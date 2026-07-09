/**
 * Manual DeepL connectivity test.
 * Usage: DEEPL_AUTH_KEY=your-key:fx node scripts/test-deepl.mjs
 */

const authKey = process.env.DEEPL_AUTH_KEY?.trim();
if (!authKey) {
  console.error('Missing DEEPL_AUTH_KEY environment variable.');
  process.exit(1);
}

const baseUrl = authKey.endsWith(':fx')
  ? 'https://api-free.deepl.com'
  : 'https://api.deepl.com';

const samples = [
  { text: '杜阿拉综合楼施工方案', source_lang: 'ZH', target_lang: 'FR' },
  { text: 'Hello world', source_lang: 'EN', target_lang: 'FR' },
];

async function translate(text, source_lang, target_lang) {
  const response = await fetch(`${baseUrl}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${authKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'OverBuild/1.0',
    },
    body: JSON.stringify({
      text: [text],
      source_lang,
      target_lang,
      tag_handling: 'xml',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`DeepL ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload.translations[0];
}

console.log(`DeepL base URL: ${baseUrl}`);
console.log('---');

for (const sample of samples) {
  const result = await translate(
    sample.text,
    sample.source_lang,
    sample.target_lang,
  );
  console.log(`[${sample.source_lang} → ${sample.target_lang}]`);
  console.log(`  原文: ${sample.text}`);
  console.log(`  译文: ${result.text}`);
  console.log(`  检测: ${result.detected_source_language ?? 'n/a'}`);
  console.log('');
}

console.log('DeepL test passed.');
