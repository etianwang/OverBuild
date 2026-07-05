import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthUser } from '../auth/auth.types';
import {
  AddMemberDto,
  CreateMilestoneDto,
  CreateProjectDto,
  CreateTaskDto,
  CreateZoneDto,
  ImportTasksDto,
  ReorderTasksDto,
  UpdateMilestoneDto,
  UpdateProjectDto,
  UpdateTaskDto,
  UpdateZoneDto,
} from './dto/project.dto';
import { parseCsv, toCsv } from './csv.util';
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

  private async validateTaskAssignee(projectId: string, assigneeId?: string) {
    if (!assigneeId) return;
    const allowed = await this.projectRepository.isProjectAssignee(
      projectId,
      assigneeId,
    );
    if (!allowed) {
      throw new BadRequestException('负责人必须是项目经理或项目成员');
    }
  }

  private async validateTaskPredecessor(
    projectId: string,
    predecessorId?: string | null,
    taskId?: string,
  ) {
    if (!predecessorId) return;
    if (taskId && predecessorId === taskId) {
      throw new BadRequestException('前置任务不能是自身');
    }
    const predecessor = await this.projectRepository.findTask(
      projectId,
      predecessorId,
    );
    if (!predecessor) {
      throw new NotFoundException('前置任务不存在');
    }
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

  private normalizeTaskStatus(value?: string): TaskStatus | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    const map: Record<string, TaskStatus> = {
      pending: TaskStatus.pending,
      in_progress: TaskStatus.in_progress,
      completed: TaskStatus.completed,
      待开始: TaskStatus.pending,
      待完成: TaskStatus.pending,
      进行中: TaskStatus.in_progress,
      已完成: TaskStatus.completed,
    };
    return map[trimmed] ?? map[trimmed.toLowerCase()];
  }

  private getCsvField(row: Record<string, string>, keys: string[]) {
    for (const key of keys) {
      if (row[key]) return row[key];
    }
    return '';
  }

  private buildGanttOverview(
    tasks: Array<{
      startDate: Date | null;
      endDate: Date | null;
      progress: number;
      status: TaskStatus;
    }>,
    projectStart?: Date | null,
    projectEnd?: Date | null,
  ) {
    const dated = tasks.filter((t) => t.startDate && t.endDate);
    const dates = dated.flatMap((t) => [t.startDate!, t.endDate!]);
    if (projectStart) dates.push(projectStart);
    if (projectEnd) dates.push(projectEnd);

    const minDate = dates.length
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : null;
    const maxDate = dates.length
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : null;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.status === TaskStatus.completed,
    ).length;
    const avgProgress = totalTasks
      ? Math.round(
          tasks.reduce((sum, t) => sum + t.progress, 0) / totalTasks,
        )
      : 0;
    const scheduledTasks = dated.length;

    return {
      totalTasks,
      completedTasks,
      scheduledTasks,
      avgProgress,
      startDate: minDate?.toISOString().slice(0, 10) ?? null,
      endDate: maxDate?.toISOString().slice(0, 10) ?? null,
    };
  }

  async getGantt(user: AuthUser, projectId: string) {
    const project = await this.assertProjectAccess(user, projectId);
    const tasks = await this.projectRepository.findTasks(projectId);
    return {
      tasks,
      overview: this.buildGanttOverview(
        tasks,
        project.startDate,
        project.endDate,
      ),
    };
  }

  async listTasks(user: AuthUser, projectId: string) {
    await this.assertProjectAccess(user, projectId);
    return this.projectRepository.findTasks(projectId);
  }

  async createTask(user: AuthUser, projectId: string, dto: CreateTaskDto) {
    await this.assertProjectAccess(user, projectId, true);

    if (dto.zoneId) {
      const zone = await this.projectRepository.findZone(projectId, dto.zoneId);
      if (!zone) {
        throw new NotFoundException('施工区域不存在');
      }
    }

    if (dto.parentId) {
      const parent = await this.projectRepository.findTask(projectId, dto.parentId);
      if (!parent) {
        throw new NotFoundException('父任务不存在');
      }
    }

    await this.validateTaskAssignee(projectId, dto.assigneeId);
    await this.validateTaskPredecessor(projectId, dto.predecessorId);

    const task = await this.projectRepository.createTask(projectId, {
      code: dto.code,
      name: dto.name,
      nameFr: dto.nameFr,
      zoneId: dto.zoneId,
      parentId: dto.parentId,
      startDate: this.parseDate(dto.startDate) ?? null,
      endDate: this.parseDate(dto.endDate) ?? null,
      laborCount: dto.laborCount,
      durationDays: dto.durationDays,
      prerequisites: dto.prerequisites,
      predecessorId: dto.predecessorId,
      assigneeId: dto.assigneeId,
      showInGantt: dto.showInGantt,
      progress: dto.progress,
      status: dto.status,
      sortOrder: dto.sortOrder,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'project',
      resource: 'project_task',
      resourceId: task.id,
      payload: { projectId, name: task.name },
    });

    return task;
  }

  async updateTask(
    user: AuthUser,
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    await this.assertProjectAccess(user, projectId, true);
    const task = await this.projectRepository.findTask(projectId, taskId);
    if (!task) {
      throw new NotFoundException('施工内容不存在');
    }

    if (dto.zoneId) {
      const zone = await this.projectRepository.findZone(projectId, dto.zoneId);
      if (!zone) {
        throw new NotFoundException('施工区域不存在');
      }
    }

    if (dto.parentId) {
      if (dto.parentId === taskId) {
        throw new BadRequestException('父任务不能是自身');
      }
      const parent = await this.projectRepository.findTask(projectId, dto.parentId);
      if (!parent) {
        throw new NotFoundException('父任务不存在');
      }
    }

    if (dto.assigneeId) {
      await this.validateTaskAssignee(projectId, dto.assigneeId);
    }
    if (dto.assigneeId === null) {
      // allow clearing assignee
    }
    if (dto.predecessorId !== undefined) {
      await this.validateTaskPredecessor(
        projectId,
        dto.predecessorId,
        taskId,
      );
    }

    const updated = await this.projectRepository.updateTask(taskId, {
      code: dto.code,
      name: dto.name,
      nameFr: dto.nameFr,
      zone:
        dto.zoneId === null
          ? { disconnect: true }
          : dto.zoneId
            ? { connect: { id: dto.zoneId } }
            : undefined,
      parent:
        dto.parentId === null
          ? { disconnect: true }
          : dto.parentId
            ? { connect: { id: dto.parentId } }
            : undefined,
      predecessor:
        dto.predecessorId === null
          ? { disconnect: true }
          : dto.predecessorId
            ? { connect: { id: dto.predecessorId } }
            : undefined,
      assignee:
        dto.assigneeId === null
          ? { disconnect: true }
          : dto.assigneeId
            ? { connect: { id: dto.assigneeId } }
            : undefined,
      startDate:
        dto.startDate === null
          ? null
          : dto.startDate !== undefined
            ? this.parseDate(dto.startDate)
            : undefined,
      endDate:
        dto.endDate === null
          ? null
          : dto.endDate !== undefined
            ? this.parseDate(dto.endDate)
            : undefined,
      laborCount: dto.laborCount === null ? null : dto.laborCount,
      durationDays: dto.durationDays === null ? null : dto.durationDays,
      prerequisites:
        dto.prerequisites === null ? null : dto.prerequisites,
      showInGantt: dto.showInGantt,
      progress: dto.progress,
      status: dto.status,
      sortOrder: dto.sortOrder,
    });

    await this.auditLogService.create({
      userId: user.id,
      action: 'update',
      module: 'project',
      resource: 'project_task',
      resourceId: taskId,
      payload: dto,
    });

    return updated;
  }

  async removeTask(user: AuthUser, projectId: string, taskId: string) {
    await this.assertProjectAccess(user, projectId, true);
    const task = await this.projectRepository.findTask(projectId, taskId);
    if (!task) {
      throw new NotFoundException('施工内容不存在');
    }

    await this.projectRepository.softDeleteTask(taskId);

    await this.auditLogService.create({
      userId: user.id,
      action: 'delete',
      module: 'project',
      resource: 'project_task',
      resourceId: taskId,
    });

    return null;
  }

  async reorderTasks(
    user: AuthUser,
    projectId: string,
    dto: ReorderTasksDto,
  ) {
    await this.assertProjectAccess(user, projectId, true);

    const tasks = await this.projectRepository.findTasks(projectId);
    const taskIds = new Set(tasks.map((t) => t.id));

    for (const id of dto.orderedIds) {
      if (!taskIds.has(id)) {
        throw new BadRequestException(`任务 ${id} 不存在`);
      }
    }

    await Promise.all(
      dto.orderedIds.map((taskId, index) =>
        this.projectRepository.updateTask(taskId, { sortOrder: index }),
      ),
    );

    return this.projectRepository.findTasks(projectId);
  }

  getTaskImportTemplate() {
    const headers = [
      '名称',
      '任务编号',
      '施工区域',
      '开始日期',
      '结束日期',
      '进度',
      '状态',
      '父任务编号',
    ];
    const rows = [
      ['基础开挖', 'T001', 'A区', '2026-01-01', '2026-01-15', '50', '进行中', ''],
      ['钢筋绑扎', 'T002', 'A区', '2026-01-16', '2026-01-30', '0', '待开始', 'T001'],
    ];
    return {
      filename: 'project-tasks-template.csv',
      content: toCsv(headers, rows),
    };
  }

  async exportTasks(user: AuthUser, projectId: string) {
    const project = await this.assertProjectAccess(user, projectId);
    const tasks = await this.projectRepository.findTasks(projectId);
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    const headers = [
      '名称',
      '任务编号',
      '施工区域',
      '开始日期',
      '结束日期',
      '进度',
      '状态',
      '父任务编号',
      '前置任务编号',
      '用工人数',
      '工期(天)',
      '前提条件',
      '负责人',
      '显示甘特图',
      '排序',
    ];

    const rows = tasks.map((task) => {
      const parentCode = task.parentId
        ? taskById.get(task.parentId)?.code ?? ''
        : '';
      const predecessorCode = task.predecessorId
        ? taskById.get(task.predecessorId)?.code ??
          task.predecessor?.code ??
          ''
        : '';

      return [
        task.name,
        task.code ?? '',
        task.zone?.name ?? '',
        task.startDate ? task.startDate.toISOString().slice(0, 10) : '',
        task.endDate ? task.endDate.toISOString().slice(0, 10) : '',
        String(task.progress),
        this.taskStatusLabel(task.status),
        parentCode,
        predecessorCode,
        task.laborCount != null ? String(task.laborCount) : '',
        task.durationDays != null ? String(task.durationDays) : '',
        task.prerequisites ?? '',
        task.assignee?.name ?? '',
        task.showInGantt !== false ? '是' : '否',
        String(task.sortOrder),
      ];
    });

    const safeName = project.name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 60);

    await this.auditLogService.create({
      userId: user.id,
      action: 'export',
      module: 'project',
      resource: 'project_task',
      resourceId: projectId,
      payload: { count: tasks.length },
    });

    return {
      filename: `${safeName}-施工计划.csv`,
      content: toCsv(headers, rows),
    };
  }

  private taskStatusLabel(status: TaskStatus): string {
    const map: Record<TaskStatus, string> = {
      pending: '待开始',
      in_progress: '进行中',
      completed: '已完成',
    };
    return map[status] ?? status;
  }

  async importTasks(user: AuthUser, projectId: string, dto: ImportTasksDto) {
    await this.assertProjectAccess(user, projectId, true);

    const rows = parseCsv(dto.content);
    if (!rows.length) {
      throw new BadRequestException('CSV 内容为空或格式不正确');
    }

    if (dto.replace) {
      await this.projectRepository.softDeleteAllTasks(projectId);
    }

    const codeToId = new Map<string, string>();
    const created: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = this.getCsvField(row, ['名称', 'name', 'Name']);
      if (!name) {
        errors.push(`第 ${i + 2} 行：名称不能为空`);
        continue;
      }

      const code = this.getCsvField(row, ['任务编号', 'code', 'Code']) || null;
      const zoneName = this.getCsvField(row, ['施工区域', 'zone', 'Zone']);
      const startDateStr = this.getCsvField(row, ['开始日期', 'startDate', 'Start Date']);
      const endDateStr = this.getCsvField(row, ['结束日期', 'endDate', 'End Date']);
      const progressStr = this.getCsvField(row, ['进度', 'progress', 'Progress']);
      const statusStr = this.getCsvField(row, ['状态', 'status', 'Status']);
      const parentCode = this.getCsvField(row, ['父任务编号', 'parentCode', 'Parent Code']);

      let zoneId: string | null = null;
      if (zoneName) {
        const zone = await this.projectRepository.findZoneByName(
          projectId,
          zoneName,
        );
        if (!zone) {
          errors.push(`第 ${i + 2} 行：施工区域「${zoneName}」不存在`);
          continue;
        }
        zoneId = zone.id;
      }

      let parentId: string | null = null;
      if (parentCode) {
        parentId = codeToId.get(parentCode) ?? null;
        if (!parentId) {
          const parent = await this.projectRepository.findTaskByCode(
            projectId,
            parentCode,
          );
          parentId = parent?.id ?? null;
        }
        if (!parentId) {
          errors.push(`第 ${i + 2} 行：父任务编号「${parentCode}」不存在`);
          continue;
        }
      }

      const progress = progressStr ? Math.min(100, Math.max(0, +progressStr)) : 0;
      const status = this.normalizeTaskStatus(statusStr) ?? TaskStatus.pending;

      const task = await this.projectRepository.createTask(projectId, {
        code,
        name,
        zoneId,
        parentId,
        startDate: startDateStr ? this.parseDate(startDateStr) ?? null : null,
        endDate: endDateStr ? this.parseDate(endDateStr) ?? null : null,
        progress: Number.isFinite(progress) ? progress : 0,
        status,
        sortOrder: i,
      });

      if (code) {
        codeToId.set(code, task.id);
      }
      created.push(task.id);
    }

    await this.auditLogService.create({
      userId: user.id,
      action: 'create',
      module: 'project',
      resource: 'project_task',
      payload: {
        projectId,
        imported: created.length,
        errors: errors.length,
        replace: !!dto.replace,
      },
    });

    return {
      imported: created.length,
      errors,
      taskIds: created,
    };
  }
}
