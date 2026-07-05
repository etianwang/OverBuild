import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogRepository } from './audit-log.repository';

export interface CreateAuditLogInput {
  userId?: string;
  action: keyof typeof AuditAction | AuditAction;
  module: string;
  resource: string;
  resourceId?: string;
  payload?: unknown;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  userId?: string;
  module?: string;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  create(input: CreateAuditLogInput) {
    return this.auditLogRepository.create({
      action: input.action as AuditAction,
      module: input.module,
      resource: input.resource,
      resourceId: input.resourceId,
      payload: input.payload as object | undefined,
      ip: input.ip,
      userAgent: input.userAgent,
      ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
    });
  }

  private parseDate(value?: string, endOfDay = false) {
    if (!value) return undefined;
    const date = new Date(value);
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    }
    return date;
  }

  async list(query: AuditLogListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [list, total] = await this.auditLogRepository.findMany({
      skip,
      take: pageSize,
      q: query.q,
      userId: query.userId,
      module: query.module,
      action: query.action,
      startDate: this.parseDate(query.startDate),
      endDate: this.parseDate(query.endDate, true),
    });

    return { list, page, pageSize, total };
  }

  async getOne(id: string) {
    const log = await this.auditLogRepository.findById(id);
    if (!log) {
      throw new NotFoundException('日志不存在');
    }
    return log;
  }

  async export(query: AuditLogListQuery, operatorId: string) {
    const logs = await this.auditLogRepository.findAllForExport({
      q: query.q,
      userId: query.userId,
      module: query.module,
      action: query.action,
      startDate: this.parseDate(query.startDate),
      endDate: this.parseDate(query.endDate, true),
    });

    const header = [
      '时间',
      '操作人',
      '动作',
      '模块',
      '资源',
      '资源ID',
      'IP',
    ];
    const rows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.user?.name ?? '',
      log.action,
      log.module,
      log.resource,
      log.resourceId ?? '',
      log.ip ?? '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    await this.create({
      userId: operatorId,
      action: 'export',
      module: 'audit',
      resource: 'audit_logs',
      payload: { count: logs.length },
    });

    return { filename: `audit-logs-${Date.now()}.csv`, content: csv };
  }
}
