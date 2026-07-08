import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  CreateDrawingDto,
  ReviewDrawingDto,
  UpdateDrawingDto,
} from './dto/drawing.dto';
import { DrawingService } from './drawing.service';

const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

@ApiTags('drawings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('drawings')
export class DrawingController {
  constructor(private readonly drawingService: DrawingService) {}

  @Get('export')
  @Permissions('drawing.export')
  @ApiOperation({ summary: '导出图纸 CSV' })
  async export(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('discipline') discipline?: string,
  ) {
    const { filename, content } = await this.drawingService.export(
      req.user,
      q,
      projectId,
      discipline,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get()
  @Permissions('drawing.read')
  @ApiOperation({ summary: '图纸列表' })
  list(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('discipline') discipline?: string,
    @Query('sort') sort = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.drawingService.list(
      req.user,
      +page,
      +pageSize,
      q,
      projectId,
      discipline,
      sort,
      order,
    );
  }

  @Get(':id')
  @Permissions('drawing.read')
  @ApiOperation({ summary: '图纸详情' })
  getOne(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.drawingService.getOne(req.user, id);
  }

  @Post()
  @Permissions('drawing.create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传图纸' })
  @UseInterceptors(uploadInterceptor)
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateDrawingDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.drawingService.create(req.user, dto, file);
  }

  @Put(':id')
  @Permissions('drawing.update')
  @ApiOperation({ summary: '编辑图纸元数据' })
  update(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateDrawingDto,
  ) {
    return this.drawingService.update(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions('drawing.delete')
  @ApiOperation({ summary: '软删除图纸' })
  remove(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.drawingService.remove(req.user, id);
  }

  @Get(':id/versions')
  @Permissions('drawing.version.read')
  @ApiOperation({ summary: '版本列表' })
  listVersions(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.drawingService.listVersions(req.user, id);
  }

  @Post(':id/versions')
  @Permissions('drawing.version.create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传新版本' })
  @UseInterceptors(uploadInterceptor)
  uploadVersion(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.drawingService.uploadVersion(req.user, id, file);
  }

  @Get(':id/versions/:version/preview')
  @Permissions('drawing.preview')
  @ApiOperation({ summary: '预览图纸' })
  async preview(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const file = await this.drawingService.getVersionFile(req.user, id, version);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    res.send(file.buffer);
  }

  @Post(':id/submit-review')
  @Permissions('drawing.submit_review')
  @ApiOperation({ summary: '提交审阅' })
  submitReview(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.drawingService.submitReview(req.user, id);
  }

  @Post(':id/review')
  @Permissions('drawing.review')
  @ApiOperation({ summary: '审阅批准/驳回' })
  review(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: ReviewDrawingDto,
  ) {
    return this.drawingService.review(req.user, id, dto);
  }

  @Post(':id/publish')
  @Permissions('drawing.publish')
  @ApiOperation({ summary: '发布图纸' })
  publish(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.drawingService.publish(req.user, id);
  }
}
