import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Locale,
  Prisma,
  TranslationSourceType,
  TranslationTaskStatus,
  TranslationVersionSource,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { parseCsv, toCsv } from '../project/csv.util';
import {
  AssignTranslationTaskDto,
  CreateGlossaryTermDto,
  CreateTranslationTaskDto,
  ImportGlossaryDto,
  SubmitManualTranslationDto,
  UpdateEntityTranslationsDto,
  UpdateGlossaryTermDto,
} from './dto/translation.dto';
import {
  buildGlossarySearchText,
  buildTaskSearchText,
  mockTranslateContent,
  pickPreferredVersion,
  translateContentWithDeepL,
} from './translation-engine.util';
import { DeepLClient } from './deepl.client';
import { TranslationRepository } from './translation.repository';

const ENTITY_TYPES = new Set([
  'project',
  'material',
  'document',
  'drawing',
  'document_category',
]);

const STATUS_LABEL: Record<TranslationTaskStatus, string> = {
  pending: '待处理',
  auto: '自动译文',
  manual: '人工译文',
  completed: '已完成',
};

@Injectable()
export class TranslationService {
  constructor(
    private readonly translationRepository: TranslationRepository,
    private readonly auditLogService: AuditLogService,
    private readonly deepLClient: DeepLClient,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes('admin');
  }

  private hasPerm(user: AuthUser, code: string) {
    return this.isAdmin(user) || user.permissions.includes(code);
  }

  private assertPerm(user: AuthUser, code: string, message: string) {
    if (!this.hasPerm(user, code)) {
      throw new ForbiddenException(message);
    }
  }

