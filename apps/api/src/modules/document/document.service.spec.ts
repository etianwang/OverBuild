import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  const documentRepository = {
    findDocuments: vi.fn(),
    findByCode: vi.fn(),
    findProjectById: vi.fn(),
    findById: vi.fn(),
  };

  const auditLogService = { create: vi.fn() };

  let service: DocumentService;

  const engineerUser = {
    id: 'u1',
    username: 'engineer',
    name: '工程师',
    locale: 'zh',
    roles: ['engineer'],
    permissions: ['document.read', 'document.create'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentService(
      documentRepository as never,
      auditLogService as never,
    );
  });

  it('rejects list without document.read', async () => {
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

  it('lists documents for engineer', async () => {
    documentRepository.findDocuments.mockResolvedValue([
      [
        {
          id: 'd1',
          code: 'DOC-001',
          title: '施工方案',
          titleFr: null,
          projectId: 'p1',
          categoryId: null,
          tags: ['方案'],
          currentVersion: 1,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          project: { id: 'p1', code: 'PRJ-1', name: '示例' },
        },
      ],
      1,
    ]);

    const result = await service.list(engineerUser, 1, 20);
    expect(result.total).toBe(1);
    expect(result.list[0].code).toBe('DOC-001');
  });
});
