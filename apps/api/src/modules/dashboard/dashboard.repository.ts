import { Injectable } from '@nestjs/common';
import {
  DrawingStatus,
  Prisma,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  TranslationTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAccessibleProjectIds(userId: string) {
    return this.prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [{ managerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
  }

  countProjectsByStatus(where: Prisma.ProjectWhereInput) {
    return this.prisma.project.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
  }

  countInventoryAlerts(projectIds: string[] | null) {
    const projectFilter =
      projectIds === null
        ? Prisma.sql``
        : projectIds.length
          ? Prisma.sql`AND m.project_id IN (${Prisma.join(projectIds)})`
          : Prisma.sql`AND 1=0`;

    return this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM materials m
      WHERE m.deleted_at IS NULL
        AND m.min_stock IS NOT NULL
        AND m.stock < m.min_stock
        ${projectFilter}
    `;
  }

  listInventoryAlerts(projectIds: string[] | null, take = 5) {
    const projectFilter =
      projectIds === null
        ? Prisma.sql``
        : projectIds.length
          ? Prisma.sql`AND m.project_id IN (${Prisma.join(projectIds)})`
          : Prisma.sql`AND 1=0`;

    return this.prisma.$queryRaw<
      Array<{
        id: string;
        code: string;
        name: string;
        stock: Prisma.Decimal;
        min_stock: Prisma.Decimal;
        unit: string;
      }>
    >`
      SELECT m.id, m.code, m.name, m.stock, m.min_stock, m.unit
      FROM materials m
      WHERE m.deleted_at IS NULL
        AND m.min_stock IS NOT NULL
        AND m.stock < m.min_stock
        ${projectFilter}
      ORDER BY (m.min_stock - m.stock) DESC
      LIMIT ${take}
    `;
  }

  countPurchaseRequests(where: Prisma.PurchaseRequestWhereInput) {
    return this.prisma.purchaseRequest.count({ where });
  }

  countPurchaseOrders(where: Prisma.PurchaseOrderWhereInput) {
    return this.prisma.purchaseOrder.count({ where });
  }

  listProjects(where: Prisma.ProjectWhereInput) {
    return this.prisma.project.findMany({
      where,
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
  }

  sumIncomes(projectIds: string[] | null) {
    const where: Prisma.IncomeWhereInput = {};
    if (projectIds !== null) {
      where.projectId = projectIds.length ? { in: projectIds } : '__none__';
    }
    return this.prisma.income.aggregate({
      where,
      _sum: { amountAmount: true },
    });
  }

  sumCollections(projectIds: string[] | null) {
    const where: Prisma.CollectionWhereInput = {};
    if (projectIds !== null) {
      where.projectId = projectIds.length ? { in: projectIds } : '__none__';
    }
    return this.prisma.collection.aggregate({
      where,
      _sum: { amountAmount: true },
    });
  }

  sumPayments(projectIds: string[] | null) {
    const where: Prisma.PaymentWhereInput = {
      status: { in: ['approved', 'paid'] },
    };
    if (projectIds !== null) {
      where.projectId = projectIds.length ? { in: projectIds } : '__none__';
    }
    return this.prisma.payment.aggregate({
      where,
      _sum: { amountAmount: true },
    });
  }

  sumCosts(projectIds: string[] | null) {
    const where: Prisma.CostWhereInput = {};
    if (projectIds !== null) {
      where.projectId = projectIds.length ? { in: projectIds } : '__none__';
    }
    return this.prisma.cost.aggregate({
      where,
      _sum: { amountAmount: true },
    });
  }

  findCostsSince(
    since: Date,
    projectIds: string[] | null,
    projectId?: string,
  ) {
    const where: Prisma.CostWhereInput = {
      occurredAt: { gte: since },
    };
    if (projectId) where.projectId = projectId;
    else if (projectIds !== null) {
      where.projectId = projectIds.length ? { in: projectIds } : '__none__';
    }
    return this.prisma.cost.findMany({
      where,
      select: { occurredAt: true, amountAmount: true },
      orderBy: { occurredAt: 'asc' },
    });
  }

  sumProjectFinancials(projectId: string) {
    return Promise.all([
      this.prisma.income.aggregate({
        where: { projectId },
        _sum: { amountAmount: true },
      }),
      this.prisma.collection.aggregate({
        where: { projectId },
        _sum: { amountAmount: true },
      }),
      this.prisma.cost.aggregate({
        where: { projectId },
        _sum: { amountAmount: true },
      }),
    ]);
  }

  countUnreadNotifications(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  countTranslationTasks(where: Prisma.TranslationTaskWhereInput) {
    return this.prisma.translationTask.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
  }

  countDrawingsByStatus(where: Prisma.DrawingWhereInput) {
    return this.prisma.drawing.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
  }

  countDocuments(where: Prisma.DocumentWhereInput) {
    return this.prisma.document.count({ where });
  }

  static readonly purchasePendingStatuses: PurchaseRequestStatus[] = [
    PurchaseRequestStatus.pending,
  ];

  static readonly purchaseActiveOrderStatuses: PurchaseOrderStatus[] = [
    PurchaseOrderStatus.confirmed,
    PurchaseOrderStatus.partial,
  ];

  static readonly translationPendingStatuses: TranslationTaskStatus[] = [
    TranslationTaskStatus.pending,
    TranslationTaskStatus.auto,
    TranslationTaskStatus.manual,
  ];

  static readonly drawingReviewStatuses: DrawingStatus[] = [
    DrawingStatus.reviewing,
    DrawingStatus.approved,
  ];
}
