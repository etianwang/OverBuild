import type { GanttStatic } from 'dhtmlx-gantt';

/** 能否降级（indent）：成为上一同级任务的子项 — 对应 Shift+Right */
export function canIndentTask(
  gantt: GanttStatic,
  taskId: string | number,
): boolean {
  const prevId = gantt.getPrevSibling(taskId);
  return (
    gantt.isTaskExists(prevId) && !gantt.isChildOf(taskId, prevId)
  );
}

/** 能否升级（outdent）：上移一层 — 对应 Shift+Left */
export function canOutdentTask(
  gantt: GanttStatic,
  taskId: string | number,
): boolean {
  const parentId = gantt.getParent(taskId);
  return (
    gantt.isTaskExists(parentId) && parentId !== gantt.config.root_id
  );
}

/** 官方降级：挂到上一同级任务下（keyboard: shift+right） */
export function indentTask(
  gantt: GanttStatic,
  taskId: string | number,
): boolean {
  if (gantt.isReadonly(gantt.getTask(taskId))) return false;
  const prevId = gantt.getPrevSibling(taskId);
  if (!gantt.isTaskExists(prevId) || gantt.isChildOf(taskId, prevId)) {
    return false;
  }
  const prev = gantt.getTask(prevId);
  prev.$open = true;
  const moved = gantt.moveTask(taskId, -1, prevId);
  if (moved === false) return false;
  gantt.updateTask(taskId);
  return true;
}

/** 官方升级：移到父级之后（keyboard: shift+left） */
export function outdentTask(
  gantt: GanttStatic,
  taskId: string | number,
): boolean {
  if (gantt.isReadonly(gantt.getTask(taskId))) return false;
  const parentId = gantt.getParent(taskId);
  if (!gantt.isTaskExists(parentId) || parentId === gantt.config.root_id) {
    return false;
  }
  const moved = gantt.moveTask(
    taskId,
    gantt.getTaskIndex(parentId) + 1,
    gantt.getParent(parentId),
  );
  if (moved === false) return false;
  gantt.updateTask(taskId);
  return true;
}
