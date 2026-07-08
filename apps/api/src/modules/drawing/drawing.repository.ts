import { Injectable } from '@nestjs/common';
import {
  DrawingDiscipline,
  DrawingFileType,
  DrawingReviewResult,
  DrawingStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const projectSelect = { id: true, code: true, name: true } as const;

const drawingInclude = {
  project: { select: projectSelect },
  zone: { select: { id: true, name: true, nameFr: true } },
  createdBy: { select: { id: true, name: true } },
  versions: {
    orderBy: { version: 'desc' as const },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  reviews: {
    orderBy: { reviewedAt: 'desc' as const },
    include: { reviewer: { select: { id: true, name: true } } },
    take: 5,
  },
} satisfies Prisma.DrawingInclude;

@Injectable()
export class DrawingRepository {
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

  findZoneById(id: string) {
    return this.prisma.projectZone.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, projectId: true, name: true },
    });
  }

  findMany(params: {
    skip: number;
    take: number;
    where: Prisma.DrawingWhereInput;
    orderBy: Prisma.DrawingOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.drawing.findMany({ ...params, include: drawingInclude }),
      this.prisma.drawing.count({ where: params.where }),
    ]);
  }

  findById(id: string) {
    return this.prisma.drawing.findFirst({
      where: { id, deletedAt: null },
      include: drawingInclude,
    });
  }

  findByDrawingNo(drawingNo: string) {
    return this.prisma.drawing.findFirst({
      where: { drawingNo, deletedAt: null },
    });
  }

  createDrawing(data: {
    drawingNo: string;
    name: string;
    nameFr?: string;
    projectId: string;
    discipline: DrawingDiscipline;
    zoneId?: string;
    searchText?: string;
    createdById: string;
    version: {
      fileUrl: string;
      fileName: string;
      fileType: DrawingFileType;
      fileSize?: number;
      uploadedById: string;
    };
  }) {
    return this.prisma.drawing.create({
      data: {
        drawingNo: data.drawingNo,
        name: data.name,
        nameFr: data.nameFr,
        project: { connect: { id: data.projectId } },
        discipline: data.discipline,
        zone: data.zoneId ? { connect: { id: data.zoneId } } : undefined,
        searchText: data.searchText,
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
      include: drawingInclude,
    });
  }

  updateDrawing(id: string, data: Prisma.DrawingUpdateInput) {
    return this.prisma.drawing.update({
      where: { id },
      data,
      include: drawingInclude,
    });
  }

  updateStatus(id: string, status: DrawingStatus) {
    return this.prisma.drawing.update({
      where: { id },
      data: { status },
      include: drawingInclude,
    });
  }

  softDelete(id: string) {
    return this.prisma.drawing.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  createVersion(
    drawingId: string,
    version: number,
    data: {
      fileUrl: string;
      fileName: string;
      fileType: DrawingFileType;
      fileSize?: number;
      uploadedById: string;
    },
    resetStatus?: DrawingStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.drawingVersion.create({
        data: {
          drawing: { connect: { id: drawingId } },
          version,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          uploadedBy: { connect: { id: data.uploadedById } },
        },
        include: { uploadedBy: { select: { id: true, name: true } } },
      });
      await tx.drawing.update({
        where: { id: drawingId },
        data: {
          currentVersion: version,
          status: resetStatus,
        },
      });
      return created;
    });
  }

  findVersion(drawingId: string, version: number) {
    return this.prisma.drawingVersion.findUnique({
      where: { drawingId_version: { drawingId, version } },
      include: {
        drawing: { include: { project: { select: projectSelect } } },
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  listVersions(drawingId: string) {
    return this.prisma.drawingVersion.findMany({
      where: { drawingId },
      orderBy: { version: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  }

  createReview(data: {
    drawingId: string;
    version: number;
    reviewerId: string;
    comment?: string;
    result: DrawingReviewResult;
  }) {
    return this.prisma.drawingReview.create({
      data: {
        drawing: { connect: { id: data.drawingId } },
        version: data.version,
        reviewer: { connect: { id: data.reviewerId } },
        comment: data.comment,
        result: data.result,
      },
      include: { reviewer: { select: { id: true, name: true } } },
    });
  }
}
