import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { BroadcastNotificationDto } from './dto/notification.dto';
import { NotificationRepository } from './notification.repository';

const TYPE_LABEL: Record<NotificationType, string> = {
  approval: '审批',
  inventory: '库存',
  procurement: '采购',
  finance: '财务',
  system: '系统',
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  private mapNotification(item: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    content: string;
    link: string | null;
    isRead: boolean;
    createdAt: Date;
  }) {
    return {
      id: item.id,
      userId: item.userId,
      type: item.type,
      typeLabel: TYPE_LABEL[item.type],
      title: item.title,
      content: item.content,
      link: item.link,
      isRead: item.isRead,
      createdAt: item.createdAt,
    };
  }

  async send(data: {
    userId: string;
    type: NotificationType;
    title: string;
    content: string;
    link?: string;
  }) {
    const row = await this.notificationRepository.create(data);
    return this.mapNotification(row);
  }

  async list(
    user: AuthUser,
    page: number,
    pageSize: number,
    type?: NotificationType,
    isRead?: boolean,
  ) {
    const where: Prisma.NotificationWhereInput = { userId: user.id };
    if (type) where.type = type;
    if (isRead !== undefined) where.isRead = isRead;

    const [rows, total] = await this.notificationRepository.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: rows.map((row) => this.mapNotification(row)),
      page,
      pageSize,
      total,
    };
  }

  async unreadCount(user: AuthUser) {
    const count = await this.notificationRepository.countUnread(user.id);
    return { count };
  }

  async markRead(user: AuthUser, id: string) {
    const existing = await this.notificationRepository.findByIdForUser(
      id,
      user.id,
    );
    if (!existing) throw new NotFoundException('通知不存在');

    await this.notificationRepository.markRead(id, user.id);
    return { id, isRead: true };
  }

  async markAllRead(user: AuthUser) {
    const result = await this.notificationRepository.markAllRead(user.id);
    return { updated: result.count };
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.notificationRepository.findByIdForUser(
      id,
      user.id,
    );
    if (!existing) throw new NotFoundException('通知不存在');

    await this.notificationRepository.delete(id, user.id);
    return { id };
  }

  async broadcast(user: AuthUser, dto: BroadcastNotificationDto) {
    if (!user.roles.includes('admin')) {
      throw new ForbiddenException('仅管理员可发送系统公告');
    }

    let userIds = dto.userIds ?? [];
    if (!userIds.length && dto.roleCodes?.length) {
      const sets = await Promise.all(
        dto.roleCodes.map((code) =>
          this.notificationRepository.findUserIdsByRoleCode(code),
        ),
      );
      userIds = [...new Set(sets.flatMap((rows) => rows.map((r) => r.userId)))];
    }
    if (!userIds.length) {
      const allUsers = await this.notificationRepository.findAllActiveUserIds();
      userIds = allUsers.map((u) => u.id);
    }

    if (!userIds.length) {
      return { sent: 0 };
    }

    await this.notificationRepository.createMany(
      userIds.map((userId) => ({
        userId,
        type: NotificationType.system,
        title: dto.title,
        content: dto.content,
        link: dto.link,
      })),
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'notification',
      resource: 'notification_broadcast',
      payload: { title: dto.title, recipients: userIds.length },
    });

    return { sent: userIds.length };
  }

  async maybeNotifyLowStock(materialId: string) {
    const material =
      await this.notificationRepository.findMaterialStock(materialId);
    if (!material?.minStock) return;

    const stock = Number(material.stock);
    const minStock = Number(material.minStock);
    if (stock >= minStock) return;

    const recipients =
      await this.notificationRepository.findUserIdsByRoleCode('warehouse');
    if (!recipients.length) return;

    const title = '库存预警';
    const content = `材料 ${material.code} ${material.name} 当前库存 ${stock}，低于最低库存 ${minStock}`;
    const link = `/materials/${material.id}`;

    for (const { userId } of recipients) {
      const recent =
        await this.notificationRepository.findRecentInventoryNotification(
          userId,
          materialId,
        );
      if (recent) continue;

      await this.notificationRepository.create({
        userId,
        type: NotificationType.inventory,
        title,
        content,
        link,
      });
    }
  }
}
