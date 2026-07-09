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
  ApprovalRecordAction,
  ApprovalStatus,
  ApprovalType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { NotificationService } from '../notification/notification.service';
import { toCsv } from '../project/csv.util';
import {
  ApprovalActionDto,
  CreateApprovalDto,
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/workflow.dto';
import { WorkflowRepository } from './workflow.repository';
import {
  APPROVAL_TYPE_LABEL,
  ApprovalTemplateNode,
  PAYMENT_AMOUNT_LIMIT,
} from './workflow.types';
import { ProcurementService } from '../procurement/procurement.service';
import { ContractService } from '../contract/contract.service';
import { FinanceService } from '../finance/finance.service';
import { DrawingService } from '../drawing/drawing.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ProcurementService))
    private readonly procurementService: ProcurementService,
    @Inject(forwardRef(() => ContractService))
    private readonly contractService: ContractService,
    @Inject(forwardRef(() => FinanceService))
    private readonly financeService: FinanceService,
    @Inject(forwardRef(() => DrawingService))
    private readonly drawingService: DrawingService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes('admin');
  }

  private parseTemplateNodes(nodes: unknown): ApprovalTemplateNode[] {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new BadRequestException('审批模板节点配置无效');
    }
    return nodes as ApprovalTemplateNode[];
  }

  private async generateCode(type: ApprovalType) {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const prefix = `APV-${type.slice(0, 3).toUpperCase()}-${y}${m}${d}`;
    const count = await this.workflowRepository.countByDatePrefix(prefix);
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private getAmountFromMetadata(metadata: unknown) {
    if (!metadata || typeof metadata !== 'object') return 0;
    const amount = (metadata as Record<string, unknown>).amount;
    return typeof amount === 'number' ? amount : Number(amount) || 0;
  }

  private shouldSkipNode(
    node: ApprovalTemplateNode,
    metadata: unknown,
  ): boolean {
    if (node.condition === 'amount_over_limit') {
      return this.getAmountFromMetadata(metadata) <= PAYMENT_AMOUNT_LIMIT;
    }
    return false;
  }

  private async resolveApprover(
    node: ApprovalTemplateNode,
    projectId?: string | null,
  ) {
    if (node.role === 'project_manager') {
      if (!projectId) {
        throw new BadRequestException('该审批类型需要关联项目');
      }
      const project = await this.workflowRepository.findProjectById(projectId);
      if (!project) {
        throw new NotFoundException('项目不存在');
      }
      return project.managerId;
    }

    if (node.role === 'engineer') {
      if (!projectId) {
        throw new BadRequestException('该审批类型需要关联项目');
      }
      const member = await this.workflowRepository.findProjectMemberByRole(
        projectId,
        'engineer',
      );
      if (member) return member.user.id;
    }

    const users = await this.workflowRepository.findUsersByRole(
      node.role,
      projectId ?? undefined,
    );
    if (!users.length) {
      throw new BadRequestException(`未找到角色 ${node.role} 的审批人`);
    }
    return users[0].id;
  }

  private async getActiveNodes(type: ApprovalType, metadata?: unknown) {
    const template = await this.workflowRepository.findActiveTemplate(type);
    if (!template) {
      throw new BadRequestException('未配置审批流程模板');
    }
    const nodes = this.parseTemplateNodes(template.nodes).sort(
      (a, b) => a.node - b.node,
    );
    return nodes.filter((node) => !this.shouldSkipNode(node, metadata));
  }

  async resolveCurrentApprover(
    instance: {
      type: ApprovalType;
      currentNode: number;
      projectId: string | null;
      metadata: unknown;
      status: ApprovalStatus;
    },
  ) {
    if (instance.status !== ApprovalStatus.pending) {
      return null;
    }
    const nodes = await this.getActiveNodes(instance.type, instance.metadata);
    const current = nodes.find((n) => n.node === instance.currentNode);
    if (!current) {
      return null;
    }
    return this.resolveApprover(current, instance.projectId);
  }

  private async notifyApprover(
    approverId: string,
    instance: { id: string; code: string; type: ApprovalType },
    initiatorName: string,
  ) {
    const typeLabel = APPROVAL_TYPE_LABEL[instance.type] ?? instance.type;
    await this.notificationService.send({
      userId: approverId,
      type: NotificationType.approval,
      title: '待办审批',
      content: `${initiatorName} 提交了${typeLabel}审批（${instance.code}）`,
      link: `/approvals/${instance.id}`,
    });
  }

  private async notifyInitiator(
    initiatorId: string,
    instance: {
      id: string;
      code: string;
      type: ApprovalType;
      status: ApprovalStatus;
    },
  ) {
    const typeLabel = APPROVAL_TYPE_LABEL[instance.type] ?? instance.type;
    const statusLabel =
      instance.status === ApprovalStatus.approved
        ? '已通过'
        : instance.status === ApprovalStatus.rejected
          ? '已驳回'
          : '已撤回';
    await this.notificationService.send({
      userId: initiatorId,
      type: NotificationType.approval,
      title: '审批结果',
      content: `您的${typeLabel}审批（${instance.code}）${statusLabel}`,
      link: `/approvals/${instance.id}`,
    });
  }

  private buildSearchWhere(
    q?: string,
    type?: ApprovalType,
    status?: ApprovalStatus,
  ): Prisma.ApprovalInstanceWhereInput {
    const where: Prisma.ApprovalInstanceWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        {
          initiator: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        {
          project: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }
    return where;
  }

  async list(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    type?: ApprovalType,
    status?: ApprovalStatus,
  ) {
    if (!this.isAdmin(user) && !user.permissions.includes('workflow.approve')) {
      throw new ForbiddenException('无权限查看审批列表');
    }
    const skip = (page - 1) * pageSize;
    const where = this.buildSearchWhere(q, type, status);
    const [list, total] = await this.workflowRepository.findMany({
      skip,
      take: pageSize,
      where,
    });
    return { list, page, pageSize, total };
  }

  async listTodo(user: AuthUser, page = 1, pageSize = 20, q?: string) {
    if (!this.isAdmin(user) && !user.permissions.includes('workflow.approve')) {
      throw new ForbiddenException('无权限查看待办');
    }

    const where = {
      ...this.buildSearchWhere(q),
      status: ApprovalStatus.pending,
    };
    const [candidates] = await this.workflowRepository.findMany({
      skip: 0,
      take: 500,
      where,
    });

    const filtered = [];
    for (const item of candidates) {
      const approverId = await this.resolveCurrentApprover(item);
      if (this.isAdmin(user) || approverId === user.id) {
        filtered.push(item);
      }
    }

    const skip = (page - 1) * pageSize;
    const list = filtered.slice(skip, skip + pageSize);
    return { list, page, pageSize, total: filtered.length };
  }

  async listDone(user: AuthUser, page = 1, pageSize = 20, q?: string) {
    if (!this.isAdmin(user) && !user.permissions.includes('workflow.approve')) {
      throw new ForbiddenException('无权限查看已办');
    }

    const skip = (page - 1) * pageSize;
    const where: Prisma.ApprovalInstanceWhereInput = {
      ...this.buildSearchWhere(q),
      records: { some: { approverId: user.id } },
    };
    const [list, total] = await this.workflowRepository.findMany({
      skip,
      take: pageSize,
      where,
    });
    return { list, page, pageSize, total };
  }

  async listInitiated(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    type?: ApprovalType,
    status?: ApprovalStatus,
  ) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.ApprovalInstanceWhereInput = {
      ...this.buildSearchWhere(q, type, status),
      initiatorId: user.id,
    };
    const [list, total] = await this.workflowRepository.findMany({
      skip,
      take: pageSize,
      where,
    });
    return { list, page, pageSize, total };
  }

  async getOne(user: AuthUser, id: string) {
    const instance = await this.workflowRepository.findById(id);
    if (!instance) {
      throw new NotFoundException('审批不存在');
    }
    await this.assertCanView(user, instance);
    const currentApproverId = await this.resolveCurrentApprover(instance);
    return { ...instance, currentApproverId };
  }

  private async assertCanView(
    user: AuthUser,
    instance: {
      initiatorId: string;
      status: ApprovalStatus;
      type: ApprovalType;
      currentNode: number;
      projectId: string | null;
      metadata: unknown;
      records: { approverId: string }[];
    },
  ) {
    if (this.isAdmin(user)) return;
    if (instance.initiatorId === user.id) return;
    if (instance.records.some((r) => r.approverId === user.id)) return;
    if (user.permissions.includes('workflow.approve')) {
      const currentApproverId = await this.resolveCurrentApprover(instance);
      if (currentApproverId === user.id) return;
    }
    throw new ForbiddenException('无权限查看此审批');
  }

  async create(user: AuthUser, dto: CreateApprovalDto) {
    const existing = await this.workflowRepository.findByBusiness(
      dto.type,
      dto.businessId,
    );

    if (existing?.status === ApprovalStatus.pending) {
      throw new ConflictException('该业务单据已在审批中');
    }

    const nodes = await this.getActiveNodes(dto.type, dto.metadata);
    if (!nodes.length) {
      throw new BadRequestException('审批流程无有效节点');
    }

    if (dto.projectId) {
      const project = await this.workflowRepository.findProjectById(
        dto.projectId,
      );
      if (!project) {
        throw new NotFoundException('项目不存在');
      }
    }

    let instance;
    if (
      existing &&
      (existing.status === ApprovalStatus.rejected ||
        existing.status === ApprovalStatus.cancelled)
    ) {
      instance = await this.workflowRepository.resetInstance(existing.id, {
        metadata: dto.metadata as Prisma.InputJsonValue,
        projectId: dto.projectId ?? existing.projectId,
      });
    } else {
      const code = await this.generateCode(dto.type);
      instance = await this.workflowRepository.createInstance({
        code,
        type: dto.type,
        businessId: dto.businessId,
        projectId: dto.projectId,
        initiatorId: user.id,
        metadata: dto.metadata as Prisma.InputJsonValue,
      });
    }

    const approverId = await this.resolveApprover(
      nodes[0],
      instance.projectId,
    );
    await this.notifyApprover(approverId, instance, user.name);

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'workflow',
      resource: 'approval',
      resourceId: instance.id,
      payload: { type: dto.type, businessId: dto.businessId },
    });

    const currentApproverId = approverId;
    return { ...instance, currentApproverId };
  }

  private async assertCanAct(
    user: AuthUser,
    instance: {
      id: string;
      status: ApprovalStatus;
      type: ApprovalType;
      currentNode: number;
      projectId: string | null;
      metadata: unknown;
    },
  ) {
    if (instance.status !== ApprovalStatus.pending) {
      throw new BadRequestException('审批已结束，无法操作');
    }
    const approverId = await this.resolveCurrentApprover(instance);
    if (!approverId) {
      throw new BadRequestException('当前无有效审批节点');
    }
    if (!this.isAdmin(user) && approverId !== user.id) {
      throw new ForbiddenException('您不是当前节点审批人');
    }
    if (!user.permissions.includes('workflow.approve') && !this.isAdmin(user)) {
      throw new ForbiddenException('无审批权限');
    }
    return approverId;
  }

  async approve(user: AuthUser, id: string, dto: ApprovalActionDto) {
    const instance = await this.workflowRepository.findById(id);
    if (!instance) {
      throw new NotFoundException('审批不存在');
    }

    const approverId = await this.assertCanAct(user, instance);
    const nodes = await this.getActiveNodes(instance.type, instance.metadata);
    const currentIndex = nodes.findIndex((n) => n.node === instance.currentNode);
    const isLastNode = currentIndex === nodes.length - 1;

    await this.workflowRepository.createRecord({
      instanceId: instance.id,
      node: instance.currentNode,
      approverId,
      action: ApprovalRecordAction.approve,
      comment: dto.comment,
    });

    let updated;
    if (isLastNode) {
      updated = await this.workflowRepository.updateInstance(instance.id, {
        status: ApprovalStatus.approved,
      });
      await this.notifyInitiator(updated.initiatorId, updated);
      if (instance.type === ApprovalType.purchase_request) {
        await this.procurementService.syncRequestApproval(
          instance.businessId,
          'approved',
        );
      }
      if (instance.type === ApprovalType.contract) {
        await this.contractService.syncContractApproval(
          instance.businessId,
          'approved',
        );
      }
      if (instance.type === ApprovalType.payment) {
        await this.financeService.syncPaymentApproval(
          instance.businessId,
          'approved',
        );
      }
      if (instance.type === ApprovalType.reimbursement) {
        await this.financeService.syncReimbursementApproval(
          instance.businessId,
          'approved',
        );
      }
      if (instance.type === ApprovalType.drawing) {
        await this.drawingService.syncDrawingApproval(
          instance.businessId,
          'approved',
          approverId,
        );
      }
    } else {
      const nextNode = nodes[currentIndex + 1];
      updated = await this.workflowRepository.updateInstance(instance.id, {
        currentNode: nextNode.node,
      });
      const nextApproverId = await this.resolveApprover(
        nextNode,
        updated.projectId,
      );
      await this.notifyApprover(
        nextApproverId,
        updated,
        updated.initiator.name,
      );
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'approve',
      module: 'workflow',
      resource: 'approval',
      resourceId: instance.id,
      payload: { node: instance.currentNode, comment: dto.comment },
    });

    const currentApproverId = await this.resolveCurrentApprover(updated);
    return { ...updated, currentApproverId };
  }

  async reject(user: AuthUser, id: string, dto: ApprovalActionDto) {
    const instance = await this.workflowRepository.findById(id);
    if (!instance) {
      throw new NotFoundException('审批不存在');
    }

    const approverId = await this.assertCanAct(user, instance);

    await this.workflowRepository.createRecord({
      instanceId: instance.id,
      node: instance.currentNode,
      approverId,
      action: ApprovalRecordAction.reject,
      comment: dto.comment,
    });

    const updated = await this.workflowRepository.updateInstance(instance.id, {
      status: ApprovalStatus.rejected,
    });

    if (instance.type === ApprovalType.purchase_request) {
      await this.procurementService.syncRequestApproval(
        instance.businessId,
        'rejected',
      );
    }
    if (instance.type === ApprovalType.contract) {
      await this.contractService.syncContractApproval(
        instance.businessId,
        'rejected',
      );
    }
    if (instance.type === ApprovalType.payment) {
      await this.financeService.syncPaymentApproval(
        instance.businessId,
        'rejected',
      );
    }
    if (instance.type === ApprovalType.reimbursement) {
      await this.financeService.syncReimbursementApproval(
        instance.businessId,
        'rejected',
      );
    }
    if (instance.type === ApprovalType.drawing) {
      await this.drawingService.syncDrawingApproval(
        instance.businessId,
        'rejected',
        approverId,
      );
    }

    await this.notifyInitiator(updated.initiatorId, updated);

    await this.auditLogService.create({
      userId: user.id,
      action: 'reject',
      module: 'workflow',
      resource: 'approval',
      resourceId: instance.id,
      payload: { node: instance.currentNode, comment: dto.comment },
    });

    return { ...updated, currentApproverId: null };
  }

  async cancel(user: AuthUser, id: string) {
    const instance = await this.workflowRepository.findById(id);
    if (!instance) {
      throw new NotFoundException('审批不存在');
    }

    if (instance.status !== ApprovalStatus.pending) {
      throw new BadRequestException('仅进行中的审批可撤回');
    }

    const canCancel =
      this.isAdmin(user) || instance.initiatorId === user.id;
    if (!canCancel) {
      throw new ForbiddenException('无权限撤回此审批');
    }

    const updated = await this.workflowRepository.updateInstance(instance.id, {
      status: ApprovalStatus.cancelled,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'workflow',
      resource: 'approval',
      resourceId: instance.id,
      payload: { action: 'cancel' },
    });

    return { ...updated, currentApproverId: null };
  }

  async listTemplates(user: AuthUser) {
    if (
      !this.isAdmin(user) &&
      !user.permissions.includes('workflow.template.manage')
    ) {
      throw new ForbiddenException('无权限管理审批模板');
    }
    return this.workflowRepository.listTemplates();
  }

  async createTemplate(user: AuthUser, dto: CreateTemplateDto) {
    if (
      !this.isAdmin(user) &&
      !user.permissions.includes('workflow.template.manage')
    ) {
      throw new ForbiddenException('无权限管理审批模板');
    }

    const nodes = this.parseTemplateNodes(dto.nodes);
    const created = await this.workflowRepository.createTemplate({
      type: dto.type,
      name: dto.name,
      nodes,
    });
    await this.workflowRepository.deactivateTemplatesByType(dto.type, created.id);

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'workflow',
      resource: 'template',
      resourceId: created.id,
      payload: { type: dto.type, name: dto.name },
    });

    return created;
  }

  async updateTemplate(user: AuthUser, id: string, dto: UpdateTemplateDto) {
    if (
      !this.isAdmin(user) &&
      !user.permissions.includes('workflow.template.manage')
    ) {
      throw new ForbiddenException('无权限管理审批模板');
    }

    const existing = await this.workflowRepository.findTemplateById(id);
    if (!existing) {
      throw new NotFoundException('模板不存在');
    }

    const nodes = dto.nodes ? this.parseTemplateNodes(dto.nodes) : undefined;
    const updated = await this.workflowRepository.updateTemplate(id, {
      name: dto.name,
      nodes,
      isActive: dto.isActive,
    });

    if (dto.isActive) {
      await this.workflowRepository.deactivateTemplatesByType(
        updated.type,
        updated.id,
      );
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'workflow',
      resource: 'template',
      resourceId: id,
      payload: dto,
    });

    return updated;
  }

  async export(
    user: AuthUser,
    q?: string,
    type?: ApprovalType,
    status?: ApprovalStatus,
    scope: 'all' | 'initiated' = 'all',
  ) {
    const canExportAll =
      this.isAdmin(user) || user.permissions.includes('workflow.approve');

    const where: Prisma.ApprovalInstanceWhereInput = this.buildSearchWhere(
      q,
      type,
      status,
    );
    if (scope === 'initiated') {
      where.initiatorId = user.id;
    } else if (!canExportAll) {
      throw new ForbiddenException('无权限导出');
    }

    const [list] = await this.workflowRepository.findMany({
      skip: 0,
      take: 5000,
      where,
    });

    const headers = [
      'code',
      'type',
      'status',
      'initiator',
      'project',
      'currentNode',
      'createdAt',
    ];
    const rows = list.map((item) => [
      item.code,
      APPROVAL_TYPE_LABEL[item.type] ?? item.type,
      item.status,
      item.initiator.name,
      item.project?.name ?? '',
      String(item.currentNode),
      item.createdAt.toISOString(),
    ]);

    const content = toCsv(headers, rows);

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'workflow',
      resource: 'approval',
      payload: { count: rows.length, scope },
    });

    return {
      filename: `approvals-${Date.now()}.csv`,
      content,
    };
  }
}