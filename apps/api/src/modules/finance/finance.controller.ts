import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  CreateBudgetDto,
  CreateCollectionDto,
  CreateCostDto,
  CreateExchangeRateDto,
  CreateIncomeDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  CreateReimbursementDto,
  UpdateBudgetDto,
  UpdateInvoiceDto,
  UpdatePaymentDto,
  UpdateReimbursementDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  private sendCsv(res: Response, filename: string, content: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\ufeff${content}`);
  }

  @Get('incomes/export')
  @Permissions('finance.income.export')
  @ApiOperation({ summary: '导出收入' })
  async exportIncomes(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    const { filename, content } = await this.financeService.exportIncomes(
      req.user,
      q,
      projectId,
    );
    this.sendCsv(res, filename, content);
  }

  @Get('incomes')
  @Permissions('finance.income.read')
  listIncomes(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.financeService.listIncomes(req.user, +page, +pageSize, q, projectId);
  }

  @Post('incomes')
  @Permissions('finance.income.create')
  createIncome(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateIncomeDto,
  ) {
    return this.financeService.createIncome(req.user, dto);
  }

  @Get('payments/export')
  @Permissions('finance.payment.export')
  async exportPayments(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    const { filename, content } = await this.financeService.exportPayments(
      req.user,
      q,
      projectId,
    );
    this.sendCsv(res, filename, content);
  }

  @Get('payments')
  @Permissions('finance.payment.read')
  listPayments(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.financeService.listPayments(
      req.user,
      +page,
      +pageSize,
      q,
      projectId,
      status,
    );
  }

  @Post('payments')
  @Permissions('finance.payment.create')
  createPayment(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreatePaymentDto,
  ) {
    return this.financeService.createPayment(req.user, dto);
  }

  @Put('payments/:id')
  @Permissions('finance.payment.update')
  updatePayment(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.financeService.updatePayment(req.user, id, dto);
  }

  @Post('payments/:id/submit')
  @Permissions('finance.payment.submit')
  submitPayment(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.financeService.submitPayment(req.user, id);
  }

  @Post('payments/:id/execute')
  @Permissions('finance.payment.execute')
  executePayment(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.financeService.executePayment(req.user, id);
  }

  @Get('collections/export')
  @Permissions('finance.collection.export')
  async exportCollections(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    const { filename, content } = await this.financeService.exportCollections(
      req.user,
      q,
      projectId,
    );
    this.sendCsv(res, filename, content);
  }

  @Get('collections')
  @Permissions('finance.collection.read')
  listCollections(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.financeService.listCollections(
      req.user,
      +page,
      +pageSize,
      q,
      projectId,
    );
  }

  @Post('collections')
  @Permissions('finance.collection.create')
  createCollection(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateCollectionDto,
  ) {
    return this.financeService.createCollection(req.user, dto);
  }

  @Get('reimbursements/export')
  @Permissions('finance.reimbursement.export')
  async exportReimbursements(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('projectId') projectId?: string,
  ) {
    const { filename, content } =
      await this.financeService.exportReimbursements(req.user, projectId);
    this.sendCsv(res, filename, content);
  }

  @Get('reimbursements')
  @Permissions('finance.reimbursement.read')
  listReimbursements(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('projectId') projectId?: string,
  ) {
    return this.financeService.listReimbursements(
      req.user,
      +page,
      +pageSize,
      projectId,
    );
  }

  @Post('reimbursements')
  @Permissions('finance.reimbursement.create')
  createReimbursement(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateReimbursementDto,
  ) {
    return this.financeService.createReimbursement(req.user, dto);
  }

  @Put('reimbursements/:id')
  @Permissions('finance.reimbursement.update')
  updateReimbursement(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateReimbursementDto,
  ) {
    return this.financeService.updateReimbursement(req.user, id, dto);
  }

  @Post('reimbursements/:id/submit')
  @Permissions('finance.reimbursement.submit')
  submitReimbursement(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.financeService.submitReimbursement(req.user, id);
  }

  @Get('budgets')
  @Permissions('finance.budget.read')
  listBudgets(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('projectId') projectId?: string,
  ) {
    return this.financeService.listBudgets(req.user, +page, +pageSize, projectId);
  }

  @Post('budgets')
  @Permissions('finance.budget.create')
  createBudget(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateBudgetDto,
  ) {
    return this.financeService.createBudget(req.user, dto);
  }

  @Put('budgets/:id')
  @Permissions('finance.budget.update')
  updateBudget(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.financeService.updateBudget(req.user, id, dto);
  }

  @Patch('budgets/:id/deactivate')
  @Permissions('finance.budget.deactivate')
  deactivateBudget(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.financeService.deactivateBudget(req.user, id);
  }

  @Get('budgets/:id/execution')
  @Permissions('finance.budget.read')
  getBudgetExecution(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.financeService.getBudgetExecution(req.user, id);
  }

  @Get('costs/summary')
  @Permissions('finance.cost.read')
  getCostSummary(
    @Req() req: Request & { user: AuthUser },
    @Query('projectId') projectId?: string,
  ) {
    return this.financeService.getCostSummary(req.user, projectId);
  }

  @Get('costs')
  @Permissions('finance.cost.read')
  listCosts(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('projectId') projectId?: string,
  ) {
    return this.financeService.listCosts(req.user, +page, +pageSize, projectId);
  }

  @Post('costs')
  @Permissions('finance.cost.create')
  createCost(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateCostDto,
  ) {
    return this.financeService.createCost(req.user, dto);
  }

  @Get('invoices/export')
  @Permissions('finance.invoice.export')
  async exportInvoices(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('q') q?: string,
  ) {
    const { filename, content } = await this.financeService.exportInvoices(
      req.user,
      q,
    );
    this.sendCsv(res, filename, content);
  }

  @Get('invoices')
  @Permissions('finance.invoice.read')
  listInvoices(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
  ) {
    return this.financeService.listInvoices(req.user, +page, +pageSize, q);
  }

  @Post('invoices')
  @Permissions('finance.invoice.create')
  createInvoice(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.financeService.createInvoice(req.user, dto);
  }

  @Put('invoices/:id')
  @Permissions('finance.invoice.update')
  updateInvoice(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.financeService.updateInvoice(req.user, id, dto);
  }

  @Get('cash-accounts')
  @Permissions('finance.account.read')
  listCashAccounts(@Req() req: Request & { user: AuthUser }) {
    return this.financeService.listCashAccounts(req.user);
  }

  @Get('bank-accounts')
  @Permissions('finance.account.read')
  listBankAccounts(@Req() req: Request & { user: AuthUser }) {
    return this.financeService.listBankAccounts(req.user);
  }

  @Get('accounts/:id/transactions')
  @Permissions('finance.account.read')
  getAccountTransactions(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Query('accountType') accountType: 'cash' | 'bank',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.financeService.getAccountTransactions(
      req.user,
      accountType,
      id,
      +page,
      +pageSize,
    );
  }

  @Get('accounts/:id/balance')
  @Permissions('finance.account.read')
  getAccountBalance(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Query('accountType') accountType: 'cash' | 'bank',
  ) {
    return this.financeService.getAccountBalance(req.user, accountType, id);
  }

  @Get('reports/daily/export')
  @Permissions('finance.report.export')
  async exportDailyReport(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('date') date?: string,
  ) {
    const { filename, content } = await this.financeService.exportDailyReport(
      req.user,
      date,
    );
    this.sendCsv(res, filename, content);
  }

  @Get('reports/daily')
  @Permissions('finance.report.read')
  getDailyReport(
    @Req() req: Request & { user: AuthUser },
    @Query('date') date?: string,
  ) {
    return this.financeService.getDailyReport(req.user, date);
  }

  @Get('reports/monthly/export')
  @Permissions('finance.report.export')
  async exportMonthlyReport(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const { filename, content } = await this.financeService.exportMonthlyReport(
      req.user,
      year ? +year : undefined,
      month ? +month : undefined,
    );
    this.sendCsv(res, filename, content);
  }

  @Get('reports/monthly')
  @Permissions('finance.report.read')
  getMonthlyReport(
    @Req() req: Request & { user: AuthUser },
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.financeService.getMonthlyReport(
      req.user,
      year ? +year : undefined,
      month ? +month : undefined,
    );
  }

  @Get('projects/profit-summary')
  @Permissions('finance.profit.read')
  getProfitSummary(@Req() req: Request & { user: AuthUser }) {
    return this.financeService.getProfitSummary(req.user);
  }

  @Get('projects/:id/profit')
  @Permissions('finance.profit.read')
  getProjectProfit(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.financeService.getProjectProfit(req.user, id);
  }

  @Get('currencies')
  @Permissions('finance.currency.read')
  listCurrencies(@Req() req: Request & { user: AuthUser }) {
    return this.financeService.listCurrencies(req.user);
  }

  @Get('exchange-rates/latest')
  @Permissions('finance.exchange_rate.read')
  getLatestExchangeRates(@Req() req: Request & { user: AuthUser }) {
    return this.financeService.getLatestExchangeRates(req.user);
  }

  @Get('exchange-rates')
  @Permissions('finance.exchange_rate.read')
  listExchangeRates(
    @Req() req: Request & { user: AuthUser },
    @Query('rateDate') rateDate?: string,
  ) {
    return this.financeService.listExchangeRates(req.user, rateDate);
  }

  @Post('exchange-rates')
  @Permissions('finance.exchange_rate.create')
  upsertExchangeRate(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateExchangeRateDto,
  ) {
    return this.financeService.upsertExchangeRate(req.user, dto);
  }
}
