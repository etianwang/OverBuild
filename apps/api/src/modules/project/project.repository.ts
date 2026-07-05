import { Injectable } from '@nestjs/common';
import { MilestoneStatus, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const projectInclude = {
  manager: {
    select: { id: true, name: true, username: true },
  },
  _count: {
    select: { zones: true, members: true, milestones: true, tasks: true },
  },
} satisfies Prisma.ProjectInclude;

const taskInclude = {
  zone: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, username: true } },
  predecessor: { select: { id: true, name: true, code: true } },
  parent: { select: { id: true, name: true } },
} satisfies Prisma.ProjectTaskInclude;

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(params: {
    skip: number;
    take: number;
    where: Prisma.ProjectWhereInput;
    orderBy: Prisma.ProjectOrderByWithRelationInput;
  }) {
    return this.prisma.$transaction([
      this.prisma.project.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
        include: projectInclude,
      }),
      this.prisma.project.count({ where: params.where }),
    ]);
  }

  findAllForExport(where: Prisma.ProjectWhereInput) {
    return this.prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        manager: { select: { name: true } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...projectInclude,
        zones: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        milestones: { orderBy: { dueDate: 'asc' } },
      },
    });
  }

  findByCode(code: string, excludeId?: string) {
    return this.prisma.project.findFirst({
      where: {
        code,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  create(data: Prisma.ProjectCreateInput) {
    return this.prisma.project.create({
      data,
      include: projectInclude,
    });
  }

  update(id: string, data: Prisma.ProjectUpdateInput) {
    return this.prisma.project.update({
      where: { id },
      data,
      include: projectInclude,
    });
  }

  softDelete(id: string) {
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  isMember(projectId: string, userId: string) {
    return this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  findZones(projectId: string) {
    return this.prisma.projectZone.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  createZone(projectId: string, data: Omit<Prisma.ProjectZoneCreateInput, 'project'>) {
    return this.prisma.projectZone.create({
      data: { ...data, project: { connect: { id: projectId } } },
    });
  }

  findZone(projectId: string, zoneId: string) {
    return this.prisma.projectZone.findFirst({
      where: { id: zoneId, projectId, deletedAt: null },
    });
  }

  updateZone(zoneId: string, data: Prisma.ProjectZoneUpdateInput) {
    return this.prisma.projectZone.update({ where: { id: zoneId }, data });
  }

  softDeleteZone(zoneId: string) {
    return this.prisma.projectZone.update({
      where: { id: zoneId },
      data: { deletedAt: new Date() },
    });
  }

  findMembers(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  addMember(projectId: string, userId: string, role: string) {
    return this.prisma.projectMember.create({
      data: { projectId, userId, role },
      include: {
        user: { select: { id: true, name: true, username: true, email: true } },
      },
    });
  }

  findMember(projectId: string, memberId: string) {
    return this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
  }

  removeMember(memberId: string) {
    return this.prisma.projectMember.delete({ where: { id: memberId } });
  }

  findMilestones(projectId: string) {
    return this.prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: { dueDate: 'asc' },
    });
  }

  createMilestone(
    projectId: string,
    data: {
      name: string;
      dueDate?: Date | null;
      status?: MilestoneStatus;
    },
  ) {
    return this.prisma.projectMilestone.create({
      data: {
        projectId,
        name: data.name,
        dueDate: data.dueDate,
        status: data.status ?? MilestoneStatus.pending,
      },
    });
  }

  findMilestone(projectId: string, milestoneId: string) {
    return this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
  }

  updateMilestone(milestoneId: string, data: Prisma.ProjectMilestoneUpdateInput) {
    return this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data,
    });
  }

  userExists(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'active' },
    });
  }

  findTasks(projectId: string) {
    return this.prisma.projectTask.findMany({
      where: { projectId, deletedAt: null },
      include: taskInclude,
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findTask(projectId: string, taskId: string) {
    return this.prisma.projectTask.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      include: taskInclude,
    });
  }

  isProjectAssignee(projectId: string, userId: string) {
    return this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { managerId: userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
  }

  createTask(
    projectId: string,
    data: {
      code?: string | null;
      name: string;
      nameFr?: string | null;
      zoneId?: string | null;
      parentId?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
      laborCount?: number | null;
      durationDays?: number | null;
      prerequisites?: string | null;
      predecessorId?: string | null;
      assigneeId?: string | null;
      showInGantt?: boolean;
      progress?: number;
      status?: TaskStatus;
      sortOrder?: number;
    },
  ) {
    return this.prisma.projectTask.create({
      data: {
        projectId,
        code: data.code,
        name: data.name,
        nameFr: data.nameFr,
        zoneId: data.zoneId,
        parentId: data.parentId,
        startDate: data.startDate,
        endDate: data.endDate,
        laborCount: data.laborCount,
        durationDays: data.durationDays,
        prerequisites: data.prerequisites,
        predecessorId: data.predecessorId,
        assigneeId: data.assigneeId,
        showInGantt: data.showInGantt ?? true,
        progress: data.progress ?? 0,
        status: data.status ?? TaskStatus.pending,
        sortOrder: data.sortOrder ?? 0,
      },
      include: taskInclude,
    });
  }

  updateTask(taskId: string, data: Prisma.ProjectTaskUpdateInput) {
    return this.prisma.projectTask.update({
      where: { id: taskId },
      data,
      include: taskInclude,
    });
  }

  softDeleteTask(taskId: string) {
    return this.prisma.projectTask.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
  }

  softDeleteAllTasks(projectId: string) {
    return this.prisma.projectTask.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  findZoneByName(projectId: string, name: string) {
    return this.prisma.projectZone.findFirst({
      where: {
        projectId,
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  findTaskByCode(projectId: string, code: string) {
    return this.prisma.projectTask.findFirst({
      where: { projectId, code, deletedAt: null },
    });
  }
}
