import { Injectable } from '@nestjs/common';
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

  async list(page = 1, pageSize = 20, q?: string) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await this.auditLogRepository.findMany({
      skip,
      take: pageSize,
      q,
    });
    return { list, page, pageSize, total };
  }
}
