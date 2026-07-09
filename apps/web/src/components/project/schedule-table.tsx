'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ProjectDetail, ProjectTaskItem, updateProjectTask } from '@/lib/api';
import type { ScheduleColumn } from '@/lib/schedule-columns';
import {
  canDemoteUnder,
  getDemotedParentId,
  getParentName,
  getPromotedParentId,
  isDescendantOf,
  taskLevelIndent,
  taskLevelLabel,
} from '@/lib/task-level';
import {
  columnTypeLabel,
  DEFAULT_SCHEDULE_COLUMNS,
  loadScheduleColumns,
  saveScheduleColumns,
  TYPE_OPTIONS,
} from '@/lib/schedule-columns';
import type { TaskTreeNode } from '@/lib/task-tree';

const STATUS_OPTIONS = [
  { value: 'pending', label: '待开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

const cellInput =
  'h-8 w-full min-w-[80px] rounded border border-transparent bg-transparent px-1 text-sm hover:border-border focus:border-primary focus:bg-card focus:outline-none';

interface ScheduleTableProps {
  project: ProjectDetail;
  rows: TaskTreeNode[];
  canManage: boolean;
  onRefresh: () => Promise<void>;
  onCreateRow: () => Promise<void>;
  onCreateChild: (parentId: string) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    patch: Parameters<typeof updateProjectTask>[2],
  ) => Promise<void>;
  onDeleteTask: (task: ProjectTaskItem) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

function assigneeOptions(project: ProjectDetail) {
  const options: Array<{ id: string; name: string }> = [];
  if (project.manager) {
    options.push({
      id: project.manager.id,
      name: `${project.manager.name}（项目经理）`,
    });
  }
  for (const member of project.members ?? []) {
    if (!options.some((o) => o.id === member.user.id)) {
      options.push({
        id: member.user.id,
        name: `${member.user.name} · ${member.role}`,
      });
    }
  }
  return options;
}

export function ScheduleTable({
  project,
  rows,
  canManage,
  onRefresh,
  onCreateRow,
  onCreateChild,
  onUpdateTask,
  onDeleteTask,
  onReorder,
}: ScheduleTableProps) {
  const [columns, setColumns] = useState<ScheduleColumn[]>(DEFAULT_SCHEDULE_COLUMNS);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assignees = useMemo(() => assigneeOptions(project), [project]);
  const allTasks = useMemo(() => rows.map(({ depth: _, ...t }) => t), [rows]);

  useEffect(() => {
    setColumns(loadScheduleColumns(project.id));
  }, [project.id]);

  const visibleColumns = columns.filter((c) => c.visible);

  const persistColumns = useCallback(
    (next: ScheduleColumn[]) => {
      setColumns(next);
      saveScheduleColumns(project.id, next);
    },
    [project.id],
  );

  function handleDragStart(id: string) {
    if (!canManage) return;
    setDragId(id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (dragId && dragId !== id) setDragOverId(id);
  }

  async function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const ids = rows.map((r) => r.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setDragId(null);
    setDragOverId(null);
    await onReorder(next);
  }

  function startLongPressDrag(id: string) {
    if (!canManage) return;
    longPressTimer.current = setTimeout(() => handleDragStart(id), 400);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  async function promoteTask(task: TaskTreeNode) {
    const parentId = getPromotedParentId(task, allTasks);
    if (task.parentId == null && parentId == null) return;
    await onUpdateTask(task.id, { parentId });
    await onRefresh();
  }

  async function demoteTask(task: TaskTreeNode, index: number) {
    const prev = rows[index - 1];
    if (!canDemoteUnder(task, prev, allTasks)) return;
    await onUpdateTask(task.id, { parentId: getDemotedParentId(prev) });
    await onRefresh();
  }

  async function setParent(task: TaskTreeNode, parentId: string | null) {
    if (
      parentId &&
      (parentId === task.id || isDescendantOf(parentId, task.id, allTasks))
    ) {
      return;
    }
    await onUpdateTask(task.id, { parentId });
    await onRefresh();
  }

  function renderCell(task: TaskTreeNode, col: ScheduleColumn) {
    const disabled = !canManage;
    const save = (patch: Parameters<typeof updateProjectTask>[2]) =>
      void onUpdateTask(task.id, patch);

    switch (col.id) {
      case 'name':
        return (
          <input
            className={cellInput}
            defaultValue={task.name}
            disabled={disabled}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== task.name) {
                void save({ name: e.target.value });
              }
            }}
          />
        );
      case 'code':
        return (
          <input
            className={cellInput}
            defaultValue={task.code ?? ''}
            disabled={disabled}
            onBlur={(e) => {
              if (e.target.value !== (task.code ?? '')) {
                void save({ code: e.target.value || null });
              }
            }}
          />
        );
      case 'durationDays':
        return (
          <input
            type="number"
            min={0}
            step="0.5"
            className={cellInput}
            defaultValue={task.durationDays != null ? String(task.durationDays) : ''}
            disabled={disabled}
            onBlur={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              void save({ durationDays: v });
            }}
          />
        );
      case 'startDate':
        return (
          <input
            type="date"
            className={cellInput}
            defaultValue={task.startDate ? String(task.startDate).slice(0, 10) : ''}
            disabled={disabled}
            onBlur={(e) => void save({ startDate: e.target.value || null })}
          />
        );
      case 'endDate':
        return (
          <input
            type="date"
            className={cellInput}
            defaultValue={task.endDate ? String(task.endDate).slice(0, 10) : ''}
            disabled={disabled}
            onBlur={(e) => void save({ endDate: e.target.value || null })}
          />
        );
      case 'laborCount':
        return (
          <input
            type="number"
            min={0}
            className={cellInput}
            defaultValue={task.laborCount != null ? String(task.laborCount) : ''}
            disabled={disabled}
            onBlur={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              void save({ laborCount: v });
            }}
          />
        );
      case 'assigneeId':
        return (
          <select
            className={`${cellInput} min-w-[120px]`}
            defaultValue={task.assigneeId ?? ''}
            disabled={disabled}
            onChange={(e) =>
              void save({ assigneeId: e.target.value || null })
            }
          >
            <option value="">未指定</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        );
      case 'prerequisites':
        return (
          <input
            className={cellInput}
            defaultValue={task.prerequisites ?? ''}
            disabled={disabled}
            onBlur={(e) =>
              void save({ prerequisites: e.target.value || null })
            }
          />
        );
      case 'progress':
        return (
          <input
            type="number"
            min={0}
            max={100}
            className={cellInput}
            defaultValue={String(task.progress)}
            disabled={disabled}
            onBlur={(e) => void save({ progress: Number(e.target.value) || 0 })}
          />
        );
      case 'status':
        return (
          <select
            className={cellInput}
            defaultValue={task.status}
            disabled={disabled}
            onChange={(e) => void save({ status: e.target.value })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      default:
        return '—';
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <Button onClick={() => void onCreateRow()}>+ 添加大项</Button>
        )}
        <Button variant="ghost" onClick={() => setShowColumnPanel((v) => !v)}>
          列设置
        </Button>
        <span className="text-xs text-muted-foreground">
          大项→子项→分项可多级嵌套 · 降级=挂到上一行 · 升级=上移一层 · +子项=在当前行下新增
        </span>
      </div>

      {showColumnPanel && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-medium">自定义列名与显示</p>
          <div className="space-y-2">
            {columns.map((col, idx) => (
              <div key={col.id} className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={(e) => {
                    const next = [...columns];
                    next[idx] = { ...col, visible: e.target.checked };
                    persistColumns(next);
                  }}
                />
                <input
                  className="h-8 flex-1 min-w-[120px] rounded border border-border bg-card px-2"
                  value={col.label}
                  onChange={(e) => {
                    const next = [...columns];
                    next[idx] = { ...col, label: e.target.value };
                    persistColumns(next);
                  }}
                />
                <span className="text-muted-foreground">
                  {columnTypeLabel(col.type)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            数据类型与字段绑定（{TYPE_OPTIONS.map(columnTypeLabel).join('、')}）暂为预设，后续可扩展自定义字段。
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              {canManage && <th className="w-10 px-2 py-2">显</th>}
              {canManage && <th className="w-8 px-1 py-2" />}
              <th className="px-2 py-2">层级</th>
              {visibleColumns.map((col) => (
                <th key={col.id} className="px-2 py-2 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              {canManage && <th className="px-2 py-2">操作</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((task, index) => (
                <tr
                  key={task.id}
                  draggable={canManage && !!dragId && dragId === task.id}
                  onDragOver={(e) => handleDragOver(e, task.id)}
                  onDrop={() => void handleDrop(task.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  className={`border-b border-border ${
                    dragOverId === task.id ? 'bg-primary/10' : ''
                  } ${task.showInGantt === false ? 'opacity-60' : ''}`}
                >
                  {canManage && (
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={task.showInGantt !== false}
                        onChange={(e) =>
                          void onUpdateTask(task.id, {
                            showInGantt: e.target.checked,
                          })
                        }
                      />
                    </td>
                  )}
                  {canManage && (
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        className="cursor-grab px-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
                        title="拖动排序"
                        draggable
                        onDragStart={() => handleDragStart(task.id)}
                        onPointerDown={() => startLongPressDrag(task.id)}
                        onPointerUp={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                      >
                        ⠿
                      </button>
                    </td>
                  )}
                  <td className="px-2 py-1">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={
                          task.depth === 0
                            ? 'inline-flex w-fit rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium'
                            : 'inline-flex w-fit rounded bg-muted px-1.5 py-0.5 text-xs'
                        }
                      >
                        {taskLevelLabel(task.depth)}
                      </span>
                      {getParentName(task, allTasks) && (
                        <span className="max-w-[100px] truncate text-[10px] text-muted-foreground" title={getParentName(task, allTasks)!}>
                          ↑{getParentName(task, allTasks)}
                        </span>
                      )}
                      {canManage && (
                        <select
                          className="mt-0.5 max-w-[100px] rounded border border-border bg-card px-1 py-0.5 text-[10px]"
                          value={task.parentId ?? ''}
                          onChange={(e) =>
                            void setParent(
                              task,
                              e.target.value || null,
                            )
                          }
                          title="所属父项"
                        >
                          <option value="">无（大项）</option>
                          {allTasks
                            .filter(
                              (t) =>
                                t.id !== task.id &&
                                !isDescendantOf(task.id, t.id, allTasks),
                            )
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </td>
                  {visibleColumns.map((col) => (
                    <td key={col.id} className="px-2 py-1">
                      {col.id === 'name' ? (
                        <div
                          className="flex items-center"
                          style={{ paddingLeft: `${task.depth * 16}px` }}
                        >
                          <span className="mr-1 shrink-0 font-mono text-xs text-muted-foreground">
                            {taskLevelIndent(task.depth)}
                          </span>
                          {renderCell(task, col)}
                        </div>
                      ) : (
                        renderCell(task, col)
                      )}
                    </td>
                  ))}
                  {canManage && (
                    <td className="px-2 py-1 whitespace-nowrap text-xs">
                      <button
                        type="button"
                        className="mr-2 text-primary hover:underline"
                        onClick={() => void onCreateChild(task.id)}
                      >
                        +子项
                      </button>
                      {task.depth > 0 && (
                        <button
                          type="button"
                          className="mr-2 text-primary hover:underline"
                          onClick={() => void promoteTask(task)}
                          title="上移一层（如分项→子项→大项）"
                        >
                          升级
                        </button>
                      )}
                      {index > 0 && canDemoteUnder(task, rows[index - 1], allTasks) && (
                        <button
                          type="button"
                          className="mr-2 text-primary hover:underline"
                          onClick={() => void demoteTask(task, index)}
                          title="成为上一行的子项"
                        >
                          降级
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-red-500 hover:underline"
                        onClick={() => void onDeleteTask(task)}
                      >
                        删
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={
                    visibleColumns.length + (canManage ? 4 : 1)
                  }
                  className="py-8 text-center text-muted-foreground"
                >
                  点击「+ 添加大项」创建顶级任务，再用「+子项」逐级展开（如：暖通工程 → R+1层通风安装 → R+1层通风风管安装）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
