import { Injectable } from '@nestjs/common';
import {
  ContractChangeType,
  ContractStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const contractInclude = {
  project: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ContractInclude;

@Injectable()
export class ContractRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProjectById(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, managerId: true, code: true, name: true },
    });
  }

  isProjectMember(projectId: string, userId: string) {
    return this.prisma.projectMember.findFirst({
      where: { projectId, userId },
    });
  }

  findMany(params: {
    skip: number;
    take: number;
    where: Prisma.ContractWhereInput;
    orderBy: Prisma.ContractOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.contract.findMany({ ...params, include: contractInclude }),
      this.prisma.contract.count({ where: params.where }),
    ]);
  }

  findById(id: string) {
    return this.prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...contractInclude,
        revisions: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.contract.findFirst({
      where: { code, deletedAt: null },
    });
  }

  create(data: Prisma.ContractCreateInput) {
    return this.prisma.contract.create({
      data,
      include: contractInclude,
    });
  }

  update(id: string, data: Prisma.ContractUpdateInput) {
    return this.prisma.contract.update({
      where: { id },
      data,
      include: contractInclude,
    });
  }

  softDelete(id: string) {
    return this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  countCollections(contractId: string) {
    return this.prisma.collection.count({ where: { contractId } });
  }

  listCollections(contractId: string) {
    return this.prisma.collection.findMany({
      where: { contractId },
      orderBy: { collectedAt: 'desc' },
    });
  }

  listRevisions(contractId: string) {
    return this.prisma.contractRevision.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      include: {
        changedBy: { select: { id: true, name: true } },
      },
    });
  }

  createRevision(data: {
    contractId: string;
    changeType: ContractChangeType;
    before: Prisma.InputJsonValue;
    after: Prisma.InputJsonValue;
    reason?: string;
    changedById: string;
  }) {
    return this.prisma.contractRevision.create({
      data,
      include: {
        changedBy: { select: { id: true, name: true } },
      },
    });
  }

  updateStatus(id: string, status: ContractStatus) {
    return this.prisma.contract.update({
      where: { id },
      data: { status },
    });
  }

  findApprovalByBusiness(businessId: string) {
    return this.prisma.approvalInstance.findFirst({
      where: { type: 'contract', businessId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
