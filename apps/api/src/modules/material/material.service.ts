import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, MaterialDiscipline } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { parseCsv, toCsv } from '../project/csv.util';
import {
  CreateMaterialCategoryDto,
  CreateMaterialDto,
  ImportMaterialsDto,
  MoneyDto,
  UpdateMaterialCategoryDto,
  UpdateMaterialDto,
} from './dto/material.dto';
import { MaterialRepository } from './material.repository';

const SORTABLE_FIELDS = new Set([
  'code',
  'name',
  'stock',
  'createdAt',
  'updatedAt',
]);

@Injectable()
export class MaterialService {
  constructor(
    private readonly materialRepository: MaterialRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes('admin');
  }

  private assertRead(user: AuthUser) {
    if (
      !this.isAdmin(user) &&
      !user.permissions.includes('material.read') &&
      !user.permissions.includes('material.export')
    ) {
      throw new ForbiddenException('无权限查看材料');
    }
  }

  private assertWrite(user: AuthUser) {
    if (!this.isAdmin(user) && !user.permissions.includes('material.create')) {
      throw new ForbiddenException('无权限操作材料');
    }
  }

  private assertUpdate(user: AuthUser) {
    if (!this.isAdmin(user) && !user.permissions.includes('material.update')) {
      throw new ForbiddenException('无权限编辑材料');
    }
  }

  private assertDelete(user: AuthUser) {
    if (!this.isAdmin(user) && !user.permissions.includes('material.delete')) {
      throw new ForbiddenException('无权限删除材料');
    }
  }

  private assertCategoryManage(user: AuthUser) {
    if (
      !this.isAdmin(user) &&
      !user.permissions.includes('material.category.manage')
    ) {
      throw new ForbiddenException('无权限管理材料分类');
    }
  }

  private toMoney(
    amount: Prisma.Decimal | null | undefined,
    currency: string | null | undefined,
  ) {
    if (amount == null || !currency) return null;
    return { amount: Number(amount), currency };
  }

  private mapMaterial(material: {
    id: string;
    code: string;
    name: string;
    spec: string | null;
    brand: string | null;
    model: string | null;
    unit: string;
    categoryId: string;
    projectId: string;
    storageLocation: string | null;
    warehouseId: string | null;
    stock: Prisma.Decimal;
    minStock: Prisma.Decimal | null;
    purchasePriceAmount: Prisma.Decimal | null;
    purchasePriceCurrency: string | null;
    imageUrl: string | null;
    supplierId: string | null;
    createdAt: Date;
    updatedAt: Date;
    category?: {
      id: string;
      code: string;
      name: string;
      discipline: MaterialDiscipline;
    };
    project?: { id: string; code: string; name: string };
    priceHistory?: Array<{
      id: string;
      amount: Prisma.Decimal;
      currency: string;
      supplierId: string | null;
      effectiveAt: Date;
    }>;
    qrcode?: { qrcodeUrl: string; payload: string } | null;
  }) {
    const latest = material.priceHistory?.[0];
    return {
      id: material.id,
      code: material.code,
      name: material.name,
      spec: material.spec,
      brand: material.brand,
      model: material.model,
      unit: material.unit,
      categoryId: material.categoryId,
      projectId: material.projectId,
      storageLocation: material.storageLocation,
      warehouseId: material.warehouseId,
      stock: Number(material.stock),
      minStock: material.minStock != null ? Number(material.minStock) : null,
      purchasePrice: this.toMoney(
        material.purchasePriceAmount,
        material.purchasePriceCurrency,
      ),
      latestPrice: latest
        ? { amount: Number(latest.amount), currency: latest.currency }
        : null,
      imageUrl: material.imageUrl,
      supplierId: material.supplierId,
      category: material.category,
      project: material.project,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
      qrcode: material.qrcode ?? null,
    };
  }

