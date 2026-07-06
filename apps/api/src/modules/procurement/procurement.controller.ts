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
  PurchaseOrderStatus,
  PurchaseRequestStatus,
} from '@prisma/client';
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  CreatePurchaseOrderDto,
  CreatePurchaseRequestDto,
  CreateQuotationDto,
  CreateSupplierDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseRequestDto,
  UpdateQuotationDto,
  UpdateSupplierDto,
} from './dto/procurement.dto';
import { ProcurementService } from './procurement.service';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('purchase-requests/export')
  @Permissions('procurement.request.export')
  @ApiOperation({ summary: '导出采购申请' })
  async exportRequests(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: PurchaseRequestStatus,
  ) {
    const { filename, content } = await this.procurementService.exportRequests(
      req.user,
      q,
      projectId,
      status,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('purchase-requests')
  @Permissions('procurement.request.read')
  @ApiOperation({ summary: '采购申请列表' })
  listRequests(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: PurchaseRequestStatus,
    @Query('sort') sort = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.procurementService.listRequests(
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

  @Post('purchase-requests')
  @Permissions('procurement.request.create')
  @ApiOperation({ summary: '创建采购申请' })
  createRequest(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreatePurchaseRequestDto,
  ) {
    return this.procurementService.createRequest(req.user, dto);
  }

  @Put('purchase-requests/:id')
  @Permissions('procurement.request.update')
  @ApiOperation({ summary: '编辑采购申请' })
  updateRequest(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseRequestDto,
  ) {
    return this.procurementService.updateRequest(req.user, id, dto);
  }

  @Post('purchase-requests/:id/submit')
  @Permissions('procurement.request.submit')
  @ApiOperation({ summary: '提交采购申请审批' })
  submitRequest(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.procurementService.submitRequest(req.user, id);
  }

  @Get('purchase-orders/export')
  @Permissions('procurement.order.export')
  @ApiOperation({ summary: '导出采购订单' })
  async exportOrders(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: PurchaseOrderStatus,
  ) {
    const { filename, content } = await this.procurementService.exportOrders(
      req.user,
      q,
      projectId,
      status,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('purchase-orders')
  @Permissions('procurement.order.read')
  @ApiOperation({ summary: '采购订单列表' })
  listOrders(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: PurchaseOrderStatus,
    @Query('sort') sort = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.procurementService.listOrders(
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

  @Post('purchase-orders')
  @Permissions('procurement.order.create')
  @ApiOperation({ summary: '创建采购订单' })
  createOrder(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.procurementService.createOrder(req.user, dto);
  }

  @Put('purchase-orders/:id')
  @Permissions('procurement.order.update')
  @ApiOperation({ summary: '编辑采购订单' })
  updateOrder(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.procurementService.updateOrder(req.user, id, dto);
  }

  @Put('purchase-orders/:id/receive')
  @Permissions('procurement.order.receive')
  @ApiOperation({ summary: '到货确认' })
  receiveOrder(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.procurementService.receiveOrder(req.user, id);
  }

  @Get('suppliers/export')
  @Permissions('procurement.supplier.export')
  @ApiOperation({ summary: '导出供应商' })
  async exportSuppliers(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
  ) {
    const { filename, content } = await this.procurementService.exportSuppliers(
      req.user,
      q,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('suppliers')
  @Permissions('procurement.supplier.read')
  @ApiOperation({ summary: '供应商列表' })
  listSuppliers(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('sort') sort = 'code',
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    return this.procurementService.listSuppliers(
      req.user,
      +page,
      +pageSize,
      q,
      sort,
      order,
    );
  }

  @Post('suppliers')
  @Permissions('procurement.supplier.create')
  @ApiOperation({ summary: '新增供应商' })
  createSupplier(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateSupplierDto,
  ) {
    return this.procurementService.createSupplier(req.user, dto);
  }

  @Put('suppliers/:id')
  @Permissions('procurement.supplier.update')
  @ApiOperation({ summary: '编辑供应商' })
  updateSupplier(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.procurementService.updateSupplier(req.user, id, dto);
  }

  @Delete('suppliers/:id')
  @Permissions('procurement.supplier.delete')
  @ApiOperation({ summary: '删除供应商' })
  removeSupplier(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.procurementService.removeSupplier(req.user, id);
  }

  @Get('quotations')
  @Permissions('procurement.quotation.read')
  @ApiOperation({ summary: '询价记录列表' })
  listQuotations(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('requestId') requestId?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.procurementService.listQuotations(
      req.user,
      +page,
      +pageSize,
      requestId,
      supplierId,
    );
  }

  @Post('quotations')
  @Permissions('procurement.quotation.create')
  @ApiOperation({ summary: '创建询价' })
  createQuotation(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateQuotationDto,
  ) {
    return this.procurementService.createQuotation(req.user, dto);
  }

  @Put('quotations/:id')
  @Permissions('procurement.quotation.update')
  @ApiOperation({ summary: '更新询价' })
  updateQuotation(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.procurementService.updateQuotation(req.user, id, dto);
  }
}
