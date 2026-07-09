import { ForbiddenException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { NotificationService } from '../notification/notification.service';
import { WorkflowService } from '../workflow/workflow.service';
import { DashboardRepository } from './dashboard.repository';

const ALL_SECTIONS = [
  'projects',
  'finance',
  'procurement',
  'inventory',
  'approvals',
  'notifications',
  'costTrend',
  'profitRanking',
  'translation',
  'documents',
  'drawings',
] as const;

type DashboardSection = (typeof ALL_SECTIONS)[number];

const ROLE_SECTIONS: Record<string, DashboardSection[]> = {
  admin: [...ALL_SECTIONS],
  boss: [
    'projects',
    'finance',
    'approvals',
    'notifications',
    'profitRanking',
  ],
  project_manager: [
    'projects',
    'procurement',
    'inventory',
    'approvals',
    'notifications',
    'costTrend',
  ],
  procurement: ['procurement', 'notifications'],
  warehouse: ['inventory', 'procurement', 'notifications'],
  finance: ['finance', 'notifications'],
  engineer: ['documents', 'drawings', 'notifications', 'approvals'],
  translator: ['translation', 'notifications'],
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService: WorkflowService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes('admin');
  }

  private hasPerm(user: AuthUser, code: string) {
    return this.isAdmin(user) || user.permissions.includes(code);
  }

  private visibleSections(user: AuthUser): Set<DashboardSection> {
    if (this.isAdmin(user)) return new Set(ALL_SECTIONS);

    const sections = new Set<DashboardSection>(['notifications']);

    for (const role of user.roles) {
      for (const section of ROLE_SECTIONS[role] ?? []) {
        sections.add(section);
      }
    }

    if (this.hasPerm(user, 'project.read')) sections.add('projects');
    if (
      this.hasPerm(user, 'finance.income.read') ||
      this.hasPerm(user, 'finance.profit.read')
    ) {
      sections.add('finance');
      sections.add('profitRanking');
    }
    if (this.hasPerm(user, 'finance.cost.read')) sections.add('costTrend');
    if (this.hasPerm(user, 'procurement.request.read')) {
      sections.add('procurement');
    }
    if (this.hasPerm(user, 'material.read')) sections.add('inventory');
    if (this.hasPerm(user, 'workflow.approve')) sections.add('approvals');
    if (this.hasPerm(user, 'translation.task.read')) sections.add('translation');
    if (this.hasPerm(user, 'document.read')) sections.add('documents');
    if (this.hasPerm(user, 'drawing.read')) sections.add('drawings');

    return sections;
  }

  private assertSection(user: AuthUser, section: DashboardSection) {
    if (!this.visibleSections(user).has(section)) {
      throw new ForbiddenException('无权限查看该仪表盘数据');
    }
  }

  private async resolveProjectIds(user: AuthUser): Promise<string[] | null> {
    if (
      this.isAdmin(user) ||
      user.roles.includes('boss') ||
      user.roles.includes('finance')
    ) {
      return null;
    }
    const rows = await this.dashboardRepository.findAccessibleProjectIds(
      user.id,
    );
    return rows.map((r) => r.id);
  }

  private buildProjectWhere(
    projectIds: string[] | null,
  ): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = { deletedAt: null };
    if (projectIds !== null) {
      where.id = projectIds.length ? { in: projectIds } : '__none__';
    }
    return where;
  }

  private money(amount: number, currency = 'CNY') {
    return { amount: Math.round(amount * 100) / 100, currency };
  }

  async getOverview(user: AuthUser) {
    const sections = [...this.visibleSections(user)];
    const data: Record<string, unknown> = { sections };

    if (sections.includes('projects')) {
      data.projects = await this.getProjects(user);
    }
    if (sections.includes('finance')) {
      data.finance = await this.getFinance(user);
    }
    if (sections.includes('procurement')) {
      data.procurement = await this.getProcurement(user);
    }
    if (sections.includes('inventory')) {
      const alerts = await this.getInventoryAlerts(user, 5);
      data.inventoryAlerts = alerts.total;
      data.inventoryAlertList = alerts.list;
    }
    if (sections.includes('approvals')) {
      data.todoApprovals = (await this.getApprovalsTodo(user)).count;
    }
    if (sections.includes('notifications')) {
      data.unreadNotifications = (await this.getNotificationsUnread(user))
        .count;
    }
    if (sections.includes('translation')) {
      data.translation = await this.getTranslationSummary(user);
    }
    if (sections.includes('documents')) {
      data.documents = await this.getDocumentsSummary(user);
    }
    if (sections.includes('drawings')) {
      data.drawings = await this.getDrawingsSummary(user);
    }

    return data;
  }

  async getProjects(user: AuthUser) {
    this.assertSection(user, 'projects');
    const projectIds = await this.resolveProjectIds(user);
    const groups = await this.dashboardRepository.countProjectsByStatus(
      this.buildProjectWhere(projectIds),
    );

    const counts: Record<string, number> = {
      planning: 0,
      active: 0,
      suspended: 0,
      completed: 0,
    };
    for (const row of groups) {
      counts[row.status] = row._count._all;
    }

    return {
      ...counts,
      total: Object.values(counts).reduce((s, n) => s + n, 0),
      activeCount: counts[ProjectStatus.active],
    };
  }

  async getFinance(user: AuthUser) {
    this.assertSection(user, 'finance');
    const projectIds = await this.resolveProjectIds(user);
    const [incomes, collections, payments, costs] = await Promise.all([
      this.dashboardRepository.sumIncomes(projectIds),
      this.dashboardRepository.sumCollections(projectIds),
      this.dashboardRepository.sumPayments(projectIds),
      this.dashboardRepository.sumCosts(projectIds),
    ]);

    const incomeTotal =
      Number(incomes._sum.amountAmount ?? 0) +
      Number(collections._sum.amountAmount ?? 0);
    const expenseTotal =
      Number(payments._sum.amountAmount ?? 0) +
      Number(costs._sum.amountAmount ?? 0);

    return {
      income: this.money(incomeTotal),
      expense: this.money(expenseTotal),
      profit: this.money(incomeTotal - expenseTotal),
    };
  }

  async getProcurement(user: AuthUser) {
    this.assertSection(user, 'procurement');
    const projectIds = await this.resolveProjectIds(user);
    const projectFilter =
      projectIds === null
        ? { deletedAt: null }
        : {
            deletedAt: null,
            projectId: projectIds.length ? { in: projectIds } : '__none__',
          };

    const [pendingRequests, activeOrders] = await Promise.all([
      this.dashboardRepository.countPurchaseRequests({
        ...projectFilter,
        status: {
          in: DashboardRepository.purchasePendingStatuses,
        },
      }),
      this.dashboardRepository.countPurchaseOrders({
        deletedAt: null,
        status: {
          in: DashboardRepository.purchaseActiveOrderStatuses,
        },
        ...(projectIds === null
          ? {}
          : {
              projectId: projectIds.length ? { in: projectIds } : '__none__',
            }),
      }),
    ]);

    return { pendingRequests, activeOrders };
  }

  async getInventoryAlerts(user: AuthUser, limit = 10) {
    this.assertSection(user, 'inventory');
    const projectIds = await this.resolveProjectIds(user);
    const [countRows, rows] = await Promise.all([
      this.dashboardRepository.countInventoryAlerts(projectIds),
      this.dashboardRepository.listInventoryAlerts(projectIds, limit),
    ]);

    return {
      total: Number(countRows[0]?.count ?? 0),
      list: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        stock: Number(row.stock),
        minStock: Number(row.min_stock),
        unit: row.unit,
        gap: Number(row.min_stock) - Number(row.stock),
      })),
    };
  }

  async getApprovalsTodo(user: AuthUser) {
    this.assertSection(user, 'approvals');
    try {
      const result = await this.workflowService.listTodo(user, 1, 1);
      return { count: result.total };
    } catch {
      return { count: 0 };
    }
  }

  async getNotificationsUnread(user: AuthUser) {
    this.assertSection(user, 'notifications');
    return this.notificationService.unreadCount(user);
  }

  async getCostTrend(user: AuthUser, projectId?: string, months = 6) {
    this.assertSection(user, 'costTrend');
    const projectIds = await this.resolveProjectIds(user);

    if (projectId && projectIds !== null && !projectIds.includes(projectId)) {
      throw new ForbiddenException('无权限查看该项目成本趋势');
    }

    const since = new Date();
    since.setMonth(since.getMonth() - months + 1);
    since.setDate(1);

    const costs = await this.dashboardRepository.findCostsSince(
      since,
      projectIds,
      projectId,
    );

    const buckets = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (months - 1 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, 0);
    }

    for (const cost of costs) {
      const d = cost.occurredAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + Number(cost.amountAmount));
      }
    }

    return {
      months,
      projectId: projectId ?? null,
      points: [...buckets.entries()].map(([month, amount]) => ({
        month,
        amount: Math.round(amount * 100) / 100,
        currency: 'CNY',
      })),
    };
  }

  async getProfitRanking(user: AuthUser, limit = 5) {
    this.assertSection(user, 'profitRanking');
    const projectIds = await this.resolveProjectIds(user);
    const projects = await this.dashboardRepository.listProjects(
      this.buildProjectWhere(projectIds),
    );

    const ranked = [];
    for (const project of projects) {
      const [incomes, collections, costs] =
        await this.dashboardRepository.sumProjectFinancials(project.id);
      const income =
        Number(incomes._sum.amountAmount ?? 0) +
        Number(collections._sum.amountAmount ?? 0);
      const cost = Number(costs._sum.amountAmount ?? 0);
      ranked.push({
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        income,
        cost,
        profit: income - cost,
      });
    }

    ranked.sort((a, b) => b.profit - a.profit);

    return {
      list: ranked.slice(0, limit).map((item) => ({
        ...item,
        income: this.money(item.income),
        cost: this.money(item.cost),
        profit: this.money(item.profit),
      })),
    };
  }

  private async getTranslationSummary(user: AuthUser) {
    const where: Prisma.TranslationTaskWhereInput = {};
    if (!this.isAdmin(user) && user.roles.includes('translator')) {
      where.assigneeId = user.id;
    }
    const groups = await this.dashboardRepository.countTranslationTasks(where);
    const byStatus: Record<string, number> = {};
    for (const row of groups) {
      byStatus[row.status] = row._count._all;
    }
    const pending = DashboardRepository.translationPendingStatuses.reduce(
      (sum, status) => sum + (byStatus[status] ?? 0),
      0,
    );
    return { pending, total: Object.values(byStatus).reduce((s, n) => s + n, 0) };
  }

  private async getDocumentsSummary(user: AuthUser) {
    const projectIds = await this.resolveProjectIds(user);
    const where: Prisma.DocumentWhereInput = { deletedAt: null };
    if (projectIds !== null) {
      where.projectId = projectIds.length ? { in: projectIds } : '__none__';
    }
    const total = await this.dashboardRepository.countDocuments(where);
    return { total };
  }

  private async getDrawingsSummary(user: AuthUser) {
    const projectIds = await this.resolveProjectIds(user);
    const where: Prisma.DrawingWhereInput = { deletedAt: null };
    if (projectIds !== null) {
      where.projectId = projectIds.length ? { in: projectIds } : '__none__';
    }
    const groups = await this.dashboardRepository.countDrawingsByStatus(where);
    const byStatus: Record<string, number> = {};
    for (const row of groups) {
      byStatus[row.status] = row._count._all;
    }
    const reviewing =
      (byStatus.reviewing ?? 0) + (byStatus.approved ?? 0);
    return { reviewing, total: Object.values(byStatus).reduce((s, n) => s + n, 0) };
  }
}