  private async applyProjectScope(
    user: AuthUser,
    where: Prisma.MaterialWhereInput,
    projectId?: string,
  ) {
    if (this.isAdmin(user) || user.roles.includes('boss')) {
      if (projectId) where.projectId = projectId;
      return;
    }

    const scopeOr: Prisma.MaterialWhereInput[] = [
      { project: { managerId: user.id } },
      { project: { members: { some: { userId: user.id } } } },
    ];

    if (projectId) {
      const project = await this.materialRepository.findProjectById(projectId);
      if (!project) {
        throw new NotFoundException('项目不存在');
      }
      const isManager = project.managerId === user.id;
      const member = await this.materialRepository.isProjectMember(
        projectId,
        user.id,
      );
      if (!isManager && !member) {
        throw new ForbiddenException('无权限查看该项目材料');
      }
      where.projectId = projectId;
      return;
    }

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: scopeOr },
    ];
  }

  private buildWhere(
    q?: string,
    categoryId?: string,
    discipline?: MaterialDiscipline,
  ): Prisma.MaterialWhereInput {
    const where: Prisma.MaterialWhereInput = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    if (discipline) {
      where.category = { discipline };
    }
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { spec: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { storageLocation: { contains: q, mode: 'insensitive' } },
        { project: { name: { contains: q, mode: 'insensitive' } } },
        { project: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  async list(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    sort = 'code',
    order: 'asc' | 'desc' = 'asc',
    categoryId?: string,
    projectId?: string,
    discipline?: MaterialDiscipline,
  ) {
    this.assertRead(user);
    const sortField = SORTABLE_FIELDS.has(sort) ? sort : 'code';
    const skip = (page - 1) * pageSize;
    const where = this.buildWhere(q, categoryId, discipline);
    await this.applyProjectScope(user, where, projectId);
    const [list, total] = await this.materialRepository.findMany({
      skip,
      take: pageSize,
      where,
      orderBy: { [sortField]: order },
    });
    return {
      list: list.map((item) => this.mapMaterial(item)),
      page,
      pageSize,
      total,
    };
  }

  async getOne(user: AuthUser, id: string) {
    this.assertRead(user);
    const material = await this.materialRepository.findById(id);
    if (!material) {
      throw new NotFoundException('材料不存在');
    }
    const where: Prisma.MaterialWhereInput = { id };
    await this.applyProjectScope(user, where);
    const [allowed] = await this.materialRepository.findMany({
      skip: 0,
      take: 1,
      where,
      orderBy: { code: 'asc' },
    });
    if (!allowed) {
      throw new ForbiddenException('无权限查看此材料');
    }
    return this.mapMaterial(material);
  }

  private async validateProject(projectId: string) {
    const project = await this.materialRepository.findProjectById(projectId);
    if (!project) {
      throw new BadRequestException('归属项目不存在');
    }
    return project;
  }

  private async validateCategory(categoryId: string) {
    const category = await this.materialRepository.findCategoryById(categoryId);
    if (!category) {
      throw new BadRequestException('材料分类不存在');
    }
    return category;
  }

  private async recordPriceIfNeeded(
    materialId: string,
    purchasePrice?: MoneyDto | null,
    supplierId?: string | null,
  ) {
    if (!purchasePrice) return;
    await this.materialRepository.appendPriceHistory({
      materialId,
      amount: purchasePrice.amount,
      currency: purchasePrice.currency.toUpperCase(),
      supplierId: supplierId ?? undefined,
    });
  }

  async create(user: AuthUser, dto: CreateMaterialDto) {
    this.assertWrite(user);
    await this.validateCategory(dto.categoryId);
    await this.validateProject(dto.projectId);

    const existing = await this.materialRepository.findByCodeInProject(
      dto.projectId,
      dto.code,
    );
    if (existing) {
      throw new ConflictException('该项目下材料编号已存在');
    }

    const material = await this.materialRepository.create({
      code: dto.code,
      name: dto.name,
      spec: dto.spec,
      brand: dto.brand,
      model: dto.model,
      unit: dto.unit,
      category: { connect: { id: dto.categoryId } },
      project: { connect: { id: dto.projectId } },
      storageLocation: dto.storageLocation,
      warehouseId: dto.warehouseId,
      minStock: dto.minStock,
      purchasePriceAmount: dto.purchasePrice?.amount,
      purchasePriceCurrency: dto.purchasePrice?.currency.toUpperCase(),
      imageUrl: dto.imageUrl,
      supplierId: dto.supplierId,
    });

    if (dto.purchasePrice) {
      await this.recordPriceIfNeeded(
        material.id,
        dto.purchasePrice,
        dto.supplierId,
      );
      const refreshed = await this.materialRepository.findById(material.id);
      if (refreshed) {
        await this.auditLogService.create({
          userId: user.id,
          action: 'create',
          module: 'material',
          resource: 'material',
          resourceId: material.id,
          payload: { code: dto.code, price: dto.purchasePrice },
        });
        return this.mapMaterial(refreshed);
      }
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'material',
      resource: 'material',
      resourceId: material.id,
      payload: { code: dto.code },
    });

    return this.mapMaterial(material);
  }

  async update(user: AuthUser, id: string, dto: UpdateMaterialDto) {
    this.assertUpdate(user);
    const material = await this.materialRepository.findById(id);
    if (!material) {
      throw new NotFoundException('材料不存在');
    }

    if (dto.code && dto.code !== material.code) {
      const projectId = dto.projectId ?? material.projectId;
      const dup = await this.materialRepository.findByCodeInProject(
        projectId,
        dto.code,
      );
      if (dup && dup.id !== id) {
        throw new ConflictException('该项目下材料编号已存在');
      }
    }

    if (dto.projectId) {
      await this.validateProject(dto.projectId);
    }

    if (dto.categoryId) {
      await this.validateCategory(dto.categoryId);
    }

    const priceChanged =
      dto.purchasePrice &&
      (Number(material.purchasePriceAmount ?? 0) !== dto.purchasePrice.amount ||
        material.purchasePriceCurrency !==
          dto.purchasePrice.currency.toUpperCase());

    const updated = await this.materialRepository.update(id, {
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.spec !== undefined ? { spec: dto.spec } : {}),
      ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
      ...(dto.model !== undefined ? { model: dto.model } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.categoryId !== undefined
        ? { category: { connect: { id: dto.categoryId } } }
        : {}),
      ...(dto.projectId !== undefined
        ? { project: { connect: { id: dto.projectId } } }
        : {}),
      ...(dto.storageLocation !== undefined
        ? { storageLocation: dto.storageLocation }
        : {}),
      ...(dto.warehouseId !== undefined ? { warehouseId: dto.warehouseId } : {}),
      ...(dto.minStock !== undefined ? { minStock: dto.minStock } : {}),
      ...(dto.purchasePrice !== undefined
        ? {
            purchasePriceAmount: dto.purchasePrice?.amount ?? null,
            purchasePriceCurrency:
              dto.purchasePrice?.currency.toUpperCase() ?? null,
          }
        : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
    });

    if (priceChanged && dto.purchasePrice) {
      await this.recordPriceIfNeeded(
        id,
        dto.purchasePrice,
        dto.supplierId ?? material.supplierId,
      );
      await this.auditLogService.create({
        userId: user.id,
        action: 'update',
        module: 'material',
        resource: 'material_price',
        resourceId: id,
        payload: dto.purchasePrice,
      });
    }

    const refreshed = await this.materialRepository.findById(id);
    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'material',
      resource: 'material',
      resourceId: id,
      payload: dto,
    });

    return this.mapMaterial(refreshed ?? updated);
  }

  async remove(user: AuthUser, id: string) {
    this.assertDelete(user);
    const material = await this.materialRepository.findById(id);
    if (!material) {
      throw new NotFoundException('材料不存在');
    }

    if (Number(material.stock) > 0) {
      throw new BadRequestException('材料仍有库存，无法删除');
    }

    const txCount = await this.materialRepository.countStockTransactions(id);
    if (txCount > 0) {
      throw new BadRequestException('材料存在库存流水，无法删除');
    }

    await this.materialRepository.softDelete(id);
    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'material',
      resource: 'material',
      resourceId: id,
      payload: { code: material.code },
    });
    return null;
  }

  async import(user: AuthUser, dto: ImportMaterialsDto) {
    this.assertWrite(user);
    if (!this.isAdmin(user) && !user.permissions.includes('material.import')) {
      throw new ForbiddenException('无权限导入材料');
    }

    const rows = parseCsv(dto.content);
    if (!rows.length) {
      throw new BadRequestException('导入内容为空或格式无效');
    }

    const categories = await this.materialRepository.listCategories();
    const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = i + 2;
      const code = row.code || row['编号'];
      const name = row.name || row['名称'];
      const unit = row.unit || row['单位'];
      const categoryCode = row.categoryCode || row['分类编号'];
      const projectCode = row.projectCode || row['项目编号'];

      if (!code || !name || !unit || !categoryCode || !projectCode) {
        errors.push(`第 ${line} 行：缺少编号/名称/单位/分类编号/项目编号`);
        continue;
      }

      const categoryId = categoryByCode.get(categoryCode);
      if (!categoryId) {
        errors.push(`第 ${line} 行：分类 ${categoryCode} 不存在`);
        continue;
      }

      const resolvedProject =
        await this.materialRepository.findProjectByCode(projectCode);
      if (!resolvedProject) {
        errors.push(`第 ${line} 行：项目 ${projectCode} 不存在`);
        continue;
      }

      const existing = await this.materialRepository.findByCodeInProject(
        resolvedProject.id,
        code,
      );
      if (existing) {
        errors.push(`第 ${line} 行：项目 ${projectCode} 下编号 ${code} 已存在`);
        continue;
      }

      const minStock = row.minStock || row['最低库存'];
      const amount = row.priceAmount || row['采购价'];
      const currency = row.priceCurrency || row['币种'] || 'CNY';
      const storageLocation =
        row.storageLocation || row['储存位置'] || undefined;

      await this.materialRepository.create({
        code,
        name,
        spec: row.spec || row['规格'],
        brand: row.brand || row['品牌'],
        model: row.model || row['型号'],
        unit,
        category: { connect: { id: categoryId } },
        project: { connect: { id: resolvedProject.id } },
        storageLocation,
        minStock: minStock ? Number(minStock) : undefined,
        purchasePriceAmount: amount ? Number(amount) : undefined,
        purchasePriceCurrency: amount ? currency.toUpperCase() : undefined,
      });

      imported += 1;
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'material',
      resource: 'material_import',
      payload: { imported, errors: errors.length },
    });

    return { imported, errors, total: rows.length };
  }

  async export(
    user: AuthUser,
    q?: string,
    categoryId?: string,
    sort = 'code',
    order: 'asc' | 'desc' = 'asc',
    projectId?: string,
    discipline?: MaterialDiscipline,
  ) {
    if (
      !this.isAdmin(user) &&
      !user.permissions.includes('material.export')
    ) {
      throw new ForbiddenException('无权限导出材料');
    }

    const sortField = SORTABLE_FIELDS.has(sort) ? sort : 'code';
    const where = this.buildWhere(q, categoryId, discipline);
    await this.applyProjectScope(user, where, projectId);
    const [list] = await this.materialRepository.findMany({
      skip: 0,
      take: 5000,
      where,
      orderBy: { [sortField]: order },
    });

    const headers = [
      'code',
      'name',
      'projectCode',
      'storageLocation',
      'discipline',
      'spec',
      'brand',
      'model',
      'unit',
      'category',
      'stock',
      'minStock',
      'latestPrice',
      'currency',
    ];
    const rows = list.map((item) => {
      const latest = item.priceHistory?.[0];
      return [
        item.code,
        item.name,
        item.project?.code ?? '',
        item.storageLocation ?? '',
        item.category?.discipline ?? '',
        item.spec ?? '',
        item.brand ?? '',
        item.model ?? '',
        item.unit,
        item.category?.name ?? '',
        String(item.stock),
        item.minStock != null ? String(item.minStock) : '',
        latest ? String(latest.amount) : '',
        latest?.currency ?? '',
      ];
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'material',
      resource: 'material',
      payload: { count: rows.length },
    });

    return {
      filename: `materials-${Date.now()}.csv`,
      content: toCsv(headers, rows),
    };
  }

  async listAlerts(user: AuthUser, page = 1, pageSize = 20) {
    this.assertRead(user);
    const skip = (page - 1) * pageSize;
    const [rows, countRows] = await Promise.all([
      this.materialRepository.findAlerts({ skip, take: pageSize }),
      this.materialRepository.countAlerts(),
    ]);
    const categories = await this.materialRepository.listCategories();
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const list = rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      stock: Number(row.stock),
      minStock: Number(row.min_stock),
      unit: row.unit,
      category: categoryMap.get(row.category_id) ?? null,
      gap: Number(row.min_stock) - Number(row.stock),
    }));

    return {
      list,
      page,
      pageSize,
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async listStockTransactions(
    user: AuthUser,
    id: string,
    page = 1,
    pageSize = 20,
  ) {
    this.assertRead(user);
    const material = await this.materialRepository.findById(id);
    if (!material) {
      throw new NotFoundException('材料不存在');
    }
    const skip = (page - 1) * pageSize;
    const [list, total] = await this.materialRepository.listStockTransactions(
      id,
      skip,
      pageSize,
    );
    return {
      list: list.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        balanceAfter:
          item.balanceAfter != null ? Number(item.balanceAfter) : null,
      })),
      page,
      pageSize,
      total,
    };
  }

  async getQrcode(user: AuthUser, id: string) {
    this.assertRead(user);
    const material = await this.materialRepository.findById(id);
    if (!material) {
      throw new NotFoundException('材料不存在');
    }

    const webBase = process.env.WEB_URL ?? 'http://localhost:3000';
    const payload = `${webBase}/materials?code=${encodeURIComponent(material.code)}`;
    const qrcode = await this.materialRepository.upsertQrcode(
      id,
      payload,
      material.code,
    );

    return {
      materialId: id,
      code: material.code,
      payload: qrcode.payload,
      qrcodeUrl: qrcode.qrcodeUrl,
    };
  }

  async listCategories(user: AuthUser) {
    this.assertRead(user);
    return this.materialRepository.listCategories();
  }

  async createCategory(user: AuthUser, dto: CreateMaterialCategoryDto) {
    this.assertCategoryManage(user);
    const existing = await this.materialRepository.findCategoryByCode(dto.code);
    if (existing) {
      throw new ConflictException('分类编号已存在');
    }
    const category = await this.materialRepository.createCategory(dto);
    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'material',
      resource: 'material_category',
      resourceId: category.id,
      payload: dto,
    });
    return category;
  }

  async updateCategory(
    user: AuthUser,
    id: string,
    dto: UpdateMaterialCategoryDto,
  ) {
    this.assertCategoryManage(user);
    const category = await this.materialRepository.findCategoryById(id);
    if (!category) {
      throw new NotFoundException('分类不存在');
    }
    if (dto.code && dto.code !== category.code) {
      const dup = await this.materialRepository.findCategoryByCode(dto.code);
      if (dup && dup.id !== id) {
        throw new ConflictException('分类编号已存在');
      }
    }
    const updated = await this.materialRepository.updateCategory(id, dto);
    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'material',
      resource: 'material_category',
      resourceId: id,
      payload: dto,
    });
    return updated;
  }

  async removeCategory(user: AuthUser, id: string) {
    this.assertCategoryManage(user);
    const category = await this.materialRepository.findCategoryById(id);
    if (!category) {
      throw new NotFoundException('分类不存在');
    }
    const count = await this.materialRepository.countMaterialsInCategory(id);
    if (count > 0) {
      throw new BadRequestException('分类下仍有材料，无法删除');
    }
    await this.materialRepository.softDeleteCategory(id);
    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'material',
      resource: 'material_category',
      resourceId: id,
    });
    return null;
  }
}
