import { Injectable } from '@nestjs/common';
import {
  AccountTransactionType,
  FinanceAccountType,
  PaymentStatus,
  Prisma,
  ReimbursementStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const projectSelect = { id: true, code: true, name: true } as const;

@Injectable()
export class FinanceRepository {
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

  findManagedProjectIds(managerId: string) {
    return this.prisma.project.findMany({
      where: { managerId, deletedAt: null },
      select: { id: true },
    });
  }

  findMemberProjectIds(userId: string) {
    return this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
  }

  listProjects(where: Prisma.ProjectWhereInput) {
    return this.prisma.project.findMany({
      where,
      select: { id: true, code: true, name: true },
    });
  }

  findContractById(id: string) {
    return this.prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: { project: { select: projectSelect } },
    });
  }

  findIncomes(params: {
    skip: number;
    take: number;
    where: Prisma.IncomeWhereInput;
    orderBy: Prisma.IncomeOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.income.findMany({
        ...params,
        include: {
          project: { select: projectSelect },
          contract: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.income.count({ where: params.where }),
    ]);
  }

  findIncomeByCode(code: string) {
    return this.prisma.income.findFirst({ where: { code } });
  }

  createIncome(data: Prisma.IncomeCreateInput) {
    return this.prisma.income.create({
      data,
      include: {
        project: { select: projectSelect },
        contract: { select: { id: true, code: true, name: true } },
      },
    });
  }

  findPayments(params: {
    skip: number;
    take: number;
    where: Prisma.PaymentWhereInput;
    orderBy: Prisma.PaymentOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.payment.findMany({
        ...params,
        include: { project: { select: projectSelect } },
      }),
      this.prisma.payment.count({ where: params.where }),
    ]);
  }

  findPaymentById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: { project: { select: projectSelect } },
    });
  }

  findPaymentByCode(code: string) {
    return this.prisma.payment.findFirst({ where: { code } });
  }

  createPayment(data: Prisma.PaymentCreateInput) {
    return this.prisma.payment.create({
      data,
      include: { project: { select: projectSelect } },
    });
  }

  updatePayment(id: string, data: Prisma.PaymentUpdateInput) {
    return this.prisma.payment.update({
      where: { id },
      data,
      include: { project: { select: projectSelect } },
    });
  }

  updatePaymentStatus(id: string, status: PaymentStatus, extra?: Prisma.PaymentUpdateInput) {
    return this.prisma.payment.update({
      where: { id },
      data: { status, ...extra },
      include: { project: { select: projectSelect } },
    });
  }

  findCollections(params: {
    skip: number;
    take: number;
    where: Prisma.CollectionWhereInput;
    orderBy: Prisma.CollectionOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.collection.findMany({
        ...params,
        include: {
          project: { select: projectSelect },
          contract: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.collection.count({ where: params.where }),
    ]);
  }

  findCollectionById(id: string) {
    return this.prisma.collection.findUnique({
      where: { id },
      include: {
        project: { select: projectSelect },
        contract: { select: { id: true, code: true, name: true } },
      },
    });
  }

  findCollectionByCode(code: string) {
    return this.prisma.collection.findFirst({ where: { code } });
  }

  createCollection(data: Prisma.CollectionCreateInput) {
    return this.prisma.collection.create({
      data,
      include: {
        project: { select: projectSelect },
        contract: { select: { id: true, code: true, name: true } },
      },
    });
  }

  updateContractCollected(
    contractId: string,
    addAmount: number,
    currency: string,
  ) {
    return this.prisma.contract.update({
      where: { id: contractId },
      data: {
        collectedAmountAmount: { increment: addAmount },
        collectedAmountCurrency: currency,
      },
    });
  }

  findReimbursements(params: {
    skip: number;
    take: number;
    where: Prisma.ReimbursementWhereInput;
    orderBy: Prisma.ReimbursementOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.reimbursement.findMany({
        ...params,
        include: {
          project: { select: projectSelect },
          applicant: { select: { id: true, name: true } },
        },
      }),
      this.prisma.reimbursement.count({ where: params.where }),
    ]);
  }

  findReimbursementById(id: string) {
    return this.prisma.reimbursement.findUnique({
      where: { id },
      include: {
        project: { select: projectSelect },
        applicant: { select: { id: true, name: true } },
      },
    });
  }

  findReimbursementByCode(code: string) {
    return this.prisma.reimbursement.findFirst({ where: { code } });
  }

  createReimbursement(data: Prisma.ReimbursementCreateInput) {
    return this.prisma.reimbursement.create({
      data,
      include: {
        project: { select: projectSelect },
        applicant: { select: { id: true, name: true } },
      },
    });
  }

  updateReimbursement(id: string, data: Prisma.ReimbursementUpdateInput) {
    return this.prisma.reimbursement.update({
      where: { id },
      data,
      include: {
        project: { select: projectSelect },
        applicant: { select: { id: true, name: true } },
      },
    });
  }

  updateReimbursementStatus(
    id: string,
    status: ReimbursementStatus,
    extra?: Prisma.ReimbursementUpdateInput,
  ) {
    return this.prisma.reimbursement.update({
      where: { id },
      data: { status, ...extra },
      include: {
        project: { select: projectSelect },
        applicant: { select: { id: true, name: true } },
      },
    });
  }

  findBudgets(params: {
    skip: number;
    take: number;
    where: Prisma.BudgetWhereInput;
    orderBy: Prisma.BudgetOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.budget.findMany({
        ...params,
        include: { project: { select: projectSelect } },
      }),
      this.prisma.budget.count({ where: params.where }),
    ]);
  }

  findBudgetById(id: string) {
    return this.prisma.budget.findUnique({
      where: { id },
      include: { project: { select: projectSelect } },
    });
  }

  createBudget(data: Prisma.BudgetCreateInput) {
    return this.prisma.budget.create({
      data,
      include: { project: { select: projectSelect } },
    });
  }

  updateBudget(id: string, data: Prisma.BudgetUpdateInput) {
    return this.prisma.budget.update({
      where: { id },
      data,
      include: { project: { select: projectSelect } },
    });
  }

  createBudgetRevision(data: Prisma.BudgetRevisionCreateInput) {
    return this.prisma.budgetRevision.create({ data });
  }

  sumCostsByProject(projectId: string) {
    return this.prisma.cost.aggregate({
      where: { projectId },
      _sum: { amountAmount: true },
    });
  }

  findCosts(params: {
    skip: number;
    take: number;
    where: Prisma.CostWhereInput;
    orderBy: Prisma.CostOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.cost.findMany({
        ...params,
        include: { project: { select: projectSelect } },
      }),
      this.prisma.cost.count({ where: params.where }),
    ]);
  }

  createCost(data: Prisma.CostCreateInput) {
    return this.prisma.cost.create({
      data,
      include: { project: { select: projectSelect } },
    });
  }

  findInvoices(params: {
    skip: number;
    take: number;
    where: Prisma.InvoiceWhereInput;
    orderBy: Prisma.InvoiceOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.invoice.findMany({ ...params }),
      this.prisma.invoice.count({ where: params.where }),
    ]);
  }

  findInvoiceById(id: string) {
    return this.prisma.invoice.findUnique({ where: { id } });
  }

  findInvoiceByNo(invoiceNo: string) {
    return this.prisma.invoice.findFirst({ where: { invoiceNo } });
  }

  createInvoice(data: Prisma.InvoiceCreateInput) {
    return this.prisma.invoice.create({ data });
  }

  updateInvoice(id: string, data: Prisma.InvoiceUpdateInput) {
    return this.prisma.invoice.update({ where: { id }, data });
  }

  listCashAccounts() {
    return this.prisma.cashAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  listBankAccounts() {
    return this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  findCashAccount(id: string) {
    return this.prisma.cashAccount.findFirst({
      where: { id, isActive: true },
    });
  }

  findBankAccount(id: string) {
    return this.prisma.bankAccount.findFirst({
      where: { id, isActive: true },
    });
  }

  findAccountTransactions(
    accountType: FinanceAccountType,
    accountId: string,
    skip: number,
    take: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.accountTransaction.findMany({
        where: { accountType, accountId },
        orderBy: { occurredAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.accountTransaction.count({
        where: { accountType, accountId },
      }),
    ]);
  }

  creditAccount(
    accountType: FinanceAccountType,
    accountId: string,
    amount: number,
    currency: string,
    transactionType: AccountTransactionType,
    referenceType: string,
    referenceId: string,
    occurredAt: Date,
    remark?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let balanceAfter: number;
      if (accountType === 'cash') {
        const account = await tx.cashAccount.findUniqueOrThrow({
          where: { id: accountId },
        });
        balanceAfter = Number(account.balanceAmount) + amount;
        await tx.cashAccount.update({
          where: { id: accountId },
          data: { balanceAmount: balanceAfter, balanceCurrency: currency },
        });
      } else {
        const account = await tx.bankAccount.findUniqueOrThrow({
          where: { id: accountId },
        });
        balanceAfter = Number(account.balanceAmount) + amount;
        await tx.bankAccount.update({
          where: { id: accountId },
          data: { balanceAmount: balanceAfter, balanceCurrency: currency },
        });
      }
      await tx.accountTransaction.create({
        data: {
          accountType,
          accountId,
          transactionType,
          amountAmount: amount,
          amountCurrency: currency,
          balanceAfterAmount: balanceAfter,
          referenceType,
          referenceId,
          occurredAt,
          remark,
        },
      });
      return balanceAfter;
    });
  }

  debitAccount(
    accountType: FinanceAccountType,
    accountId: string,
    amount: number,
    currency: string,
    transactionType: AccountTransactionType,
    referenceType: string,
    referenceId: string,
    occurredAt: Date,
    remark?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let balanceAfter: number;
      if (accountType === 'cash') {
        const account = await tx.cashAccount.findUniqueOrThrow({
          where: { id: accountId },
        });
        if (Number(account.balanceAmount) < amount) {
          throw new Error('INSUFFICIENT_BALANCE');
        }
        balanceAfter = Number(account.balanceAmount) - amount;
        await tx.cashAccount.update({
          where: { id: accountId },
          data: { balanceAmount: balanceAfter },
        });
      } else {
        const account = await tx.bankAccount.findUniqueOrThrow({
          where: { id: accountId },
        });
        if (Number(account.balanceAmount) < amount) {
          throw new Error('INSUFFICIENT_BALANCE');
        }
        balanceAfter = Number(account.balanceAmount) - amount;
        await tx.bankAccount.update({
          where: { id: accountId },
          data: { balanceAmount: balanceAfter },
        });
      }
      await tx.accountTransaction.create({
        data: {
          accountType,
          accountId,
          transactionType,
          amountAmount: amount,
          amountCurrency: currency,
          balanceAfterAmount: balanceAfter,
          referenceType,
          referenceId,
          occurredAt,
          remark,
        },
      });
      return balanceAfter;
    });
  }

  sumIncomesByProject(projectId: string) {
    return this.prisma.income.aggregate({
      where: { projectId },
      _sum: { amountAmount: true },
    });
  }

  sumCollectionsByProject(projectId: string) {
    return this.prisma.collection.aggregate({
      where: { projectId },
      _sum: { amountAmount: true },
    });
  }

  listCurrencies() {
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  findExchangeRates(rateDate?: Date) {
    return this.prisma.exchangeRate.findMany({
      where: rateDate ? { rateDate } : undefined,
      orderBy: [{ rateDate: 'desc' }, { baseCurrency: 'asc' }],
    });
  }

  findLatestExchangeRates() {
    return this.prisma.exchangeRate.findMany({
      orderBy: { rateDate: 'desc' },
      take: 50,
    });
  }

  upsertExchangeRate(data: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    rateDate: Date;
  }) {
    return this.prisma.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency_rateDate: {
          baseCurrency: data.baseCurrency,
          quoteCurrency: data.quoteCurrency,
          rateDate: data.rateDate,
        },
      },
      update: { rate: data.rate },
      create: data,
    });
  }

  sumPaymentsByDate(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this.prisma.payment.aggregate({
      where: { paidAt: { gte: start, lte: end }, status: 'paid' },
      _sum: { amountAmount: true },
      _count: true,
    });
  }

  sumCollectionsByDate(date: Date) {
    return this.prisma.collection.aggregate({
      where: { collectedAt: date },
      _sum: { amountAmount: true },
      _count: true,
    });
  }

  sumIncomesByDate(date: Date) {
    return this.prisma.income.aggregate({
      where: { receivedAt: date },
      _sum: { amountAmount: true },
      _count: true,
    });
  }
}
