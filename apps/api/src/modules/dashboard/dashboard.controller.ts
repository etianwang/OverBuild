import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: '仪表盘总览（按角色过滤）' })
  overview(@Req() req: Request & { user: AuthUser }) {
    return this.dashboardService.getOverview(req.user);
  }

  @Get('projects')
  @ApiOperation({ summary: '项目统计' })
  projects(@Req() req: Request & { user: AuthUser }) {
    return this.dashboardService.getProjects(req.user);
  }

  @Get('finance')
  @ApiOperation({ summary: '财务统计' })
  finance(@Req() req: Request & { user: AuthUser }) {
    return this.dashboardService.getFinance(req.user);
  }

  @Get('procurement')
  @ApiOperation({ summary: '采购统计' })
  procurement(@Req() req: Request & { user: AuthUser }) {
    return this.dashboardService.getProcurement(req.user);
  }

  @Get('inventory-alerts')
  @ApiOperation({ summary: '库存预警' })
  inventoryAlerts(@Req() req: Request & { user: AuthUser }) {
    return this.dashboardService.getInventoryAlerts(req.user);
  }

  @Get('approvals-todo')
  @ApiOperation({ summary: '待办审批数' })
  approvalsTodo(@Req() req: Request & { user: AuthUser }) {
    return this.dashboardService.getApprovalsTodo(req.user);
  }

  @Get('notifications-unread')
  @ApiOperation({ summary: '未读通知数' })
  notificationsUnread(@Req() req: Request & { user: AuthUser }) {
    return this.dashboardService.getNotificationsUnread(req.user);
  }

  @Get('cost-trend')
  @ApiOperation({ summary: '成本趋势' })
  costTrend(
    @Req() req: Request & { user: AuthUser },
    @Query('projectId') projectId?: string,
    @Query('months') months = '6',
  ) {
    return this.dashboardService.getCostTrend(req.user, projectId, +months);
  }

  @Get('profit-ranking')
  @ApiOperation({ summary: '项目利润排名' })
  profitRanking(
    @Req() req: Request & { user: AuthUser },
    @Query('limit') limit = '5',
  ) {
    return this.dashboardService.getProfitRanking(req.user, +limit);
  }
}
