import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PurchaseRequestStatus } from '@prisma/client';
import { ProcurementService } from './procurement.service';

describe('ProcurementService', () => {
  const procurementRepository = {
    findProjectById: vi.fn(),
    isProjectMember: vi.fn(),
    findMaterialById: vi.fn(),
    findRequestByCode: vi.fn(),
    findRequestById: vi.fn(),
    createRequest: vi.fn(),
    updateRequest: vi.fn(),
    updateRequestStatus: vi.fn(),
    findRequests: vi.fn(),
    findOrderByCode: vi.fn(),
    findOrderById: vi.fn(),
    findSupplierById: vi.fn(),
    createOrder: vi.fn(),
    appendPriceHistory: vi.fn(),
    updateMaterialPurchasePrice: vi.fn(),
    findSuppliers: vi.fn(),
    findSupplierByCode: vi.fn(),
  };

  const auditLogService = { create: vi.fn() };
  const workflowService = { create: vi.fn() };

  let service: ProcurementService;

  const procurementUser = {
    id: 'u1',
    username: 'proc',
    name: '采购',
    locale: 'zh',
    roles: ['procurement'],
    permissions: [
      'procurement.request.read',
      'procurement.request.create',
      'procurement.request.update',
      'procurement.request.submit',
      'procurement.order.read',
      'procurement.order.create',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProcurementService(
      procurementRepository as never,
      auditLogService as never,
      workflowService as never,
    );
  });

  it('rejects list without procurement.request.read', async () => {
    await expect(
      service.listRequests(
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

  it('rejects order create without supplier', async () => {
    await expect(
      service.createOrder(procurementUser, {
        code: 'PO-001',
        projectId: 'p1',
        supplierId: '',
        items: [
          {
            materialId: 'm1',
            quantity: 10,
            unit: '米',
            unitPrice: { amount: 45, currency: 'CNY' },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects order when request is not approved', async () => {
    procurementRepository.findProjectById.mockResolvedValue({ id: 'p1' });
    procurementRepository.findSupplierById.mockResolvedValue({ id: 's1' });
    procurementRepository.findRequestById.mockResolvedValue({
      id: 'r1',
      status: PurchaseRequestStatus.pending,
      projectId: 'p1',
    });

    await expect(
      service.createOrder(procurementUser, {
        code: 'PO-001',
        projectId: 'p1',
        supplierId: 's1',
        requestId: 'r1',
        items: [
          {
            materialId: 'm1',
            quantity: 10,
            unit: '米',
            unitPrice: { amount: 45, currency: 'CNY' },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists requests for procurement user', async () => {
    procurementRepository.findRequests.mockResolvedValue([
      [
        {
          id: 'r1',
          code: 'PR-001',
          projectId: 'p1',
          requesterId: 'u1',
          status: PurchaseRequestStatus.draft,
          remark: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          project: { id: 'p1', code: 'PRJ-1', name: '示例' },
          requester: { id: 'u1', name: '采购' },
          items: [],
        },
      ],
      1,
    ]);

    const result = await service.listRequests(procurementUser, 1, 20);
    expect(result.total).toBe(1);
    expect(result.list[0].code).toBe('PR-001');
  });
});
