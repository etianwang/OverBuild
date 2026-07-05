import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  const auditLogRepository = {
    findMany: vi.fn(),
    findById: vi.fn(),
    findAllForExport: vi.fn(),
    create: vi.fn(),
  };

  let service: AuditLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditLogService(auditLogRepository as never);
  });

  it('returns paginated list', async () => {
    auditLogRepository.findMany.mockResolvedValue([[{ id: '1' }], 1]);

    const result = await service.list({ page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.list).toHaveLength(1);
  });

  it('throws when log not found', async () => {
    auditLogRepository.findById.mockResolvedValue(null);

    await expect(service.getOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exports logs and records audit entry', async () => {
    auditLogRepository.findAllForExport.mockResolvedValue([
      {
        createdAt: new Date('2026-07-05'),
        user: { name: 'Admin' },
        action: 'login',
        module: 'auth',
        resource: 'session',
        resourceId: null,
        ip: '127.0.0.1',
      },
    ]);
    auditLogRepository.create.mockResolvedValue({ id: 'export-log' });

    const result = await service.export({}, 'admin-id');

    expect(result.filename).toContain('audit-logs-');
    expect(result.content).toContain('Admin');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'export', module: 'audit' }),
    );
  });
});
