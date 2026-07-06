'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Gantt,
  type GanttStatic,
  type Link,
  type RouterFunction,
  type Task,
} from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import '@/lib/dhtmlx-gantt/gantt-overrides.css';
import type { ProjectTaskItem } from '@/lib/api';
import {
  createProjectTask,
  deleteProjectTask,
  reorderProjectTasks,
  updateProjectTask,
} from '@/lib/api';
import {
  canIndentTask,
  canOutdentTask,
  indentTask,
  outdentTask,
  resolveSelectedTaskId,
} from '@/lib/dhtmlx-gantt/indent-outdent';
import {
  guardInlineEditorsToDblClick,
} from '@/lib/dhtmlx-gantt/inline-edit-policy';
import { mapProjectTasksToGantt } from '@/lib/gantt-mapper';
import {
  collectGanttTaskOrder,
  isTemporaryGanttId,
  mapDhtmlxTaskToCreatePayload,
  mapDhtmlxTaskToUpdatePayload,
  mapLinkDeleteToPredecessorClear,
  mapLinkToPredecessorUpdate,
} from '@/lib/gantt-task-sync';
import {
  GANTT_ZOOM_LEVELS,
  ganttZoomLevelLabel,
} from '@/lib/gantt-zoom-levels';

interface DhtmlxGanttChartProps {
  projectId?: string;
  tasks: ProjectTaskItem[];
  compact?: boolean;
  readOnly?: boolean;
  editable?: boolean;
  onOverviewSync?: () => void | Promise<void>;
}

export interface DhtmlxGanttChartHandle {
  exportMsProject: (projectName: string) => Promise<void>;
}

function sanitizeExportName(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 60) || '施工计划';
}

function timelineElement(instance: GanttStatic | null | undefined) {
  if (!instance) return undefined;
  const timeline = (instance as GanttStatic & { $task_data?: HTMLElement })
    .$task_data;
  return timeline ?? undefined;
}

function buildColumns(editable: boolean, compact: boolean) {
  const base = editable ? [{ name: 'add', label: '', width: 44 }] : [];

  return [
    ...base,
    {
      name: 'text',
      label: '施工内容',
      tree: true,
      width: compact ? 200 : 260,
      resize: true,
      ...(editable ? { editor: { type: 'text', map_to: 'text' } } : {}),
    },
    {
      name: 'start_date',
      label: '开始',
      align: 'center',
      width: 96,
      resize: true,
      ...(editable ? { editor: { type: 'date', map_to: 'start_date' } } : {}),
    },
    {
      name: 'duration',
      label: '工期(天)',
      align: 'center',
      width: 80,
      resize: true,
      ...(editable
        ? { editor: { type: 'duration', map_to: 'duration' } }
        : {}),
    },
    {
      name: 'progress',
      label: '进度',
      align: 'center',
      width: 72,
      resize: true,
      template: (task: Task) => `${Math.round((task.progress ?? 0) * 100)}%`,
      ...(editable
        ? {
            editor: {
              type: 'number',
              map_to: 'progress',
              min: 0,
              max: 1,
            },
          }
        : {}),
    },
  ];
}

export const DhtmlxGanttChart = forwardRef<
  DhtmlxGanttChartHandle,
  DhtmlxGanttChartProps
