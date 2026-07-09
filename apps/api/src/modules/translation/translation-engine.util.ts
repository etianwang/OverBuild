import { Locale } from '@prisma/client';

export type GlossaryEntry = {
  source: string;
  zh: string | null;
  fr: string | null;
  en: string | null;
};

export function buildTaskSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildGlossarySearchText(term: {
  source: string;
  zh?: string | null;
  fr?: string | null;
  en?: string | null;
  category?: string | null;
}) {
  return buildTaskSearchText([
    term.source,
    term.zh,
    term.fr,
    term.en,
    term.category,
  ]);
}

export function applyGlossary(
  text: string,
  terms: GlossaryEntry[],
  targetLang: Locale,
) {
  let result = text;
  const sorted = [...terms].sort((a, b) => b.source.length - a.source.length);
  for (const term of sorted) {
    const replacement =
      targetLang === Locale.zh
        ? term.zh
        : targetLang === Locale.fr
          ? term.fr
          : term.en;
    if (!replacement) continue;
    result = result.split(term.source).join(replacement);
  }
  return result;
}

export function mockTranslateField(
  text: string,
  sourceLang: Locale,
  targetLang: Locale,
  terms: GlossaryEntry[],
) {
  if (!text?.trim()) return text;
  if (sourceLang === targetLang) {
    return applyGlossary(text, terms, targetLang);
  }

  const withGlossary = applyGlossary(text, terms, targetLang);
  if (withGlossary !== text) return withGlossary;

  const prefix =
    targetLang === Locale.fr ? '[FR] ' : targetLang === Locale.en ? '[EN] ' : '';
  return `${prefix}${text}`;
}

export function mockTranslateContent(
  content: Record<string, string>,
  sourceLang: Locale,
  targetLang: Locale,
  terms: GlossaryEntry[],
) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    result[key] =
      typeof value === 'string'
        ? mockTranslateField(value, sourceLang, targetLang, terms)
        : value;
  }
  return result;
}

export function pickPreferredVersion<
  T extends { source: 'auto' | 'manual'; content: unknown },
>(versions: T[]) {
  const manual = versions.find((v) => v.source === 'manual');
  if (manual) return manual;
  return versions.find((v) => v.source === 'auto') ?? null;
}
