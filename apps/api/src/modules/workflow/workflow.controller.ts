import {
  Body,
  Controller,
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
import { ApprovalStatus, ApprovalType } from '@prisma/client';
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  ApprovalActionDto,
  CreateApprovalDto,
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/workflow.dto';
import { WorkflowService } from './workflow.service';

@ApiTags('workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('approvals/export')
  @ApiOperation({ summary: '导出审批记录 CSV' })
  async exportApprovals(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('type') type?: ApprovalType,
    @Query('status') status?: ApprovalStatus,
    @Query('scope') scope?: 'all' | 'initiated',
  ) {
    const { filename, content } = await this.workflowService.export(
      req.user,
      q,
      type,
      status,
      scope,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('approvals/todo')
  @Permissions('workflow.approve')
  @ApiOperation({ summary: '我的待办' })
  listTodo(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
  ) {
    return this.workflowService.listTodo(req.user, +page, +pageSize, q);
  }

  @Get('approvals/done')
  @Permissions('workflow.approve')
  @ApiOperation({ summary: '我的已办' })
  listDone(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
  ) {
    return this.workflowService.listDone(req.user, +page, +pageSize, q);
  }

  @Get('approvals/initiated')
  @ApiOperation({ summary: '我发起的' })
  listInitiated(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('type') type?: ApprovalType,
    @Query('status') status?: ApprovalStatus,
  ) {
    return this.workflowService.listInitiated(
      req.user,
      +page,
      +pageSize,
      q,
      type,
      status,
    );
  }

  @Get('approvals')
  @Permissions('workflow.approve')
  @ApiOperation({ summary: '审批列表' })
  list(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('type') type?: ApprovalType,
    @Query('status') status?: ApprovalStatus,
  ) {
    return this.workflowService.list(
      req.user,
      +page,
      +pageSize,
      q,
      type,
      status,
    );
  }

  @Get('approvals/:id')
  @ApiOperation({ summary: '审批详情' })
  getOne(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.workflowService.getOne(req.user, id);
  }

  @Post('approvals')
  @ApiOperation({ summary: '创建审批' })
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateApprovalDto,
  ) {
    return this.workflowService.create(req.user, dto);
  }

  @Post('approvals/:id/approve')
  @Permissions('workflow.approve')
  @ApiOperation({ summary: '审批通过' })
  approve(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.workflowService.approve(req.user, id, dto);
  }

  @Post('approvals/:id/reject')
  @Permissions('workflow.approve')
  @ApiOperation({ summary: '审批驳回' })
  reject(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.workflowService.reject(req.user, id, dto);
  }

  @Post('approvals/:id/cancel')
  @ApiOperation({ summary: '撤回审批' })
  cancel(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.workflowService.cancel(req.user, id);
  }

  @Get('templates')
  @Permissions('workflow.template.manage')
  @ApiOperation({ summary: '审批模板列表' })
  listTemplates(@Req() req: Request & { user: AuthUser }) {
    return this.workflowService.listTemplates(req.user);
  }

  @Post('templates')
  @Permissions('workflow.template.manage')
  @ApiOperation({ summary: '创建审批模板' })
  createTemplate(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateTemplateDto,
  ) {
    return this.workflowService.createTemplate(req.user, dto);
  }

  @Put('templates/:id')
  @Permissions('workflow.template.manage')
  @ApiOperation({ summary: '编辑审批模板' })
  updateTemplate(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.workflowService.updateTemplate(req.user, id, dto);
  }
}
