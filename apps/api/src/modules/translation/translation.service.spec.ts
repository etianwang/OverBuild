import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  const translationRepository = {
    findManyTasks: vi.fn(),
    findTaskById: vi.fn(),
    listAllGlossary: vi.fn(),
    upsertVersion: vi.fn(),
    updateTask: vi.fn(),
  };

  const auditLogService = { create: vi.fn() };

  let service: TranslationService;

  const translatorUser = {
    id: 'u1',
    username: 'translator',
    name: '译员',
    locale: 'zh',
    roles: ['translator'],
    permissions: [
      'translation.task.read',
      'translation.task.create',
      'translation.auto',
      'translation.manual',
      'translation.glossary.read',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TranslationService(
      translationRepository as never,
      auditLogService as never,
    );
  });

  it('rejects list without translation.task.read', async () => {
    await expect(
      service.listTasks(
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

  it('lists tasks for translator', async () => {
    translationRepository.findManyTasks.mockResolvedValue([
      [
        {
          id: 't1',
          code: 'TR-001',
          sourceType: 'document',
          sourceId: 'd1',
          sourceLang: 'zh',
          targetLang: 'fr',
          status: 'pending',
          assigneeId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          versions: [],
        },
      ],
      1,
    ]);

    const result = await service.listTasks(translatorUser, 1, 20);
    expect(result.total).toBe(1);
    expect(result.list[0].code).toBe('TR-001');
  });

  it('prefers manual content in mapped task', async () => {
    translationRepository.findTaskById.mockResolvedValue({
      id: 't1',
      code: 'TR-001',
      sourceType: 'document',
      sourceId: 'd1',
      sourceLang: 'zh',
      targetLang: 'fr',
      status: 'completed',
      assigneeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [
        {
          id: 'v1',
          source: 'auto',
          content: { title: 'auto title' },
          createdAt: new Date(),
        },
        {
          id: 'v2',
          source: 'manual',
          content: { title: 'manual title' },
          createdAt: new Date(),
          translatedBy: { id: 'u1', name: '译员' },
        },
      ],
    });

    const result = await service.getTask(translatorUser, 't1');
    expect(result.preferredSource).toBe('manual');
    expect(result.preferredContent).toEqual({ title: 'manual title' });
  });
});
