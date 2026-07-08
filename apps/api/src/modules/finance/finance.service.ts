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
  BudgetStatus,
  PaymentStatus,
  Prisma,
  ReimbursementStatus,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { toCsv } from '../project/csv.util';
import { WorkflowService } from '../workflow/workflow.service';
import {
  CreateBudgetDto,
  CreateCollectionDto,
  CreateCostDto,
  CreateExchangeRateDto,
  CreateIncomeDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  CreateReimbursementDto,
  UpdateBudgetDto,
  UpdateInvoiceDto,
  UpdatePaymentDto,
  UpdateReimbursementDto,
} from './dto/finance.dto';
import { FinanceRepository } from './finance.repository';

@Injectable()
export class FinanceService {
  constructor(
    private readonly financeRepository: FinanceRepository,
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
    if (!this.hasPerm(user, code)) {
      throw new ForbiddenException(message);
    }
  }

  private toMoney(amount: Prisma.Decimal, currency: string) {
    return { amount: Number(amount), currency };
  }

  private async applyProjectScope(
    user: AuthUser,
    where: { projectId?: string; OR?: Array<{ projectId?: { in: string[] } }> },
    projectId?: string,
  ) {
    if (this.isAdmin(user) || user.roles.includes('finance') || user.roles.includes('boss')) {
      if (projectId) where.projectId = projectId;
      return;
    }

    const managed = await this.financeRepository.findManagedProjectIds(user.id);
    const memberProjects = await this.financeRepository.findMemberProjectIds(user.id);

    const ids = new Set<string>();
    managed.forEach((p) => ids.add(p.id));
    memberProjects.forEach((m) => ids.add(m.projectId));

    if (!ids.size) {
      where.projectId = 'none';
      return;
    }

    if (projectId) {
      if (!ids.has(projectId)) {
        throw new ForbiddenException('无权限查看该项目财务数据');
      }
      where.projectId = projectId;
      return;
    }

    where.OR = [{ projectId: { in: [...ids] } }];
  }

  private async validateAccount(
    accountType: 'cash' | 'bank',
    accountId: string,
  ) {
    const account =
      accountType === 'cash'
        ? await this.financeRepository.findCashAccount(accountId)
        : await this.financeRepository.findBankAccount(accountId);
    if (!account) throw new NotFoundException('账户不存在');
    return account;
  }

  async syncPaymentApproval(businessId: string, result: 'approved' | 'rejected') {
    const payment = await this.financeRepository.findPaymentById(businessId);
    if (!payment) return;

    const status =
      result === 'approved' ? PaymentStatus.approved : PaymentStatus.rejected;
    await this.financeRepository.updatePaymentStatus(businessId, status, {
      approvedAt: result === 'approved' ? new Date() : null,
    });
  }

  async syncReimbursementApproval(
    businessId: string,
    result: 'approved' | 'rejected',
  ) {
    const reimbursement =
      await this.financeRepository.findReimbursementById(businessId);
    if (!reimbursement) return;

    const status =
      result === 'approved'
        ? ReimbursementStatus.approved
        : ReimbursementStatus.rejected;
    await this.financeRepository.updateReimbursementStatus(businessId, status);
  }

  // ── Incomes ──

