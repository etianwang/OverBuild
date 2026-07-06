import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MaterialService } from './material.service';

describe('MaterialService', () => {
  const materialRepository = {
    findMany: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    countStockTransactions: vi.fn(),
    appendPriceHistory: vi.fn(),
    listCategories: vi.fn(),
    findCategoryById: vi.fn(),
    findCategoryByCode: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    softDeleteCategory: vi.fn(),
    countMaterialsInCategory: vi.fn(),
    findAlerts: vi.fn(),
    countAlerts: vi.fn(),
    listStockTransactions: vi.fn(),
    upsertQrcode: vi.fn(),
  };

  const auditLogService = { create: vi.fn() };

  let service: MaterialService;

  const reader = {
    id: 'u1',
    username: 'reader',
    name: 'Reader',
    locale: 'zh',
    roles: ['project_manager'],
    permissions: ['material.read'],
  };

  const writer = {
    id: 'u2',
    username: 'wh',
    name: 'Warehouse',
    locale: 'zh',
    roles: ['warehouse'],
    permissions: ['material.read', 'material.create', 'material.update'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MaterialService(
      materialRepository as never,
      auditLogService as never,
    );
  });

  it('rejects list without material.read', async () => {
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

  it('rejects duplicate material code on create', async () => {
    materialRepository.findCategoryById.mockResolvedValue({ id: 'c1' });
    materialRepository.findByCode.mockResolvedValue({ id: 'm1' });

    await expect(
      service.create(writer, {
        code: 'MAT-001',
        name: '钢管',
        unit: '米',
        categoryId: 'c1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists materials for reader', async () => {
    materialRepository.findMany.mockResolvedValue([
      [
        {
          id: 'm1',
          code: 'MAT-001',
          name: '钢管',
          spec: null,
          brand: null,
          model: null,
          unit: '米',
          categoryId: 'c1',
          stock: 0,
          minStock: null,
          purchasePriceAmount: null,
          purchasePriceCurrency: null,
          imageUrl: null,
          supplierId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: 'c1', code: 'PIPE', name: '管材' },
          priceHistory: [],
        },
      ],
      1,
    ]);

    const result = await service.list(reader, 1, 20);
    expect(result.total).toBe(1);
    expect(result.list[0].code).toBe('MAT-001');
  });
});
