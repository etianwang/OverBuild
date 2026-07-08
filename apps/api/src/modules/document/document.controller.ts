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
  CreateDocumentDto,
  SubmitDocumentTranslateDto,
  UpdateDocumentDto,
} from './dto/document.dto';
import { DocumentService } from './document.service';

const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get('export')
  @Permissions('document.export')
  @ApiOperation({ summary: '导出文档 CSV' })
  async export(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const { filename, content } = await this.documentService.export(
      req.user,
      q,
      projectId,
      categoryId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get()
  @Permissions('document.read')
  @ApiOperation({ summary: '文档列表' })
  list(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sort') sort = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.documentService.list(
      req.user,
      +page,
      +pageSize,
      q,
      projectId,
      categoryId,
      sort,
      order,
    );
  }

  @Get(':id')
  @Permissions('document.read')
  @ApiOperation({ summary: '文档详情' })
  getOne(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.documentService.getOne(req.user, id);
  }

  @Post()
  @Permissions('document.create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传文档' })
  @UseInterceptors(uploadInterceptor)
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documentService.create(req.user, dto, file);
  }

  @Put(':id')
  @Permissions('document.update')
  @ApiOperation({ summary: '编辑文档元数据' })
  update(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentService.update(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions('document.delete')
  @ApiOperation({ summary: '软删除文档' })
  remove(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.documentService.remove(req.user, id);
  }

  @Get(':id/versions')
  @Permissions('document.version.read')
  @ApiOperation({ summary: '版本列表' })
  listVersions(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.documentService.listVersions(req.user, id);
  }

  @Post(':id/versions')
  @Permissions('document.version.create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传新版本' })
  @UseInterceptors(uploadInterceptor)
  uploadVersion(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documentService.uploadVersion(req.user, id, file);
  }

  @Get(':id/versions/:version/preview')
  @Permissions('document.preview')
  @ApiOperation({ summary: '预览文档版本' })
  async preview(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const file = await this.documentService.getVersionFile(req.user, id, version);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    res.send(file.buffer);
  }

  @Get(':id/versions/:version/download')
  @Permissions('document.download')
  @ApiOperation({ summary: '下载文档版本' })
  async download(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const file = await this.documentService.getVersionFile(req.user, id, version);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Post(':id/translate')
  @Permissions('document.translate')
  @ApiOperation({ summary: '提交翻译任务' })
  submitTranslate(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: SubmitDocumentTranslateDto,
  ) {
    return this.documentService.submitTranslate(req.user, id, dto);
  }
}
