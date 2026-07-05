import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv.util';

describe('csv.util', () => {
  it('parses quoted CSV rows', () => {
    const content = `名称,任务编号,开始日期
"基础,开挖",T001,2026-01-01
钢筋绑扎,T002,2026-01-16`;

    const rows = parseCsv(content);
    expect(rows).toHaveLength(2);
    expect(rows[0]['名称']).toBe('基础,开挖');
    expect(rows[1]['任务编号']).toBe('T002');
  });

  it('serializes CSV with escaped quotes', () => {
    const csv = toCsv(['名称'], [['Say "hi"']]);
    expect(csv).toBe('"名称"\n"Say ""hi"""');
  });
});
