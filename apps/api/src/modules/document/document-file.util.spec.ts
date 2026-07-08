import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DocumentFileType } from '@prisma/client';
import {
  buildSearchText,
  detectFileType,
  getPreviewContentType,
} from './document-file.util';

describe('document-file.util', () => {
  it('detects pdf file type', () => {
    expect(detectFileType('spec.pdf')).toBe(DocumentFileType.pdf);
  });

  it('detects image file type', () => {
    expect(detectFileType('photo.png')).toBe(DocumentFileType.image);
  });

  it('rejects unsupported file type', () => {
    expect(() => detectFileType('archive.zip')).toThrow(BadRequestException);
  });

  it('builds search text from title and tags', () => {
    expect(buildSearchText('方案', 'Plan', ['土建'])).toContain('方案');
    expect(buildSearchText('方案', 'Plan', ['土建'])).toContain('plan');
  });

  it('returns preview content type for pdf', () => {
    expect(getPreviewContentType(DocumentFileType.pdf, 'a.pdf')).toBe(
      'application/pdf',
    );
  });
});
