import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  CreateDocumentCategoryDto,
  UpdateDocumentCategoryDto,
} from './dto/document.dto';
import { DocumentService } from './document.service';

@ApiTags('document-categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('document-categories')
export class DocumentCategoryController {
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  @Permissions('document.category.read')
  @ApiOperation({ summary: '分类列表' })
  list(
    @Req() req: Request & { user: AuthUser },
    @Query('projectId') projectId?: string,
  ) {
    return this.documentService.listCategories(req.user, projectId);
  }

  @Post()
  @Permissions('document.category.create')
  @ApiOperation({ summary: '新增分类' })
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateDocumentCategoryDto,
  ) {
    return this.documentService.createCategory(req.user, dto);
  }

  @Put(':id')
  @Permissions('document.category.update')
  @ApiOperation({ summary: '编辑分类' })
  update(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateDocumentCategoryDto,
  ) {
    return this.documentService.updateCategory(req.user, id, dto);
  }
}
