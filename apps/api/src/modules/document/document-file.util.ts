import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { DocumentFileType } from '@prisma/client';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'documents');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const OFFICE_EXT = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
]);

export function detectFileType(filename: string): DocumentFileType {
  const ext = extname(filename).toLowerCase();
  if (ext === '.pdf') return DocumentFileType.pdf;
  if (ext === '.dwg') return DocumentFileType.dwg;
  if (IMAGE_EXT.has(ext)) return DocumentFileType.image;
  if (OFFICE_EXT.has(ext)) return DocumentFileType.office;
  throw new BadRequestException('不支持的文件格式');
}

export function getUploadRoot() {
  return UPLOAD_ROOT;
}

export function saveDocumentFile(
  documentId: string,
  version: number,
  fileName: string,
  buffer: Buffer,
) {
  const dir = join(UPLOAD_ROOT, documentId, String(version));
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, fileName);
  writeFileSync(filePath, buffer);
  return join('documents', documentId, String(version), fileName).replace(/\\/g, '/');
}

export function resolveDocumentFilePath(fileUrl: string) {
  const fullPath = join(process.cwd(), 'uploads', fileUrl);
  if (!existsSync(fullPath)) {
    throw new BadRequestException('文件不存在');
  }
  return fullPath;
}

export function readDocumentFile(fileUrl: string) {
  return readFileSync(resolveDocumentFilePath(fileUrl));
}

export function getPreviewContentType(
  fileType: DocumentFileType,
  fileName: string,
): string {
  const ext = extname(fileName).toLowerCase();
  if (fileType === DocumentFileType.pdf || ext === '.pdf') {
    return 'application/pdf';
  }
  if (fileType === DocumentFileType.image) {
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'image/jpeg';
  }
  if (fileType === DocumentFileType.dwg) {
    return 'application/acad';
  }
  if (ext === '.doc' || ext === '.docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (ext === '.xls' || ext === '.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (ext === '.ppt' || ext === '.pptx') {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  return 'application/octet-stream';
}

export function buildSearchText(
  title: string,
  titleFr?: string | null,
  tags?: string[],
) {
  return [title, titleFr, ...(tags ?? [])].filter(Boolean).join(' ').toLowerCase();
}
