import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Locale,
  TranslationSourceType,
  TranslationVersionSource,
} from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTranslationTaskDto {
  @ApiProperty({ enum: TranslationSourceType })
  @IsEnum(TranslationSourceType)
  sourceType!: TranslationSourceType;

  @ApiProperty()
  @IsUUID()
  sourceId!: string;

  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  sourceLang!: Locale;

  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  targetLang!: Locale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class AssignTranslationTaskDto {
  @ApiProperty()
  @IsUUID()
  assigneeId!: string;
}

export class SubmitManualTranslationDto {
  @ApiProperty({ description: '字段级或全文译文 JSON' })
  @IsObject()
  content!: Record<string, string>;
}

export class CreateGlossaryTermDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  source!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  zh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

export class UpdateGlossaryTermDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  zh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

export class ImportGlossaryDto {
  @ApiProperty({ description: 'CSV 内容：原文,中文,法语,英语,分类' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateEntityTranslationsDto {
  @ApiProperty({
    description: 'locale -> field -> value',
    example: { fr: { name: 'Plan Douala' } },
  })
  @IsObject()
  translations!: Record<string, Record<string, string>>;
}

export class TranslationVersionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TranslationVersionSource })
  source!: TranslationVersionSource;

  @ApiProperty()
  content!: Record<string, string>;

  @ApiPropertyOptional()
  translatedBy?: { id: string; name: string };

  @ApiProperty()
  createdAt!: Date;
}
