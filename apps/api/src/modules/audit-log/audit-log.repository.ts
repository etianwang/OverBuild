import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AuditLogCreateInput) {
    return this.prisma.auditLog.create({ data });
  }

  findMany(params: { skip: number; take: number; q?: string }) {
    const where: Prisma.AuditLogWhereInput = params.q
      ? {
          OR: [
            { module: { contains: params.q, mode: 'insensitive' } },
            { resource: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {};

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
}
