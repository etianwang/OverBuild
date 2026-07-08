import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DocumentStatus, Locale } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  titleFr?: string;

  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed)
          ? parsed
          : value.split(',').map((t: string) => t.trim());
      } catch {
        return value
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  titleFr?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

export class CreateDocumentCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  nameFr?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class UpdateDocumentCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nameFr?: string;
}

export class SubmitDocumentTranslateDto {
  @IsEnum(Locale)
  sourceLang!: Locale;

  @IsEnum(Locale)
  targetLang!: Locale;
}
