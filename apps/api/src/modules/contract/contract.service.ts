import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  ApprovalType,
  ContractStatus,
  Prisma,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { toCsv } from '../project/csv.util';
import { WorkflowService } from '../workflow/workflow.service';
import {
  CreateContractDto,
  CreateContractRevisionDto,
  UpdateContractDto,
} from './dto/contract.dto';
import { ContractRepository } from './contract.repository';

const SORTABLE = new Set(['code', 'name', 'status', 'createdAt', 'signedAt']);

@Injectable()
export class ContractService {
  constructor(
    private readonly contractRepository: ContractRepository,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService: WorkflowService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes('admin');
  }

  private hasPerm(user: AuthUser, code: string) {
    return this.isAdmin(user) || user.permissions.includes(code);
  }

  private assertPerm(user: AuthUser, code: string, message: string) {
    if (!this.hasPerm(user, code)) throw new ForbiddenException(message);
  }

  private toMoney(
    amount: Prisma.Decimal,
    currency: string | null | undefined,
  ) {
    return { amount: Number(amount), currency: currency ?? 'CNY' };
  }

  private mapContract(contract: {
    id: string;
    code: string;
    name: string;
    nameFr: string | null;
    projectId: string;
    partyA: string;
    partyB: string;
    amountAmount: Prisma.Decimal;
    amountCurrency: string;
    type: string;
    signedAt: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    status: ContractStatus;
    collectedAmountAmount: Prisma.Decimal;
    collectedAmountCurrency: string | null;
    attachmentUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; code: string; name: string };
    revisions?: unknown[];
  }) {
    return {
      id: contract.id,
      code: contract.code,
      name: contract.name,
      nameFr: contract.nameFr,
      projectId: contract.projectId,
      partyA: contract.partyA,
      partyB: contract.partyB,
      amount: this.toMoney(contract.amountAmount, contract.amountCurrency),
      type: contract.type,
      signedAt: contract.signedAt,
      startDate: contract.startDate,
      endDate: contract.endDate,
      status: contract.status,
      collectedAmount: this.toMoney(
        contract.collectedAmountAmount,
        contract.collectedAmountCurrency ?? contract.amountCurrency,
      ),
      attachmentUrl: contract.attachmentUrl,
      project: contract.project,
      revisions: contract.revisions,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  private async applyProjectScope(
    user: AuthUser,
    where: Prisma.ContractWhereInput,
    projectId?: string,
  ) {
    if (
      this.isAdmin(user) ||
      user.roles.includes('boss') ||
      user.roles.includes('finance')
    ) {
      if (projectId) where.projectId = projectId;
      return;
    }

    const scopeOr: Prisma.ContractWhereInput[] = [
      { project: { managerId: user.id } },
      { project: { members: { some: { userId: user.id } } } },
    ];

    if (projectId) {
      const project = await this.contractRepository.findProjectById(projectId);
      if (!project) throw new NotFoundException('项目不存在');
      const member = await this.contractRepository.isProjectMember(
        projectId,
        user.id,
      );
      if (project.managerId !== user.id && !member) {
        throw new ForbiddenException('无权限查看该项目合同');
      }
      where.projectId = projectId;
      return;
    }

    Object.assign(where, { OR: scopeOr });
  }

  async syncContractApproval(businessId: string, result: 'approved' | 'rejected') {
    const contract = await this.contractRepository.findById(businessId);
    if (!contract) return;

    const status =
      result === 'approved' ? ContractStatus.active : ContractStatus.draft;
    await this.contractRepository.updateStatus(businessId, status);
  }

  async list(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
    status?: ContractStatus,
    sort = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ) {
    this.assertPerm(user, 'contract.read', '无权限查看合同');

    const where: Prisma.ContractWhereInput = { deletedAt: null };
    await this.applyProjectScope(user, where, projectId);
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { partyA: { contains: q, mode: 'insensitive' } },
        { partyB: { contains: q, mode: 'insensitive' } },
        { project: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const orderBy = {
      [SORTABLE.has(sort) ? sort : 'createdAt']: order,
    } as Prisma.ContractOrderByWithRelationInput;

    const [list, total] = await this.contractRepository.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy,
    });

    return {
      list: list.map((item) => this.mapContract(item)),
      page,
      pageSize,
      total,
    };
  }

  async getOne(user: AuthUser, id: string) {
    this.assertPerm(user, 'contract.read', '无权限查看合同');

    const contract = await this.contractRepository.findById(id);
    if (!contract) throw new NotFoundException('合同不存在');

    const approval = await this.contractRepository.findApprovalByBusiness(id);

    return {
      ...this.mapContract(contract),
      approval: approval
        ? { id: approval.id, status: approval.status, code: approval.code }
        : null,
    };
  }

  async create(user: AuthUser, dto: CreateContractDto) {
    this.assertPerm(user, 'contract.create', '无权限创建合同');

    const project = await this.contractRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');

    const existing = await this.contractRepository.findByCode(dto.code);
    if (existing) throw new ConflictException('合同编号已存在');

    const created = await this.contractRepository.create({
      code: dto.code,
      name: dto.name,
      nameFr: dto.nameFr,
      project: { connect: { id: dto.projectId } },
      partyA: dto.partyA,
      partyB: dto.partyB,
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
      collectedAmountCurrency: dto.amount.currency.toUpperCase(),
      type: dto.type,
      signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      attachmentUrl: dto.attachmentUrl,
      status: ContractStatus.draft,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'contract',
      resource: 'contract',
      resourceId: created.id,
      payload: { code: dto.code, projectId: dto.projectId },
    });

    return this.mapContract(created);
  }

  async update(user: AuthUser, id: string, dto: UpdateContractDto) {
    this.assertPerm(user, 'contract.update', '无权限编辑合同');

    const contract = await this.contractRepository.findById(id);
    if (!contract) throw new NotFoundException('合同不存在');
    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException('仅草稿状态合同可编辑');
    }

    const updated = await this.contractRepository.update(id, {
      name: dto.name,
      nameFr: dto.nameFr,
      partyA: dto.partyA,
      partyB: dto.partyB,
      type: dto.type,
      status: dto.status,
      attachmentUrl: dto.attachmentUrl,
      signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      ...(dto.amount
        ? {
            amountAmount: dto.amount.amount,
            amountCurrency: dto.amount.currency.toUpperCase(),
          }
        : {}),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'contract',
      resource: 'contract',
      resourceId: id,
    });

    return this.mapContract(updated);
  }

  async remove(user: AuthUser, id: string) {
    this.assertPerm(user, 'contract.delete', '无权限删除合同');

    const contract = await this.contractRepository.findById(id);
    if (!contract) throw new NotFoundException('合同不存在');

    const collectionCount = await this.contractRepository.countCollections(id);
    if (collectionCount > 0) {
      throw new BadRequestException('合同存在回款记录，无法删除');
    }

    await this.contractRepository.softDelete(id);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'contract',
      resource: 'contract',
      resourceId: id,
    });

    return { id };
  }

  async submit(user: AuthUser, id: string) {
    this.assertPerm(user, 'contract.submit', '无权限提交合同审批');

    const contract = await this.contractRepository.findById(id);
    if (!contract) throw new NotFoundException('合同不存在');
    if (contract.status !== ContractStatus.draft) {
      throw new BadRequestException('仅草稿状态可提交签订审批');
    }

    await this.workflowService.create(user, {
      type: ApprovalType.contract,
      businessId: id,
      projectId: contract.projectId,
      metadata: {
        code: contract.code,
        amount: Number(contract.amountAmount),
      },
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'contract',
      resource: 'contract',
      resourceId: id,
      payload: { action: 'submit' },
    });

    return this.mapContract(contract);
  }

  async listRevisions(user: AuthUser, id: string) {
    this.assertPerm(user, 'contract.revision.read', '无权限查看变更历史');

    const contract = await this.contractRepository.findById(id);
    if (!contract) throw new NotFoundException('合同不存在');

    return this.contractRepository.listRevisions(id);
  }

  async createRevision(
    user: AuthUser,
    id: string,
    dto: CreateContractRevisionDto,
  ) {
    this.assertPerm(user, 'contract.revision.create', '无权限记录合同变更');

    const contract = await this.contractRepository.findById(id);
    if (!contract) throw new NotFoundException('合同不存在');
    if (contract.status === ContractStatus.terminated) {
      throw new BadRequestException('已终止合同不可变更');
    }

    const revision = await this.contractRepository.createRevision({
      contractId: id,
      changeType: dto.changeType,
      before: dto.before as Prisma.InputJsonValue,
      after: dto.after as Prisma.InputJsonValue,
      reason: dto.reason,
      changedById: user.id,
    });

    if (dto.changeType === 'amount' && dto.after.amount) {
      const amount = dto.after.amount as { amount?: number; currency?: string };
      if (amount.amount != null && amount.currency) {
        await this.contractRepository.update(id, {
          amountAmount: amount.amount,
          amountCurrency: amount.currency.toUpperCase(),
        });
      }
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'contract',
      resource: 'contract_revision',
      resourceId: revision.id,
      payload: { contractId: id, changeType: dto.changeType },
    });

    return revision;
  }

  async listCollections(user: AuthUser, id: string) {
    this.assertPerm(user, 'contract.collection.read', '无权限查看回款');

    const contract = await this.contractRepository.findById(id);
    if (!contract) throw new NotFoundException('合同不存在');

    const list = await this.contractRepository.listCollections(id);
    return {
      list: list.map((item) => ({
        id: item.id,
        code: item.code,
        contractId: item.contractId,
        projectId: item.projectId,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        collectedAt: item.collectedAt,
        remark: item.remark,
        createdAt: item.createdAt,
      })),
      total: list.length,
    };
  }

  async export(user: AuthUser, q?: string, projectId?: string) {
    this.assertPerm(user, 'contract.export', '无权限导出合同');

    const result = await this.list(user, 1, 10000, q, projectId);
    const headers = [
      '合同编号',
      '名称',
      '项目',
      '甲方',
      '乙方',
      '金额',
      '币种',
      '类型',
      '状态',
      '已回款',
    ];
    const rows = result.list.map((item) => [
      item.code,
      item.name,
      item.project?.name ?? '',
      item.partyA,
      item.partyB,
      String(item.amount.amount),
      item.amount.currency,
      item.type,
      item.status,
      String(item.collectedAmount.amount),
    ]);

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'contract',
      resource: 'contract',
      payload: { count: rows.length },
    });

    return {
      filename: `contracts-${Date.now()}.csv`,
      content: toCsv(headers, rows),
    };
  }
}
