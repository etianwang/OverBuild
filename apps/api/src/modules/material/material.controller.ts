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
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  CreateMaterialCategoryDto,
  CreateMaterialDto,
  ImportMaterialsDto,
  UpdateMaterialCategoryDto,
  UpdateMaterialDto,
} from './dto/material.dto';
import { MaterialService } from './material.service';

@ApiTags('materials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('materials')
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  @Get('export')
  @Permissions('material.export')
  @ApiOperation({ summary: '导出材料 CSV' })
  async export(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sort') sort = 'code',
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    const { filename, content } = await this.materialService.export(
      req.user,
      q,
      categoryId,
      sort,
      order,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('alerts')
  @Permissions('material.read')
  @ApiOperation({ summary: '库存预警列表' })
  listAlerts(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.materialService.listAlerts(req.user, +page, +pageSize);
  }

  @Post('import')
  @Permissions('material.import')
  @ApiOperation({ summary: 'Excel/CSV 批量导入' })
  importMaterials(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: ImportMaterialsDto,
  ) {
    return this.materialService.import(req.user, dto);
  }

  @Get('categories')
  @Permissions('material.read')
  @ApiOperation({ summary: '材料分类列表' })
  listCategories(@Req() req: Request & { user: AuthUser }) {
    return this.materialService.listCategories(req.user);
  }

  @Post('categories')
  @Permissions('material.category.manage')
  @ApiOperation({ summary: '新增分类' })
  createCategory(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateMaterialCategoryDto,
  ) {
    return this.materialService.createCategory(req.user, dto);
  }

  @Put('categories/:id')
  @Permissions('material.category.manage')
  @ApiOperation({ summary: '编辑分类' })
  updateCategory(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateMaterialCategoryDto,
  ) {
    return this.materialService.updateCategory(req.user, id, dto);
  }

  @Delete('categories/:id')
  @Permissions('material.category.manage')
  @ApiOperation({ summary: '删除分类' })
  removeCategory(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.materialService.removeCategory(req.user, id);
  }

  @Get()
  @Permissions('material.read')
  @ApiOperation({ summary: '材料列表' })
  list(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('sort') sort = 'code',
    @Query('order') order: 'asc' | 'desc' = 'asc',
    @Query('categoryId') categoryId?: string,
  ) {
    return this.materialService.list(
      req.user,
      +page,
      +pageSize,
      q,
      sort,
      order,
      categoryId,
    );
  }

  @Get(':id/qrcode')
  @Permissions('material.read')
  @ApiOperation({ summary: '获取/生成二维码' })
  getQrcode(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.materialService.getQrcode(req.user, id);
  }

  @Get(':id/stock-transactions')
  @Permissions('material.read')
  @ApiOperation({ summary: '库存流水' })
  listStockTransactions(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.materialService.listStockTransactions(
      req.user,
      id,
      +page,
      +pageSize,
    );
  }

  @Get(':id')
  @Permissions('material.read')
  @ApiOperation({ summary: '材料详情' })
  getOne(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.materialService.getOne(req.user, id);
  }

  @Post()
  @Permissions('material.create')
  @ApiOperation({ summary: '新增材料' })
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateMaterialDto,
  ) {
    return this.materialService.create(req.user, dto);
  }

  @Put(':id')
  @Permissions('material.update')
  @ApiOperation({ summary: '编辑材料' })
  update(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materialService.update(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions('material.delete')
  @ApiOperation({ summary: '删除材料' })
  remove(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.materialService.remove(req.user, id);
  }
}
