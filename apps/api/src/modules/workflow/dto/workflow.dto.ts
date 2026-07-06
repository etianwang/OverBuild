import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApprovalRecordAction,
  ApprovalStatus,
  ApprovalType,
} from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class CreateApprovalDto {
  @ApiProperty({ enum: ApprovalType })
  @IsEnum(ApprovalType)
  type!: ApprovalType;

  @ApiProperty()
  @IsUUID()
  businessId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: '业务上下文，如付款金额' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ApprovalActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ enum: ApprovalType })
  @IsEnum(ApprovalType)
  type!: ApprovalType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: [{ node: 1, role: 'project_manager' }],
  })
  @IsArray()
  @ArrayMinSize(1)
  nodes!: Record<string, unknown>[];
}

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  nodes?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class ApprovalListQueryDto {
  @ApiPropertyOptional({ enum: ApprovalType })
  @IsOptional()
  @IsEnum(ApprovalType)
  type?: ApprovalType;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}

export { ApprovalRecordAction, ApprovalStatus, ApprovalType };
