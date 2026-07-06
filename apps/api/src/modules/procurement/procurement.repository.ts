import { Injectable } from '@nestjs/common';
import {
  ApprovalType,
  Prisma,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  QuotationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const requestInclude = {
  project: { select: { id: true, code: true, name: true } },
  requester: { select: { id: true, name: true } },
  items: {
    include: {
      material: { select: { id: true, code: true, name: true, unit: true } },
    },
  },
} satisfies Prisma.PurchaseRequestInclude;

const orderInclude = {
  project: { select: { id: true, code: true, name: true } },
  supplier: { select: { id: true, code: true, name: true } },
  request: { select: { id: true, code: true, status: true } },
  items: {
    include: {
      material: { select: { id: true, code: true, name: true, unit: true } },
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

@Injectable()
export class ProcurementRepository {
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
      select: { id: true, projectId: true, code: true, name: true, unit: true },
    });
  }

  findRequests(params: {
    skip: number;
    take: number;
    where: Prisma.PurchaseRequestWhereInput;
    orderBy: Prisma.PurchaseRequestOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.purchaseRequest.findMany({
        ...params,
        include: requestInclude,
      }),
      this.prisma.purchaseRequest.count({ where: params.where }),
    ]);
  }

  findRequestById(id: string) {
    return this.prisma.purchaseRequest.findFirst({
      where: { id, deletedAt: null },
      include: requestInclude,
    });
  }

  findRequestByCode(code: string) {
    return this.prisma.purchaseRequest.findFirst({
      where: { code, deletedAt: null },
    });
  }

  createRequest(data: {
    code: string;
    projectId: string;
    requesterId: string;
    remark?: string;
    items: Array<{ materialId: string; quantity: number; unit: string }>;
  }) {
    return this.prisma.purchaseRequest.create({
      data: {
        code: data.code,
        projectId: data.projectId,
        requesterId: data.requesterId,
        remark: data.remark,
        items: {
          create: data.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
      },
      include: requestInclude,
    });
  }

  updateRequest(
    id: string,
    data: {
      remark?: string;
      status?: PurchaseRequestStatus;
      items?: Array<{ materialId: string; quantity: number; unit: string }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.purchaseRequestItem.deleteMany({ where: { requestId: id } });
        await tx.purchaseRequestItem.createMany({
          data: data.items.map((item) => ({
            requestId: id,
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        });
      }
      return tx.purchaseRequest.update({
        where: { id },
        data: {
          remark: data.remark,
          status: data.status,
        },
        include: requestInclude,
      });
    });
  }

  updateRequestStatus(id: string, status: PurchaseRequestStatus) {
    return this.prisma.purchaseRequest.update({
      where: { id },
      data: { status },
    });
  }

  findOrders(params: {
    skip: number;
    take: number;
    where: Prisma.PurchaseOrderWhereInput;
    orderBy: Prisma.PurchaseOrderOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        ...params,
        include: orderInclude,
      }),
      this.prisma.purchaseOrder.count({ where: params.where }),
    ]);
  }

  findOrderById(id: string) {
    return this.prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: orderInclude,
    });
  }

  findOrderByCode(code: string) {
    return this.prisma.purchaseOrder.findFirst({
      where: { code, deletedAt: null },
    });
  }

  createOrder(data: {
    code: string;
    projectId: string;
    supplierId: string;
    requestId?: string;
    totalAmount: number;
    totalCurrency: string;
    items: Array<{
      materialId: string;
      quantity: number;
      unit: string;
      unitPriceAmount: number;
      unitPriceCurrency: string;
    }>;
  }) {
    return this.prisma.purchaseOrder.create({
      data: {
        code: data.code,
        projectId: data.projectId,
        supplierId: data.supplierId,
        requestId: data.requestId,
        totalAmount: data.totalAmount,
        totalCurrency: data.totalCurrency,
        status: PurchaseOrderStatus.confirmed,
        orderedAt: new Date(),
        items: {
          create: data.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
            unitPriceAmount: item.unitPriceAmount,
            unitPriceCurrency: item.unitPriceCurrency,
          })),
        },
      },
      include: orderInclude,
    });
  }

  updateOrder(
    id: string,
    data: {
      supplierId?: string;
      status?: PurchaseOrderStatus;
      items?: Array<{
        materialId: string;
        quantity: number;
        unit: string;
        unitPriceAmount: number;
        unitPriceCurrency: string;
      }>;
      totalAmount?: number;
      totalCurrency?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.purchaseOrderItem.deleteMany({ where: { orderId: id } });
        await tx.purchaseOrderItem.createMany({
          data: data.items.map((item) => ({
            orderId: id,
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
            unitPriceAmount: item.unitPriceAmount,
            unitPriceCurrency: item.unitPriceCurrency,
          })),
        });
      }
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          status: data.status,
          totalAmount: data.totalAmount,
          totalCurrency: data.totalCurrency,
        },
        include: orderInclude,
      });
    });
  }

  findSuppliers(params: {
    skip: number;
    take: number;
    where: Prisma.SupplierWhereInput;
    orderBy: Prisma.SupplierOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.supplier.findMany(params),
      this.prisma.supplier.count({ where: params.where }),
    ]);
  }

  findSupplierById(id: string) {
    return this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findSupplierByCode(code: string) {
    return this.prisma.supplier.findFirst({
      where: { code, deletedAt: null },
    });
  }

  createSupplier(data: Prisma.SupplierCreateInput) {
    return this.prisma.supplier.create({ data });
  }

  updateSupplier(id: string, data: Prisma.SupplierUpdateInput) {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  softDeleteSupplier(id: string) {
    return this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  countOrdersBySupplier(supplierId: string) {
    return this.prisma.purchaseOrder.count({
      where: { supplierId, deletedAt: null, status: { not: PurchaseOrderStatus.cancelled } },
    });
  }

  findQuotations(params: {
    skip: number;
    take: number;
    where: Prisma.QuotationWhereInput;
    orderBy: Prisma.QuotationOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.quotation.findMany({
        ...params,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          request: { select: { id: true, code: true } },
          material: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.quotation.count({ where: params.where }),
    ]);
  }

  findQuotationById(id: string) {
    return this.prisma.quotation.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        request: { select: { id: true, code: true } },
        material: { select: { id: true, code: true, name: true } },
      },
    });
  }

  findQuotationByCode(code: string) {
    return this.prisma.quotation.findFirst({ where: { code } });
  }

  createQuotation(data: {
    code: string;
    supplierId: string;
    requestId?: string;
    materialId?: string;
    amount: number;
    currency: string;
    remark?: string;
  }) {
    return this.prisma.quotation.create({
      data: {
        ...data,
        status: QuotationStatus.quoted,
        quotedAt: new Date(),
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        request: { select: { id: true, code: true } },
        material: { select: { id: true, code: true, name: true } },
      },
    });
  }

  updateQuotation(
    id: string,
    data: {
      amount?: number;
      currency?: string;
      status?: QuotationStatus;
      remark?: string;
    },
  ) {
    return this.prisma.quotation.update({
      where: { id },
      data: {
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        remark: data.remark,
        quotedAt: data.amount != null ? new Date() : undefined,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        request: { select: { id: true, code: true } },
        material: { select: { id: true, code: true, name: true } },
      },
    });
  }

  appendPriceHistory(data: {
    materialId: string;
    amount: number;
    currency: string;
    supplierId?: string;
  }) {
    return this.prisma.materialPriceHistory.create({ data });
  }

  updateMaterialPurchasePrice(
    materialId: string,
    amount: number,
    currency: string,
    supplierId?: string,
  ) {
    return this.prisma.material.update({
      where: { id: materialId },
      data: {
        purchasePriceAmount: amount,
        purchasePriceCurrency: currency,
        supplierId,
      },
    });
  }

  findApprovalByBusiness(businessId: string) {
    return this.prisma.approvalInstance.findFirst({
      where: {
        type: ApprovalType.purchase_request,
        businessId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
