import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DrawingDiscipline, DrawingReviewResult } from '@prisma/client';

export class CreateDrawingDto {
  @IsString()
  @MaxLength(50)
  drawingNo!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  nameFr?: string;

  @IsUUID()
  projectId!: string;

  @IsEnum(DrawingDiscipline)
  discipline!: DrawingDiscipline;

  @IsOptional()
  @IsUUID()
  zoneId?: string;
}

export class UpdateDrawingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nameFr?: string;

  @IsOptional()
  @IsEnum(DrawingDiscipline)
  discipline?: DrawingDiscipline;

  @IsOptional()
  @IsUUID()
  zoneId?: string;
}

export class ReviewDrawingDto {
  @IsEnum(DrawingReviewResult)
  result!: DrawingReviewResult;

  @IsOptional()
  @IsString()
  comment?: string;
}
