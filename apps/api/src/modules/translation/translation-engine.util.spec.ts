import { Locale } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  applyGlossary,
  mockTranslateField,
  pickPreferredVersion,
} from './translation-engine.util';

describe('translation-engine.util', () => {
  const terms = [
    { source: '综合楼', zh: '综合楼', fr: 'Immeuble', en: 'Building' },
    { source: '施工', zh: '施工', fr: 'Construction', en: 'Construction' },
  ];

  it('replaces glossary terms for French target', () => {
    expect(applyGlossary('杜阿拉综合楼施工', terms, Locale.fr)).toBe(
      '杜阿拉ImmeubleConstruction',
    );
  });

  it('mock translates with glossary or prefix', () => {
    expect(mockTranslateField('综合楼', Locale.zh, Locale.fr, terms)).toBe(
      'Immeuble',
    );
    expect(mockTranslateField('平面图', Locale.zh, Locale.fr, terms)).toBe(
      '[FR] 平面图',
    );
  });

  it('prefers manual version over auto', () => {
    const preferred = pickPreferredVersion([
      { source: 'auto', content: { title: 'auto' } },
      { source: 'manual', content: { title: 'manual' } },
    ]);
    expect(preferred?.source).toBe('manual');
  });
});
