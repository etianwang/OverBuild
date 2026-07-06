import { describe, expect, it } from 'vitest';
import {
  isCorruptedText,
  repairProjectName,
  repairTaskName,
} from '../../../../prisma/lib/text-encoding';

describe('text-encoding', () => {
  it('detects question-mark corruption', () => {
    expect(isCorruptedText('??????-???')).toBe(true);
    expect(isCorruptedText('验收项目')).toBe(false);
    expect(isCorruptedText('Projet été')).toBe(false);
  });

  it('repairs acceptance project names', () => {
    expect(repairProjectName('PRJ-ACPT-140947')).toBe('验收项目');
    expect(repairProjectName('PRJ-ACPT-140947', 'active')).toBe(
      '验收项目-已编辑',
    );
  });

  it('repairs corrupted task names', () => {
    expect(repairTaskName('??????', 0)).toBe('基础工程');
    expect(repairTaskName('屋面防水', 1)).toBe('屋面防水');
  });
});
