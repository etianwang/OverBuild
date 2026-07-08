import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  const financeRepository = {
    findManagedProjectIds: vi.fn(),
    findMemberProjectIds: vi.fn(),
    findIncomes: vi.fn(),
    findIncomeByCode: vi.fn(),
    findProjectById: vi.fn(),
    findContractById: vi.fn(),
    createIncome: vi.fn(),
    findCollectionByCode: vi.fn(),
    findCashAccount: vi.fn(),
    findBankAccount: vi.fn(),
    createCollection: vi.fn(),
    updateContractCollected: vi.fn(),
    creditAccount: vi.fn(),
    findPaymentById: vi.fn(),
    updatePaymentStatus: vi.fn(),
    sumIncomesByProject: vi.fn(),
    sumCollectionsByProject: vi.fn(),
    sumCostsByProject: vi.fn(),
  };

  const auditLogService = { create: vi.fn() };
  const workflowService = { create: vi.fn() };

  let service: FinanceService;

  const financeUser = {
    id: 'u1',
    username: 'finance',
    name: '财务',
    locale: 'zh',
    roles: ['finance'],
    permissions: [
      'finance.income.read',
      'finance.income.create',
      'finance.collection.read',
      'finance.collection.create',
      'finance.profit.read',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FinanceService(
      financeRepository as never,
      auditLogService as never,
      workflowService as never,
    );
  });

  it('rejects list incomes without permission', async () => {
    await expect(
      service.listIncomes(
        {
          id: 'x',
          username: 'x',
          name: 'x',
          locale: 'zh',
          roles: [],
          permissions: [],
        },
        1,
        20,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects collection without contractId in dto validation path', async () => {
    await expect(
      service.createCollection(financeUser, {
        code: 'COL-001',
        contractId: '',
        amount: { amount: 1000, currency: 'CNY' },
        collectedAt: '2026-07-08',
        accountType: 'bank',
        accountId: 'acc-1',
      }),
    ).rejects.toThrow();
  });

  it('calculates project profit', async () => {
    financeRepository.findProjectById.mockResolvedValue({
      id: 'p1',
      name: '示例项目',
    });
    financeRepository.sumIncomesByProject.mockResolvedValue({
      _sum: { amountAmount: 100000 },
    });
    financeRepository.sumCollectionsByProject.mockResolvedValue({
      _sum: { amountAmount: 50000 },
    });
    financeRepository.sumCostsByProject.mockResolvedValue({
      _sum: { amountAmount: 80000 },
    });

    const result = await service.getProjectProfit(financeUser, 'p1');
    expect(result.income).toBe(150000);
    expect(result.cost).toBe(80000);
    expect(result.profit).toBe(70000);
  });
});
