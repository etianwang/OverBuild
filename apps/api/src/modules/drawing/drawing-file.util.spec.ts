import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DrawingFileType } from '@prisma/client';
import {
  buildDrawingSearchText,
  detectDrawingFileType,
  getDrawingPreviewContentType,
} from './drawing-file.util';

describe('drawing-file.util', () => {
  it('detects dwg file type', () => {
    expect(detectDrawingFileType('plan.dwg')).toBe(DrawingFileType.dwg);
  });

  it('detects pdf file type', () => {
    expect(detectDrawingFileType('plan.pdf')).toBe(DrawingFileType.pdf);
  });

  it('rejects unsupported file type', () => {
    expect(() => detectDrawingFileType('plan.docx')).toThrow(BadRequestException);
  });

  it('builds search text', () => {
    const text = buildDrawingSearchText('A-001', '平面图', 'Plan', 'arch');
    expect(text).toContain('a-001');
    expect(text).toContain('平面图');
  });

  it('returns preview content type for dwg', () => {
    expect(getDrawingPreviewContentType(DrawingFileType.dwg, 'a.dwg')).toBe(
      'application/acad',
    );
  });
});
