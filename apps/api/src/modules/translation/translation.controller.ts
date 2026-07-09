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
import {
  TranslationSourceType,
  TranslationTaskStatus,
} from '@prisma/client';
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  AssignTranslationTaskDto,
  CreateGlossaryTermDto,
  CreateTranslationTaskDto,
  ImportGlossaryDto,
  SubmitManualTranslationDto,
  UpdateEntityTranslationsDto,
  UpdateGlossaryTermDto,
} from './dto/translation.dto';
import { TranslationService } from './translation.service';

@ApiTags('translation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('translation')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Get('tasks/export')
  @Permissions('translation.export')
  @ApiOperation({ summary: '导出翻译任务 CSV' })
  async exportTasks(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('status') status?: TranslationTaskStatus,
  ) {
    const { filename, content } = await this.translationService.exportTasks(
      req.user,
      q,
      status,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('tasks')
  @Permissions('translation.task.read')
  @ApiOperation({ summary: '翻译任务列表' })
  listTasks(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('status') status?: TranslationTaskStatus,
    @Query('sourceType') sourceType?: TranslationSourceType,
  ) {
    return this.translationService.listTasks(
      req.user,
      +page,
      +pageSize,
      q,
      status,
      sourceType,
    );
  }

  @Post('tasks')
  @Permissions('translation.task.create')
  @ApiOperation({ summary: '创建翻译任务' })
  createTask(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateTranslationTaskDto,
  ) {
    return this.translationService.createTask(req.user, dto);
  }

  @Get('tasks/:id')
  @Permissions('translation.task.read')
  @ApiOperation({ summary: '翻译任务详情' })
  getTask(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.translationService.getTask(req.user, id);
  }

  @Post('tasks/:id/auto-translate')
  @Permissions('translation.auto')
  @ApiOperation({ summary: '触发自动翻译（异步）' })
  triggerAutoTranslate(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.translationService.triggerAutoTranslate(req.user, id);
  }

  @Put('tasks/:id/manual')
  @Permissions('translation.manual')
  @ApiOperation({ summary: '提交人工译文' })
  submitManual(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: SubmitManualTranslationDto,
  ) {
    return this.translationService.submitManualTranslation(req.user, id, dto);
  }

  @Put('tasks/:id/assign')
  @Permissions('translation.task.assign')
  @ApiOperation({ summary: '分配译员' })
  assignTask(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: AssignTranslationTaskDto,
  ) {
    return this.translationService.assignTask(req.user, id, dto);
  }

  @Get('glossary/export')
  @Permissions('translation.export')
  @ApiOperation({ summary: '导出术语库 CSV' })
  async exportGlossary(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
  ) {
    const { filename, content } = await this.translationService.exportGlossary(
      req.user,
      q,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Post('glossary/import')
  @Permissions('translation.glossary.manage')
  @ApiOperation({ summary: '导入术语库 CSV' })
  importGlossary(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: ImportGlossaryDto,
  ) {
    return this.translationService.importGlossary(req.user, dto);
  }

  @Get('glossary')
  @Permissions('translation.glossary.read')
  @ApiOperation({ summary: '术语库列表' })
  listGlossary(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('category') category?: string,
  ) {
    return this.translationService.listGlossary(
      req.user,
      +page,
      +pageSize,
      q,
      category,
    );
  }

  @Post('glossary')
  @Permissions('translation.glossary.manage')
  @ApiOperation({ summary: '新增术语' })
  createGlossary(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateGlossaryTermDto,
  ) {
    return this.translationService.createGlossary(req.user, dto);
  }

  @Put('glossary/:id')
  @Permissions('translation.glossary.manage')
  @ApiOperation({ summary: '编辑术语' })
  updateGlossary(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateGlossaryTermDto,
  ) {
    return this.translationService.updateGlossary(req.user, id, dto);
  }

  @Delete('glossary/:id')
  @Permissions('translation.glossary.manage')
  @ApiOperation({ summary: '删除术语' })
  deleteGlossary(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.translationService.deleteGlossary(req.user, id);
  }

  @Get('entities/:type/:id/translations')
  @Permissions('translation.entity.read')
  @ApiOperation({ summary: '获取实体译文' })
  getEntityTranslations(
    @Req() req: Request & { user: AuthUser },
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.translationService.getEntityTranslations(req.user, type, id);
  }

  @Put('entities/:type/:id/translations')
  @Permissions('translation.entity.update')
  @ApiOperation({ summary: '更新实体译文' })
  updateEntityTranslations(
    @Req() req: Request & { user: AuthUser },
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() dto: UpdateEntityTranslationsDto,
  ) {
    return this.translationService.updateEntityTranslations(
      req.user,
      type,
      id,
      dto,
    );
  }
}
