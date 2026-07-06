import { Injectable } from '@nestjs/common';
import {
  ApprovalRecordAction,
  ApprovalStatus,
  ApprovalType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalTemplateNode } from './workflow.types';

const approvalInclude = {
  initiator: {
    select: { id: true, name: true, username: true, email: true },
  },
  project: {
    select: { id: true, code: true, name: true },
  },
  records: {
    orderBy: { actedAt: 'asc' as const },
    include: {
      approver: {
        select: { id: true, name: true, username: true },
      },
    },
  },
};

@Injectable()
export class WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveTemplate(type: ApprovalType) {
    return this.prisma.approvalTemplate.findFirst({
      where: { type, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  listTemplates() {
    return this.prisma.approvalTemplate.findMany({
      orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  findTemplateById(id: string) {
    return this.prisma.approvalTemplate.findUnique({ where: { id } });
  }

  createTemplate(data: {
    type: ApprovalType;
    name: string;
    nodes: ApprovalTemplateNode[];
  }) {
    return this.prisma.approvalTemplate.create({
      data: {
        type: data.type,
        name: data.name,
        nodes: data.nodes as unknown as Prisma.InputJsonValue,
      },
    });
  }

  updateTemplate(
    id: string,
    data: Partial<{
      name: string;
      nodes: ApprovalTemplateNode[];
      isActive: boolean;
    }>,
  ) {
    return this.prisma.approvalTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.nodes !== undefined
          ? { nodes: data.nodes as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  deactivateTemplatesByType(type: ApprovalType, exceptId?: string) {
    return this.prisma.approvalTemplate.updateMany({
      where: {
        type,
        isActive: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isActive: false },
    });
  }

  findByBusiness(type: ApprovalType, businessId: string) {
    return this.prisma.approvalInstance.findFirst({
      where: { type, businessId },
      orderBy: { createdAt: 'desc' },
      include: approvalInclude,
    });
  }

  findById(id: string) {
    return this.prisma.approvalInstance.findUnique({
      where: { id },
      include: approvalInclude,
    });
  }

  countByDatePrefix(prefix: string) {
    return this.prisma.approvalInstance.count({
      where: { code: { startsWith: prefix } },
    });
  }

  createInstance(data: {
    code: string;
    type: ApprovalType;
    businessId: string;
    projectId?: string;
    initiatorId: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.approvalInstance.create({
      data: {
        code: data.code,
        type: data.type,
        businessId: data.businessId,
        projectId: data.projectId,
        initiatorId: data.initiatorId,
        metadata: data.metadata,
      },
      include: approvalInclude,
    });
  }

  resetInstance(
    id: string,
    data: {
      metadata?: Prisma.InputJsonValue;
      projectId?: string | null;
    },
  ) {
    return this.prisma.approvalInstance.update({
      where: { id },
      data: {
        status: ApprovalStatus.pending,
        currentNode: 1,
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
      },
      include: approvalInclude,
    });
  }

  updateInstance(
    id: string,
    data: Partial<{
      status: ApprovalStatus;
      currentNode: number;
    }>,
  ) {
    return this.prisma.approvalInstance.update({
      where: { id },
      data,
      include: approvalInclude,
    });
  }

  createRecord(data: {
    instanceId: string;
    node: number;
    approverId: string;
    action: ApprovalRecordAction;
    comment?: string;
  }) {
    return this.prisma.approvalRecord.create({ data });
  }

  findMany(params: {
    skip: number;
    take: number;
    where: Prisma.ApprovalInstanceWhereInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.approvalInstance.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: approvalInclude,
      }),
      this.prisma.approvalInstance.count({ where: params.where }),
    ]);
  }

  findProjectById(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, managerId: true, code: true, name: true },
    });
  }

  findUsersByRole(roleCode: string, projectId?: string) {
    return this.prisma.user.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        userRoles: {
          some: {
            role: { code: roleCode },
            OR: projectId
              ? [{ projectId }, { projectId: null }]
              : [{ projectId: null }],
          },
        },
      },
      select: { id: true, name: true, username: true },
    });
  }

  findProjectMemberByRole(projectId: string, memberRole: string) {
    return this.prisma.projectMember.findFirst({
      where: { projectId, role: memberRole },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });
  }

  createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    content: string;
    link?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  findNotificationsByUser(userId: string, approvalId: string) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        type: NotificationType.approval,
        link: { contains: approvalId },
      },
    });
  }
}
