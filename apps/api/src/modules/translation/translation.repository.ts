import { Injectable } from '@nestjs/common';
import {
  Locale,
  Prisma,
  TranslationSourceType,
  TranslationVersionSource,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const userSelect = { id: true, name: true } as const;

const taskInclude = {
  assignee: { select: userSelect },
  createdBy: { select: userSelect },
  versions: {
    orderBy: { createdAt: 'desc' as const },
    include: { translatedBy: { select: userSelect } },
  },
} satisfies Prisma.TranslationTaskInclude;

@Injectable()
export class TranslationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyTasks(params: {
    skip: number;
    take: number;
    where: Prisma.TranslationTaskWhereInput;
    orderBy: Prisma.TranslationTaskOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.translationTask.findMany({
        ...params,
        include: taskInclude,
      }),
      this.prisma.translationTask.count({ where: params.where }),
    ]);
  }

  findTaskById(id: string) {
    return this.prisma.translationTask.findUnique({
      where: { id },
      include: taskInclude,
    });
  }

  findTaskByCode(code: string) {
    return this.prisma.translationTask.findUnique({ where: { code } });
  }

  createTask(data: {
    code: string;
    sourceType: TranslationSourceType;
    sourceId: string;
    sourceLang: Locale;
    targetLang: Locale;
    assigneeId?: string;
    searchText?: string;
    createdById?: string;
  }) {
    return this.prisma.translationTask.create({
      data,
      include: taskInclude,
    });
  }

  updateTask(id: string, data: Prisma.TranslationTaskUpdateInput) {
    return this.prisma.translationTask.update({
      where: { id },
      data,
      include: taskInclude,
    });
  }

  upsertVersion(data: {
    taskId: string;
    source: TranslationVersionSource;
    content: Prisma.InputJsonValue;
    translatedById?: string;
  }) {
    return this.prisma.translationVersion.upsert({
      where: {
        taskId_source: { taskId: data.taskId, source: data.source },
      },
      create: data,
      update: {
        content: data.content,
        translatedById: data.translatedById,
      },
      include: { translatedBy: { select: userSelect } },
    });
  }

  findManyGlossary(params: {
    skip: number;
    take: number;
    where: Prisma.GlossaryTermWhereInput;
    orderBy: Prisma.GlossaryTermOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.glossaryTerm.findMany(params),
      this.prisma.glossaryTerm.count({ where: params.where }),
    ]);
  }

  findGlossaryById(id: string) {
    return this.prisma.glossaryTerm.findUnique({ where: { id } });
  }

  createGlossary(data: Prisma.GlossaryTermCreateInput) {
    return this.prisma.glossaryTerm.create({ data });
  }

  updateGlossary(id: string, data: Prisma.GlossaryTermUpdateInput) {
    return this.prisma.glossaryTerm.update({ where: { id }, data });
  }

  deleteGlossary(id: string) {
    return this.prisma.glossaryTerm.delete({ where: { id } });
  }

  listAllGlossary() {
    return this.prisma.glossaryTerm.findMany({
      orderBy: { source: 'asc' },
    });
  }

  findEntityTranslations(entityType: string, entityId: string) {
    return this.prisma.entityTranslation.findMany({
      where: { entityType, entityId },
      orderBy: [{ locale: 'asc' }, { field: 'asc' }],
    });
  }

  upsertEntityTranslation(data: {
    entityType: string;
    entityId: string;
    locale: Locale;
    field: string;
    value: string;
  }) {
    return this.prisma.entityTranslation.upsert({
      where: {
        entityType_entityId_locale_field: {
          entityType: data.entityType,
          entityId: data.entityId,
          locale: data.locale,
          field: data.field,
        },
      },
      create: data,
      update: { value: data.value },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null, status: 'active' },
      select: { id: true, name: true },
    });
  }

  findDocumentById(id: string) {
    return this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        titleFr: true,
        tags: true,
        projectId: true,
      },
    });
  }

  findDrawingById(id: string) {
    return this.prisma.drawing.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        drawingNo: true,
        name: true,
        nameFr: true,
        projectId: true,
      },
    });
  }

  findProjectById(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true, name: true, nameFr: true },
    });
  }

  findMaterialById(id: string) {
    return this.prisma.material.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
  }

  findDocumentCategoryById(id: string) {
    return this.prisma.documentCategory.findFirst({
      where: { id },
      select: { id: true, name: true, nameFr: true },
    });
  }

  updateProjectNameFr(id: string, nameFr: string) {
    return this.prisma.project.update({
      where: { id },
      data: { nameFr },
    });
  }

  updateDocumentTitleFr(id: string, titleFr: string) {
    return this.prisma.document.update({
      where: { id },
      data: { titleFr },
    });
  }

  updateDrawingNameFr(id: string, nameFr: string) {
    return this.prisma.drawing.update({
      where: { id },
      data: { nameFr },
    });
  }

  updateDocumentCategoryNameFr(id: string, nameFr: string) {
    return this.prisma.documentCategory.update({
      where: { id },
      data: { nameFr },
    });
  }
}
