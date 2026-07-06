import { Injectable } from '@nestjs/common';
import { Prisma, StockTransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const materialInclude = {
  category: {
    select: { id: true, code: true, name: true },
  },
  priceHistory: {
    orderBy: { effectiveAt: 'desc' as const },
    take: 5,
  },
};

@Injectable()
export class MaterialRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(params: {
    skip: number;
    take: number;
    where: Prisma.MaterialWhereInput;
    orderBy: Prisma.MaterialOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.material.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
        include: materialInclude,
      }),
      this.prisma.material.count({ where: params.where }),
    ]);
  }

  findAlerts(params: { skip: number; take: number }) {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        code: string;
        name: string;
        stock: Prisma.Decimal;
        min_stock: Prisma.Decimal;
        unit: string;
        category_id: string;
      }>
    >`
      SELECT m.id, m.code, m.name, m.stock, m.min_stock, m.unit, m.category_id
      FROM materials m
      WHERE m.deleted_at IS NULL
        AND m.min_stock IS NOT NULL
        AND m.stock < m.min_stock
      ORDER BY (m.min_stock - m.stock) DESC
      OFFSET ${params.skip}
      LIMIT ${params.take}
    `;
  }

  countAlerts() {
    return this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM materials m
      WHERE m.deleted_at IS NULL
        AND m.min_stock IS NOT NULL
        AND m.stock < m.min_stock
    `;
  }

  findById(id: string) {
    return this.prisma.material.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...materialInclude,
        priceHistory: {
          orderBy: { effectiveAt: 'desc' },
          take: 20,
        },
        qrcode: true,
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.material.findFirst({
      where: { code, deletedAt: null },
    });
  }

  create(data: Prisma.MaterialCreateInput) {
    return this.prisma.material.create({
      data,
      include: materialInclude,
    });
  }

  update(id: string, data: Prisma.MaterialUpdateInput) {
    return this.prisma.material.update({
      where: { id },
      data,
      include: materialInclude,
    });
  }

  softDelete(id: string) {
    return this.prisma.material.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  countStockTransactions(materialId: string) {
    return this.prisma.stockTransaction.count({ where: { materialId } });
  }

  appendPriceHistory(data: {
    materialId: string;
    amount: Prisma.Decimal | number;
    currency: string;
    supplierId?: string | null;
  }) {
    return this.prisma.materialPriceHistory.create({ data });
  }

  listStockTransactions(materialId: string, skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.stockTransaction.findMany({
        where: { materialId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockTransaction.count({ where: { materialId } }),
    ]);
  }

  upsertQrcode(materialId: string, qrcodeUrl: string, payload: string) {
    return this.prisma.materialQrcode.upsert({
      where: { materialId },
      update: { qrcodeUrl, payload },
      create: { materialId, qrcodeUrl, payload },
    });
  }

  findQrcode(materialId: string) {
    return this.prisma.materialQrcode.findUnique({ where: { materialId } });
  }

  listCategories() {
    return this.prisma.materialCategory.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  findCategoryById(id: string) {
    return this.prisma.materialCategory.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findCategoryByCode(code: string) {
    return this.prisma.materialCategory.findFirst({
      where: { code, deletedAt: null },
    });
  }

  createCategory(data: Prisma.MaterialCategoryCreateInput) {
    return this.prisma.materialCategory.create({ data });
  }

  updateCategory(id: string, data: Prisma.MaterialCategoryUpdateInput) {
    return this.prisma.materialCategory.update({ where: { id }, data });
  }

  softDeleteCategory(id: string) {
    return this.prisma.materialCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  countMaterialsInCategory(categoryId: string) {
    return this.prisma.material.count({
      where: { categoryId, deletedAt: null },
    });
  }

  createStockTransaction(data: {
    materialId: string;
    type: StockTransactionType;
    quantity: number;
    balanceAfter?: number;
    reference?: string;
    projectId?: string;
  }) {
    return this.prisma.stockTransaction.create({ data });
  }
}
