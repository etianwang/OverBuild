import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import {
  AddMemberDto,
  CreateMilestoneDto,
  CreateProjectDto,
  CreateZoneDto,
  UpdateMilestoneDto,
  UpdateProjectDto,
  UpdateZoneDto,
} from './dto/project.dto';
import { ProjectRepository } from './project.repository';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes('admin');
  }

  private canManageAll(user: AuthUser) {
    return this.isAdmin(user);
  }

  private async assertProjectAccess(
    user: AuthUser,
    projectId: string,
    write = false,
  ) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    if (this.canManageAll(user)) {
      return project;
    }

    const isManager = project.managerId === user.id;
    const member = await this.projectRepository.isMember(projectId, user.id);
    const isMember = !!member;

    if (write) {
      if (!isManager && !user.permissions.includes('project.update')) {
        throw new ForbiddenException('无权限操作此项目');
      }
      if (!isManager && !isMember) {
        throw new ForbiddenException('无权限操作此项目');
      }
    } else if (!user.permissions.includes('project.read')) {
      throw new ForbiddenException('无权限查看此项目');
    } else if (!isManager && !isMember && !user.roles.includes('boss')) {
      throw new ForbiddenException('无权限查看此项目');
    }

    return project;
  }

  private buildListWhere(user: AuthUser, q?: string, status?: ProjectStatus) {
    const where: Prisma.ProjectWhereInput = { deletedAt: null };

    if (status) {
      where.status = status;
    }

    const and: Prisma.ProjectWhereInput[] = [];

    if (q) {
      and.push({
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (!this.canManageAll(user) && !user.roles.includes('boss')) {
      and.push({
        OR: [
          { managerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      });
    }

    if (and.length) {
      where.AND = and;
    }

    return where;
  }

  private parseDate(value?: string) {
    return value ? new Date(value) : undefined;
  }

  async list(
    user: AuthUser,
    page = 1,
    pageSize = 20,
    q?: string,
    status?: ProjectStatus,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const allowedSort = ['createdAt', 'code', 'name', 'status', 'startDate'];
    const field = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    const where = this.buildListWhere(user, q, status);
    const skip = (page - 1) * pageSize;

    const [list, total] = await this.projectRepository.findMany({
      skip,
      take: pageSize,
      where,
      orderBy: { [field]: sortOrder },
    });

    return { list, page, pageSize, total };
  }

  async getOne(user: AuthUser, id: string) {
    return this.assertProjectAccess(user, id);
  }

  async create(user: AuthUser, dto: CreateProjectDto) {
    const existing = await this.projectRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException('项目编号已存在');
    }

    const manager = await this.projectRepository.userExists(dto.managerId);
    if (!manager) {
      throw new NotFoundException('项目经理不存在');
    }

    const project = await this.projectRepository.create({
      code: dto.code,
      name: dto.name,
      nameFr: dto.nameFr,
      location: dto.location,
      status: dto.status,
      startDate: this.parseDate(dto.startDate),
      endDate: this.parseDate(dto.endDate),
      description: dto.description,
      manager: { connect: { id: dto.managerId } },
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'project',
      resource: 'project',
      resourceId: project.id,
      payload: { code: project.code, name: project.name },
    });

    return project;
  }

  async update(user: AuthUser, id: string, dto: UpdateProjectDto) {
    await this.assertProjectAccess(user, id, true);

    if (dto.code) {
      const existing = await this.projectRepository.findByCode(dto.code, id);
      if (existing) {
        throw new ConflictException('项目编号已存在');
      }
    }

    if (dto.managerId) {
      const manager = await this.projectRepository.userExists(dto.managerId);
      if (!manager) {
        throw new NotFoundException('项目经理不存在');
      }
    }

    const project = await this.projectRepository.update(id, {
      code: dto.code,
      name: dto.name,
      nameFr: dto.nameFr,
      location: dto.location,
      status: dto.status,
      startDate: dto.startDate !== undefined ? this.parseDate(dto.startDate) : undefined,
      endDate: dto.endDate !== undefined ? this.parseDate(dto.endDate) : undefined,
      description: dto.description,
      manager: dto.managerId ? { connect: { id: dto.managerId } } : undefined,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'project',
      resource: 'project',
      resourceId: id,
      payload: dto,
    });

    return project;
  }

  async remove(user: AuthUser, id: string) {
    const project = await this.assertProjectAccess(user, id, true);

    if (project.status === ProjectStatus.active) {
      // Future: check procurement/payments/inventory when modules exist
    }

    await this.projectRepository.softDelete(id);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'project',
      resource: 'project',
      resourceId: id,
      payload: { code: project.code },
    });

    return null;
  }

  async export(user: AuthUser, q?: string, status?: ProjectStatus) {
    const where = this.buildListWhere(user, q, status);
    const projects = await this.projectRepository.findAllForExport(where);

    const header = ['编号', '名称', '状态', '地点', '项目经理', '开始日期', '结束日期'];
    const rows = projects.map((p) => [
      p.code,
      p.name,
      p.status,
      p.location ?? '',
      p.manager.name,
      p.startDate ? p.startDate.toISOString().slice(0, 10) : '',
      p.endDate ? p.endDate.toISOString().slice(0, 10) : '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'project',
      resource: 'project',
      payload: { count: projects.length },
    });

    return { filename: `projects-${Date.now()}.csv`, content: csv };
  }

  async getProfit(user: AuthUser, id: string) {
    await this.assertProjectAccess(user, id);
    return {
      projectId: id,
      income: 0,
      cost: 0,
      profit: 0,
      currency: 'CNY',
      source: 'finance_module_pending',
    };
  }

  async getCostAnalysis(user: AuthUser, id: string) {
    await this.assertProjectAccess(user, id);
    return {
      projectId: id,
      totalCost: 0,
      budget: 0,
      variance: 0,
      byCategory: [],
      byZone: [],
      source: 'finance_module_pending',
    };
  }

  async getSummary(user: AuthUser, id: string) {
    const project = await this.assertProjectAccess(user, id);
    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
      },
      contracts: { total: 0 },
      procurement: { total: 0, inProgress: 0 },
      warehouse: { total: 0 },
      finance: { income: 0, cost: 0, profit: 0 },
      source: 'related_modules_pending',
    };
  }

  async listZones(user: AuthUser, projectId: string) {
    await this.assertProjectAccess(user, projectId);
    return this.projectRepository.findZones(projectId);
  }

  async createZone(user: AuthUser, projectId: string, dto: CreateZoneDto) {
    await this.assertProjectAccess(user, projectId, true);
    const zone = await this.projectRepository.createZone(projectId, dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'project',
      resource: 'project_zone',
      resourceId: zone.id,
      payload: { projectId, name: zone.name },
    });

    return zone;
  }

  async updateZone(
    user: AuthUser,
    projectId: string,
    zoneId: string,
    dto: UpdateZoneDto,
  ) {
    await this.assertProjectAccess(user, projectId, true);
    const zone = await this.projectRepository.findZone(projectId, zoneId);
    if (!zone) {
      throw new NotFoundException('施工区域不存在');
    }

    const updated = await this.projectRepository.updateZone(zoneId, dto);

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'project',
      resource: 'project_zone',
      resourceId: zoneId,
      payload: dto,
    });

    return updated;
  }

  async removeZone(user: AuthUser, projectId: string, zoneId: string) {
    await this.assertProjectAccess(user, projectId, true);
    const zone = await this.projectRepository.findZone(projectId, zoneId);
    if (!zone) {
      throw new NotFoundException('施工区域不存在');
    }

    await this.projectRepository.softDeleteZone(zoneId);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'project',
      resource: 'project_zone',
      resourceId: zoneId,
    });

    return null;
  }

  async listMembers(user: AuthUser, projectId: string) {
    await this.assertProjectAccess(user, projectId);
    return this.projectRepository.findMembers(projectId);
  }

  async addMember(user: AuthUser, projectId: string, dto: AddMemberDto) {
    await this.assertProjectAccess(user, projectId, true);

    const targetUser = await this.projectRepository.userExists(dto.userId);
    if (!targetUser) {
      throw new NotFoundException('用户不存在');
    }

    try {
      const member = await this.projectRepository.addMember(
        projectId,
        dto.userId,
        dto.role,
      );

      await this.auditLogService.create({
        userId: user.id,
        action: 'create',
        module: 'project',
        resource: 'project_member',
        resourceId: member.id,
        payload: { projectId, userId: dto.userId, role: dto.role },
      });

      return member;
    } catch {
      throw new ConflictException('成员已存在');
    }
  }

  async removeMember(user: AuthUser, projectId: string, memberId: string) {
    await this.assertProjectAccess(user, projectId, true);
    const member = await this.projectRepository.findMember(projectId, memberId);
    if (!member) {
      throw new NotFoundException('成员不存在');
    }

    await this.projectRepository.removeMember(memberId);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'project',
      resource: 'project_member',
      resourceId: memberId,
    });

    return null;
  }

  async listMilestones(user: AuthUser, projectId: string) {
    await this.assertProjectAccess(user, projectId);
    return this.projectRepository.findMilestones(projectId);
  }

  async createMilestone(
    user: AuthUser,
    projectId: string,
    dto: CreateMilestoneDto,
  ) {
    await this.assertProjectAccess(user, projectId, true);
    const milestone = await this.projectRepository.createMilestone(projectId, {
      name: dto.name,
      dueDate: this.parseDate(dto.dueDate) ?? null,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'project',
      resource: 'project_milestone',
      resourceId: milestone.id,
      payload: { projectId, name: dto.name },
    });

    return milestone;
  }

  async updateMilestone(
    user: AuthUser,
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ) {
    await this.assertProjectAccess(user, projectId, true);
    const milestone = await this.projectRepository.findMilestone(
      projectId,
      milestoneId,
    );
    if (!milestone) {
      throw new NotFoundException('里程碑不存在');
    }

    const completedAt =
      dto.status === 'completed'
        ? dto.completedAt
          ? this.parseDate(dto.completedAt)
          : new Date()
        : dto.completedAt !== undefined
          ? this.parseDate(dto.completedAt)
          : undefined;

    const updated = await this.projectRepository.updateMilestone(milestoneId, {
      name: dto.name,
      dueDate: dto.dueDate !== undefined ? this.parseDate(dto.dueDate) : undefined,
      status: dto.status,
      completedAt,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'project',
      resource: 'project_milestone',
      resourceId: milestoneId,
      payload: dto,
    });

    return updated;
  }
}
