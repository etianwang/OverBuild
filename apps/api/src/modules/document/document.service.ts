import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentFileType, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { toCsv } from '../project/csv.util';
import {
  buildSearchText,
  detectFileType,
  getPreviewContentType,
  readDocumentFile,
  saveDocumentFile,
} from './document-file.util';
import {
  CreateDocumentCategoryDto,
  CreateDocumentDto,
  SubmitDocumentTranslateDto,
  UpdateDocumentCategoryDto,
  UpdateDocumentDto,
} from './dto/document.dto';
import { DocumentRepository } from './document.repository';

const SORTABLE = new Set(['code', 'title', 'createdAt', 'updatedAt']);

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly auditLogService: AuditLogService,
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

  private mapDocument(doc: {
    id: string;
    code: string;
    title: string;
    titleFr: string | null;
    projectId: string;
    categoryId: string | null;
    tags: string[];
    currentVersion: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; code: string; name: string };
    category?: { id: string; name: string; nameFr: string | null } | null;
    createdBy?: { id: string; name: string };
    versions?: Array<{
      id: string;
      version: number;
      fileName: string;
      fileType: DocumentFileType;
      fileSize: number | null;
      uploadedAt: Date;
      uploadedBy?: { id: string; name: string };
    }>;
  }) {
    return {
      id: doc.id,
      code: doc.code,
      title: doc.title,
      titleFr: doc.titleFr,
      projectId: doc.projectId,
      categoryId: doc.categoryId,
      tags: doc.tags,
      currentVersion: doc.currentVersion,
      status: doc.status,
      project: doc.project,
      category: doc.category,
      createdBy: doc.createdBy,
      versions: doc.versions?.map((v) => ({
        id: v.id,
        version: v.version,
        fileName: v.fileName,
        fileType: v.fileType,
        fileSize: v.fileSize,
        uploadedAt: v.uploadedAt,
        uploadedBy: v.uploadedBy,
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private async applyProjectScope(
    user: AuthUser,
    where: Prisma.DocumentWhereInput,
    projectId?: string,
  ) {
    if (
      this.isAdmin(user) ||
      user.roles.includes('boss') ||
      user.roles.includes('finance') ||
      user.roles.includes('translator')
    ) {
      if (projectId) where.projectId = projectId;
      return;
    }

    const scopeOr: Prisma.DocumentWhereInput[] = [
      { project: { managerId: user.id } },
      { project: { members: { some: { userId: user.id } } } },
    ];

    if (projectId) {
      const project = await this.documentRepository.findProjectById(projectId);
      if (!project) throw new NotFoundException('项目不存在');
      const member = await this.documentRepository.isProjectMember(
        projectId,
        user.id,
      );
      if (project.managerId !== user.id && !member) {
        throw new ForbiddenException('无权限查看该项目文档');
      }
      where.projectId = projectId;
      return;
    }

    Object.assign(where, { OR: scopeOr });
  }

  private async assertCanAccessDocument(user: AuthUser, documentId: string) {
    const doc = await this.documentRepository.findById(documentId);
    if (!doc) throw new NotFoundException('文档不存在');

    if (
      this.isAdmin(user) ||
      user.roles.includes('boss') ||
      user.roles.includes('translator')
    ) {
      return doc;
    }

    const project = await this.documentRepository.findProjectById(
      doc.projectId,
    );
    if (!project) throw new NotFoundException('项目不存在');

    const member = await this.documentRepository.isProjectMember(
      doc.projectId,
      user.id,
    );
    if (
      project.managerId !== user.id &&
      !member &&
      !user.roles.includes('engineer')
    ) {
      throw new ForbiddenException('无权限访问该文档');
    }

    return doc;
  }

  private validateUploadFile(file?: Express.Multer.File) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('请上传文件');
    }
    const maxMb = Number(process.env.FILE_MAX_SIZE_MB ?? 100);
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`文件大小不能超过 ${maxMb}MB`);
    }
    return file;
  }

  async list(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
    categoryId?: string,
    sort = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ) {
    this.assertPerm(user, 'document.read', '无权限查看文档');

    const where: Prisma.DocumentWhereInput = { deletedAt: null };
    await this.applyProjectScope(user, where, projectId);
    if (categoryId) where.categoryId = categoryId;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { titleFr: { contains: q, mode: 'insensitive' } },
        { searchText: { contains: q.toLowerCase(), mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    const orderBy = {
      [SORTABLE.has(sort) ? sort : 'createdAt']: order,
    } as Prisma.DocumentOrderByWithRelationInput;

    const [list, total] = await this.documentRepository.findDocuments({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy,
    });

    return {
      list: list.map((item) => this.mapDocument(item)),
      page,
      pageSize,
      total,
    };
  }

  async getOne(user: AuthUser, id: string) {
    this.assertPerm(user, 'document.read', '无权限查看文档');
    const doc = await this.assertCanAccessDocument(user, id);
    return this.mapDocument(doc);
  }

  async create(
    user: AuthUser,
    dto: CreateDocumentDto,
    file?: Express.Multer.File,
  ) {
    this.assertPerm(user, 'document.create', '无权限上传文档');

    const upload = this.validateUploadFile(file);
    const project = await this.documentRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');
    if (await this.documentRepository.findByCode(dto.code)) {
      throw new ConflictException('文档编号已存在');
    }
    if (dto.categoryId) {
      const category = await this.documentRepository.findCategoryById(
        dto.categoryId,
      );
      if (!category) throw new NotFoundException('分类不存在');
    }

    const fileType = detectFileType(upload.originalname);

    const doc = await this.documentRepository.createDocument({
      code: dto.code,
      title: dto.title,
      titleFr: dto.titleFr,
      projectId: dto.projectId,
      categoryId: dto.categoryId,
      tags: dto.tags,
      searchText: buildSearchText(dto.title, dto.titleFr, dto.tags),
      createdById: user.id,
      version: {
        fileUrl: 'pending',
        fileName: upload.originalname,
        fileType,
        fileSize: upload.size,
        uploadedById: user.id,
      },
    });

    const finalUrl = saveDocumentFile(
      doc.id,
      1,
      upload.originalname,
      upload.buffer,
    );
    await this.documentRepository.updateDocument(doc.id, {
      versions: {
        update: {
          where: { documentId_version: { documentId: doc.id, version: 1 } },
          data: { fileUrl: finalUrl },
        },
      },
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'document',
      resource: 'document',
      resourceId: doc.id,
      payload: { code: dto.code, fileName: upload.originalname },
    });

    const refreshed = await this.documentRepository.findById(doc.id);
    return this.mapDocument(refreshed!);
  }

  async update(user: AuthUser, id: string, dto: UpdateDocumentDto) {
    this.assertPerm(user, 'document.update', '无权限编辑文档');
    await this.assertCanAccessDocument(user, id);

    const existing = await this.documentRepository.findById(id);
    if (!existing) throw new NotFoundException('文档不存在');

    const title = dto.title ?? existing.title;
    const titleFr = dto.titleFr ?? existing.titleFr;
    const tags = dto.tags ?? existing.tags;

    const updated = await this.documentRepository.updateDocument(id, {
      title: dto.title,
      titleFr: dto.titleFr,
      category: dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : undefined,
      tags: dto.tags,
      status: dto.status,
      searchText: buildSearchText(title, titleFr, tags),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'document',
      resource: 'document',
      resourceId: id,
    });

    return this.mapDocument(updated);
  }

  async remove(user: AuthUser, id: string) {
    this.assertPerm(user, 'document.delete', '无权限删除文档');
    const doc = await this.assertCanAccessDocument(user, id);

    if (
      !this.isAdmin(user) &&
      doc.createdById !== user.id &&
      !user.roles.includes('project_manager')
    ) {
      throw new ForbiddenException('仅管理员、上传人或项目经理可删除');
    }

    await this.documentRepository.softDelete(id);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'document',
      resource: 'document',
      resourceId: id,
    });

    return { success: true };
  }

  async uploadVersion(
    user: AuthUser,
    id: string,
    file?: Express.Multer.File,
  ) {
    this.assertPerm(user, 'document.version.create', '无权限上传新版本');
    const doc = await this.assertCanAccessDocument(user, id);
    const upload = this.validateUploadFile(file);

    const fileType = detectFileType(upload.originalname);
    const nextVersion = doc.currentVersion + 1;
    const fileUrl = saveDocumentFile(
      id,
      nextVersion,
      upload.originalname,
      upload.buffer,
    );

    const version = await this.documentRepository.createVersion(id, nextVersion, {
      fileUrl,
      fileName: upload.originalname,
      fileType,
      fileSize: upload.size,
      uploadedById: user.id,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'document',
      resource: 'document_version',
      resourceId: version.id,
      payload: { documentId: id, version: nextVersion },
    });

    return version;
  }

  async listVersions(user: AuthUser, id: string) {
    this.assertPerm(user, 'document.version.read', '无权限查看版本');
    await this.assertCanAccessDocument(user, id);
    const list = await this.documentRepository.listVersions(id);
    return {
      list: list.map((item) => ({
        id: item.id,
        version: item.version,
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSize,
        uploadedAt: item.uploadedAt,
        uploadedBy: item.uploadedBy,
      })),
      total: list.length,
    };
  }

  async getVersionFile(user: AuthUser, id: string, version: number) {
    this.assertPerm(user, 'document.read', '无权限访问文档');
    await this.assertCanAccessDocument(user, id);

    const record = await this.documentRepository.findVersion(id, version);
    if (!record) throw new NotFoundException('版本不存在');

    const buffer = readDocumentFile(record.fileUrl);
    return {
      buffer,
      fileName: record.fileName,
      fileType: record.fileType,
      contentType: getPreviewContentType(record.fileType, record.fileName),
    };
  }

  async submitTranslate(
    user: AuthUser,
    id: string,
    dto: SubmitDocumentTranslateDto,
  ) {
    this.assertPerm(user, 'document.translate', '无权限提交翻译');
    const doc = await this.assertCanAccessDocument(user, id);

    const pending = await this.documentRepository.countTranslationTasksBySource(
      id,
    );
    if (pending > 0) {
      throw new ConflictException('该文档已有进行中的翻译任务');
    }

    const code = `TR-DOC-${Date.now()}`;
    const task = await this.documentRepository.createTranslationTask({
      code,
      sourceId: id,
      sourceLang: dto.sourceLang,
      targetLang: dto.targetLang,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'document',
      resource: 'translation_task',
      resourceId: task.id,
      payload: {
        documentId: id,
        documentCode: doc.code,
        sourceLang: dto.sourceLang,
        targetLang: dto.targetLang,
      },
    });

    return {
      id: task.id,
      code: task.code,
      status: task.status,
      sourceType: task.sourceType,
      sourceId: task.sourceId,
      documentTitle: doc.title,
    };
  }

  async export(
    user: AuthUser,
    q?: string,
    projectId?: string,
    categoryId?: string,
  ) {
    this.assertPerm(user, 'document.export', '无权限导出文档');
    const result = await this.list(user, 1, 10000, q, projectId, categoryId);
    const content = toCsv(
      ['编号', '标题', '项目', '分类', '版本', '状态', '标签'],
      result.list.map((item) => [
        item.code,
        item.title,
        item.project?.name ?? '',
        item.category?.name ?? '',
        String(item.currentVersion),
        item.status,
        item.tags.join(';'),
      ]),
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'document',
      resource: 'document',
      payload: { count: result.total },
    });

    return { filename: `documents-${Date.now()}.csv`, content };
  }

  async listCategories(user: AuthUser, projectId?: string) {
    this.assertPerm(user, 'document.category.read', '无权限查看分类');
    const list = await this.documentRepository.listCategories(projectId);
    return {
      list: list.map((item) => ({
        id: item.id,
        name: item.name,
        nameFr: item.nameFr,
        projectId: item.projectId,
        project: item.project,
      })),
      total: list.length,
    };
  }

  async createCategory(user: AuthUser, dto: CreateDocumentCategoryDto) {
    this.assertPerm(user, 'document.category.create', '无权限新增分类');
    if (dto.projectId) {
      const project = await this.documentRepository.findProjectById(
        dto.projectId,
      );
      if (!project) throw new NotFoundException('项目不存在');
    }

    const category = await this.documentRepository.createCategory({
      name: dto.name,
      nameFr: dto.nameFr,
      project: dto.projectId
        ? { connect: { id: dto.projectId } }
        : undefined,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'document',
      resource: 'document_category',
      resourceId: category.id,
    });

    return category;
  }

  async updateCategory(
    user: AuthUser,
    id: string,
    dto: UpdateDocumentCategoryDto,
  ) {
    this.assertPerm(user, 'document.category.update', '无权限编辑分类');
    const existing = await this.documentRepository.findCategoryById(id);
    if (!existing) throw new NotFoundException('分类不存在');

    const updated = await this.documentRepository.updateCategory(id, {
      name: dto.name,
      nameFr: dto.nameFr,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'document',
      resource: 'document_category',
      resourceId: id,
    });

    return updated;
  }
}
