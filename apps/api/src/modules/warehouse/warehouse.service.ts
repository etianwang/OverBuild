import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockDocumentStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { toCsv } from '../project/csv.util';
import {
  CreateInboundDto,
  CreateOutboundDto,
  CreateStocktakeDto,
  CreateWarehouseDto,
  UpdateInboundDto,
  UpdateOutboundDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto';
import { WarehouseRepository } from './warehouse.repository';

@Injectable()
export class WarehouseService {
  constructor(
    private readonly warehouseRepository: WarehouseRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes('admin');
  }

  private hasPerm(user: AuthUser, code: string) {
    return this.isAdmin(user) || user.permissions.includes(code);
  }

  private assertPerm(user: AuthUser, code: string, message: string) {
    if (!this.hasPerm(user, code)) throw new ForbiddenException(message);
  }

  private async applyProjectScope(
    user: AuthUser,
    where: Prisma.WarehouseWhereInput | Prisma.StockBalanceWhereInput,
    projectId?: string,
  ) {
    if (
      this.isAdmin(user) ||
      user.roles.includes('boss') ||
      user.roles.includes('warehouse') ||
      user.roles.includes('procurement')
    ) {
      if (projectId) where.projectId = projectId;
      return;
    }

    const scopeOr = [
      { project: { managerId: user.id } },
      { project: { members: { some: { userId: user.id } } } },
    ];

    if (projectId) {
      const project = await this.warehouseRepository.findProjectById(projectId);
      if (!project) throw new NotFoundException('项目不存在');
      const member = await this.warehouseRepository.isProjectMember(
        projectId,
        user.id,
      );
      if (project.managerId !== user.id && !member) {
        throw new ForbiddenException('无权限查看该项目仓库数据');
      }
      where.projectId = projectId;
      return;
    }

    Object.assign(where, { OR: scopeOr });
  }

  private async validateLines(projectId: string, items: Array<{ materialId: string }>) {
    for (const item of items) {
      const material = await this.warehouseRepository.findMaterialById(item.materialId);
      if (!material) throw new NotFoundException(`材料不存在: ${item.materialId}`);
      if (material.projectId !== projectId) {
        throw new BadRequestException(`材料 ${material.code} 不属于所选项目`);
      }
    }
  }

  private mapInbound(doc: {
    id: string;
    code: string;
    warehouseId: string;
    projectId: string;
    purchaseOrderId: string | null;
    type: string;
    status: StockDocumentStatus;
    inboundAt: Date | null;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
    warehouse?: { id: string; code: string; name: string };
    project?: { id: string; code: string; name: string };
    purchaseOrder?: { id: string; code: string } | null;
    items?: Array<{
      id: string;
      materialId: string;
      quantity: Prisma.Decimal;
      unit: string;
      material?: { id: string; code: string; name: string; unit: string };
    }>;
  }) {
    return {
      ...doc,
      items: doc.items?.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      })),
    };
  }

  // ── Warehouses ──

  async listWarehouses(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
  ) {
    this.assertPerm(user, 'warehouse.read', '无权限查看仓库');

    const where: Prisma.WarehouseWhereInput = { deletedAt: null };
    await this.applyProjectScope(user, where, projectId);
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [list, total] = await this.warehouseRepository.listWarehouses({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { code: 'asc' },
    });

    return { list, page, pageSize, total };
  }

  async createWarehouse(user: AuthUser, dto: CreateWarehouseDto) {
    this.assertPerm(user, 'warehouse.create', '无权限新增仓库');

    const project = await this.warehouseRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');

    const existing = await this.warehouseRepository.findWarehouseByCode(dto.code);
    if (existing) throw new ConflictException('仓库编号已存在');

    const created = await this.warehouseRepository.createWarehouse(dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'warehouse',
      resource: 'warehouse',
      resourceId: created.id,
      payload: { code: dto.code },
    });

    return created;
  }

  async updateWarehouse(user: AuthUser, id: string, dto: UpdateWarehouseDto) {
    this.assertPerm(user, 'warehouse.update', '无权限编辑仓库');

    const warehouse = await this.warehouseRepository.findWarehouseById(id);
    if (!warehouse) throw new NotFoundException('仓库不存在');

    const updated = await this.warehouseRepository.updateWarehouse(id, dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'warehouse',
      resource: 'warehouse',
      resourceId: id,
    });

    return updated;
  }

  async removeWarehouse(user: AuthUser, id: string) {
    this.assertPerm(user, 'warehouse.delete', '无权限停用仓库');

    const warehouse = await this.warehouseRepository.findWarehouseById(id);
    if (!warehouse) throw new NotFoundException('仓库不存在');

    await this.warehouseRepository.deactivateWarehouse(id);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'warehouse',
      resource: 'warehouse',
      resourceId: id,
    });

    return { id };
  }

  // ── Inbound ──

  async listInbounds(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
    warehouseId?: string,
  ) {
    this.assertPerm(user, 'warehouse.inbound.read', '无权限查看入库单');

    const where: Prisma.StockInboundWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { warehouse: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [list, total] = await this.warehouseRepository.listInbounds({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: list.map((item) => this.mapInbound(item)),
      page,
      pageSize,
      total,
    };
  }

  async createInbound(user: AuthUser, dto: CreateInboundDto) {
    this.assertPerm(user, 'warehouse.inbound.create', '无权限创建入库单');

    const warehouse = await this.warehouseRepository.findWarehouseById(dto.warehouseId);
    if (!warehouse) throw new NotFoundException('仓库不存在');
    if (warehouse.projectId !== dto.projectId) {
      throw new BadRequestException('仓库与项目不匹配');
    }

    const existing = await this.warehouseRepository.findInboundByCode(dto.code);
    if (existing) throw new ConflictException('入库单号已存在');

    await this.validateLines(dto.projectId, dto.items);

    const created = await this.warehouseRepository.createInbound(dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'warehouse',
      resource: 'stock_inbound',
      resourceId: created.id,
    });

    return this.mapInbound(created);
  }

  async updateInbound(user: AuthUser, id: string, dto: UpdateInboundDto) {
    this.assertPerm(user, 'warehouse.inbound.update', '无权限编辑入库单');

    const inbound = await this.warehouseRepository.findInboundById(id);
    if (!inbound) throw new NotFoundException('入库单不存在');
    if (inbound.status !== StockDocumentStatus.draft) {
      throw new BadRequestException('仅草稿状态可编辑');
    }

    if (dto.items) await this.validateLines(inbound.projectId, dto.items);

    const updated = await this.warehouseRepository.updateInbound(id, dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'warehouse',
      resource: 'stock_inbound',
      resourceId: id,
    });

    return this.mapInbound(updated);
  }

  async confirmInbound(user: AuthUser, id: string) {
    this.assertPerm(user, 'warehouse.inbound.confirm', '无权限确认入库');

    const inbound = await this.warehouseRepository.findInboundById(id);
    if (!inbound) throw new NotFoundException('入库单不存在');
    if (inbound.status !== StockDocumentStatus.draft) {
      throw new BadRequestException('仅草稿状态可确认入库');
    }
    if (!inbound.items.length) throw new BadRequestException('入库明细不能为空');

    try {
      const updated = await this.warehouseRepository.confirmInboundTransaction(id, inbound);
      await this.auditLogService.create({
        userId: user.id,
        action: 'update',
        module: 'warehouse',
        resource: 'stock_inbound',
        resourceId: id,
        payload: { action: 'confirm' },
      });
      return this.mapInbound(updated);
    } catch (err) {
      if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
        throw new BadRequestException('库存不足');
      }
      throw err;
    }
  }

  async exportInbounds(user: AuthUser, q?: string, projectId?: string) {
    this.assertPerm(user, 'warehouse.inbound.export', '无权限导出入库单');
    const result = await this.listInbounds(user, 1, 10000, q, projectId);
    const headers = ['入库单号', '仓库', '项目', '类型', '状态', '入库时间'];
    const rows = result.list.map((item) => [
      item.code,
      item.warehouse?.name ?? '',
      item.project?.name ?? '',
      item.type,
      item.status,
      item.inboundAt?.toISOString() ?? '',
    ]);
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'warehouse',
      resource: 'stock_inbound',
      payload: { count: rows.length },
    });
    return { filename: `inbound-${Date.now()}.csv`, content: toCsv(headers, rows) };
  }

  // ── Outbound ──

  async listOutbounds(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
  ) {
    this.assertPerm(user, 'warehouse.outbound.read', '无权限查看出库单');

    const where: Prisma.StockOutboundWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (q) {
      where.OR = [{ code: { contains: q, mode: 'insensitive' } }];
    }

    const [list, total] = await this.warehouseRepository.listOutbounds({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: list.map((item) => this.mapInbound(item as never)),
      page,
      pageSize,
      total,
    };
  }

  async createOutbound(user: AuthUser, dto: CreateOutboundDto) {
    this.assertPerm(user, 'warehouse.outbound.create', '无权限创建出库单');

    if (!dto.projectId) throw new BadRequestException('出库必须关联项目');

    const warehouse = await this.warehouseRepository.findWarehouseById(dto.warehouseId);
    if (!warehouse) throw new NotFoundException('仓库不存在');

    const existing = await this.warehouseRepository.findOutboundByCode(dto.code);
    if (existing) throw new ConflictException('出库单号已存在');

    await this.validateLines(dto.projectId, dto.items);

    const created = await this.warehouseRepository.createOutbound(dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'warehouse',
      resource: 'stock_outbound',
      resourceId: created.id,
    });

    return this.mapInbound(created as never);
  }

  async updateOutbound(user: AuthUser, id: string, dto: UpdateOutboundDto) {
    this.assertPerm(user, 'warehouse.outbound.update', '无权限编辑出库单');

    const outbound = await this.warehouseRepository.findOutboundById(id);
    if (!outbound) throw new NotFoundException('出库单不存在');
    if (outbound.status !== StockDocumentStatus.draft) {
      throw new BadRequestException('仅草稿状态可编辑');
    }

    if (dto.items) await this.validateLines(outbound.projectId, dto.items);

    const updated = await this.warehouseRepository.updateOutbound(id, dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'warehouse',
      resource: 'stock_outbound',
      resourceId: id,
    });

    return this.mapInbound(updated as never);
  }

  async confirmOutbound(user: AuthUser, id: string) {
    this.assertPerm(user, 'warehouse.outbound.confirm', '无权限确认出库');

    const outbound = await this.warehouseRepository.findOutboundById(id);
    if (!outbound) throw new NotFoundException('出库单不存在');
    if (outbound.status !== StockDocumentStatus.draft) {
      throw new BadRequestException('仅草稿状态可确认出库');
    }
    if (!outbound.projectId) throw new BadRequestException('出库必须关联项目');

    try {
      const updated = await this.warehouseRepository.confirmOutboundTransaction(
        id,
        outbound,
      );
      await this.auditLogService.create({
        userId: user.id,
        action: 'update',
        module: 'warehouse',
        resource: 'stock_outbound',
        resourceId: id,
        payload: { action: 'confirm' },
      });
      return this.mapInbound(updated as never);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'INSUFFICIENT_STOCK' ||
          err.message === 'INSUFFICIENT_MATERIAL_STOCK')
      ) {
        throw new BadRequestException('库存不足，无法出库');
      }
      throw err;
    }
  }

  async exportOutbounds(user: AuthUser, q?: string, projectId?: string) {
    this.assertPerm(user, 'warehouse.outbound.export', '无权限导出出库单');
    const result = await this.listOutbounds(user, 1, 10000, q, projectId);
    const headers = ['出库单号', '仓库', '项目', '类型', '状态', '出库时间'];
    const rows = result.list.map((item) => [
      item.code,
      item.warehouse?.name ?? '',
      item.project?.name ?? '',
      item.type,
      item.status,
      (item as { outboundAt?: Date | null }).outboundAt?.toISOString() ?? '',
    ]);
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'warehouse',
      resource: 'stock_outbound',
      payload: { count: rows.length },
    });
    return { filename: `outbound-${Date.now()}.csv`, content: toCsv(headers, rows) };
  }

  // ── Stocktake ──

  async listStocktakes(user: AuthUser, page = 1, pageSize = 20, projectId?: string) {
    this.assertPerm(user, 'warehouse.stocktake.read', '无权限查看盘点单');

    const where: Prisma.StocktakeWhereInput = {};
    if (projectId) where.projectId = projectId;

    const [list, total] = await this.warehouseRepository.listStocktakes({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        ...item,
        items: item.items.map((line) => ({
          ...line,
          bookQuantity: Number(line.bookQuantity),
          countedQuantity: Number(line.countedQuantity),
          difference: Number(line.countedQuantity) - Number(line.bookQuantity),
        })),
      })),
      page,
      pageSize,
      total,
    };
  }

  async createStocktake(user: AuthUser, dto: CreateStocktakeDto) {
    this.assertPerm(user, 'warehouse.stocktake.create', '无权限创建盘点');

    const warehouse = await this.warehouseRepository.findWarehouseById(dto.warehouseId);
    if (!warehouse) throw new NotFoundException('仓库不存在');

    const existing = await this.warehouseRepository.findStocktakeByCode(dto.code);
    if (existing) throw new ConflictException('盘点单号已存在');

    const items = [];
    for (const line of dto.items) {
      await this.validateLines(dto.projectId, [line]);
      const balance = await this.warehouseRepository.findBalance(
        dto.warehouseId,
        line.materialId,
        dto.projectId,
      );
      items.push({
        materialId: line.materialId,
        bookQuantity: balance ? Number(balance.quantity) : 0,
        countedQuantity: line.countedQuantity,
        unit: line.unit,
      });
    }

    const created = await this.warehouseRepository.createStocktake({
      ...dto,
      items,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'warehouse',
      resource: 'stocktake',
      resourceId: created.id,
    });

    return created;
  }

  async confirmStocktake(user: AuthUser, id: string) {
    this.assertPerm(user, 'warehouse.stocktake.confirm', '无权限确认盘点');

    const stocktake = await this.warehouseRepository.findStocktakeById(id);
    if (!stocktake) throw new NotFoundException('盘点单不存在');
    if (stocktake.status !== StockDocumentStatus.draft) {
      throw new BadRequestException('仅草稿状态可确认盘点');
    }

    try {
      const updated = await this.warehouseRepository.confirmStocktakeTransaction(
        id,
        stocktake,
      );
      await this.auditLogService.create({
        userId: user.id,
        action: 'update',
        module: 'warehouse',
        resource: 'stocktake',
        resourceId: id,
        payload: { action: 'confirm' },
      });
      return updated;
    } catch (err) {
      if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
        throw new BadRequestException('盘点调减后库存不足');
      }
      throw err;
    }
  }

  // ── Balances & Transactions ──

  async listBalances(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    projectId?: string,
    warehouseId?: string,
    q?: string,
  ) {
    this.assertPerm(user, 'warehouse.balance.read', '无权限查看库存余额');

    const where: Prisma.StockBalanceWhereInput = {};
    await this.applyProjectScope(user, where, projectId);
    if (warehouseId) where.warehouseId = warehouseId;
    if (q) {
      where.OR = [
        { material: { name: { contains: q, mode: 'insensitive' } } },
        { material: { code: { contains: q, mode: 'insensitive' } } },
        { warehouse: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [list, total] = await this.warehouseRepository.listBalances({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      })),
      page,
      pageSize,
      total,
    };
  }

  async listTransactions(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    projectId?: string,
    materialId?: string,
  ) {
    this.assertPerm(user, 'warehouse.transaction.read', '无权限查看库存流水');

    const where: Prisma.StockTransactionWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (materialId) where.materialId = materialId;

    const [list, total] = await this.warehouseRepository.listTransactions({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        balanceAfter: item.balanceAfter != null ? Number(item.balanceAfter) : null,
      })),
      page,
      pageSize,
      total,
    };
  }

  async exportBalances(user: AuthUser, projectId?: string, warehouseId?: string) {
    this.assertPerm(user, 'warehouse.balance.export', '无权限导出库存报表');
    const result = await this.listBalances(user, 1, 10000, projectId, warehouseId);
    const headers = ['仓库', '项目', '材料编号', '材料名称', '数量', '单位'];
    const rows = result.list.map((item) => [
      item.warehouse?.name ?? '',
      item.project?.name ?? '',
      item.material?.code ?? '',
      item.material?.name ?? '',
      String(item.quantity),
      item.material?.unit ?? '',
    ]);
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'warehouse',
      resource: 'stock_balance',
      payload: { count: rows.length },
    });
    return { filename: `stock-balances-${Date.now()}.csv`, content: toCsv(headers, rows) };
  }
}