>(function DhtmlxGanttChart(
  {
    projectId,
    tasks,
    compact = false,
    readOnly = false,
    editable = false,
    onOverviewSync,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartShellRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<GanttStatic | null>(null);
  const reorderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventIdsRef = useRef<string[]>([]);
  const onOverviewSyncRef = useRef(onOverviewSync);
  onOverviewSyncRef.current = onOverviewSync;

  const [zoomLevelName, setZoomLevelName] = useState(
    GANTT_ZOOM_LEVELS[compact ? 2 : 1]?.name ?? 'week',
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [wbsState, setWbsState] = useState({ canIndent: false, canOutdent: false });

  const isInteractive = editable && !readOnly && !!projectId;

  const { tasks: ganttTasks, links } = useMemo(
    () => mapProjectTasksToGantt(tasks),
    [tasks],
  );

  const scheduleOverviewSync = useCallback(() => {
    if (!onOverviewSyncRef.current) return;
    if (overviewTimer.current) clearTimeout(overviewTimer.current);
    overviewTimer.current = setTimeout(() => {
      void onOverviewSyncRef.current?.();
    }, 800);
  }, []);

  const syncReorder = useCallback(() => {
    const gantt = ganttRef.current;
    if (!isInteractive || !projectId || !gantt) return;

    const orderedIds = collectGanttTaskOrder(gantt);
    if (!orderedIds.length) return;

    void reorderProjectTasks(projectId, orderedIds)
      .then(() => scheduleOverviewSync())
      .catch(() => undefined);
  }, [isInteractive, projectId, scheduleOverviewSync]);

  const scheduleReorder = useCallback(() => {
    if (reorderTimer.current) clearTimeout(reorderTimer.current);
    reorderTimer.current = setTimeout(() => {
      syncReorder();
    }, 300);
  }, [syncReorder]);

  const refreshWbsState = useCallback((taskId?: string | null) => {
    const gantt = ganttRef.current;
    if (!gantt) return;
    const resolved = taskId ?? resolveSelectedTaskId(gantt);
    setSelectedTaskId(resolved);
    if (!resolved || !gantt.isTaskExists(resolved)) {
      setWbsState({ canIndent: false, canOutdent: false });
      return;
    }
    setWbsState({
      canIndent: canIndentTask(gantt, resolved),
      canOutdent: canOutdentTask(gantt, resolved),
    });
  }, []);

  const focusChart = useCallback(() => {
    chartShellRef.current?.focus({ preventScroll: true });
  }, []);

  const handleChartKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isInteractive) return;
      const gantt = ganttRef.current;
      if (!gantt) return;
      const taskId = resolveSelectedTaskId(gantt);
      if (!taskId) return;

      if (event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        if (indentTask(gantt, taskId)) {
          refreshWbsState(taskId);
          scheduleReorder();
        }
        return;
      }
      if (event.shiftKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        if (outdentTask(gantt, taskId)) {
          refreshWbsState(taskId);
          scheduleReorder();
        }
      }
    },
    [isInteractive, refreshWbsState, scheduleReorder],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const gantt = Gantt.getGanttInstance();
    ganttRef.current = gantt;
    const eventIds: string[] = [];

    gantt.plugins({
      keyboard_navigation: isInteractive,
      undo: isInteractive,
      export_api: true,
      multiselect: isInteractive,
    });

    gantt.i18n.setLocale('cn');

    gantt.config.readonly = readOnly || !isInteractive;
    gantt.config.grid_width = compact ? 340 : 480;
    gantt.config.columns = buildColumns(isInteractive, compact);
    gantt.config.date_format = '%Y-%m-%d';
    gantt.config.fit_tasks = true;
    gantt.config.open_tree_initially = true;
    gantt.config.details_on_create = isInteractive;
    gantt.config.details_on_dblclick = false;
    gantt.config.drag_move = isInteractive;
    gantt.config.drag_resize = isInteractive;
    gantt.config.drag_progress = isInteractive;
    gantt.config.drag_links = isInteractive;
    gantt.config.drag_project = isInteractive;
    gantt.config.order_branch = isInteractive;
    gantt.config.order_branch_free = isInteractive;
    gantt.config.reorder_grid_columns = isInteractive;
    gantt.config.keyboard_navigation = isInteractive;
    gantt.config.keyboard_navigation_cells = false;
    gantt.config.select_task = isInteractive;
    gantt.config.inline_editors_multiselect_open = false;

    gantt.ext.zoom.init({
      levels: GANTT_ZOOM_LEVELS,
      trigger: 'wheel',
      activeLevelIndex: compact ? 2 : 1,
      minColumnWidth: 28,
      maxColumnWidth: 140,
      widthStep: 16,
      element: () => timelineElement(gantt) ?? container,
    });

    eventIds.push(
      gantt.attachEvent('onAfterTaskMove', () => {
        scheduleReorder();
      }),
    );

    eventIds.push(
      gantt.attachEvent('onAfterSort', () => {
        scheduleReorder();
      }),
    );

    eventIds.push(
      gantt.attachEvent('onTaskClick', (id) => {
        const taskId = String(id);
        setSelectedTaskId(taskId);
        refreshWbsState(taskId);
        focusChart();
        return true;
      }),
    );

    eventIds.push(
      gantt.attachEvent('onTaskSelected', (id) => {
        const taskId = String(id);
        setSelectedTaskId(taskId);
        refreshWbsState(taskId);
      }),
    );

    eventIds.push(
      gantt.attachEvent('onTaskUnselected', () => {
        const taskId = resolveSelectedTaskId(gantt);
        if (taskId) {
          setSelectedTaskId(taskId);
          refreshWbsState(taskId);
          return;
        }
        setSelectedTaskId(null);
        refreshWbsState(null);
      }),
    );

    if (isInteractive && projectId) {
      const saveHandler: RouterFunction = async (entity, action, item, id) => {
        if (entity === 'task') {
          const task = item as Task;
          if (action === 'create') {
            const sortOrder = collectGanttTaskOrder(gantt).length;
            const created = await createProjectTask(
              projectId,
              mapDhtmlxTaskToCreatePayload(task, sortOrder),
            );
            scheduleOverviewSync();
            return { id: created.data.id, tid: created.data.id };
          }
          if (action === 'update') {
            if (isTemporaryGanttId(id)) return {};
            await updateProjectTask(
              projectId,
              String(id),
              mapDhtmlxTaskToUpdatePayload(task),
            );
            scheduleOverviewSync();
            return {};
          }
          if (action === 'delete') {
            if (isTemporaryGanttId(id)) return {};
            await deleteProjectTask(projectId, String(id));
            scheduleOverviewSync();
            return {};
          }
        }

        if (entity === 'link') {
          const link = item as Link;
          if (action === 'create' || action === 'update') {
            const { taskId, predecessorId } = mapLinkToPredecessorUpdate(link);
            if (
              !isTemporaryGanttId(taskId) &&
              !isTemporaryGanttId(predecessorId)
            ) {
              await updateProjectTask(projectId, taskId, { predecessorId });
              scheduleOverviewSync();
            }
            return { id: link.id, tid: link.id };
          }
          if (action === 'delete') {
            const { taskId } = mapLinkDeleteToPredecessorClear(link);
            if (!isTemporaryGanttId(taskId)) {
              await updateProjectTask(projectId, taskId, {
                predecessorId: null,
              });
              scheduleOverviewSync();
            }
            return {};
          }
        }

        return {};
      };

      gantt.createDataProcessor(saveHandler);
    }

    gantt.init(container);
    gantt.parse({ data: ganttTasks, links });

    let releaseInlineEditPolicy: () => void = () => {};
    const applyInlineEditPolicy = () => {
      if (!isInteractive) return;
      releaseInlineEditPolicy();
      releaseInlineEditPolicy = guardInlineEditorsToDblClick(gantt);
    };

    applyInlineEditPolicy();
    const ganttReadyEventId = gantt.attachEvent('onGanttReady', () => {
      applyInlineEditPolicy();
    });
    eventIds.push(ganttReadyEventId);

    const currentLevel = gantt.ext.zoom.getCurrentLevel();
    const levelConfig = GANTT_ZOOM_LEVELS[currentLevel];
    if (levelConfig?.name) setZoomLevelName(levelConfig.name);

    eventIdsRef.current = eventIds;

    return () => {
      releaseInlineEditPolicy();
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      if (overviewTimer.current) clearTimeout(overviewTimer.current);
      for (const eventId of eventIdsRef.current) {
        gantt.detachEvent(eventId);
      }
      eventIdsRef.current = [];
      gantt.destructor();
      ganttRef.current = null;
      container.innerHTML = '';
    };
    // 仅在挂载/卸载时初始化；tasks 变更由父级 key 控制重挂载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, isInteractive, projectId, readOnly]);

  useImperativeHandle(
    ref,
    () => ({
      exportMsProject(projectName: string) {
        const gantt = ganttRef.current;
        if (!gantt) {
          return Promise.reject(new Error('甘特图未就绪，请稍后重试'));
        }

        const safeName = sanitizeExportName(projectName);

        return new Promise<void>((resolve, reject) => {
          try {
            gantt.exportToMSProject({
              name: `${safeName}.xml`,
              server: 'https://export.dhtmlx.com/gantt/project',
              project: { Title: projectName },
              callback(response: { url?: string; error?: string }) {
                if (response?.url) {
                  const link = document.createElement('a');
                  link.href = response.url;
                  link.download = `${safeName}.xml`;
                  link.click();
                  resolve();
                  return;
                }
                if (response?.error) {
                  reject(new Error(response.error));
                  return;
                }
                resolve();
              },
            });
          } catch (err) {
            reject(
              err instanceof Error ? err : new Error('导出 MS Project 失败'),
            );
          }
        });
      },
    }),
    [],
  );

  const currentIndex = GANTT_ZOOM_LEVELS.findIndex(
    (level) => level.name === zoomLevelName,
  );
  const canZoomIn = currentIndex > 0;
  const canZoomOut =
    currentIndex >= 0 && currentIndex < GANTT_ZOOM_LEVELS.length - 1;

  const syncZoomLabel = () => {
    const gantt = ganttRef.current;
    if (!gantt) return;
    const level = gantt.ext.zoom.getCurrentLevel();
    const name = GANTT_ZOOM_LEVELS[level]?.name;
    if (name) setZoomLevelName(name);
  };

  const handleZoomIn = () => {
    ganttRef.current?.ext.zoom.zoomIn();
    syncZoomLabel();
  };

  const handleZoomOut = () => {
    ganttRef.current?.ext.zoom.zoomOut();
    syncZoomLabel();
  };

  const handleIndent = () => {
    const gantt = ganttRef.current;
    if (!gantt) return;
    const taskId = resolveSelectedTaskId(gantt) ?? selectedTaskId;
    if (!taskId) return;
    if (indentTask(gantt, taskId)) {
      refreshWbsState(taskId);
      scheduleReorder();
    }
  };

  const handleOutdent = () => {
    const gantt = ganttRef.current;
    if (!gantt) return;
    const taskId = resolveSelectedTaskId(gantt) ?? selectedTaskId;
    if (!taskId) return;
    if (outdentTask(gantt, taskId)) {
      refreshWbsState(taskId);
      scheduleReorder();
    }
  };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-border"
      style={{ height: compact ? 360 : 640 }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-2 py-1.5 text-xs">
        {isInteractive && !compact ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">
              单击选中 · 双击单元格编辑 · Shift+←/→ 升降级
            </span>
            <span className="hidden h-4 w-px bg-border sm:inline" />
            <button
              type="button"
              className="rounded px-2 py-0.5 text-primary hover:bg-accent disabled:opacity-40"
              disabled={!wbsState.canOutdent}
              title="升级（Shift+←）"
              onClick={handleOutdent}
            >
              升级
            </button>
            <button
              type="button"
              className="rounded px-2 py-0.5 text-primary hover:bg-accent disabled:opacity-40"
              disabled={!wbsState.canIndent}
              title="降级（Shift+→）"
              onClick={handleIndent}
            >
              降级
            </button>
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40"
            disabled={!canZoomIn}
            title="放大时间轴"
            aria-label="放大时间轴"
            onClick={handleZoomIn}
          >
            +
          </button>
          <span className="min-w-[2rem] text-center text-muted-foreground">
            {ganttZoomLevelLabel(zoomLevelName)}
          </span>
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40"
            disabled={!canZoomOut}
            title="缩小时间轴"
            aria-label="缩小时间轴"
            onClick={handleZoomOut}
          >
            −
          </button>
          {!compact && (
            <span className="hidden border-l border-border pl-2 text-muted-foreground sm:inline">
              滚轮缩放
            </span>
          )}
        </div>
      </div>

      <div
        ref={chartShellRef}
        tabIndex={isInteractive && !compact ? 0 : -1}
        onKeyDown={handleChartKeyDown}
        className="relative min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
});
