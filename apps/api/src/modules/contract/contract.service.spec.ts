import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { ContractService } from './contract.service';

describe('ContractService', () => {
  const contractRepository = {
    findProjectById: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    countCollections: vi.fn(),
    findMany: vi.fn(),
    findApprovalByBusiness: vi.fn(),
  };

  const auditLogService = { create: vi.fn() };
  const workflowService = { create: vi.fn() };

  let service: ContractService;

  const financeUser = {
    id: 'u1',
    username: 'finance',
    name: '财务',
    locale: 'zh',
    roles: ['finance'],
    permissions: ['contract.read', 'contract.create', 'contract.update'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContractService(
      contractRepository as never,
      auditLogService as never,
      workflowService as never,
    );
  });

  it('rejects list without contract.read', async () => {
    await expect(
      service.list(
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

  it('rejects duplicate contract code on create', async () => {
    contractRepository.findProjectById.mockResolvedValue({ id: 'p1' });
    contractRepository.findByCode.mockResolvedValue({ id: 'c1' });

    await expect(
      service.create(financeUser, {
        code: 'CTR-001',
        name: '总包合同',
        projectId: 'p1',
        partyA: '甲方',
        partyB: '乙方',
        amount: { amount: 1000000, currency: 'CNY' },
        type: 'construction',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists contracts for finance user', async () => {
    contractRepository.findMany.mockResolvedValue([
      [
        {
          id: 'c1',
          code: 'CTR-001',
          name: '总包合同',
          nameFr: null,
          projectId: 'p1',
          partyA: '甲方',
          partyB: '乙方',
          amountAmount: 1000000,
          amountCurrency: 'CNY',
          type: 'construction',
          signedAt: null,
          startDate: null,
          endDate: null,
          status: ContractStatus.draft,
          collectedAmountAmount: 0,
          collectedAmountCurrency: 'CNY',
          attachmentUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          project: { id: 'p1', code: 'PRJ-1', name: '示例' },
        },
      ],
      1,
    ]);

    const result = await service.list(financeUser, 1, 20);
    expect(result.total).toBe(1);
    expect(result.list[0].code).toBe('CTR-001');
  });
});
