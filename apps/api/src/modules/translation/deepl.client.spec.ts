import { Locale } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { DeepLClient } from './deepl.client';

describe('DeepLClient', () => {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'DEEPL_AUTH_KEY') return 'demo-key:fx';
      return undefined;
    }),
  };

  let client: DeepLClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'DEEPL_AUTH_KEY') return 'demo-key:fx';
      return undefined;
    });
    client = new DeepLClient(config as unknown as ConfigService);
  });

  it('uses free API base URL for :fx keys', () => {
    expect(client.resolveBaseUrl('demo-key:fx')).toBe(
      'https://api-free.deepl.com',
    );
  });

  it('translates text via DeepL API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [{ text: 'Bonjour' }] }),
    } as Response);

    const result = await client.translateText('你好', Locale.zh, Locale.fr);
    expect(result).toBe('Bonjour');

    const [, init] = fetchMock.mock.calls[0];
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api-free.deepl.com/v2/translate',
    );
    expect(init?.headers).toMatchObject({
      Authorization: 'DeepL-Auth-Key demo-key:fx',
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      text: ['你好'],
      source_lang: 'ZH',
      target_lang: 'FR',
      tag_handling: 'xml',
    });
  });

  it('throws when API returns error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    await expect(
      client.translateText('Hello', Locale.en, Locale.fr),
    ).rejects.toThrow('DeepL API error 403');
  });
});
