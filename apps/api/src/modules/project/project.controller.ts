import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
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
import { ProjectService } from './project.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @Permissions('project.read')
  @ApiOperation({ summary: '项目列表' })
  list(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('status') status?: ProjectStatus,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    return this.projectService.list(
      req.user,
      +page,
      +pageSize,
      q,
      status,
      sortBy,
      sortOrder,
    );
  }

  @Get('export')
  @Permissions('project.export')
  @ApiOperation({ summary: '导出项目列表 CSV' })
  async export(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('status') status?: ProjectStatus,
  ) {
    const { filename, content } = await this.projectService.export(
      req.user,
      q,
      status,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get(':id')
  @Permissions('project.read')
  @ApiOperation({ summary: '项目详情' })
  getOne(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.projectService.getOne(req.user, id);
  }

  @Post()
  @Permissions('project.create')
  @ApiOperation({ summary: '新增项目' })
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.create(req.user, dto);
  }

  @Put(':id')
  @Permissions('project.update')
  @ApiOperation({ summary: '编辑项目' })
  update(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions('project.delete')
  @ApiOperation({ summary: '删除项目' })
  remove(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.projectService.remove(req.user, id);
  }

  @Get(':id/profit')
  @Permissions('project.read')
  @ApiOperation({ summary: '项目利润' })
  profit(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.projectService.getProfit(req.user, id);
  }

  @Get(':id/cost-analysis')
  @Permissions('project.read')
  @ApiOperation({ summary: '成本分析' })
  costAnalysis(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.projectService.getCostAnalysis(req.user, id);
  }

  @Get(':id/summary')
  @Permissions('project.read')
  @ApiOperation({ summary: '关联数据汇总' })
  summary(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.projectService.getSummary(req.user, id);
  }

  @Get(':id/zones')
  @Permissions('project.read')
  @ApiOperation({ summary: '施工区域列表' })
  listZones(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.projectService.listZones(req.user, id);
  }

  @Post(':id/zones')
  @Permissions('project.zone.manage')
  @ApiOperation({ summary: '新增施工区域' })
  createZone(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: CreateZoneDto,
  ) {
    return this.projectService.createZone(req.user, id, dto);
  }

  @Put(':id/zones/:zoneId')
  @Permissions('project.zone.manage')
  @ApiOperation({ summary: '编辑施工区域' })
  updateZone(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.projectService.updateZone(req.user, id, zoneId, dto);
  }

  @Delete(':id/zones/:zoneId')
  @Permissions('project.zone.manage')
  @ApiOperation({ summary: '删除施工区域' })
  removeZone(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Param('zoneId') zoneId: string,
  ) {
    return this.projectService.removeZone(req.user, id, zoneId);
  }

  @Get(':id/members')
  @Permissions('project.read')
  @ApiOperation({ summary: '项目成员列表' })
  listMembers(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.projectService.listMembers(req.user, id);
  }

  @Post(':id/members')
  @Permissions('project.member.manage')
  @ApiOperation({ summary: '添加项目成员' })
  addMember(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.projectService.addMember(req.user, id, dto);
  }

  @Delete(':id/members/:memberId')
  @Permissions('project.member.manage')
  @ApiOperation({ summary: '移除项目成员' })
  removeMember(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projectService.removeMember(req.user, id, memberId);
  }

  @Get(':id/milestones')
  @Permissions('project.read')
  @ApiOperation({ summary: '里程碑列表' })
  listMilestones(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.projectService.listMilestones(req.user, id);
  }

  @Post(':id/milestones')
  @Permissions('project.milestone.manage')
  @ApiOperation({ summary: '新增里程碑' })
  createMilestone(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projectService.createMilestone(req.user, id, dto);
  }

  @Put(':id/milestones/:milestoneId')
  @Permissions('project.milestone.manage')
  @ApiOperation({ summary: '编辑里程碑' })
  updateMilestone(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.projectService.updateMilestone(req.user, id, milestoneId, dto);
  }
}
