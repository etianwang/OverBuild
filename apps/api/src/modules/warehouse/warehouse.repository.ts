import { Injectable } from '@nestjs/common';
import {
  InboundType,
  OutboundType,
  Prisma,
  StockDocumentStatus,
  StockTransactionType,
  WarehouseStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const warehouseInclude = {
  project: { select: { id: true, code: true, name: true } },
} satisfies Prisma.WarehouseInclude;

const inboundInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
  purchaseOrder: { select: { id: true, code: true } },
  items: {
    include: {
      material: { select: { id: true, code: true, name: true, unit: true } },
    },
  },
} satisfies Prisma.StockInboundInclude;

const outboundInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
  zone: { select: { id: true, name: true } },
  items: {
    include: {
      material: { select: { id: true, code: true, name: true, unit: true } },
    },
  },
} satisfies Prisma.StockOutboundInclude;

const stocktakeInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
  items: {
    include: {
      material: { select: { id: true, code: true, name: true, unit: true } },
    },
  },
} satisfies Prisma.StocktakeInclude;

const balanceInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  material: { select: { id: true, code: true, name: true, unit: true } },
  project: { select: { id: true, code: true, name: true } },
} satisfies Prisma.StockBalanceInclude;

@Injectable()
export class WarehouseRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProjectById(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, managerId: true, code: true, name: true },
    });
  }

  isProjectMember(projectId: string, userId: string) {
    return this.prisma.projectMember.findFirst({
      where: { projectId, userId },
    });
  }

  findMaterialById(id: string) {
    return this.prisma.material.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, projectId: true, code: true, name: true, unit: true, stock: true },
    });
  }

  findWarehouseById(id: string) {
    return this.prisma.warehouse.findFirst({
      where: { id, deletedAt: null },
      include: warehouseInclude,
    });
  }

  findWarehouseByCode(code: string) {
    return this.prisma.warehouse.findFirst({ where: { code, deletedAt: null } });
  }

  listWarehouses(params: {
    skip: number;
    take: number;
    where: Prisma.WarehouseWhereInput;
    orderBy: Prisma.WarehouseOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.warehouse.findMany({ ...params, include: warehouseInclude }),
      this.prisma.warehouse.count({ where: params.where }),
    ]);
  }

  createWarehouse(data: {
    code: string;
    name: string;
    projectId: string;
    address?: string;
  }) {
    return this.prisma.warehouse.create({
      data,
      include: warehouseInclude,
    });
  }

  updateWarehouse(id: string, data: Prisma.WarehouseUpdateInput) {
    return this.prisma.warehouse.update({
      where: { id },
      data,
      include: warehouseInclude,
    });
  }

  deactivateWarehouse(id: string) {
    return this.prisma.warehouse.update({
      where: { id },
      data: { status: WarehouseStatus.inactive, deletedAt: new Date() },
    });
  }

  listInbounds(params: {
    skip: number;
    take: number;
    where: Prisma.StockInboundWhereInput;
    orderBy: Prisma.StockInboundOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.stockInbound.findMany({ ...params, include: inboundInclude }),
      this.prisma.stockInbound.count({ where: params.where }),
    ]);
  }

  findInboundById(id: string) {
    return this.prisma.stockInbound.findUnique({
      where: { id },
      include: inboundInclude,
    });
  }

  findInboundByCode(code: string) {
    return this.prisma.stockInbound.findFirst({ where: { code } });
  }

  createInbound(data: {
    code: string;
    warehouseId: string;
    projectId: string;
    purchaseOrderId?: string;
    type: InboundType;
    remark?: string;
    items: Array<{ materialId: string; quantity: number; unit: string }>;
  }) {
    return this.prisma.stockInbound.create({
      data: {
        code: data.code,
        warehouseId: data.warehouseId,
        projectId: data.projectId,
        purchaseOrderId: data.purchaseOrderId,
        type: data.type,
        remark: data.remark,
        items: {
          create: data.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
      },
      include: inboundInclude,
    });
  }

  updateInbound(
    id: string,
    data: {
      remark?: string;
      items?: Array<{ materialId: string; quantity: number; unit: string }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.stockItem.deleteMany({ where: { inboundId: id } });
        await tx.stockItem.createMany({
          data: data.items.map((item) => ({
            inboundId: id,
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        });
      }
      return tx.stockInbound.update({
        where: { id },
        data: { remark: data.remark },
        include: inboundInclude,
      });
    });
  }

  listOutbounds(params: {
    skip: number;
    take: number;
    where: Prisma.StockOutboundWhereInput;
    orderBy: Prisma.StockOutboundOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.stockOutbound.findMany({ ...params, include: outboundInclude }),
      this.prisma.stockOutbound.count({ where: params.where }),
    ]);
  }

  findOutboundById(id: string) {
    return this.prisma.stockOutbound.findUnique({
      where: { id },
      include: outboundInclude,
    });
  }

  findOutboundByCode(code: string) {
    return this.prisma.stockOutbound.findFirst({ where: { code } });
  }

  createOutbound(data: {
    code: string;
    warehouseId: string;
    projectId: string;
    zoneId?: string;
    type: OutboundType;
    remark?: string;
    items: Array<{ materialId: string; quantity: number; unit: string }>;
  }) {
    return this.prisma.stockOutbound.create({
      data: {
        code: data.code,
        warehouseId: data.warehouseId,
        projectId: data.projectId,
        zoneId: data.zoneId,
        type: data.type,
        remark: data.remark,
        items: {
          create: data.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
      },
      include: outboundInclude,
    });
  }

  updateOutbound(
    id: string,
    data: {
      remark?: string;
      items?: Array<{ materialId: string; quantity: number; unit: string }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.stockItem.deleteMany({ where: { outboundId: id } });
        await tx.stockItem.createMany({
          data: data.items.map((item) => ({
            outboundId: id,
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        });
      }
      return tx.stockOutbound.update({
        where: { id },
        data: { remark: data.remark },
        include: outboundInclude,
      });
    });
  }

  listStocktakes(params: {
    skip: number;
    take: number;
    where: Prisma.StocktakeWhereInput;
    orderBy: Prisma.StocktakeOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.stocktake.findMany({ ...params, include: stocktakeInclude }),
      this.prisma.stocktake.count({ where: params.where }),
    ]);
  }

  findStocktakeById(id: string) {
    return this.prisma.stocktake.findUnique({
      where: { id },
      include: stocktakeInclude,
    });
  }

  findStocktakeByCode(code: string) {
    return this.prisma.stocktake.findFirst({ where: { code } });
  }

  createStocktake(data: {
    code: string;
    warehouseId: string;
    projectId: string;
    remark?: string;
    items: Array<{
      materialId: string;
      bookQuantity: number;
      countedQuantity: number;
      unit: string;
    }>;
  }) {
    return this.prisma.stocktake.create({
      data: {
        code: data.code,
        warehouseId: data.warehouseId,
        projectId: data.projectId,
        remark: data.remark,
        items: { create: data.items },
      },
      include: stocktakeInclude,
    });
  }

  listBalances(params: {
    skip: number;
    take: number;
    where: Prisma.StockBalanceWhereInput;
    orderBy: Prisma.StockBalanceOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.stockBalance.findMany({ ...params, include: balanceInclude }),
      this.prisma.stockBalance.count({ where: params.where }),
    ]);
  }

  listTransactions(params: {
    skip: number;
    take: number;
    where: Prisma.StockTransactionWhereInput;
    orderBy: Prisma.StockTransactionOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.stockTransaction.findMany({
        ...params,
        include: {
          material: { select: { id: true, code: true, name: true } },
          project: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.stockTransaction.count({ where: params.where }),
    ]);
  }

  findBalance(warehouseId: string, materialId: string, projectId: string) {
    return this.prisma.stockBalance.findUnique({
      where: {
        warehouseId_materialId_projectId: { warehouseId, materialId, projectId },
      },
    });
  }

  confirmInboundTransaction(
    inboundId: string,
    inbound: {
      code: string;
      warehouseId: string;
      projectId: string;
      items: Array<{ materialId: string; quantity: Prisma.Decimal; unit: string }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of inbound.items) {
        const balance = await tx.stockBalance.upsert({
          where: {
            warehouseId_materialId_projectId: {
              warehouseId: inbound.warehouseId,
              materialId: item.materialId,
              projectId: inbound.projectId,
            },
          },
          create: {
            warehouseId: inbound.warehouseId,
            materialId: item.materialId,
            projectId: inbound.projectId,
            quantity: item.quantity,
          },
          update: { quantity: { increment: item.quantity } },
        });

        const material = await tx.material.update({
          where: { id: item.materialId },
          data: { stock: { increment: item.quantity } },
        });

        await tx.stockTransaction.create({
          data: {
            materialId: item.materialId,
            type: StockTransactionType.inbound,
            quantity: item.quantity,
            balanceAfter: balance.quantity,
            reference: inbound.code,
            warehouseId: inbound.warehouseId,
            projectId: inbound.projectId,
          },
        });

        void material;
      }

      return tx.stockInbound.update({
        where: { id: inboundId },
        data: { status: StockDocumentStatus.confirmed, inboundAt: new Date() },
        include: inboundInclude,
      });
    });
  }

  confirmOutboundTransaction(
    outboundId: string,
    outbound: {
      code: string;
      warehouseId: string;
      projectId: string;
      items: Array<{ materialId: string; quantity: Prisma.Decimal; unit: string }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of outbound.items) {
        const updated = await tx.stockBalance.updateMany({
          where: {
            warehouseId: outbound.warehouseId,
            materialId: item.materialId,
            projectId: outbound.projectId,
            quantity: { gte: item.quantity },
          },
          data: { quantity: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          throw new Error('INSUFFICIENT_STOCK');
        }

        const balance = await tx.stockBalance.findUniqueOrThrow({
          where: {
            warehouseId_materialId_projectId: {
              warehouseId: outbound.warehouseId,
              materialId: item.materialId,
              projectId: outbound.projectId,
            },
          },
        });

        const material = await tx.material.findUniqueOrThrow({
          where: { id: item.materialId },
        });
        if (Number(material.stock) < Number(item.quantity)) {
          throw new Error('INSUFFICIENT_MATERIAL_STOCK');
        }

        await tx.material.update({
          where: { id: item.materialId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockTransaction.create({
          data: {
            materialId: item.materialId,
            type: StockTransactionType.outbound,
            quantity: item.quantity,
            balanceAfter: balance.quantity,
            reference: outbound.code,
            warehouseId: outbound.warehouseId,
            projectId: outbound.projectId,
          },
        });
      }

      return tx.stockOutbound.update({
        where: { id: outboundId },
        data: { status: StockDocumentStatus.confirmed, outboundAt: new Date() },
        include: outboundInclude,
      });
    });
  }

  confirmStocktakeTransaction(
    stocktakeId: string,
    stocktake: {
      code: string;
      warehouseId: string;
      projectId: string;
      items: Array<{
        materialId: string;
        bookQuantity: Prisma.Decimal;
        countedQuantity: Prisma.Decimal;
        unit: string;
      }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of stocktake.items) {
        const diff = Number(item.countedQuantity) - Number(item.bookQuantity);
        if (diff === 0) continue;

        if (diff > 0) {
          const balance = await tx.stockBalance.upsert({
            where: {
              warehouseId_materialId_projectId: {
                warehouseId: stocktake.warehouseId,
                materialId: item.materialId,
                projectId: stocktake.projectId,
              },
            },
            create: {
              warehouseId: stocktake.warehouseId,
              materialId: item.materialId,
              projectId: stocktake.projectId,
              quantity: diff,
            },
            update: { quantity: { increment: diff } },
          });
          await tx.material.update({
            where: { id: item.materialId },
            data: { stock: { increment: diff } },
          });
          await tx.stockTransaction.create({
            data: {
              materialId: item.materialId,
              type: StockTransactionType.adjustment,
              quantity: Math.abs(diff),
              balanceAfter: balance.quantity,
              reference: stocktake.code,
              warehouseId: stocktake.warehouseId,
              projectId: stocktake.projectId,
            },
          });
        } else {
          const qty = Math.abs(diff);
          const updated = await tx.stockBalance.updateMany({
            where: {
              warehouseId: stocktake.warehouseId,
              materialId: item.materialId,
              projectId: stocktake.projectId,
              quantity: { gte: qty },
            },
            data: { quantity: { decrement: qty } },
          });
          if (updated.count === 0) throw new Error('INSUFFICIENT_STOCK');
          const balance = await tx.stockBalance.findUniqueOrThrow({
            where: {
              warehouseId_materialId_projectId: {
                warehouseId: stocktake.warehouseId,
                materialId: item.materialId,
                projectId: stocktake.projectId,
              },
            },
          });
          await tx.material.update({
            where: { id: item.materialId },
            data: { stock: { decrement: qty } },
          });
          await tx.stockTransaction.create({
            data: {
              materialId: item.materialId,
              type: StockTransactionType.adjustment,
              quantity: qty,
              balanceAfter: balance.quantity,
              reference: stocktake.code,
              warehouseId: stocktake.warehouseId,
              projectId: stocktake.projectId,
            },
          });
        }
      }

      return tx.stocktake.update({
        where: { id: stocktakeId },
        data: { status: StockDocumentStatus.confirmed, confirmedAt: new Date() },
        include: stocktakeInclude,
      });
    });
  }
}
