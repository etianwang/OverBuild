import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  const projectRepository = {
    findByCode: vi.fn(),
    userExists: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    isMember: vi.fn(),
  };

  const auditLogService = {
    create: vi.fn(),
  };

  let service: ProjectService;

  const adminUser = {
    id: 'admin-id',
    username: 'admin',
    name: 'Admin',
    email: null,
    locale: 'zh',
    roles: ['admin'],
    permissions: ['project.create', 'project.read'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectService(
      projectRepository as never,
      auditLogService as never,
    );
  });

  it('rejects duplicate project code', async () => {
    projectRepository.findByCode.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create(adminUser, {
        code: 'PRJ-001',
        name: 'Test',
        status: ProjectStatus.planning,
        managerId: 'mgr-id',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates project and writes audit log', async () => {
    projectRepository.findByCode.mockResolvedValue(null);
    projectRepository.userExists.mockResolvedValue({ id: 'mgr-id' });
    projectRepository.create.mockResolvedValue({
      id: 'p1',
      code: 'PRJ-001',
      name: 'Test',
    });

    const result = await service.create(adminUser, {
      code: 'PRJ-001',
      name: 'Test',
      status: ProjectStatus.planning,
      managerId: 'mgr-id',
    });

    expect(result.code).toBe('PRJ-001');
    expect(auditLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'project', action: 'create' }),
    );
  });
});
