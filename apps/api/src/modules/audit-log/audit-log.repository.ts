import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogListParams {
  skip: number;
  take: number;
  q?: string;
  userId?: string;
  module?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AuditLogCreateInput) {
    return this.prisma.auditLog.create({ data });
  }

  private buildWhere(params: Omit<AuditLogListParams, 'skip' | 'take'>) {
    const where: Prisma.AuditLogWhereInput = {};

    if (params.userId) {
      where.userId = params.userId;
    }
    if (params.module) {
      where.module = { contains: params.module, mode: 'insensitive' };
    }
    if (params.action) {
      where.action = params.action;
    }
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }
    if (params.q) {
      where.OR = [
        { module: { contains: params.q, mode: 'insensitive' } },
        { resource: { contains: params.q, mode: 'insensitive' } },
        { user: { name: { contains: params.q, mode: 'insensitive' } } },
        { user: { username: { contains: params.q, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  findMany(params: AuditLogListParams) {
    const where = this.buildWhere(params);

    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
  }

  findAllForExport(params: Omit<AuditLogListParams, 'skip' | 'take'>) {
    const where = this.buildWhere(params);
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, name: true } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, name: true, email: true } },
      },
    });
  }
}
