import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const notificationRepository = {
    findMany: vi.fn(),
    countUnread: vi.fn(),
    findByIdForUser: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  };
  const auditLogService = { create: vi.fn() };

  let service: NotificationService;

  const user = {
    id: 'u1',
    username: 'pm',
    name: 'PM',
    locale: 'zh',
    roles: ['project_manager'],
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService(
      notificationRepository as never,
      auditLogService as never,
    );
  });

  it('lists only current user notifications', async () => {
    notificationRepository.findMany.mockResolvedValue([
      [
        {
          id: 'n1',
          userId: 'u1',
          type: NotificationType.approval,
          title: '待办审批',
          content: 'test',
          link: '/approvals/1',
          isRead: false,
          createdAt: new Date(),
        },
      ],
      1,
    ]);

    const result = await service.list(user, 1, 20);
    expect(result.total).toBe(1);
    expect(notificationRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
      }),
    );
  });

  it('returns unread count', async () => {
    notificationRepository.countUnread.mockResolvedValue(3);
    const result = await service.unreadCount(user);
    expect(result.count).toBe(3);
  });

  it('rejects broadcast for non-admin', async () => {
    await expect(
      service.broadcast(user, { title: '公告', content: '内容' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks read only owned notification', async () => {
    notificationRepository.findByIdForUser.mockResolvedValue(null);
    await expect(service.markRead(user, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
