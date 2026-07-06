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
  CreateInboundDto,
  CreateOutboundDto,
  CreateStocktakeDto,
  CreateWarehouseDto,
  UpdateInboundDto,
  UpdateOutboundDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto';
import { WarehouseService } from './warehouse.service';

@ApiTags('warehouse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('stock-balances/export')
  @Permissions('warehouse.balance.export')
  @ApiOperation({ summary: '导出库存报表' })
  async exportBalances(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('projectId') projectId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const { filename, content } = await this.warehouseService.exportBalances(
      req.user,
      projectId,
      warehouseId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('inbound/export')
  @Permissions('warehouse.inbound.export')
  @ApiOperation({ summary: '导出入库单' })
  async exportInbounds(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    const { filename, content } = await this.warehouseService.exportInbounds(
      req.user,
      q,
      projectId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('outbound/export')
  @Permissions('warehouse.outbound.export')
  @ApiOperation({ summary: '导出出库单' })
  async exportOutbounds(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    const { filename, content } = await this.warehouseService.exportOutbounds(
      req.user,
      q,
      projectId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('warehouses')
  @Permissions('warehouse.read')
  listWarehouses(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.warehouseService.listWarehouses(req.user, +page, +pageSize, q, projectId);
  }

  @Post('warehouses')
  @Permissions('warehouse.create')
  createWarehouse(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.warehouseService.createWarehouse(req.user, dto);
  }

  @Put('warehouses/:id')
  @Permissions('warehouse.update')
  updateWarehouse(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouseService.updateWarehouse(req.user, id, dto);
  }

  @Delete('warehouses/:id')
  @Permissions('warehouse.delete')
  removeWarehouse(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.warehouseService.removeWarehouse(req.user, id);
  }

  @Get('inbound')
  @Permissions('warehouse.inbound.read')
  listInbounds(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.warehouseService.listInbounds(
      req.user,
      +page,
      +pageSize,
      q,
      projectId,
      warehouseId,
    );
  }

  @Post('inbound')
  @Permissions('warehouse.inbound.create')
  createInbound(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateInboundDto,
  ) {
    return this.warehouseService.createInbound(req.user, dto);
  }

  @Put('inbound/:id')
  @Permissions('warehouse.inbound.update')
  updateInbound(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateInboundDto,
  ) {
    return this.warehouseService.updateInbound(req.user, id, dto);
  }

  @Post('inbound/:id/confirm')
  @Permissions('warehouse.inbound.confirm')
  confirmInbound(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.warehouseService.confirmInbound(req.user, id);
  }

  @Get('outbound')
  @Permissions('warehouse.outbound.read')
  listOutbounds(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.warehouseService.listOutbounds(req.user, +page, +pageSize, q, projectId);
  }

  @Post('outbound')
  @Permissions('warehouse.outbound.create')
  createOutbound(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateOutboundDto,
  ) {
    return this.warehouseService.createOutbound(req.user, dto);
  }

  @Put('outbound/:id')
  @Permissions('warehouse.outbound.update')
  updateOutbound(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateOutboundDto,
  ) {
    return this.warehouseService.updateOutbound(req.user, id, dto);
  }

  @Post('outbound/:id/confirm')
  @Permissions('warehouse.outbound.confirm')
  confirmOutbound(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.warehouseService.confirmOutbound(req.user, id);
  }

  @Get('stocktakes')
  @Permissions('warehouse.stocktake.read')
  listStocktakes(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('projectId') projectId?: string,
  ) {
    return this.warehouseService.listStocktakes(req.user, +page, +pageSize, projectId);
  }

  @Post('stocktakes')
  @Permissions('warehouse.stocktake.create')
  createStocktake(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateStocktakeDto,
  ) {
    return this.warehouseService.createStocktake(req.user, dto);
  }

  @Post('stocktakes/:id/confirm')
  @Permissions('warehouse.stocktake.confirm')
  confirmStocktake(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.warehouseService.confirmStocktake(req.user, id);
  }

  @Get('stock-balances')
  @Permissions('warehouse.balance.read')
  listBalances(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('projectId') projectId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('q') q?: string,
  ) {
    return this.warehouseService.listBalances(
      req.user,
      +page,
      +pageSize,
      projectId,
      warehouseId,
      q,
    );
  }

  @Get('stock-transactions')
  @Permissions('warehouse.transaction.read')
  listTransactions(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('projectId') projectId?: string,
    @Query('materialId') materialId?: string,
  ) {
    return this.warehouseService.listTransactions(
      req.user,
      +page,
      +pageSize,
      projectId,
      materialId,
    );
  }
}