  private mapTask(task: {
    id: string;
    code: string;
    sourceType: TranslationSourceType;
    sourceId: string;
    sourceLang: Locale;
    targetLang: Locale;
    status: TranslationTaskStatus;
    assigneeId: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignee?: { id: string; name: string } | null;
    createdBy?: { id: string; name: string } | null;
    versions?: Array<{
      id: string;
      source: TranslationVersionSource;
      content: Prisma.JsonValue;
      createdAt: Date;
      translatedBy?: { id: string; name: string } | null;
    }>;
  }) {
    const versions =
      task.versions?.map((v) => ({
        id: v.id,
        source: v.source,
        content: v.content as Record<string, string>,
        translatedBy: v.translatedBy ?? undefined,
        createdAt: v.createdAt,
      })) ?? [];
    const preferred = pickPreferredVersion(versions);

    return {
      id: task.id,
      code: task.code,
      sourceType: task.sourceType,
      sourceId: task.sourceId,
      sourceLang: task.sourceLang,
      targetLang: task.targetLang,
      status: task.status,
      statusLabel: STATUS_LABEL[task.status],
      assigneeId: task.assigneeId,
      assignee: task.assignee ?? undefined,
      createdBy: task.createdBy ?? undefined,
      versions,
      preferredContent: preferred?.content ?? null,
      preferredSource: preferred?.source ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private async resolveSourceLabel(
    sourceType: TranslationSourceType,
    sourceId: string,
  ) {
    switch (sourceType) {
      case TranslationSourceType.document: {
        const doc = await this.translationRepository.findDocumentById(sourceId);
        return doc ? `${doc.code} ${doc.title}` : sourceId;
      }
      case TranslationSourceType.drawing: {
        const drawing =
          await this.translationRepository.findDrawingById(sourceId);
        return drawing ? `${drawing.drawingNo} ${drawing.name}` : sourceId;
      }
      case TranslationSourceType.entity:
        return sourceId;
      default:
        return sourceId;
    }
  }

  private async assertSourceExists(
    sourceType: TranslationSourceType,
    sourceId: string,
  ) {
    switch (sourceType) {
      case TranslationSourceType.document: {
        const doc = await this.translationRepository.findDocumentById(sourceId);
        if (!doc) throw new NotFoundException('文档不存在');
        return doc;
      }
      case TranslationSourceType.drawing: {
        const drawing =
          await this.translationRepository.findDrawingById(sourceId);
        if (!drawing) throw new NotFoundException('图纸不存在');
        return drawing;
      }
      case TranslationSourceType.entity:
        throw new BadRequestException('实体类型任务请通过实体翻译接口维护');
      default:
        throw new BadRequestException('无效来源类型');
    }
  }

  private async extractSourceContent(
    sourceType: TranslationSourceType,
    sourceId: string,
  ): Promise<Record<string, string>> {
    switch (sourceType) {
      case TranslationSourceType.document: {
        const doc = await this.translationRepository.findDocumentById(sourceId);
        if (!doc) throw new NotFoundException('文档不存在');
        return {
          title: doc.title,
          titleFr: doc.titleFr ?? '',
          tags: doc.tags.join(', '),
        };
      }
      case TranslationSourceType.drawing: {
        const drawing =
          await this.translationRepository.findDrawingById(sourceId);
        if (!drawing) throw new NotFoundException('图纸不存在');
        return {
          name: drawing.name,
          nameFr: drawing.nameFr ?? '',
        };
      }
      default:
        throw new BadRequestException('暂不支持该来源的自动翻译');
    }
  }

  private enqueueAutoTranslate(taskId: string) {
    setImmediate(() => {
      void this.runAutoTranslate(taskId).catch(() => undefined);
    });
  }

  async listTasks(
    user: AuthUser,
    page: number,
    pageSize: number,
    q?: string,
    status?: TranslationTaskStatus,
    sourceType?: TranslationSourceType,
  ) {
    this.assertPerm(user, 'translation.task.read', '无权限查看翻译任务');

    const where: Prisma.TranslationTaskWhereInput = {};
    if (status) where.status = status;
    if (sourceType) where.sourceType = sourceType;
    if (q?.trim()) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { searchText: { contains: q.toLowerCase(), mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.translationRepository.findManyTasks({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: rows.map((row) => this.mapTask(row)),
      page,
      pageSize,
      total,
    };
  }

  async getTask(user: AuthUser, id: string) {
    this.assertPerm(user, 'translation.task.read', '无权限查看翻译任务');
    const task = await this.translationRepository.findTaskById(id);
    if (!task) throw new NotFoundException('翻译任务不存在');
    return this.mapTask(task);
  }

  async createTask(user: AuthUser, dto: CreateTranslationTaskDto) {
    this.assertPerm(user, 'translation.task.create', '无权限创建翻译任务');
    if (dto.sourceLang === dto.targetLang) {
      throw new BadRequestException('源语言与目标语言不能相同');
    }

    await this.assertSourceExists(dto.sourceType, dto.sourceId);

    if (dto.assigneeId) {
      const assignee = await this.translationRepository.findUserById(
        dto.assigneeId,
      );
      if (!assignee) throw new NotFoundException('译员不存在');
    }

    const sourceLabel = await this.resolveSourceLabel(
      dto.sourceType,
      dto.sourceId,
    );
    const code = `TR-${Date.now()}`;
    const task = await this.translationRepository.createTask({
      code,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      sourceLang: dto.sourceLang,
      targetLang: dto.targetLang,
      assigneeId: dto.assigneeId,
      createdById: user.id,
      searchText: buildTaskSearchText([
        code,
        dto.sourceType,
        sourceLabel,
        dto.sourceLang,
        dto.targetLang,
      ]),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'translation',
      resource: 'translation_task',
      resourceId: task.id,
      payload: {
        code: task.code,
        sourceType: task.sourceType,
        sourceId: task.sourceId,
      },
    });

    return this.mapTask(task);
  }

  async triggerAutoTranslate(user: AuthUser, id: string) {
    this.assertPerm(user, 'translation.auto', '无权限触发自动翻译');
    const task = await this.translationRepository.findTaskById(id);
    if (!task) throw new NotFoundException('翻译任务不存在');
    if (task.status === TranslationTaskStatus.completed) {
      throw new BadRequestException('任务已完成');
    }

    await this.translationRepository.updateTask(id, {
      status: TranslationTaskStatus.pending,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'translation',
      resource: 'translation_task',
      resourceId: id,
      payload: { action: 'auto_translate_queued' },
    });

    this.enqueueAutoTranslate(id);

    return { id, status: 'queued', message: '自动翻译已加入队列' };
  }

  async runAutoTranslate(taskId: string) {
    const task = await this.translationRepository.findTaskById(taskId);
    if (!task) return;

    const sourceContent = await this.extractSourceContent(
      task.sourceType,
      task.sourceId,
    );
    const glossary = await this.translationRepository.listAllGlossary();
    let translated: Record<string, string>;

    try {
      if (this.deepLClient.isConfigured) {
        translated = await translateContentWithDeepL(
          sourceContent,
          task.sourceLang,
          task.targetLang,
          glossary,
          (text) =>
            this.deepLClient.translateText(
              text,
              task.sourceLang,
              task.targetLang,
            ),
        );
      } else {
        translated = mockTranslateContent(
          sourceContent,
          task.sourceLang,
          task.targetLang,
          glossary,
        );
      }
    } catch (error) {
      await this.auditLogService.create({
        action: 'update',
        module: 'translation',
        resource: 'translation_task',
        resourceId: taskId,
        payload: {
          action: 'auto_translate_failed',
          message: error instanceof Error ? error.message : 'DeepL failed',
        },
      });
      return;
    }

    await this.translationRepository.upsertVersion({
      taskId,
      source: TranslationVersionSource.auto,
      content: translated,
    });

    await this.translationRepository.updateTask(taskId, {
      status: TranslationTaskStatus.auto,
    });
  }

  async submitManualTranslation(
    user: AuthUser,
    id: string,
    dto: SubmitManualTranslationDto,
  ) {
    this.assertPerm(user, 'translation.manual', '无权限提交人工译文');
    const task = await this.translationRepository.findTaskById(id);
    if (!task) throw new NotFoundException('翻译任务不存在');

    await this.translationRepository.upsertVersion({
      taskId: id,
      source: TranslationVersionSource.manual,
      content: dto.content,
      translatedById: user.id,
    });

    const updated = await this.translationRepository.updateTask(id, {
      status: TranslationTaskStatus.completed,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'translation',
      resource: 'translation_version',
      resourceId: id,
      payload: { source: 'manual' },
    });

    return this.mapTask(updated);
  }

  async assignTask(user: AuthUser, id: string, dto: AssignTranslationTaskDto) {
    this.assertPerm(user, 'translation.task.assign', '无权限分配译员');
    const task = await this.translationRepository.findTaskById(id);
    if (!task) throw new NotFoundException('翻译任务不存在');

    const assignee = await this.translationRepository.findUserById(
      dto.assigneeId,
    );
    if (!assignee) throw new NotFoundException('译员不存在');

    const updated = await this.translationRepository.updateTask(id, {
      assignee: { connect: { id: dto.assigneeId } },
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'translation',
      resource: 'translation_task',
      resourceId: id,
      payload: { assigneeId: dto.assigneeId, assigneeName: assignee.name },
    });

    return this.mapTask(updated);
  }

  async exportTasks(
    user: AuthUser,
    q?: string,
    status?: TranslationTaskStatus,
  ) {
    this.assertPerm(user, 'translation.export', '无权限导出翻译任务');
    const result = await this.listTasks(user, 1, 10000, q, status);
    const content = toCsv(
      ['编号', '来源类型', '来源ID', '源语言', '目标语言', '状态', '译员'],
      result.list.map((item) => [
        item.code,
        item.sourceType,
        item.sourceId,
        item.sourceLang,
        item.targetLang,
        item.statusLabel,
        item.assignee?.name ?? '',
      ]),
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'translation',
      resource: 'translation_task',
      payload: { count: result.list.length },
    });

    return {
      filename: `translation-tasks-${Date.now()}.csv`,
      content,
    };
  }

  async listGlossary(
    user: AuthUser,
    page: number,
    pageSize: number,
    q?: string,
    category?: string,
  ) {
    this.assertPerm(user, 'translation.glossary.read', '无权限查看术语库');

    const where: Prisma.GlossaryTermWhereInput = {};
    if (category) where.category = category;
    if (q?.trim()) {
      where.OR = [
        { source: { contains: q, mode: 'insensitive' } },
        { zh: { contains: q, mode: 'insensitive' } },
        { fr: { contains: q, mode: 'insensitive' } },
        { en: { contains: q, mode: 'insensitive' } },
        { searchText: { contains: q.toLowerCase(), mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.translationRepository.findManyGlossary({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy: { source: 'asc' },
    });

    return {
      list: rows,
      page,
      pageSize,
      total,
    };
  }

  async createGlossary(user: AuthUser, dto: CreateGlossaryTermDto) {
    this.assertPerm(user, 'translation.glossary.manage', '无权限管理术语库');
    const term = await this.translationRepository.createGlossary({
      source: dto.source,
      zh: dto.zh,
      fr: dto.fr,
      en: dto.en,
      category: dto.category,
      searchText: buildGlossarySearchText(dto),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'translation',
      resource: 'glossary_term',
      resourceId: term.id,
      payload: { source: term.source },
    });

    return term;
  }

  async updateGlossary(
    user: AuthUser,
    id: string,
    dto: UpdateGlossaryTermDto,
  ) {
    this.assertPerm(user, 'translation.glossary.manage', '无权限管理术语库');
    const existing = await this.translationRepository.findGlossaryById(id);
    if (!existing) throw new NotFoundException('术语不存在');

    const term = await this.translationRepository.updateGlossary(id, {
      ...dto,
      searchText: buildGlossarySearchText({
        source: dto.source ?? existing.source,
        zh: dto.zh ?? existing.zh,
        fr: dto.fr ?? existing.fr,
        en: dto.en ?? existing.en,
        category: dto.category ?? existing.category,
      }),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'translation',
      resource: 'glossary_term',
      resourceId: id,
      payload: dto,
    });

    return term;
  }

  async deleteGlossary(user: AuthUser, id: string) {
    this.assertPerm(user, 'translation.glossary.manage', '无权限管理术语库');
    const existing = await this.translationRepository.findGlossaryById(id);
    if (!existing) throw new NotFoundException('术语不存在');

    await this.translationRepository.deleteGlossary(id);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'translation',
      resource: 'glossary_term',
      resourceId: id,
      payload: { source: existing.source },
    });

    return { id };
  }

  async importGlossary(user: AuthUser, dto: ImportGlossaryDto) {
    this.assertPerm(user, 'translation.glossary.manage', '无权限管理术语库');
    const rows = parseCsv(dto.content);
    if (!rows.length) throw new BadRequestException('导入内容为空');

    let imported = 0;
    for (const row of rows) {
      const source = row.source || row['原文'];
      const zh = row.zh || row['中文'];
      const fr = row.fr || row['法语'];
      const en = row.en || row['英语'];
      const category = row.category || row['分类'];
      if (!source?.trim()) continue;
      await this.translationRepository.createGlossary({
        source: source.trim(),
        zh: zh?.trim() || null,
        fr: fr?.trim() || null,
        en: en?.trim() || null,
        category: category?.trim() || null,
        searchText: buildGlossarySearchText({
          source: source.trim(),
          zh,
          fr,
          en,
          category,
        }),
      });
      imported += 1;
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'translation',
      resource: 'glossary_term',
      payload: { imported },
    });

    return { imported };
  }

  async exportGlossary(user: AuthUser, q?: string) {
    this.assertPerm(user, 'translation.export', '无权限导出术语库');
    const result = await this.listGlossary(user, 1, 10000, q);
    const content = toCsv(
      ['原文', '中文', '法语', '英语', '分类'],
      result.list.map((item) => [
        item.source,
        item.zh ?? '',
        item.fr ?? '',
        item.en ?? '',
        item.category ?? '',
      ]),
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'translation',
      resource: 'glossary_term',
      payload: { count: result.list.length },
    });

    return {
      filename: `glossary-${Date.now()}.csv`,
      content,
    };
  }

  private async loadEntityRecord(entityType: string, entityId: string) {
    switch (entityType) {
      case 'project':
        return this.translationRepository.findProjectById(entityId);
      case 'material':
        return this.translationRepository.findMaterialById(entityId);
      case 'document':
        return this.translationRepository.findDocumentById(entityId);
      case 'drawing':
        return this.translationRepository.findDrawingById(entityId);
      case 'document_category':
        return this.translationRepository.findDocumentCategoryById(entityId);
      default:
        return null;
    }
  }

  async getEntityTranslations(user: AuthUser, type: string, id: string) {
    this.assertPerm(user, 'translation.entity.read', '无权限查看实体译文');
    if (!ENTITY_TYPES.has(type)) {
      throw new BadRequestException('不支持的实体类型');
    }

    const entity = await this.loadEntityRecord(type, id);
    if (!entity) throw new NotFoundException('实体不存在');

    const rows = await this.translationRepository.findEntityTranslations(
      type,
      id,
    );
    const translations: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      translations[row.locale] ??= {};
      translations[row.locale][row.field] = row.value;
    }

    return {
      entityType: type,
      entityId: id,
      entity,
      translations,
    };
  }

  async updateEntityTranslations(
    user: AuthUser,
    type: string,
    id: string,
    dto: UpdateEntityTranslationsDto,
  ) {
    this.assertPerm(user, 'translation.entity.update', '无权限更新实体译文');
    if (!ENTITY_TYPES.has(type)) {
      throw new BadRequestException('不支持的实体类型');
    }

    const entity = await this.loadEntityRecord(type, id);
    if (!entity) throw new NotFoundException('实体不存在');

    for (const [localeKey, fields] of Object.entries(dto.translations)) {
      const locale = localeKey as Locale;
      if (!Object.values(Locale).includes(locale)) {
        throw new BadRequestException(`无效语言：${localeKey}`);
      }
      for (const [field, value] of Object.entries(fields)) {
        await this.translationRepository.upsertEntityTranslation({
          entityType: type,
          entityId: id,
          locale,
          field,
          value,
        });

        if (locale === Locale.fr && field === 'name' && value) {
          if (type === 'project') {
            await this.translationRepository.updateProjectNameFr(id, value);
          } else if (type === 'drawing') {
            await this.translationRepository.updateDrawingNameFr(id, value);
          } else if (type === 'document_category') {
            await this.translationRepository.updateDocumentCategoryNameFr(
              id,
              value,
            );
          }
        }
        if (locale === Locale.fr && field === 'title' && value && type === 'document') {
          await this.translationRepository.updateDocumentTitleFr(id, value);
        }
      }
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'translation',
      resource: 'entity_translation',
      resourceId: id,
      payload: { entityType: type, fields: Object.keys(dto.translations) },
    });

    return this.getEntityTranslations(user, type, id);
  }
}
