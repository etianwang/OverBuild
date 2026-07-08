import { Injectable } from '@nestjs/common';
import {
  DocumentFileType,
  Locale,
  Prisma,
  TranslationSourceType,
  TranslationTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const projectSelect = { id: true, code: true, name: true } as const;

const documentInclude = {
  project: { select: projectSelect },
  category: { select: { id: true, name: true, nameFr: true } },
  createdBy: { select: { id: true, name: true } },
  versions: {
    orderBy: { version: 'desc' as const },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.DocumentInclude;

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProjectById(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, managerId: true, code: true, name: true },
    });
  }

  isProjectMember(projectId: string, userId: string) {
    return this.prisma.projectMember.findFirst({
      where: { projectId, userId },
    });
  }

  findCategoryById(id: string) {
    return this.prisma.documentCategory.findUnique({ where: { id } });
  }

  findDocuments(params: {
    skip: number;
    take: number;
    where: Prisma.DocumentWhereInput;
    orderBy: Prisma.DocumentOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.document.findMany({ ...params, include: documentInclude }),
      this.prisma.document.count({ where: params.where }),
    ]);
  }

  findById(id: string) {
    return this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: documentInclude,
    });
  }

  findByCode(code: string) {
    return this.prisma.document.findFirst({
      where: { code, deletedAt: null },
    });
  }

  createDocument(data: {
    code: string;
    title: string;
    titleFr?: string;
    projectId: string;
    categoryId?: string;
    tags?: string[];
    searchText?: string;
    createdById: string;
    version: {
      fileUrl: string;
      fileName: string;
      fileType: DocumentFileType;
      fileSize?: number;
      uploadedById: string;
    };
  }) {
    return this.prisma.document.create({
      data: {
        code: data.code,
        title: data.title,
        titleFr: data.titleFr,
        project: { connect: { id: data.projectId } },
        category: data.categoryId
          ? { connect: { id: data.categoryId } }
          : undefined,
        tags: data.tags ?? [],
        searchText: data.searchText,
        currentVersion: 1,
        createdBy: { connect: { id: data.createdById } },
        versions: {
          create: {
            version: 1,
            fileUrl: data.version.fileUrl,
            fileName: data.version.fileName,
            fileType: data.version.fileType,
            fileSize: data.version.fileSize,
            uploadedBy: { connect: { id: data.version.uploadedById } },
          },
        },
      },
      include: documentInclude,
    });
  }

  updateDocument(id: string, data: Prisma.DocumentUpdateInput) {
    return this.prisma.document.update({
      where: { id },
      data,
      include: documentInclude,
    });
  }

  softDelete(id: string) {
    return this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  createVersion(
    documentId: string,
    version: number,
    data: {
      fileUrl: string;
      fileName: string;
      fileType: DocumentFileType;
      fileSize?: number;
      uploadedById: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.documentVersion.create({
        data: {
          document: { connect: { id: documentId } },
          version,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          uploadedBy: { connect: { id: data.uploadedById } },
        },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersion: version },
      });
      return created;
    });
  }

  findVersion(documentId: string, version: number) {
    return this.prisma.documentVersion.findUnique({
      where: { documentId_version: { documentId, version } },
      include: {
        document: {
          include: {
            project: { select: projectSelect },
          },
        },
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  listVersions(documentId: string) {
    return this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  listCategories(projectId?: string) {
    return this.prisma.documentCategory.findMany({
      where: projectId
        ? { OR: [{ projectId }, { projectId: null }] }
        : undefined,
      orderBy: { name: 'asc' },
      include: { project: { select: projectSelect } },
    });
  }

  createCategory(data: Prisma.DocumentCategoryCreateInput) {
    return this.prisma.documentCategory.create({
      data,
      include: { project: { select: projectSelect } },
    });
  }

  updateCategory(id: string, data: Prisma.DocumentCategoryUpdateInput) {
    return this.prisma.documentCategory.update({
      where: { id },
      data,
      include: { project: { select: projectSelect } },
    });
  }

  countTranslationTasksBySource(sourceId: string) {
    return this.prisma.translationTask.count({
      where: {
        sourceType: TranslationSourceType.document,
        sourceId,
        status: { not: TranslationTaskStatus.completed },
      },
    });
  }

  createTranslationTask(data: {
    code: string;
    sourceId: string;
    sourceLang: Locale;
    targetLang: Locale;
  }) {
    return this.prisma.translationTask.create({
      data: {
        code: data.code,
        sourceType: TranslationSourceType.document,
        sourceId: data.sourceId,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
      },
    });
  }
}
