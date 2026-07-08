import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { DrawingFileType } from '@prisma/client';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'drawings');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function detectDrawingFileType(filename: string): DrawingFileType {
  const ext = extname(filename).toLowerCase();
  if (ext === '.dwg') return DrawingFileType.dwg;
  if (ext === '.pdf') return DrawingFileType.pdf;
  if (IMAGE_EXT.has(ext)) return DrawingFileType.image;
  throw new BadRequestException('不支持的图纸格式，仅支持 DWG/PDF/图片');
}

export function saveDrawingFile(
  drawingId: string,
  version: number,
  fileName: string,
  buffer: Buffer,
) {
  const dir = join(UPLOAD_ROOT, drawingId, String(version));
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, fileName);
  writeFileSync(filePath, buffer);
  return join('drawings', drawingId, String(version), fileName).replace(/\\/g, '/');
}

export function readDrawingFile(fileUrl: string) {
  const fullPath = join(process.cwd(), 'uploads', fileUrl);
  if (!existsSync(fullPath)) {
    throw new BadRequestException('图纸文件不存在');
  }
  return readFileSync(fullPath);
}

export function getDrawingPreviewContentType(
  fileType: DrawingFileType,
  fileName: string,
): string {
  const ext = extname(fileName).toLowerCase();
  if (fileType === DrawingFileType.pdf || ext === '.pdf') {
    return 'application/pdf';
  }
  if (fileType === DrawingFileType.image) {
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'image/jpeg';
  }
  return 'application/acad';
}

export function buildDrawingSearchText(
  drawingNo: string,
  name: string,
  nameFr?: string | null,
  discipline?: string,
) {
  return [drawingNo, name, nameFr, discipline].filter(Boolean).join(' ').toLowerCase();
}
