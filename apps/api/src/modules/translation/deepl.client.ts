import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale } from '@prisma/client';

export type DeepLTranslateResponse = {
  translations: Array<{ detected_source_language?: string; text: string }>;
};

const LOCALE_TO_DEEPL: Record<Locale, string> = {
  [Locale.zh]: 'ZH',
  [Locale.fr]: 'FR',
  [Locale.en]: 'EN',
};

@Injectable()
export class DeepLClient {
  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.authKey);
  }

  private get authKey(): string | undefined {
    return this.config.get<string>('DEEPL_AUTH_KEY')?.trim() || undefined;
  }

  resolveBaseUrl(authKey = this.authKey): string {
    const configured = this.config.get<string>('DEEPL_API_URL')?.trim();
    if (configured) return configured.replace(/\/$/, '');
    return authKey?.endsWith(':fx')
      ? 'https://api-free.deepl.com'
      : 'https://api.deepl.com';
  }

  toDeepLLang(locale: Locale): string {
    return LOCALE_TO_DEEPL[locale];
  }

  async translateText(
    text: string,
    sourceLang: Locale,
    targetLang: Locale,
  ): Promise<string> {
    if (!text.trim()) return text;
    if (sourceLang === targetLang) return text;

    const authKey = this.authKey;
    if (!authKey) {
      throw new Error('DEEPL_AUTH_KEY is not configured');
    }

    const response = await fetch(`${this.resolveBaseUrl(authKey)}/v2/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${authKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'OverBuild/1.0',
      },
      body: JSON.stringify({
        text: [text],
        source_lang: this.toDeepLLang(sourceLang),
        target_lang: this.toDeepLLang(targetLang),
        tag_handling: 'xml',
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`DeepL API error ${response.status}: ${detail}`);
    }

    const payload = (await response.json()) as DeepLTranslateResponse;
    return payload.translations[0]?.text ?? text;
  }
}
