import type { Link, Task } from '@/lib/dhtmlx-gantt/types';
import type { ProjectTaskItem } from '@/lib/api';

const TEMP_ID = /^\d{10,}$/;

export function isTemporaryGanttId(id: string | number) {
  return TEMP_ID.test(String(id));
}

export function dhtmlxParentToApi(parent?: string | number | null) {
  if (parent === undefined || parent === null || parent === 0 || parent === '0') {
    return null;
  }
  return String(parent);
}

function formatDateOnly(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function mapDhtmlxTaskToCreatePayload(task: Task, sortOrder: number) {
  const progress = Math.round(Math.min(1, Math.max(0, task.progress ?? 0)) * 100);
  const parentId = dhtmlxParentToApi(task.parent);
  return {
    name: String(task.text ?? '新任务').trim() || '新任务',
    ...(parentId ? { parentId } : {}),
    startDate: formatDateOnly(task.start_date) ?? undefined,
    endDate: formatDateOnly(task.end_date) ?? undefined,
    durationDays:
      task.duration !== undefined && task.duration !== null
        ? Number(task.duration)
        : undefined,
    progress,
    status:
      progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending',
    sortOrder,
    showInGantt: true,
  };
}

export function mapDhtmlxTaskToUpdatePayload(task: Task) {
  const progress = Math.round(Math.min(1, Math.max(0, task.progress ?? 0)) * 100);
  return {
    name: String(task.text ?? '').trim() || '未命名',
    parentId: dhtmlxParentToApi(task.parent),
    startDate: formatDateOnly(task.start_date),
    endDate: formatDateOnly(task.end_date),
    durationDays:
      task.duration !== undefined && task.duration !== null
        ? Number(task.duration)
        : null,
    progress,
    status: progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending',
    showInGantt: true,
  };
}

export function collectGanttTaskOrder(instance: {
  eachTask: (cb: (task: Task) => void) => void;
}): string[] {
  const orderedIds: string[] = [];
  instance.eachTask((task) => {
    if (!isTemporaryGanttId(task.id)) {
      orderedIds.push(String(task.id));
    }
  });
  return orderedIds;
}

export function mapLinkToPredecessorUpdate(link: Link) {
  return {
    taskId: String(link.target),
    predecessorId: String(link.source),
  };
}

export function mapLinkDeleteToPredecessorClear(link: Link) {
  return {
    taskId: String(link.target),
    predecessorId: null as null,
  };
}

export type { ProjectTaskItem };
