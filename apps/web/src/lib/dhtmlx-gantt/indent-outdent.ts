import type { GanttStatic } from 'dhtmlx-gantt';

function isRootParent(gantt: GanttStatic, parentId: string | number) {
  return parentId === gantt.config.root_id || parentId === 0 || parentId === '0';
}

/** 上一可见行（与表格「成为上一行子项」一致） */
export function getPreviousRowId(
  gantt: GanttStatic,
  taskId: string | number,
): string | number | null {
  const prevId = gantt.getPrev(taskId);
  return gantt.isTaskExists(prevId) ? prevId : null;
}

/** 能否降级：挂到上一可见行 */
export function canIndentTask(
  gantt: GanttStatic,
  taskId: string | number,
): boolean {
  const prevId = getPreviousRowId(gantt, taskId);
  if (prevId == null) return false;
  // 已是上一行的子项，再次降级无意义且会导致树错乱
  if (String(gantt.getParent(taskId)) === String(prevId)) return false;
  // 上一行不能是当前行的后代，否则形成环
  return !gantt.isChildOf(prevId, taskId);
}

/** 能否升级：存在非根父级 */
export function canOutdentTask(
  gantt: GanttStatic,
  taskId: string | number,
): boolean {
  const parentId = gantt.getParent(taskId);
  return gantt.isTaskExists(parentId) && !isRootParent(gantt, parentId);
}

function openAncestorBranches(gantt: GanttStatic, taskId: string | number) {
  let parentId = gantt.getParent(taskId);
  while (gantt.isTaskExists(parentId) && !isRootParent(gantt, parentId)) {
    gantt.open(parentId);
    parentId = gantt.getParent(parentId);
  }
}

function ensureTaskVisible(gantt: GanttStatic, taskId: string | number) {
  openAncestorBranches(gantt, taskId);
  if (gantt.isTaskExists(taskId)) {
    gantt.showTask(taskId);
    gantt.refreshTask(taskId);
  }
}

/** 降级：成为上一可见行的子项（对齐 DHTMLX shift+right，但不改 summary 类型） */
export function indentTask(
  gantt: GanttStatic,
  taskId: string | number,
): boolean {
  if (!gantt.isTaskExists(taskId) || gantt.isReadonly(gantt.getTask(taskId))) {
    return false;
  }

  const prevId = getPreviousRowId(gantt, taskId);
  if (prevId == null || !canIndentTask(gantt, taskId)) {
    return false;
  }

  gantt.open(prevId);

  let moved = false;
  gantt.batchUpdate(() => {
    moved = gantt.moveTask(taskId, -1, prevId) !== false;
  });

  if (!moved) return false;

  gantt.updateTask(taskId);
  ensureTaskVisible(gantt, taskId);
  return true;
}

/** 升级：移到父级之后（对齐 DHTMLX shift+left） */
export function outdentTask(
  gantt: GanttStatic,
  taskId: string | number,
): boolean {
  if (!gantt.isTaskExists(taskId) || gantt.isReadonly(gantt.getTask(taskId))) {
    return false;
  }

  const parentId = gantt.getParent(taskId);
  if (!gantt.isTaskExists(parentId) || isRootParent(gantt, parentId)) {
    return false;
  }

  const grandParentId = gantt.getParent(parentId);
  const index = gantt.getTaskIndex(parentId) + 1;

  let moved = false;
  gantt.batchUpdate(() => {
    moved = gantt.moveTask(taskId, index, grandParentId) !== false;
  });

  if (!moved) return false;

  gantt.updateTask(taskId);
  ensureTaskVisible(gantt, taskId);
  return true;
}

type GanttWithSelection = GanttStatic & {
  getSelectedId?: () => string | number | null;
  getLastSelectedTask?: () => string | number | null;
  getSelectedTasks?: () => Array<string | number>;
};

export function resolveSelectedTaskId(gantt: GanttStatic): string | null {
  const api = gantt as GanttWithSelection;

  const selectedId = api.getSelectedId?.();
  if (selectedId != null && gantt.isTaskExists(selectedId)) {
    return String(selectedId);
  }

  const last = api.getLastSelectedTask?.();
  if (last != null && gantt.isTaskExists(last)) {
    return String(last);
  }

  const selected = api.getSelectedTasks?.();
  if (selected?.length && gantt.isTaskExists(selected[0])) {
    return String(selected[0]);
  }

  return null;
}
