import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import { AuditLogService } from './audit-log.service';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Permissions('audit.read')
  @ApiOperation({ summary: '日志列表' })
  list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('action') action?: AuditAction,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditLogService.list({
      page: +page,
      pageSize: +pageSize,
      q,
      userId,
      module,
      action,
      startDate,
      endDate,
    });
  }

  @Get('export')
  @Permissions('audit.read')
  @ApiOperation({ summary: '导出日志 CSV' })
  async export(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('action') action?: AuditAction,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { filename, content } = await this.auditLogService.export(
      { q, userId, module, action, startDate, endDate },
      req.user.id,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get(':id')
  @Permissions('audit.read')
  @ApiOperation({ summary: '日志详情' })
  getOne(@Param('id') id: string) {
    return this.auditLogService.getOne(id);
  }
}
