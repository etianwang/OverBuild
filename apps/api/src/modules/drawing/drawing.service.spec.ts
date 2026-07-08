import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { DrawingService } from './drawing.service';

describe('DrawingService', () => {
  const drawingRepository = {
    findMany: vi.fn(),
    findProjectById: vi.fn(),
    isProjectMember: vi.fn(),
  };

  const auditLogService = { create: vi.fn() };
  const workflowService = { create: vi.fn() };

  let service: DrawingService;

  const engineerUser = {
    id: 'u1',
    username: 'engineer',
    name: '工程师',
    locale: 'zh',
    roles: ['engineer'],
    permissions: ['drawing.read', 'drawing.create'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DrawingService(
      drawingRepository as never,
      auditLogService as never,
      workflowService as never,
    );
  });

  it('rejects list without drawing.read', async () => {
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

  it('lists drawings for engineer', async () => {
    drawingRepository.findMany.mockResolvedValue([
      [
        {
          id: 'd1',
          drawingNo: 'A-001',
          name: '平面图',
          nameFr: null,
          projectId: 'p1',
          discipline: 'arch',
          zoneId: null,
          currentVersion: 1,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
          project: { id: 'p1', code: 'PRJ-1', name: '示例' },
        },
      ],
      1,
    ]);

    const result = await service.list(engineerUser, 1, 20);
    expect(result.total).toBe(1);
    expect(result.list[0].drawingNo).toBe('A-001');
  });
});
