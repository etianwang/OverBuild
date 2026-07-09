import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const dashboardRepository = {
    findAccessibleProjectIds: vi.fn(),
    countProjectsByStatus: vi.fn(),
    countInventoryAlerts: vi.fn(),
    listInventoryAlerts: vi.fn(),
    countPurchaseRequests: vi.fn(),
    countPurchaseOrders: vi.fn(),
  };
  const notificationService = {
    unreadCount: vi.fn(),
  };
  const workflowService = {
    listTodo: vi.fn(),
  };

  let service: DashboardService;

  const pmUser = {
    id: 'u1',
    username: 'pm',
    name: 'PM',
    locale: 'zh',
    roles: ['project_manager'],
    permissions: ['project.read', 'workflow.approve', 'material.read'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DashboardService(
      dashboardRepository as never,
      notificationService as never,
      workflowService as never,
    );
  });

  it('includes role-based sections in overview', async () => {
    dashboardRepository.findAccessibleProjectIds.mockResolvedValue([
      { id: 'p1' },
    ]);
    dashboardRepository.countProjectsByStatus.mockResolvedValue([
      { status: 'active', _count: { _all: 2 } },
    ]);
    workflowService.listTodo.mockResolvedValue({ total: 1, list: [] });
    notificationService.unreadCount.mockResolvedValue({ count: 3 });
    dashboardRepository.countInventoryAlerts.mockResolvedValue([
      { count: BigInt(1) },
    ]);
    dashboardRepository.listInventoryAlerts.mockResolvedValue([]);
    dashboardRepository.countPurchaseRequests.mockResolvedValue(2);
    dashboardRepository.countPurchaseOrders.mockResolvedValue(1);

    const result = await service.getOverview(pmUser);
    expect(result.sections).toContain('projects');
    expect(result.sections).toContain('approvals');
    expect(result.todoApprovals).toBe(1);
    expect(result.unreadNotifications).toBe(3);
  });

  it('rejects finance for engineer without permission', async () => {
    await expect(
      service.getFinance({
        id: 'e1',
        username: 'eng',
        name: '工程师',
        locale: 'zh',
        roles: ['engineer'],
        permissions: ['document.read'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