  async listIncomes(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
  ) {
    this.assertPerm(user, 'finance.income.read', '无权限查看收入');

    const where: Prisma.IncomeWhereInput = {};
    await this.applyProjectScope(user, where as never, projectId);
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [list, total] = await this.financeRepository.findIncomes({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { receivedAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        id: item.id,
        code: item.code,
        projectId: item.projectId,
        contractId: item.contractId,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        receivedAt: item.receivedAt,
        summary: item.summary,
        project: item.project,
        contract: item.contract,
        createdAt: item.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  }

  async createIncome(user: AuthUser, dto: CreateIncomeDto) {
    this.assertPerm(user, 'finance.income.create', '无权限登记收入');

    const project = await this.financeRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');

    if (await this.financeRepository.findIncomeByCode(dto.code)) {
      throw new ConflictException('收入编号已存在');
    }

    if (dto.contractId) {
      const contract = await this.financeRepository.findContractById(
        dto.contractId,
      );
      if (!contract || contract.projectId !== dto.projectId) {
        throw new BadRequestException('合同与项目不匹配');
      }
    }

    const income = await this.financeRepository.createIncome({
      code: dto.code,
      project: { connect: { id: dto.projectId } },
      contract: dto.contractId
        ? { connect: { id: dto.contractId } }
        : undefined,
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
      receivedAt: new Date(dto.receivedAt),
      summary: dto.summary,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'finance',
      resource: 'income',
      resourceId: income.id,
      payload: { code: dto.code },
    });

    return income;
  }

  async exportIncomes(user: AuthUser, q?: string, projectId?: string) {
    this.assertPerm(user, 'finance.income.export', '无权限导出收入');
    const result = await this.listIncomes(user, 1, 10000, q, projectId);
    const content = toCsv(
      ['编号', '项目', '金额', '币种', '日期', '摘要'],
      result.list.map((item) => [
        item.code,
        item.project?.name ?? '',
        String(item.amount.amount),
        item.amount.currency,
        item.receivedAt.toISOString().slice(0, 10),
        item.summary ?? '',
      ]),
    );
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'finance',
      resource: 'income',
      payload: { count: result.total },
    });
    return { filename: `incomes-${Date.now()}.csv`, content };
  }

  // ── Payments ──

  async listPayments(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
    status?: PaymentStatus,
  ) {
    this.assertPerm(user, 'finance.payment.read', '无权限查看付款');

    const where: Prisma.PaymentWhereInput = {};
    await this.applyProjectScope(user, where as never, projectId);
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { payee: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [list, total] = await this.financeRepository.findPayments({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        id: item.id,
        code: item.code,
        projectId: item.projectId,
        payee: item.payee,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        paymentMethod: item.paymentMethod,
        accountType: item.accountType,
        accountId: item.accountId,
        status: item.status,
        approvedAt: item.approvedAt,
        paidAt: item.paidAt,
        project: item.project,
        createdAt: item.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  }

  async createPayment(user: AuthUser, dto: CreatePaymentDto) {
    this.assertPerm(user, 'finance.payment.create', '无权限创建付款');

    const project = await this.financeRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');
    if (await this.financeRepository.findPaymentByCode(dto.code)) {
      throw new ConflictException('付款单号已存在');
    }
    await this.validateAccount(dto.accountType, dto.accountId);

    const payment = await this.financeRepository.createPayment({
      code: dto.code,
      project: { connect: { id: dto.projectId } },
      payee: dto.payee,
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
      paymentMethod: dto.paymentMethod,
      accountType: dto.accountType,
      accountId: dto.accountId,
      purchaseOrder: dto.purchaseOrderId
        ? { connect: { id: dto.purchaseOrderId } }
        : undefined,
      contract: dto.contractId
        ? { connect: { id: dto.contractId } }
        : undefined,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'finance',
      resource: 'payment',
      resourceId: payment.id,
      payload: { code: dto.code },
    });

    return payment;
  }

  async updatePayment(user: AuthUser, id: string, dto: UpdatePaymentDto) {
    this.assertPerm(user, 'finance.payment.update', '无权限编辑付款');

    const payment = await this.financeRepository.findPaymentById(id);
    if (!payment) throw new NotFoundException('付款单不存在');
    if (payment.status !== PaymentStatus.draft) {
      throw new BadRequestException('仅草稿状态可编辑');
    }

    if (dto.accountType && dto.accountId) {
      await this.validateAccount(dto.accountType, dto.accountId);
    }

    const updated = await this.financeRepository.updatePayment(id, {
      payee: dto.payee,
      amountAmount: dto.amount?.amount,
      amountCurrency: dto.amount?.currency?.toUpperCase(),
      paymentMethod: dto.paymentMethod,
      accountType: dto.accountType,
      accountId: dto.accountId,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'finance',
      resource: 'payment',
      resourceId: id,
    });

    return updated;
  }

  async submitPayment(user: AuthUser, id: string) {
    this.assertPerm(user, 'finance.payment.submit', '无权限提交付款审批');

    const payment = await this.financeRepository.findPaymentById(id);
    if (!payment) throw new NotFoundException('付款单不存在');
    if (payment.status !== PaymentStatus.draft) {
      throw new BadRequestException('仅草稿状态可提交审批');
    }

    await this.workflowService.create(user, {
      type: ApprovalType.payment,
      businessId: id,
      projectId: payment.projectId,
      metadata: {
        code: payment.code,
        amount: Number(payment.amountAmount),
        payee: payment.payee,
      },
    });

    const updated = await this.financeRepository.updatePaymentStatus(
      id,
      PaymentStatus.pending,
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'finance',
      resource: 'payment',
      resourceId: id,
      payload: { action: 'submit' },
    });

    return updated;
  }

  async executePayment(user: AuthUser, id: string) {
    this.assertPerm(user, 'finance.payment.execute', '无权限执行付款');

    const payment = await this.financeRepository.findPaymentById(id);
    if (!payment) throw new NotFoundException('付款单不存在');
    if (payment.status !== PaymentStatus.approved) {
      throw new BadRequestException('仅已审批付款可执行');
    }

    const amount = Number(payment.amountAmount);
    try {
      await this.financeRepository.debitAccount(
        payment.accountType,
        payment.accountId,
        amount,
        payment.amountCurrency,
        'payment',
        'payment',
        id,
        new Date(),
        payment.payee,
      );
    } catch {
      throw new BadRequestException('账户余额不足');
    }

    const updated = await this.financeRepository.updatePaymentStatus(
      id,
      PaymentStatus.paid,
      { paidAt: new Date() },
    );

    await this.financeRepository.createCost({
      project: { connect: { id: payment.projectId } },
      source: 'manual',
      sourceId: id,
      category: '付款',
      amountAmount: amount,
      amountCurrency: payment.amountCurrency,
      occurredAt: new Date(),
      description: `付款 ${payment.code} - ${payment.payee}`,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'finance',
      resource: 'payment',
      resourceId: id,
      payload: { action: 'execute' },
    });

    return updated;
  }

  async exportPayments(user: AuthUser, q?: string, projectId?: string) {
    this.assertPerm(user, 'finance.payment.export', '无权限导出付款');
    const result = await this.listPayments(user, 1, 10000, q, projectId);
    const content = toCsv(
      ['编号', '项目', '收款方', '金额', '币种', '状态'],
      result.list.map((item) => [
        item.code,
        item.project?.name ?? '',
        item.payee,
        String(item.amount.amount),
        item.amount.currency,
        item.status,
      ]),
    );
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'finance',
      resource: 'payment',
      payload: { count: result.total },
    });
    return { filename: `payments-${Date.now()}.csv`, content };
  }

  // ── Collections ──

  async listCollections(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
  ) {
    this.assertPerm(user, 'finance.collection.read', '无权限查看回款');

    const where: Prisma.CollectionWhereInput = {};
    await this.applyProjectScope(user, where as never, projectId);
    if (q) {
      where.OR = [{ code: { contains: q, mode: 'insensitive' } }];
    }

    const [list, total] = await this.financeRepository.findCollections({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { collectedAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        id: item.id,
        code: item.code,
        contractId: item.contractId,
        projectId: item.projectId,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        collectedAt: item.collectedAt,
        accountType: item.accountType,
        accountId: item.accountId,
        remark: item.remark,
        contract: item.contract,
        project: item.project,
        createdAt: item.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  }

  async createCollection(user: AuthUser, dto: CreateCollectionDto) {
    this.assertPerm(user, 'finance.collection.create', '无权限登记回款');

    if (!dto.contractId) {
      throw new BadRequestException('回款必须关联合同');
    }

    const contract = await this.financeRepository.findContractById(dto.contractId);
    if (!contract) throw new NotFoundException('合同不存在');
    if (await this.financeRepository.findCollectionByCode(dto.code)) {
      throw new ConflictException('回款编号已存在');
    }
    await this.validateAccount(dto.accountType, dto.accountId);

    const collection = await this.financeRepository.createCollection({
      code: dto.code,
      contract: { connect: { id: dto.contractId } },
      project: { connect: { id: contract.projectId } },
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
      collectedAt: new Date(dto.collectedAt),
      accountType: dto.accountType,
      accountId: dto.accountId,
      remark: dto.remark,
    });

    await this.financeRepository.updateContractCollected(
      dto.contractId,
      dto.amount.amount,
      dto.amount.currency.toUpperCase(),
    );

    await this.financeRepository.creditAccount(
      dto.accountType,
      dto.accountId,
      dto.amount.amount,
      dto.amount.currency.toUpperCase(),
      'collection',
      'collection',
      collection.id,
      new Date(dto.collectedAt),
      dto.remark,
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'finance',
      resource: 'collection',
      resourceId: collection.id,
      payload: { code: dto.code, contractId: dto.contractId },
    });

    return collection;
  }

  async exportCollections(user: AuthUser, q?: string, projectId?: string) {
    this.assertPerm(user, 'finance.collection.export', '无权限导出回款');
    const result = await this.listCollections(user, 1, 10000, q, projectId);
    const content = toCsv(
      ['编号', '合同', '项目', '金额', '币种', '到账日'],
      result.list.map((item) => [
        item.code,
        item.contract?.name ?? '',
        item.project?.name ?? '',
        String(item.amount.amount),
        item.amount.currency,
        item.collectedAt.toISOString().slice(0, 10),
      ]),
    );
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'finance',
      resource: 'collection',
      payload: { count: result.total },
    });
    return { filename: `collections-${Date.now()}.csv`, content };
  }

  // ── Reimbursements ──

  async listReimbursements(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    projectId?: string,
  ) {
    this.assertPerm(user, 'finance.reimbursement.read', '无权限查看报销');

    const where: Prisma.ReimbursementWhereInput = {};
    await this.applyProjectScope(user, where as never, projectId);

    const [list, total] = await this.financeRepository.findReimbursements({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        id: item.id,
        code: item.code,
        projectId: item.projectId,
        applicantId: item.applicantId,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        description: item.description,
        status: item.status,
        project: item.project,
        applicant: item.applicant,
        createdAt: item.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  }

  async createReimbursement(user: AuthUser, dto: CreateReimbursementDto) {
    this.assertPerm(user, 'finance.reimbursement.create', '无权限创建报销');

    const project = await this.financeRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');
    if (await this.financeRepository.findReimbursementByCode(dto.code)) {
      throw new ConflictException('报销单号已存在');
    }

    const reimbursement = await this.financeRepository.createReimbursement({
      code: dto.code,
      project: { connect: { id: dto.projectId } },
      applicant: { connect: { id: user.id } },
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
      description: dto.description,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'finance',
      resource: 'reimbursement',
      resourceId: reimbursement.id,
      payload: { code: dto.code },
    });

    return reimbursement;
  }

  async updateReimbursement(
    user: AuthUser,
    id: string,
    dto: UpdateReimbursementDto,
  ) {
    this.assertPerm(user, 'finance.reimbursement.update', '无权限编辑报销');

    const reimbursement = await this.financeRepository.findReimbursementById(id);
    if (!reimbursement) throw new NotFoundException('报销单不存在');
    if (reimbursement.status !== ReimbursementStatus.draft) {
      throw new BadRequestException('仅草稿状态可编辑');
    }

    const updated = await this.financeRepository.updateReimbursement(id, {
      amountAmount: dto.amount?.amount,
      amountCurrency: dto.amount?.currency?.toUpperCase(),
      description: dto.description,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'finance',
      resource: 'reimbursement',
      resourceId: id,
    });

    return updated;
  }

  async submitReimbursement(user: AuthUser, id: string) {
    this.assertPerm(user, 'finance.reimbursement.submit', '无权限提交报销');

    const reimbursement = await this.financeRepository.findReimbursementById(id);
    if (!reimbursement) throw new NotFoundException('报销单不存在');
    if (reimbursement.status !== ReimbursementStatus.draft) {
      throw new BadRequestException('仅草稿状态可提交审批');
    }

    await this.workflowService.create(user, {
      type: ApprovalType.reimbursement,
      businessId: id,
      projectId: reimbursement.projectId,
      metadata: {
        code: reimbursement.code,
        amount: Number(reimbursement.amountAmount),
      },
    });

    const updated = await this.financeRepository.updateReimbursementStatus(
      id,
      ReimbursementStatus.pending,
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'finance',
      resource: 'reimbursement',
      resourceId: id,
      payload: { action: 'submit' },
    });

    return updated;
  }

  async exportReimbursements(user: AuthUser, projectId?: string) {
    this.assertPerm(user, 'finance.reimbursement.export', '无权限导出报销');
    const result = await this.listReimbursements(user, 1, 10000, projectId);
    const content = toCsv(
      ['编号', '项目', '申请人', '金额', '币种', '状态'],
      result.list.map((item) => [
        item.code,
        item.project?.name ?? '',
        item.applicant?.name ?? '',
        String(item.amount.amount),
        item.amount.currency,
        item.status,
      ]),
    );
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'finance',
      resource: 'reimbursement',
      payload: { count: result.total },
    });
    return { filename: `reimbursements-${Date.now()}.csv`, content };
  }

