/** 检测因错误编码写入后常见的「问号」占位文本 */
export function isCorruptedText(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed.includes('?')) return false;

  // 连续问号几乎一定是编码损坏
  if (/\?{2,}/.test(trimmed)) return true;

  // 仅由问号、连字符、空白组成
  if (/^[\?\-\s_\.]+$/.test(trimmed)) return true;

  return false;
}

export function repairProjectName(code: string, status?: string): string {
  if (code.startsWith('PRJ-ACPT-')) {
    return status === 'active' ? '验收项目-已编辑' : '验收项目';
  }
  if (code.startsWith('PRJ-DEMO-')) {
    return '杜阿拉综合楼';
  }
  return `项目 ${code}`;
}

export function repairProjectNameFr(code: string): string | null {
  if (code.startsWith('PRJ-DEMO-')) {
    return 'Immeuble Douala';
  }
  if (code.startsWith('PRJ-ACPT-')) {
    return 'Projet de recette';
  }
  return null;
}

export function repairZoneName(index: number): string {
  const labels = ['A区', 'B区', 'C区'];
  return labels[index] ?? `区域 ${index + 1}`;
}

export function repairMilestoneName(index: number): string {
  const labels = ['基础完工', '主体封顶', '竣工验收'];
  return labels[index] ?? `里程碑 ${index + 1}`;
}

export function repairTaskName(name: string, sortOrder: number): string {
  if (!isCorruptedText(name)) {
    return name;
  }
  const samples = ['基础工程', '主体结构', '机电安装', '装饰装修'];
  return samples[sortOrder % samples.length] ?? '施工内容';
}

export const UTF8_DATABASE_URL_SUFFIX =
  'schema=public&client_encoding=UTF8';

export function ensureUtf8DatabaseUrl(url: string): string {
  if (url.includes('client_encoding=')) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}client_encoding=UTF8`;
}
