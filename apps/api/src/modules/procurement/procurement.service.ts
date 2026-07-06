import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalType,
  Prisma,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { toCsv } from '../project/csv.util';
import { WorkflowService } from '../workflow/workflow.service';
import {
  CreatePurchaseOrderDto,
  CreatePurchaseRequestDto,
  CreateQuotationDto,
  CreateSupplierDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseRequestDto,
  UpdateQuotationDto,
  UpdateSupplierDto,
} from './dto/procurement.dto';
import { ProcurementRepository } from './procurement.repository';

const REQUEST_SORT = new Set(['code', 'status', 'createdAt', 'updatedAt']);
const ORDER_SORT = new Set(['code', 'status', 'orderedAt', 'createdAt']);
const SUPPLIER_SORT = new Set(['code', 'name', 'createdAt']);

@Injectable()
export class ProcurementService {
  constructor(
    private readonly procurementRepository: ProcurementRepository,
    private readonly auditLogService: AuditLogService,
    private readonly workflowService: WorkflowService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes('admin');
  }

  private hasPerm(user: AuthUser, code: string) {
    return this.isAdmin(user) || user.permissions.includes(code);
  }

  private assertPerm(user: AuthUser, code: string, message: string) {
    if (!this.hasPerm(user, code)) {
      throw new ForbiddenException(message);
    }
  }

  private toMoney(amount: Prisma.Decimal, currency: string) {
    return { amount: Number(amount), currency };
  }