  // ── Budgets ──

  async listBudgets(user: AuthUser, page = 1, pageSize = 20, projectId?: string) {
    this.assertPerm(user, 'finance.budget.read', '无权限查看预算');

    const where: Prisma.BudgetWhereInput = { status: BudgetStatus.active };
    await this.applyProjectScope(user, where as never, projectId);

    const [list, total] = await this.financeRepository.findBudgets({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { category: 'asc' },
    });

    return {
      list: list.map((item) => ({
        id: item.id,
        projectId: item.projectId,
        category: item.category,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        status: item.status,
        project: item.project,
        createdAt: item.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  }

  async createBudget(user: AuthUser, dto: CreateBudgetDto) {
    this.assertPerm(user, 'finance.budget.create', '无权限编制预算');

    const project = await this.financeRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');

    const budget = await this.financeRepository.createBudget({
      project: { connect: { id: dto.projectId } },
      category: dto.category,
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'finance',
      resource: 'budget',
      resourceId: budget.id,
      payload: { category: dto.category },
    });

    return budget;
  }

  async updateBudget(user: AuthUser, id: string, dto: UpdateBudgetDto) {
    this.assertPerm(user, 'finance.budget.update', '无权限调整预算');

    const budget = await this.financeRepository.findBudgetById(id);
    if (!budget) throw new NotFoundException('预算不存在');
    if (budget.status !== BudgetStatus.active) {
      throw new BadRequestException('仅生效预算可调整');
    }

    await this.financeRepository.createBudgetRevision({
      budget: { connect: { id } },
      before: {
        amount: {
          amount: Number(budget.amountAmount),
          currency: budget.amountCurrency,
        },
      },
      after: {
        amount: {
          amount: dto.amount.amount,
          currency: dto.amount.currency,
        },
      } as Prisma.InputJsonValue,
      reason: dto.reason,
      changedBy: { connect: { id: user.id } },
    });

    const updated = await this.financeRepository.updateBudget(id, {
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'finance',
      resource: 'budget',
      resourceId: id,
    });

    return updated;
  }

  async deactivateBudget(user: AuthUser, id: string) {
    this.assertPerm(user, 'finance.budget.deactivate', '无权限停用预算');

    const budget = await this.financeRepository.findBudgetById(id);
    if (!budget) throw new NotFoundException('预算不存在');

    const updated = await this.financeRepository.updateBudget(id, {
      status: BudgetStatus.inactive,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'finance',
      resource: 'budget',
      resourceId: id,
      payload: { action: 'deactivate' },
    });

    return updated;
  }

  async getBudgetExecution(user: AuthUser, id: string) {
    this.assertPerm(user, 'finance.budget.read', '无权限查看预算执行');

    const budget = await this.financeRepository.findBudgetById(id);
    if (!budget) throw new NotFoundException('预算不存在');

    const costs = await this.financeRepository.sumCostsByProject(budget.projectId);
    const actual = Number(costs._sum.amountAmount ?? 0);
    const planned = Number(budget.amountAmount);

    return {
      budgetId: id,
      category: budget.category,
      planned: this.toMoney(budget.amountAmount, budget.amountCurrency),
      actualAmount: actual,
      variance: planned - actual,
      executionRate: planned > 0 ? actual / planned : 0,
    };
  }

  // ── Costs ──

  async listCosts(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    projectId?: string,
  ) {
    this.assertPerm(user, 'finance.cost.read', '无权限查看成本');

    const where: Prisma.CostWhereInput = {};
    await this.applyProjectScope(user, where as never, projectId);

    const [list, total] = await this.financeRepository.findCosts({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { occurredAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        id: item.id,
        projectId: item.projectId,
        source: item.source,
        sourceId: item.sourceId,
        category: item.category,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        occurredAt: item.occurredAt,
        description: item.description,
        project: item.project,
        createdAt: item.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  }

  async createCost(user: AuthUser, dto: CreateCostDto) {
    this.assertPerm(user, 'finance.cost.create', '无权限补录成本');

    const project = await this.financeRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');

    const cost = await this.financeRepository.createCost({
      project: { connect: { id: dto.projectId } },
      source: dto.source,
      sourceId: dto.sourceId,
      category: dto.category,
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
      occurredAt: new Date(dto.occurredAt),
      description: dto.description,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'finance',
      resource: 'cost',
      resourceId: cost.id,
    });

    return cost;
  }

  async getCostSummary(user: AuthUser, projectId?: string) {
    this.assertPerm(user, 'finance.cost.read', '无权限查看成本汇总');

    const where: Prisma.CostWhereInput = {};
    await this.applyProjectScope(user, where as never, projectId);

    const result = await this.listCosts(user, 1, 10000, projectId);
    const byProject = new Map<string, number>();
    for (const item of result.list) {
      const current = byProject.get(item.projectId) ?? 0;
      byProject.set(item.projectId, current + item.amount.amount);
    }

    return {
      list: [...byProject.entries()].map(([pid, total]) => ({
        projectId: pid,
        totalCost: total,
      })),
      total: result.total,
    };
  }

  // ── Invoices ──

  async listInvoices(user: AuthUser, page = 1, pageSize = 20, q?: string) {
    this.assertPerm(user, 'finance.invoice.read', '无权限查看发票');

    const where: Prisma.InvoiceWhereInput = {};
    if (q) {
      where.invoiceNo = { contains: q, mode: 'insensitive' };
    }

    const [list, total] = await this.financeRepository.findInvoices({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { issuedAt: 'desc' },
    });

    return {
      list: list.map((item) => ({
        id: item.id,
        invoiceNo: item.invoiceNo,
        type: item.type,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        taxRate: item.taxRate ? Number(item.taxRate) : null,
        issuedAt: item.issuedAt,
        contractId: item.contractId,
        projectId: item.projectId,
        createdAt: item.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  }

  async createInvoice(user: AuthUser, dto: CreateInvoiceDto) {
    this.assertPerm(user, 'finance.invoice.create', '无权限登记发票');

    if (await this.financeRepository.findInvoiceByNo(dto.invoiceNo)) {
      throw new ConflictException('发票号已存在');
    }

    const invoice = await this.financeRepository.createInvoice({
      invoiceNo: dto.invoiceNo,
      type: dto.type,
      amountAmount: dto.amount.amount,
      amountCurrency: dto.amount.currency.toUpperCase(),
      taxRate: dto.taxRate,
      issuedAt: new Date(dto.issuedAt),
      contract: dto.contractId
        ? { connect: { id: dto.contractId } }
        : undefined,
      project: dto.projectId
        ? { connect: { id: dto.projectId } }
        : undefined,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'finance',
      resource: 'invoice',
      resourceId: invoice.id,
    });

    return invoice;
  }

  async updateInvoice(user: AuthUser, id: string, dto: UpdateInvoiceDto) {
    this.assertPerm(user, 'finance.invoice.update', '无权限编辑发票');

    const invoice = await this.financeRepository.findInvoiceById(id);
    if (!invoice) throw new NotFoundException('发票不存在');

    const updated = await this.financeRepository.updateInvoice(id, {
      amountAmount: dto.amount?.amount,
      amountCurrency: dto.amount?.currency?.toUpperCase(),
      taxRate: dto.taxRate,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'finance',
      resource: 'invoice',
      resourceId: id,
    });

    return updated;
  }

  async exportInvoices(user: AuthUser, q?: string) {
    this.assertPerm(user, 'finance.invoice.export', '无权限导出发票');
    const result = await this.listInvoices(user, 1, 10000, q);
    const content = toCsv(
      ['发票号', '类型', '金额', '币种', '开票日'],
      result.list.map((item) => [
        item.invoiceNo,
        item.type,
        String(item.amount.amount),
        item.amount.currency,
        item.issuedAt.toISOString().slice(0, 10),
      ]),
    );
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'finance',
      resource: 'invoice',
      payload: { count: result.total },
    });
    return { filename: `invoices-${Date.now()}.csv`, content };
  }

  // ── Accounts ──

  async listCashAccounts(user: AuthUser) {
    this.assertPerm(user, 'finance.account.read', '无权限查看账户');
    const list = await this.financeRepository.listCashAccounts();
    return {
      list: list.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        balance: this.toMoney(item.balanceAmount, item.balanceCurrency),
      })),
      total: list.length,
    };
  }

  async listBankAccounts(user: AuthUser) {
    this.assertPerm(user, 'finance.account.read', '无权限查看账户');
    const list = await this.financeRepository.listBankAccounts();
    return {
      list: list.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        bankName: item.bankName,
        accountNo: item.accountNo,
        balance: this.toMoney(item.balanceAmount, item.balanceCurrency),
      })),
      total: list.length,
    };
  }

  async getAccountTransactions(
    user: AuthUser,
    accountType: 'cash' | 'bank',
    accountId: string,
    page = 1,
    pageSize = 20,
  ) {
    this.assertPerm(user, 'finance.account.read', '无权限查看账户流水');
    await this.validateAccount(accountType, accountId);

    const [list, total] = await this.financeRepository.findAccountTransactions(
      accountType,
      accountId,
      (page - 1) * pageSize,
      pageSize,
    );

    return {
      list: list.map((item) => ({
        id: item.id,
        transactionType: item.transactionType,
        amount: this.toMoney(item.amountAmount, item.amountCurrency),
        balanceAfter: Number(item.balanceAfterAmount),
        occurredAt: item.occurredAt,
        remark: item.remark,
      })),
      page,
      pageSize,
      total,
    };
  }

  async getAccountBalance(
    user: AuthUser,
    accountType: 'cash' | 'bank',
    accountId: string,
  ) {
    this.assertPerm(user, 'finance.account.read', '无权限查看账户余额');
    const account = await this.validateAccount(accountType, accountId);
    return {
      accountType,
      accountId,
      balance: this.toMoney(account.balanceAmount, account.balanceCurrency),
    };
  }

  // ── Reports ──

  async getDailyReport(user: AuthUser, dateStr?: string) {
    this.assertPerm(user, 'finance.report.read', '无权限查看日报');

    const date = dateStr ? new Date(dateStr) : new Date();
    const incomes = await this.financeRepository.sumIncomesByDate(date);
    const collections = await this.financeRepository.sumCollectionsByDate(date);
    const payments = await this.financeRepository.sumPaymentsByDate(date);

    return {
      date: date.toISOString().slice(0, 10),
      income: {
        count: incomes._count,
        amount: Number(incomes._sum.amountAmount ?? 0),
      },
      collection: {
        count: collections._count,
        amount: Number(collections._sum.amountAmount ?? 0),
      },
      payment: {
        count: payments._count,
        amount: Number(payments._sum.amountAmount ?? 0),
      },
    };
  }

  async getMonthlyReport(user: AuthUser, year?: number, month?: number) {
    this.assertPerm(user, 'finance.report.read', '无权限查看月报');

    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);

    const profitSummary = await this.getProfitSummary(user);

    return {
      year: y,
      month: m,
      period: { start, end },
      projects: profitSummary.list,
      totalProfit: profitSummary.list.reduce((s, p) => s + p.profit, 0),
    };
  }

  async exportDailyReport(user: AuthUser, dateStr?: string) {
    this.assertPerm(user, 'finance.report.export', '无权限导出日报');
    const report = await this.getDailyReport(user, dateStr);
    const content = toCsv(
      ['指标', '笔数', '金额'],
      [
        ['收入', String(report.income.count), String(report.income.amount)],
        ['回款', String(report.collection.count), String(report.collection.amount)],
        ['付款', String(report.payment.count), String(report.payment.amount)],
      ],
    );
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'finance',
      resource: 'daily_report',
      payload: { date: report.date },
    });
    return { filename: `daily-report-${report.date}.csv`, content };
  }

