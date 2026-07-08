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
import { ContractStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  CreateContractDto,
  CreateContractRevisionDto,
  UpdateContractDto,
} from './dto/contract.dto';
import { ContractService } from './contract.service';

@ApiTags('contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Get('export')
  @Permissions('contract.export')
  @ApiOperation({ summary: '导出合同 CSV' })
  async export(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    const { filename, content } = await this.contractService.export(
      req.user,
      q,
      projectId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get()
  @Permissions('contract.read')
  @ApiOperation({ summary: '合同列表' })
  list(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: ContractStatus,
    @Query('sort') sort = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.contractService.list(
      req.user,
      +page,
      +pageSize,
      q,
      projectId,
      status,
      sort,
      order,
    );
  }

  @Get(':id')
  @Permissions('contract.read')
  @ApiOperation({ summary: '合同详情' })
  getOne(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.contractService.getOne(req.user, id);
  }

  @Post()
  @Permissions('contract.create')
  @ApiOperation({ summary: '创建合同' })
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateContractDto,
  ) {
    return this.contractService.create(req.user, dto);
  }

  @Put(':id')
  @Permissions('contract.update')
  @ApiOperation({ summary: '编辑合同' })
  update(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contractService.update(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions('contract.delete')
  @ApiOperation({ summary: '删除合同' })
  remove(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.contractService.remove(req.user, id);
  }

  @Post(':id/submit')
  @Permissions('contract.submit')
  @ApiOperation({ summary: '提交签订审批' })
  submit(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.contractService.submit(req.user, id);
  }

  @Get(':id/revisions')
  @Permissions('contract.revision.read')
  @ApiOperation({ summary: '变更历史' })
  listRevisions(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.contractService.listRevisions(req.user, id);
  }

  @Post(':id/revisions')
  @Permissions('contract.revision.create')
  @ApiOperation({ summary: '记录变更' })
  createRevision(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: CreateContractRevisionDto,
  ) {
    return this.contractService.createRevision(req.user, id, dto);
  }

  @Get(':id/collections')
  @Permissions('contract.collection.read')
  @ApiOperation({ summary: '关联回款' })
  listCollections(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.contractService.listCollections(req.user, id);
  }
}
