import type { ProjectTaskItem } from '@/lib/api';

/** 层级标签：大项 → 子项 → 分项 → 四级… */
export function taskLevelLabel(depth: number): string {
  if (depth === 0) return '大项';
  if (depth === 1) return '子项';
  if (depth === 2) return '分项';
  return `${depth + 1}级`;
}

export function taskLevelIndent(depth: number): string {
  if (depth <= 0) return '';
  return `${'│ '.repeat(depth - 1)}└ `;
}

export function isDescendantOf(
  taskId: string,
  ancestorId: string,
  tasks: ProjectTaskItem[],
): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let cur = byId.get(taskId);
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

/** 升级一层：父级变为原父级的父级（大项的 parentId 为 null） */
export function getPromotedParentId(
  task: ProjectTaskItem,
  tasks: ProjectTaskItem[],
): string | null {
  if (!task.parentId) return null;
  const parent = tasks.find((t) => t.id === task.parentId);
  return parent?.parentId ?? null;
}

/** 降级一层：成为上一行的子项（需避免循环引用） */
export function canDemoteUnder(
  task: ProjectTaskItem,
  prev: ProjectTaskItem | undefined,
  tasks: ProjectTaskItem[],
): boolean {
  if (!prev) return false;
  if (prev.id === task.id) return false;
  // 上一行不能是当前行的后代，否则形成环
  if (isDescendantOf(prev.id, task.id, tasks)) return false;
  return true;
}

export function getDemotedParentId(prev: ProjectTaskItem): string {
  return prev.id;
}

export function getParentName(
  task: ProjectTaskItem,
  tasks: ProjectTaskItem[],
): string | null {
  if (!task.parentId) return null;
  return tasks.find((t) => t.id === task.parentId)?.name ?? null;
}