  async exportMonthlyReport(user: AuthUser, year?: number, month?: number) {
    this.assertPerm(user, 'finance.report.export', '无权限导出月报');
    const report = await this.getMonthlyReport(user, year, month);
    const content = toCsv(
      ['项目', '收入', '成本', '利润'],
      report.projects.map((p) => [
        p.projectName,
        String(p.income),
        String(p.cost),
        String(p.profit),
      ]),
    );
    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'finance',
      resource: 'monthly_report',
      payload: { year: report.year, month: report.month },
    });
    return {
      filename: `monthly-report-${report.year}-${report.month}.csv`,
      content,
    };
  }

  // ── Profit ──

  async getProjectProfit(user: AuthUser, projectId: string) {
    this.assertPerm(user, 'finance.profit.read', '无权限查看项目利润');

    const project = await this.financeRepository.findProjectById(projectId);
    if (!project) throw new NotFoundException('项目不存在');

    const incomes = await this.financeRepository.sumIncomesByProject(projectId);
    const collections =
      await this.financeRepository.sumCollectionsByProject(projectId);
    const costs = await this.financeRepository.sumCostsByProject(projectId);

    const income =
      Number(incomes._sum.amountAmount ?? 0) +
      Number(collections._sum.amountAmount ?? 0);
    const cost = Number(costs._sum.amountAmount ?? 0);

    return {
      projectId,
      projectName: project.name,
      income,
      cost,
      profit: income - cost,
      profitRate: income > 0 ? (income - cost) / income : 0,
    };
  }

  async getProfitSummary(user: AuthUser) {
    this.assertPerm(user, 'finance.profit.read', '无权限查看项目利润');

    const where: Prisma.ProjectWhereInput = { deletedAt: null };
    if (!this.isAdmin(user) && !user.roles.includes('finance') && !user.roles.includes('boss')) {
      const managed = await this.financeRepository.findManagedProjectIds(user.id);
      const ids = managed.map((p) => p.id);
      if (!ids.length) return { list: [], total: 0 };
      where.id = { in: ids };
    }

    const projects = await this.financeRepository.listProjects(where);

    const list = [];
    for (const project of projects) {
      const profit = await this.getProjectProfit(user, project.id);
      list.push({
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        income: profit.income,
        cost: profit.cost,
        profit: profit.profit,
        profitRate: profit.profitRate,
      });
    }

    return { list, total: list.length };
  }

  // ── Currencies / Exchange rates ──

  async listCurrencies(user: AuthUser) {
    this.assertPerm(user, 'finance.currency.read', '无权限查看币种');
    const list = await this.financeRepository.listCurrencies();
    return { list, total: list.length };
  }

  async listExchangeRates(user: AuthUser, rateDate?: string) {
    this.assertPerm(user, 'finance.exchange_rate.read', '无权限查看汇率');
    const date = rateDate ? new Date(rateDate) : undefined;
    const list = await this.financeRepository.findExchangeRates(date);
    return {
      list: list.map((item) => ({
        id: item.id,
        baseCurrency: item.baseCurrency,
        quoteCurrency: item.quoteCurrency,
        rate: Number(item.rate),
        rateDate: item.rateDate,
      })),
      total: list.length,
    };
  }

  async getLatestExchangeRates(user: AuthUser) {
    this.assertPerm(user, 'finance.exchange_rate.read', '无权限查看汇率');
    const list = await this.financeRepository.findLatestExchangeRates();
    return {
      list: list.map((item) => ({
        id: item.id,
        baseCurrency: item.baseCurrency,
        quoteCurrency: item.quoteCurrency,
        rate: Number(item.rate),
        rateDate: item.rateDate,
      })),
      total: list.length,
    };
  }

  async upsertExchangeRate(user: AuthUser, dto: CreateExchangeRateDto) {
    this.assertPerm(user, 'finance.exchange_rate.create', '无权限录入汇率');

    const rate = await this.financeRepository.upsertExchangeRate({
      baseCurrency: dto.baseCurrency.toUpperCase(),
      quoteCurrency: dto.quoteCurrency.toUpperCase(),
      rate: dto.rate,
      rateDate: new Date(dto.rateDate),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'finance',
      resource: 'exchange_rate',
      resourceId: rate.id,
      payload: dto,
    });

    return {
      id: rate.id,
      baseCurrency: rate.baseCurrency,
      quoteCurrency: rate.quoteCurrency,
      rate: Number(rate.rate),
      rateDate: rate.rateDate,
    };
  }
}
