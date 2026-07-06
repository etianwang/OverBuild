import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, ApprovalType } from '@prisma/client';
import { WorkflowService } from './workflow.service';

describe('WorkflowService', () => {
  const workflowRepository = {
    findActiveTemplate: vi.fn(),
    findByBusiness: vi.fn(),
    findById: vi.fn(),
    countByDatePrefix: vi.fn(),
    createInstance: vi.fn(),
    resetInstance: vi.fn(),
    createRecord: vi.fn(),
    updateInstance: vi.fn(),
    findProjectById: vi.fn(),
    findUsersByRole: vi.fn(),
    findProjectMemberByRole: vi.fn(),
    createNotification: vi.fn(),
    findMany: vi.fn(),
    listTemplates: vi.fn(),
    findTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deactivateTemplatesByType: vi.fn(),
  };

  const auditLogService = {
    create: vi.fn(),
  };

  let service: WorkflowService;

  const adminUser = {
    id: 'admin-1',
    username: 'admin',
    name: 'Admin',
    locale: 'zh',
    roles: ['admin'],
    permissions: ['workflow.approve', 'workflow.template.manage'],
  };

  const pmUser = {
    id: 'pm-1',
    username: 'pm',
    name: 'PM',
    locale: 'zh',
    roles: ['project_manager'],
    permissions: ['workflow.approve'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkflowService(
      workflowRepository as never,
      auditLogService as never,
    );
  });

  it('rejects list for user without workflow.approve', async () => {
    await expect(
      service.list(
        {
          id: 'u1',
          username: 'u',
          name: 'U',
          locale: 'zh',
          roles: [],
          permissions: [],
        },
        1,
        20,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects approve when not current approver', async () => {
    workflowRepository.findById.mockResolvedValue({
      id: 'a1',
      status: ApprovalStatus.pending,
      type: ApprovalType.purchase_request,
      currentNode: 1,
      projectId: 'p1',
      metadata: null,
      initiator: { id: 'u2', name: 'Initiator' },
      project: { id: 'p1', code: 'P1', name: 'Project' },
      records: [],
    });
    workflowRepository.findActiveTemplate.mockResolvedValue({
      nodes: [{ node: 1, role: 'project_manager' }],
    });
    workflowRepository.findProjectById.mockResolvedValue({
      id: 'p1',
      managerId: 'other-pm',
    });

    await expect(
      service.approve(pmUser, 'a1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects cancel on completed approval', async () => {
    workflowRepository.findById.mockResolvedValue({
      id: 'a1',
      status: ApprovalStatus.approved,
      initiatorId: adminUser.id,
      type: ApprovalType.payment,
      currentNode: 1,
      projectId: null,
      metadata: null,
      initiator: { id: adminUser.id, name: 'Admin' },
      records: [],
    });

    await expect(service.cancel(adminUser, 'a1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('skips boss node when payment amount is below limit', async () => {
    workflowRepository.findActiveTemplate.mockResolvedValue({
      nodes: [
        { node: 1, role: 'finance' },
        { node: 2, role: 'boss', condition: 'amount_over_limit' },
      ],
    });

    const nodes = await (service as unknown as {
      getActiveNodes: (type: ApprovalType, metadata?: unknown) => Promise<unknown[]>;
    }).getActiveNodes(ApprovalType.payment, { amount: 1000 });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ role: 'finance' });
  });
});
