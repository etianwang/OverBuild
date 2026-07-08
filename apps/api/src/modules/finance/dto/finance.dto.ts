import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CostSource,
  FinanceAccountType,
  InvoiceType,
  PaymentMethod,
} from '@prisma/client';

class MoneyDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @MaxLength(3)
  currency!: string;
}

export class CreateIncomeDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;

  @IsDateString()
  receivedAt!: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

export class CreatePaymentDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsUUID()
  projectId!: string;

  @IsString()
  payee!: string;

  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsEnum(FinanceAccountType)
  accountType!: FinanceAccountType;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;
}

export class UpdatePaymentDto {
  @IsOptional()
  @IsString()
  payee?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  amount?: MoneyDto;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(FinanceAccountType)
  accountType?: FinanceAccountType;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class CreateCollectionDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsUUID()
  contractId!: string;

  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;

  @IsDateString()
  collectedAt!: string;

  @IsEnum(FinanceAccountType)
  accountType!: FinanceAccountType;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateReimbursementDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsUUID()
  projectId!: string;

  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateReimbursementDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  amount?: MoneyDto;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateBudgetDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  category!: string;

  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;
}

export class UpdateBudgetDto {
  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateCostDto {
  @IsUUID()
  projectId!: string;

  @IsEnum(CostSource)
  source!: CostSource;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsString()
  category!: string;

  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateInvoiceDto {
  @IsString()
  invoiceNo!: string;

  @IsEnum(InvoiceType)
  type!: InvoiceType;

  @ValidateNested()
  @Type(() => MoneyDto)
  amount!: MoneyDto;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsDateString()
  issuedAt!: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class UpdateInvoiceDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  amount?: MoneyDto;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;
}

export class CreateExchangeRateDto {
  @IsString()
  @MaxLength(3)
  baseCurrency!: string;

  @IsString()
  @MaxLength(3)
  quoteCurrency!: string;

  @IsNumber()
  @Min(0)
  rate!: number;

  @IsDateString()
  rateDate!: string;
}