  private mapRequest(request: {
    id: string;
    code: string;
    projectId: string;
    requesterId: string;
    status: PurchaseRequestStatus;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; code: string; name: string };
    requester?: { id: string; name: string };
    items?: Array<{
      id: string;
      materialId: string;
      quantity: Prisma.Decimal;
      unit: string;
      material?: { id: string; code: string; name: string; unit: string };
    }>;
  }) {
    return {
      id: request.id,
      code: request.code,
      projectId: request.projectId,
      requesterId: request.requesterId,
      status: request.status,
      remark: request.remark,
      project: request.project,
      requester: request.requester,
      items: request.items?.map((item) => ({
        id: item.id,
        materialId: item.materialId,
        quantity: Number(item.quantity),
        unit: item.unit,
        material: item.material,
      })),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private mapOrder(order: {
    id: string;
    code: string;
    projectId: string;
    supplierId: string;
    requestId: string | null;
    totalAmount: Prisma.Decimal;
    totalCurrency: string;
    status: PurchaseOrderStatus;
    orderedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; code: string; name: string };
    supplier?: { id: string; code: string; name: string };
    request?: { id: string; code: string; status: PurchaseRequestStatus } | null;
    items?: Array<{
      id: string;
      materialId: string;
      quantity: Prisma.Decimal;
      unit: string;
      unitPriceAmount: Prisma.Decimal;
      unitPriceCurrency: string;
      material?: { id: string; code: string; name: string; unit: string };
    }>;
  }) {
    return {
      id: order.id,
      code: order.code,
      projectId: order.projectId,
      supplierId: order.supplierId,
      requestId: order.requestId,
      totalAmount: this.toMoney(order.totalAmount, order.totalCurrency),
      status: order.status,
      orderedAt: order.orderedAt,
      project: order.project,
      supplier: order.supplier,
      request: order.request,
      items: order.items?.map((item) => ({
        id: item.id,
        materialId: item.materialId,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: this.toMoney(item.unitPriceAmount, item.unitPriceCurrency),
        material: item.material,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private async applyProjectScope(
    user: AuthUser,
    where: Prisma.PurchaseRequestWhereInput | Prisma.PurchaseOrderWhereInput,
    projectId?: string,
  ) {
    if (
      this.isAdmin(user) ||
      user.roles.includes('boss') ||
      user.roles.includes('procurement') ||
      user.roles.includes('finance')
    ) {
      if (projectId) where.projectId = projectId;
      return;
    }

    const scopeOr: Prisma.PurchaseRequestWhereInput[] = [
      { project: { managerId: user.id } },
      { project: { members: { some: { userId: user.id } } } },
      { requesterId: user.id },
    ];

    if (projectId) {
      const project = await this.procurementRepository.findProjectById(projectId);
      if (!project) throw new NotFoundException('项目不存在');
      const member = await this.procurementRepository.isProjectMember(
        projectId,
        user.id,
      );
      if (project.managerId !== user.id && !member && !this.hasPerm(user, 'procurement.request.create')) {
        throw new ForbiddenException('无权限查看该项目采购数据');
      }
      where.projectId = projectId;
      return;
    }

    Object.assign(where, { OR: scopeOr });
  }

  private async validateRequestItems(
    projectId: string,
    items: Array<{ materialId: string; quantity: number; unit: string }>,
  ) {
    for (const item of items) {
      const material = await this.procurementRepository.findMaterialById(
        item.materialId,
      );
      if (!material) {
        throw new NotFoundException(`材料不存在: ${item.materialId}`);
      }
      if (material.projectId !== projectId) {
        throw new BadRequestException(
          `材料 ${material.code} 不属于所选项目，专款专料专用`,
        );
      }
    }
  }

  async syncRequestApproval(businessId: string, result: 'approved' | 'rejected') {
    const request = await this.procurementRepository.findRequestById(businessId);
    if (!request) return;

    const status =
      result === 'approved'
        ? PurchaseRequestStatus.approved
        : PurchaseRequestStatus.rejected;
    await this.procurementRepository.updateRequestStatus(businessId, status);
  }

  // ── Purchase Requests ──

  async listRequests(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
    status?: PurchaseRequestStatus,
    sort = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ) {
    this.assertPerm(user, 'procurement.request.read', '无权限查看采购申请');

    const where: Prisma.PurchaseRequestWhereInput = { deletedAt: null };
    await this.applyProjectScope(user, where, projectId);
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { remark: { contains: q, mode: 'insensitive' } },
        { project: { name: { contains: q, mode: 'insensitive' } } },
        { items: { some: { material: { name: { contains: q, mode: 'insensitive' } } } } },
      ];
    }

    const orderBy = {
      [REQUEST_SORT.has(sort) ? sort : 'createdAt']: order,
    } as Prisma.PurchaseRequestOrderByWithRelationInput;

    const [list, total] = await this.procurementRepository.findRequests({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy,
    });

    return {
      list: list.map((item) => this.mapRequest(item)),
      page,
      pageSize,
      total,
    };
  }

  async createRequest(user: AuthUser, dto: CreatePurchaseRequestDto) {
    this.assertPerm(user, 'procurement.request.create', '无权限创建采购申请');

    const project = await this.procurementRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');

    const existing = await this.procurementRepository.findRequestByCode(dto.code);
    if (existing) throw new ConflictException('申请单号已存在');

    await this.validateRequestItems(dto.projectId, dto.items);

    const created = await this.procurementRepository.createRequest({
      code: dto.code,
      projectId: dto.projectId,
      requesterId: user.id,
      remark: dto.remark,
      items: dto.items,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'procurement',
      resource: 'purchase_request',
      resourceId: created.id,
      payload: { code: dto.code, projectId: dto.projectId },
    });

    return this.mapRequest(created);
  }

  async updateRequest(user: AuthUser, id: string, dto: UpdatePurchaseRequestDto) {
    this.assertPerm(user, 'procurement.request.update', '无权限编辑采购申请');

    const request = await this.procurementRepository.findRequestById(id);
    if (!request) throw new NotFoundException('采购申请不存在');
    if (request.status !== PurchaseRequestStatus.draft) {
      throw new BadRequestException('仅草稿状态可编辑');
    }

    if (dto.items) {
      await this.validateRequestItems(request.projectId, dto.items);
    }

    const updated = await this.procurementRepository.updateRequest(id, dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'procurement',
      resource: 'purchase_request',
      resourceId: id,
    });

    return this.mapRequest(updated);
  }

  async submitRequest(user: AuthUser, id: string) {
    this.assertPerm(user, 'procurement.request.submit', '无权限提交采购申请');

    const request = await this.procurementRepository.findRequestById(id);
    if (!request) throw new NotFoundException('采购申请不存在');
    if (request.status !== PurchaseRequestStatus.draft) {
      throw new BadRequestException('仅草稿状态可提交审批');
    }
    if (!request.items.length) {
      throw new BadRequestException('申请明细不能为空');
    }

    await this.workflowService.create(user, {
      type: ApprovalType.purchase_request,
      businessId: id,
      projectId: request.projectId,
      metadata: {
        code: request.code,
        itemCount: request.items.length,
      },
    });

    const updated = await this.procurementRepository.updateRequest(id, {
      status: PurchaseRequestStatus.pending,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'procurement',
      resource: 'purchase_request',
      resourceId: id,
      payload: { action: 'submit' },
    });

    return this.mapRequest(updated);
  }

  async exportRequests(
    user: AuthUser,
    q?: string,
    projectId?: string,
    status?: PurchaseRequestStatus,
  ) {
    this.assertPerm(user, 'procurement.request.export', '无权限导出采购申请');

    const result = await this.listRequests(user, 1, 10000, q, projectId, status);
    const rows = result.list.map((item) => [
      item.code,
      item.project?.name ?? '',
      item.status,
      item.requester?.name ?? '',
      String(item.items?.length ?? 0),
      item.remark ?? '',
      item.createdAt.toISOString(),
    ]);
    const headers = [
      '申请单号',
      '项目',
      '状态',
      '申请人',
      '明细数',
      '备注',
      '创建时间',
    ];

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'procurement',
      resource: 'purchase_request',
      payload: { count: rows.length },
    });

    return {
      filename: `purchase-requests-${Date.now()}.csv`,
      content: toCsv(headers, rows),
    };
  }

  // ── Purchase Orders ──

  async listOrders(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
    status?: PurchaseOrderStatus,
    sort = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ) {
    this.assertPerm(user, 'procurement.order.read', '无权限查看采购订单');

    const where: Prisma.PurchaseOrderWhereInput = { deletedAt: null };
    await this.applyProjectScope(user, where, projectId);
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
        { project: { name: { contains: q, mode: 'insensitive' } } },
        { items: { some: { material: { name: { contains: q, mode: 'insensitive' } } } } },
      ];
    }

    const orderBy = {
      [ORDER_SORT.has(sort) ? sort : 'createdAt']: order,
    } as Prisma.PurchaseOrderOrderByWithRelationInput;

    const [list, total] = await this.procurementRepository.findOrders({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy,
    });

    return {
      list: list.map((item) => this.mapOrder(item)),
      page,
      pageSize,
      total,
    };
  }

  async createOrder(user: AuthUser, dto: CreatePurchaseOrderDto) {
    this.assertPerm(user, 'procurement.order.create', '无权限创建采购订单');

    if (!dto.projectId || !dto.supplierId) {
      throw new BadRequestException('采购订单必须关联项目和供应商');
    }

    const project = await this.procurementRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');

    const supplier = await this.procurementRepository.findSupplierById(dto.supplierId);
    if (!supplier) throw new NotFoundException('供应商不存在');

    if (dto.requestId) {
      const request = await this.procurementRepository.findRequestById(dto.requestId);
      if (!request) throw new NotFoundException('采购申请不存在');
      if (request.status !== PurchaseRequestStatus.approved) {
        throw new BadRequestException('采购申请须经项目主管审批通过后方可下单');
      }
      if (request.projectId !== dto.projectId) {
        throw new BadRequestException('订单项目须与申请项目一致');
      }
    }

    const existing = await this.procurementRepository.findOrderByCode(dto.code);
    if (existing) throw new ConflictException('订单号已存在');

    await this.validateRequestItems(dto.projectId, dto.items);

    let totalAmount = 0;
    let totalCurrency = dto.items[0].unitPrice.currency;
    for (const item of dto.items) {
      totalAmount += item.quantity * item.unitPrice.amount;
      totalCurrency = item.unitPrice.currency;
    }

    const created = await this.procurementRepository.createOrder({
      code: dto.code,
      projectId: dto.projectId,
      supplierId: dto.supplierId,
      requestId: dto.requestId,
      totalAmount,
      totalCurrency,
      items: dto.items.map((item) => ({
        materialId: item.materialId,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceAmount: item.unitPrice.amount,
        unitPriceCurrency: item.unitPrice.currency,
      })),
    });

    for (const item of dto.items) {
      await this.procurementRepository.appendPriceHistory({
        materialId: item.materialId,
        amount: item.unitPrice.amount,
        currency: item.unitPrice.currency,
        supplierId: dto.supplierId,
      });
      await this.procurementRepository.updateMaterialPurchasePrice(
        item.materialId,
        item.unitPrice.amount,
        item.unitPrice.currency,
        dto.supplierId,
      );
    }

    if (dto.requestId) {
      await this.procurementRepository.updateRequestStatus(
        dto.requestId,
        PurchaseRequestStatus.ordered,
      );
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'procurement',
      resource: 'purchase_order',
      resourceId: created.id,
      payload: { code: dto.code, projectId: dto.projectId, supplierId: dto.supplierId },
    });

    return this.mapOrder(created);
  }

  async updateOrder(user: AuthUser, id: string, dto: UpdatePurchaseOrderDto) {
    this.assertPerm(user, 'procurement.order.update', '无权限编辑采购订单');

    const order = await this.procurementRepository.findOrderById(id);
    if (!order) throw new NotFoundException('采购订单不存在');
    if (order.status !== PurchaseOrderStatus.confirmed) {
      throw new BadRequestException('仅已确认订单可编辑');
    }

    if (dto.supplierId) {
      const supplier = await this.procurementRepository.findSupplierById(dto.supplierId);
      if (!supplier) throw new NotFoundException('供应商不存在');
    }

    let updateData: Parameters<ProcurementRepository['updateOrder']>[1] = {
      supplierId: dto.supplierId,
    };

    if (dto.items) {
      await this.validateRequestItems(order.projectId, dto.items);
      let totalAmount = 0;
      let totalCurrency = dto.items[0].unitPrice.currency;
      for (const item of dto.items) {
        totalAmount += item.quantity * item.unitPrice.amount;
        totalCurrency = item.unitPrice.currency;
      }
      updateData = {
        ...updateData,
        items: dto.items.map((item) => ({
          materialId: item.materialId,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceAmount: item.unitPrice.amount,
          unitPriceCurrency: item.unitPrice.currency,
        })),
        totalAmount,
        totalCurrency,
      };
    }

    const updated = await this.procurementRepository.updateOrder(id, updateData);

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'procurement',
      resource: 'purchase_order',
      resourceId: id,
    });

    return this.mapOrder(updated);
  }

  async receiveOrder(user: AuthUser, id: string) {
    this.assertPerm(user, 'procurement.order.receive', '无权限确认到货');

    const order = await this.procurementRepository.findOrderById(id);
    if (!order) throw new NotFoundException('采购订单不存在');
    if (
      order.status !== PurchaseOrderStatus.confirmed &&
      order.status !== PurchaseOrderStatus.partial
    ) {
      throw new BadRequestException('当前状态不可确认到货');
    }

    const updated = await this.procurementRepository.updateOrder(id, {
      status: PurchaseOrderStatus.received,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'procurement',
      resource: 'purchase_order',
      resourceId: id,
      payload: { action: 'receive', note: '仓库入库模块接入后可自动创建入库单' },
    });

    return this.mapOrder(updated);
  }

  async exportOrders(
    user: AuthUser,
    q?: string,
    projectId?: string,
    status?: PurchaseOrderStatus,
  ) {
    this.assertPerm(user, 'procurement.order.export', '无权限导出采购订单');

    const result = await this.listOrders(user, 1, 10000, q, projectId, status);
    const rows = result.list.map((item) => [
      item.code,
      item.project?.name ?? '',
      item.supplier?.name ?? '',
      String(item.totalAmount.amount),
      item.totalAmount.currency,
      item.status,
      item.orderedAt?.toISOString() ?? '',
    ]);
    const headers = [
      '订单号',
      '项目',
      '供应商',
      '总额',
      '币种',
      '状态',
      '下单时间',
    ];

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'procurement',
      resource: 'purchase_order',
      payload: { count: rows.length },
    });

    return {
      filename: `purchase-orders-${Date.now()}.csv`,
      content: toCsv(headers, rows),
    };
  }

  // ── Suppliers ──

  async listSuppliers(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    sort = 'code',
    order: 'asc' | 'desc' = 'asc',
  ) {
    this.assertPerm(user, 'procurement.supplier.read', '无权限查看供应商');

    const where: Prisma.SupplierWhereInput = { deletedAt: null };
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { contact: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy = {
      [SUPPLIER_SORT.has(sort) ? sort : 'code']: order,
    } as Prisma.SupplierOrderByWithRelationInput;

    const [list, total] = await this.procurementRepository.findSuppliers({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy,
    });

    return { list, page, pageSize, total };
  }

  async createSupplier(user: AuthUser, dto: CreateSupplierDto) {
    this.assertPerm(user, 'procurement.supplier.create', '无权限新增供应商');

    const existing = await this.procurementRepository.findSupplierByCode(dto.code);
    if (existing) throw new ConflictException('供应商编号已存在');

    const created = await this.procurementRepository.createSupplier(dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'procurement',
      resource: 'supplier',
      resourceId: created.id,
      payload: { code: dto.code },
    });

    return created;
  }

  async updateSupplier(user: AuthUser, id: string, dto: UpdateSupplierDto) {
    this.assertPerm(user, 'procurement.supplier.update', '无权限编辑供应商');

    const supplier = await this.procurementRepository.findSupplierById(id);
    if (!supplier) throw new NotFoundException('供应商不存在');

    const updated = await this.procurementRepository.updateSupplier(id, dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'procurement',
      resource: 'supplier',
      resourceId: id,
    });

    return updated;
  }

  async removeSupplier(user: AuthUser, id: string) {
    this.assertPerm(user, 'procurement.supplier.delete', '无权限删除供应商');

    const supplier = await this.procurementRepository.findSupplierById(id);
    if (!supplier) throw new NotFoundException('供应商不存在');

    const orderCount = await this.procurementRepository.countOrdersBySupplier(id);
    if (orderCount > 0) {
      throw new BadRequestException('供应商存在关联订单，无法删除');
    }

    await this.procurementRepository.softDeleteSupplier(id);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'procurement',
      resource: 'supplier',
      resourceId: id,
    });

    return { id };
  }

  async exportSuppliers(user: AuthUser, q?: string) {
    this.assertPerm(user, 'procurement.supplier.export', '无权限导出供应商');

    const result = await this.listSuppliers(user, 1, 10000, q);
    const rows = result.list.map((item) => [
      item.code,
      item.name,
      item.contact ?? '',
      item.phone ?? '',
      item.email ?? '',
      item.address ?? '',
    ]);
    const headers = ['编号', '名称', '联系人', '电话', '邮箱', '地址'];

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'procurement',
      resource: 'supplier',
      payload: { count: rows.length },
    });

    return {
      filename: `suppliers-${Date.now()}.csv`,
      content: toCsv(headers, rows),
    };
  }

  // ── Quotations ──

  async listQuotations(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    requestId?: string,
    supplierId?: string,
  ) {
    this.assertPerm(user, 'procurement.quotation.read', '无权限查看询价');

    const where: Prisma.QuotationWhereInput = {};
    if (requestId) where.requestId = requestId;
    if (supplierId) where.supplierId = supplierId;

    const [list, total] = await this.procurementRepository.findQuotations({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        ...item,
        price: this.toMoney(item.amount, item.currency),
      })),
      page,
      pageSize,
      total,
    };
  }

  async createQuotation(user: AuthUser, dto: CreateQuotationDto) {
    this.assertPerm(user, 'procurement.quotation.create', '无权限创建询价');

    const supplier = await this.procurementRepository.findSupplierById(dto.supplierId);
    if (!supplier) throw new NotFoundException('供应商不存在');

    if (dto.requestId) {
      const request = await this.procurementRepository.findRequestById(dto.requestId);
      if (!request) throw new NotFoundException('采购申请不存在');
    }

    const existing = await this.procurementRepository.findQuotationByCode(dto.code);
    if (existing) throw new ConflictException('询价单号已存在');

    const created = await this.procurementRepository.createQuotation({
      code: dto.code,
      supplierId: dto.supplierId,
      requestId: dto.requestId,
      materialId: dto.materialId,
      amount: dto.price.amount,
      currency: dto.price.currency,
      remark: dto.remark,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'procurement',
      resource: 'quotation',
      resourceId: created.id,
    });

    return { ...created, price: this.toMoney(created.amount, created.currency) };
  }

  async updateQuotation(user: AuthUser, id: string, dto: UpdateQuotationDto) {
    this.assertPerm(user, 'procurement.quotation.update', '无权限更新询价');

    const quotation = await this.procurementRepository.findQuotationById(id);
    if (!quotation) throw new NotFoundException('询价记录不存在');

    const updated = await this.procurementRepository.updateQuotation(id, {
      amount: dto.price?.amount,
      currency: dto.price?.currency,
      status: dto.status,
      remark: dto.remark,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'procurement',
      resource: 'quotation',
      resourceId: id,
    });

    return { ...updated, price: this.toMoney(updated.amount, updated.currency) };
  }
}
