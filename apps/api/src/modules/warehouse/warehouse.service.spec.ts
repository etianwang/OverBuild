import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';

describe('WarehouseService', () => {
  const warehouseRepository = {
    findProjectById: vi.fn(),
    isProjectMember: vi.fn(),
    findWarehouseByCode: vi.fn(),
    findWarehouseById: vi.fn(),
    createWarehouse: vi.fn(),
    listWarehouses: vi.fn(),
    findOutboundById: vi.fn(),
    confirmOutboundTransaction: vi.fn(),
    findMaterialById: vi.fn(),
  };

  const auditLogService = { create: vi.fn() };
  const notificationService = { maybeNotifyLowStock: vi.fn() };

  let service: WarehouseService;

  const warehouseUser = {
    id: 'u1',
    username: 'wh',
    name: '仓管',
    locale: 'zh',
    roles: ['warehouse'],
    permissions: [
      'warehouse.read',
      'warehouse.outbound.create',
      'warehouse.outbound.confirm',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WarehouseService(
      warehouseRepository as never,
      auditLogService as never,
      notificationService as never,
    );
  });

  it('rejects list without warehouse.read', async () => {
    await expect(
      service.listWarehouses(
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

  it('rejects outbound create without projectId', async () => {
    await expect(
      service.createOutbound(warehouseUser, {
        code: 'OUT-001',
        warehouseId: 'w1',
        projectId: '',
        type: 'usage',
        items: [{ materialId: 'm1', quantity: 1, unit: '个' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists warehouses for warehouse role', async () => {
    warehouseRepository.listWarehouses.mockResolvedValue([
      [
        {
          id: 'w1',
          code: 'WH-1',
          name: '主仓',
          projectId: 'p1',
          address: null,
          status: 'active',
          project: { id: 'p1', code: 'PRJ-1', name: '示例' },
        },
      ],
      1,
    ]);

    const result = await service.listWarehouses(warehouseUser, 1, 20);
    expect(result.total).toBe(1);
    expect(result.list[0].code).toBe('WH-1');
  });
});
