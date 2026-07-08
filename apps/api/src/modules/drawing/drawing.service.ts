import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  ApprovalType,
  DrawingFileType,
  DrawingReviewResult,
  DrawingStatus,
  Prisma,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import { toCsv } from '../project/csv.util';
import { WorkflowService } from '../workflow/workflow.service';
import {
  buildDrawingSearchText,
  detectDrawingFileType,
  getDrawingPreviewContentType,
  readDrawingFile,
  saveDrawingFile,
} from './drawing-file.util';
import {
  CreateDrawingDto,
  ReviewDrawingDto,
  UpdateDrawingDto,
} from './dto/drawing.dto';
import { DrawingRepository } from './drawing.repository';

const SORTABLE = new Set(['drawingNo', 'name', 'createdAt', 'updatedAt']);
const DISCIPLINE_LABEL: Record<string, string> = {
  arch: '建筑',
  struct: '结构',
  mep: '机电',
  civil: '土建',
  other: '其他',
};

@Injectable()
export class DrawingService {
  constructor(
    private readonly drawingRepository: DrawingRepository,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService: WorkflowService,
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

  private mapDrawing(item: {
    id: string;
    drawingNo: string;
    name: string;
    nameFr: string | null;
    projectId: string;
    discipline: string;
    zoneId: string | null;
    currentVersion: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; code: string; name: string };
    zone?: { id: string; name: string; nameFr: string | null } | null;
    createdBy?: { id: string; name: string };
    versions?: Array<{
      id: string;
      version: number;
      fileName: string;
      fileType: DrawingFileType;
      fileSize: number | null;
      uploadedAt: Date;
      uploadedBy?: { id: string; name: string };
    }>;
    reviews?: Array<{
      id: string;
      version: number;
      comment: string | null;
      result: string;
      reviewedAt: Date;
      reviewer?: { id: string; name: string };
    }>;
  }) {
    return {
      id: item.id,
      drawingNo: item.drawingNo,
      name: item.name,
      nameFr: item.nameFr,
      projectId: item.projectId,
      discipline: item.discipline,
      zoneId: item.zoneId,
      currentVersion: item.currentVersion,
      status: item.status,
      project: item.project,
      zone: item.zone,
      createdBy: item.createdBy,
      versions: item.versions?.map((v) => ({
        id: v.id,
        version: v.version,
        fileName: v.fileName,
        fileType: v.fileType,
        fileSize: v.fileSize,
        uploadedAt: v.uploadedAt,
        uploadedBy: v.uploadedBy,
      })),
      reviews: item.reviews?.map((r) => ({
        id: r.id,
        version: r.version,
        comment: r.comment,
        result: r.result,
        reviewedAt: r.reviewedAt,
        reviewer: r.reviewer,
      })),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async applyProjectScope(
    user: AuthUser,
    where: Prisma.DrawingWhereInput,
    projectId?: string,
  ) {
    if (this.isAdmin(user) || user.roles.includes('boss')) {
      if (projectId) where.projectId = projectId;
      return;
    }

    const scopeOr: Prisma.DrawingWhereInput[] = [
      { project: { managerId: user.id } },
      { project: { members: { some: { userId: user.id } } } },
    ];

    if (projectId) {
      const project = await this.drawingRepository.findProjectById(projectId);
      if (!project) throw new NotFoundException('项目不存在');
      const member = await this.drawingRepository.isProjectMember(
        projectId,
        user.id,
      );
      if (project.managerId !== user.id && !member) {
        throw new ForbiddenException('无权限查看该项目图纸');
      }
      where.projectId = projectId;
      return;
    }

    Object.assign(where, { OR: scopeOr });
  }

  private async assertCanAccessDrawing(user: AuthUser, drawingId: string) {
    const drawing = await this.drawingRepository.findById(drawingId);
    if (!drawing) throw new NotFoundException('图纸不存在');

    if (this.isAdmin(user) || user.roles.includes('boss')) {
      return drawing;
    }

    const project = await this.drawingRepository.findProjectById(
      drawing.projectId,
    );
    if (!project) throw new NotFoundException('项目不存在');

    const member = await this.drawingRepository.isProjectMember(
      drawing.projectId,
      user.id,
    );
    if (
      project.managerId !== user.id &&
      !member &&
      !user.roles.includes('engineer')
    ) {
      throw new ForbiddenException('无权限访问该图纸');
    }

    return drawing;
  }

  private validateUploadFile(file?: Express.Multer.File) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('请上传图纸文件');
    }
    const maxMb = Number(process.env.FILE_MAX_SIZE_MB ?? 100);
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`文件大小不能超过 ${maxMb}MB`);
    }
    return file;
  }

  async syncDrawingApproval(
    businessId: string,
    result: 'approved' | 'rejected',
    reviewerId?: string,
  ) {
    const drawing = await this.drawingRepository.findById(businessId);
    if (!drawing) return;

    if (result === 'approved') {
      await this.drawingRepository.updateStatus(
        businessId,
        DrawingStatus.approved,
      );
      if (reviewerId) {
        await this.drawingRepository.createReview({
          drawingId: businessId,
          version: drawing.currentVersion,
          reviewerId,
          result: DrawingReviewResult.approved,
        });
      }
      return;
    }

    await this.drawingRepository.updateStatus(businessId, DrawingStatus.draft);
    if (reviewerId) {
      await this.drawingRepository.createReview({
        drawingId: businessId,
        version: drawing.currentVersion,
        reviewerId,
        result: DrawingReviewResult.rejected,
      });
    }
  }

  async list(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    projectId?: string,
    discipline?: string,
    sort = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ) {
    this.assertPerm(user, 'drawing.read', '无权限查看图纸');

    const where: Prisma.DrawingWhereInput = { deletedAt: null };
    await this.applyProjectScope(user, where, projectId);
    if (discipline) where.discipline = discipline as never;
    if (q) {
      where.OR = [
        { drawingNo: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { nameFr: { contains: q, mode: 'insensitive' } },
        { searchText: { contains: q.toLowerCase(), mode: 'insensitive' } },
      ];
    }

    const orderBy = {
      [SORTABLE.has(sort) ? sort : 'createdAt']: order,
    } as Prisma.DrawingOrderByWithRelationInput;

    const [list, total] = await this.drawingRepository.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
      orderBy,
    });

    return {
      list: list.map((item) => this.mapDrawing(item)),
      page,
      pageSize,
      total,
    };
  }

  async getOne(user: AuthUser, id: string) {
    this.assertPerm(user, 'drawing.read', '无权限查看图纸');
    const drawing = await this.assertCanAccessDrawing(user, id);
    return this.mapDrawing(drawing);
  }

  async create(
    user: AuthUser,
    dto: CreateDrawingDto,
    file?: Express.Multer.File,
  ) {
    this.assertPerm(user, 'drawing.create', '无权限上传图纸');

    const upload = this.validateUploadFile(file);
    const project = await this.drawingRepository.findProjectById(dto.projectId);
    if (!project) throw new NotFoundException('项目不存在');
    if (await this.drawingRepository.findByDrawingNo(dto.drawingNo)) {
      throw new ConflictException('图号已存在');
    }
    if (dto.zoneId) {
      const zone = await this.drawingRepository.findZoneById(dto.zoneId);
      if (!zone || zone.projectId !== dto.projectId) {
        throw new BadRequestException('施工区域与项目不匹配');
      }
    }

    const fileType = detectDrawingFileType(upload.originalname);
    const drawing = await this.drawingRepository.createDrawing({
      drawingNo: dto.drawingNo,
      name: dto.name,
      nameFr: dto.nameFr,
      projectId: dto.projectId,
      discipline: dto.discipline,
      zoneId: dto.zoneId,
      searchText: buildDrawingSearchText(
        dto.drawingNo,
        dto.name,
        dto.nameFr,
        dto.discipline,
      ),
      createdById: user.id,
      version: {
        fileUrl: 'pending',
        fileName: upload.originalname,
        fileType,
        fileSize: upload.size,
        uploadedById: user.id,
      },
    });

    const finalUrl = saveDrawingFile(
      drawing.id,
      1,
      upload.originalname,
      upload.buffer,
    );
    await this.drawingRepository.updateDrawing(drawing.id, {
      versions: {
        update: {
          where: {
            drawingId_version: { drawingId: drawing.id, version: 1 },
          },
          data: { fileUrl: finalUrl },
        },
      },
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'drawing',
      resource: 'drawing',
      resourceId: drawing.id,
      payload: { drawingNo: dto.drawingNo },
    });

    const refreshed = await this.drawingRepository.findById(drawing.id);
    return this.mapDrawing(refreshed!);
  }

  async update(user: AuthUser, id: string, dto: UpdateDrawingDto) {
    this.assertPerm(user, 'drawing.update', '无权限编辑图纸');
    const existing = await this.assertCanAccessDrawing(user, id);

    if (dto.zoneId) {
      const zone = await this.drawingRepository.findZoneById(dto.zoneId);
      if (!zone || zone.projectId !== existing.projectId) {
        throw new BadRequestException('施工区域与项目不匹配');
      }
    }

    const name = dto.name ?? existing.name;
    const nameFr = dto.nameFr ?? existing.nameFr;
    const discipline = dto.discipline ?? existing.discipline;

    const updated = await this.drawingRepository.updateDrawing(id, {
      name: dto.name,
      nameFr: dto.nameFr,
      discipline: dto.discipline,
      zone: dto.zoneId ? { connect: { id: dto.zoneId } } : undefined,
      searchText: buildDrawingSearchText(
        existing.drawingNo,
        name,
        nameFr,
        discipline,
      ),
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'drawing',
      resource: 'drawing',
      resourceId: id,
    });

    return this.mapDrawing(updated);
  }

  async remove(user: AuthUser, id: string) {
    this.assertPerm(user, 'drawing.delete', '无权限删除图纸');
    const drawing = await this.assertCanAccessDrawing(user, id);

    if (
      !this.isAdmin(user) &&
      drawing.createdById !== user.id &&
      !user.roles.includes('project_manager')
    ) {
      throw new ForbiddenException('仅管理员、上传人或项目经理可删除');
    }

    await this.drawingRepository.softDelete(id);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'drawing',
      resource: 'drawing',
      resourceId: id,
    });

    return { success: true };
  }

  async uploadVersion(
    user: AuthUser,
    id: string,
    file?: Express.Multer.File,
  ) {
    this.assertPerm(user, 'drawing.version.create', '无权限上传新版本');
    const drawing = await this.assertCanAccessDrawing(user, id);
    const upload = this.validateUploadFile(file);

    const fileType = detectDrawingFileType(upload.originalname);
    const nextVersion = drawing.currentVersion + 1;
    const fileUrl = saveDrawingFile(
      id,
      nextVersion,
      upload.originalname,
      upload.buffer,
    );

    const resetStatus =
      drawing.status === DrawingStatus.published
        ? DrawingStatus.draft
        : undefined;

    const version = await this.drawingRepository.createVersion(
      id,
      nextVersion,
      {
        fileUrl,
        fileName: upload.originalname,
        fileType,
        fileSize: upload.size,
        uploadedById: user.id,
      },
      resetStatus,
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'drawing',
      resource: 'drawing_version',
      resourceId: version.id,
      payload: { drawingId: id, version: nextVersion },
    });

    return version;
  }

  async listVersions(user: AuthUser, id: string) {
    this.assertPerm(user, 'drawing.version.read', '无权限查看版本');
    await this.assertCanAccessDrawing(user, id);
    const list = await this.drawingRepository.listVersions(id);
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
    this.assertPerm(user, 'drawing.preview', '无权限预览图纸');
    await this.assertCanAccessDrawing(user, id);

    const record = await this.drawingRepository.findVersion(id, version);
    if (!record) throw new NotFoundException('版本不存在');

    const buffer = readDrawingFile(record.fileUrl);
    return {
      buffer,
      fileName: record.fileName,
      fileType: record.fileType,
      contentType: getDrawingPreviewContentType(
        record.fileType,
        record.fileName,
      ),
    };
  }

  async submitReview(user: AuthUser, id: string) {
    this.assertPerm(user, 'drawing.submit_review', '无权限提交审阅');

    const drawing = await this.assertCanAccessDrawing(user, id);
    if (
      drawing.status !== DrawingStatus.draft &&
      drawing.status !== DrawingStatus.approved
    ) {
      throw new BadRequestException('当前状态不可提交审阅');
    }

    await this.workflowService.create(user, {
      type: ApprovalType.drawing,
      businessId: id,
      projectId: drawing.projectId,
      metadata: {
        drawingNo: drawing.drawingNo,
        name: drawing.name,
        version: drawing.currentVersion,
      },
    });

    const updated = await this.drawingRepository.updateStatus(
      id,
      DrawingStatus.reviewing,
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'drawing',
      resource: 'drawing',
      resourceId: id,
      payload: { action: 'submit_review' },
    });

    return this.mapDrawing(updated);
  }

  async review(user: AuthUser, id: string, dto: ReviewDrawingDto) {
    this.assertPerm(user, 'drawing.review', '无权限审阅图纸');

    const drawing = await this.assertCanAccessDrawing(user, id);
    if (drawing.status !== DrawingStatus.reviewing) {
      throw new BadRequestException('仅审阅中图纸可处理');
    }

    const status =
      dto.result === DrawingReviewResult.approved
        ? DrawingStatus.approved
        : DrawingStatus.draft;

    const review = await this.drawingRepository.createReview({
      drawingId: id,
      version: drawing.currentVersion,
      reviewerId: user.id,
      comment: dto.comment,
      result: dto.result,
    });

    const updated = await this.drawingRepository.updateStatus(id, status);

    await this.auditLogService.create({
      userId: user.id,
      action: dto.result === DrawingReviewResult.approved ? 'approve' : 'reject',
      module: 'drawing',
      resource: 'drawing_review',
      resourceId: review.id,
      payload: { drawingId: id, result: dto.result },
    });

    return this.mapDrawing(updated);
  }

  async publish(user: AuthUser, id: string) {
    this.assertPerm(user, 'drawing.publish', '无权限发布图纸');

    const drawing = await this.assertCanAccessDrawing(user, id);
    if (drawing.status !== DrawingStatus.approved) {
      throw new BadRequestException('仅已批准图纸可发布');
    }

    const updated = await this.drawingRepository.updateStatus(
      id,
      DrawingStatus.published,
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'drawing',
      resource: 'drawing',
      resourceId: id,
      payload: { action: 'publish' },
    });

    return this.mapDrawing(updated);
  }

  async export(
    user: AuthUser,
    q?: string,
    projectId?: string,
    discipline?: string,
  ) {
    this.assertPerm(user, 'drawing.export', '无权限导出图纸');
    const result = await this.list(user, 1, 10000, q, projectId, discipline);
    const content = toCsv(
      ['图号', '名称', '项目', '专业', '版本', '状态'],
      result.list.map((item) => [
        item.drawingNo,
        item.name,
        item.project?.name ?? '',
        DISCIPLINE_LABEL[item.discipline] ?? item.discipline,
        String(item.currentVersion),
        item.status,
      ]),
    );

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'drawing',
      resource: 'drawing',
      payload: { count: result.total },
    });

    return { filename: `drawings-${Date.now()}.csv`, content };
  }
}
