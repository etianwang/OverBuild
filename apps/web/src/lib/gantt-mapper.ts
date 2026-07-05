import type { Link, Task } from '@/lib/dhtmlx-gantt/types';
import type { ProjectTaskItem } from '@/lib/api';

const ROOT_PARENT = 0;
const DAY_MS = 86_400_000;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDuration(value?: number | string | null): number {
  if (value === null || value === undefined || value === '') return 1;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function resolveVisibleParent(
  task: ProjectTaskItem,
  byId: Map<string, ProjectTaskItem>,
): string | number {
  let parentId = task.parentId ?? null;
  while (parentId && !byId.has(parentId)) {
    const parent = byId.get(parentId);
    parentId = parent?.parentId ?? null;
  }
  return parentId ?? ROOT_PARENT;
}

export interface GanttMappedData {
  tasks: Task[];
  links: Link[];
}

export function mapProjectTasksToGantt(tasks: ProjectTaskItem[]): GanttMappedData {
  if (!tasks.length) {
    return { tasks: [], links: [] };
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const parentIds = new Set<string>();

  for (const task of tasks) {
    if (task.parentId && byId.has(task.parentId)) {
      parentIds.add(task.parentId);
    }
  }

  const datedStarts = tasks
    .map((task) => parseDate(task.startDate))
    .filter((date): date is Date => date !== null);
  const anchor = datedStarts.length
    ? new Date(Math.min(...datedStarts.map((date) => date.getTime())))
    : new Date();
  anchor.setHours(0, 0, 0, 0);

  let cursor = anchor.getTime();

  const dhtmlxTasks: Task[] = tasks.map((task) => {
    const progress = Math.min(1, Math.max(0, task.progress / 100));
    const parent = resolveVisibleParent(task, byId);
    const isProject = parentIds.has(task.id);

    if (isProject) {
      return {
        id: task.id,
        text: task.name,
        parent,
        type: 'project',
        progress,
        open: true,
      };
    }

    const start = parseDate(task.startDate);
    const end = parseDate(task.endDate);
    const duration = parseDuration(task.durationDays);

    const mapped: Task = {
      id: task.id,
      text: task.name,
      parent,
      type: 'task',
      progress,
      open: true,
    };

    if (start && end) {
      mapped.start_date = start;
      mapped.end_date = end;
      return mapped;
    }

    if (start) {
      mapped.start_date = start;
      mapped.duration = duration;
      return mapped;
    }

    if (end) {
      mapped.end_date = end;
      mapped.start_date = new Date(end.getTime() - duration * DAY_MS);
      return mapped;
    }

    mapped.start_date = new Date(cursor);
    mapped.duration = duration;
    cursor += duration * DAY_MS;
    return mapped;
  });

  const links: Link[] = [];
  let linkId = 1;

  for (const task of tasks) {
    if (task.predecessorId && byId.has(task.predecessorId)) {
      links.push({
        id: linkId,
        source: task.predecessorId,
        target: task.id,
        type: '0',
      });
      linkId += 1;
    }
  }

  return { tasks: dhtmlxTasks, links };
}
