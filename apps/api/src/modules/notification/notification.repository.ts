import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(params: {
    skip: number;
    take: number;
    where: Prisma.NotificationWhereInput;
    orderBy: Prisma.NotificationOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.notification.findMany(params),
      this.prisma.notification.count({ where: params.where }),
    ]);
  }

  findByIdForUser(id: string, userId: string) {
    return this.prisma.notification.findFirst({
      where: { id, userId },
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    content: string;
    link?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  createMany(
    data: Array<{
      userId: string;
      type: NotificationType;
      title: string;
      content: string;
      link?: string;
    }>,
  ) {
    return this.prisma.notification.createMany({ data });
  }

  markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  findMaterialStock(materialId: string) {
    return this.prisma.material.findFirst({
      where: { id: materialId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        stock: true,
        minStock: true,
        projectId: true,
      },
    });
  }

  findRecentInventoryNotification(userId: string, materialId: string) {
    return this.prisma.notification.findFirst({
      where: {
        userId,
        type: NotificationType.inventory,
        link: `/materials/${materialId}`,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
  }

  findUserIdsByRoleCode(roleCode: string) {
    return this.prisma.userRole.findMany({
      where: { role: { code: roleCode }, user: { deletedAt: null, status: 'active' } },
      select: { userId: true },
      distinct: ['userId'],
    });
  }

  findAllActiveUserIds() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, status: 'active' },
      select: { id: true },
    });
  }
}
