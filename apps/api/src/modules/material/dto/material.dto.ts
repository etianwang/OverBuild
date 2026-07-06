import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialDiscipline } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MoneyDto {
  @ApiProperty({ example: 45.5 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: 'CNY' })
  @IsString()
  @Length(3, 3)
  currency!: string;
}

export class CreateMaterialDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  spec?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  unit!: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ description: '归属项目（专款专料专用）' })
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({ description: '储存位置，如 杜阿拉仓-A区-3号架' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storageLocation?: string;

  @ApiPropertyOptional({ description: '关联仓库 ID（仓库模块接入后使用）' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  purchasePrice?: MoneyDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}

export class UpdateMaterialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  spec?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storageLocation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  purchasePrice?: MoneyDto | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string | null;
}

export class ImportMaterialsDto {
  @ApiProperty({ description: 'CSV 文本内容' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class CreateMaterialCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: MaterialDiscipline, description: '专业/团队' })
  @IsEnum(MaterialDiscipline)
  discipline!: MaterialDiscipline;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateMaterialCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: MaterialDiscipline })
  @IsOptional()
  @IsEnum(MaterialDiscipline)
  discipline?: MaterialDiscipline;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
