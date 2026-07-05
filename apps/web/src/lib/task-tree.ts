import type { ProjectTaskItem } from '@/lib/api';

export type TaskTreeNode = ProjectTaskItem & { depth: number };

export function flattenTaskTree(tasks: ProjectTaskItem[] | null | undefined): TaskTreeNode[] {
  if (!Array.isArray(tasks) || !tasks.length) {
    return [];
  }
  const byParent = new Map<string | null, ProjectTaskItem[]>();

  for (const task of tasks) {
    const key = task.parentId ?? null;
    const bucket = byParent.get(key) ?? [];
    bucket.push(task);
    byParent.set(key, bucket);
  }

  for (const bucket of byParent.values()) {
    bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  const result: TaskTreeNode[] = [];
  const visited = new Set<string>();

  function walk(parentId: string | null, depth: number) {
    for (const task of byParent.get(parentId) ?? []) {
      if (visited.has(task.id)) continue;
      visited.add(task.id);
      result.push({ ...task, depth });
      walk(task.id, depth + 1);
    }
  }

  walk(null, 0);

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      result.push({ ...task, depth: 0 });
    }
  }

  return result;
}

export function listRootTasks(tasks: ProjectTaskItem[]) {
  return tasks.filter((t) => !t.parentId);
}
