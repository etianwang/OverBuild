'use client';

import { taskLevelIndent } from '@/lib/task-level';

export interface GanttTaskItem {
  id: string;
  name: string;
  code?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  progress: number;
  status: string;
  parentId?: string | null;
  depth?: number;
  zone?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-slate-400',
  in_progress: 'bg-primary',
  completed: 'bg-emerald-500',
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthLabels(min: Date, max: Date) {
  const labels: { label: string; left: number }[] = [];
  const total = max.getTime() - min.getTime();
  if (total <= 0) return labels;

  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cursor <= max) {
    const left = ((cursor.getTime() - min.getTime()) / total) * 100;
    labels.push({
      label: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      left,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return labels;
}

function barStyle(start: Date, end: Date, min: Date, max: Date) {
  const total = max.getTime() - min.getTime();
  if (total <= 0) return { left: '0%', width: '0%' };
  const left = ((start.getTime() - min.getTime()) / total) * 100;
  const width = ((end.getTime() - start.getTime()) / total) * 100;
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.max(1.5, width)}%`,
  };
}

interface GanttChartProps {
  tasks: GanttTaskItem[];
  compact?: boolean;
}

export function GanttChart({ tasks, compact = false }: GanttChartProps) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const datedTasks = safeTasks
    .map((task) => ({
      task,
      start: parseDate(task.startDate),
      end: parseDate(task.endDate),
    }))
    .filter((item) => item.start && item.end) as Array<{
    task: GanttTaskItem;
    start: Date;
    end: Date;
  }>;

  if (!datedTasks.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        暂无已排期的施工内容，请在下方填写施工内容并设置开始/结束时间
      </div>
    );
  }

  const min = new Date(
    Math.min(...datedTasks.flatMap((t) => [t.start.getTime(), t.end.getTime()])),
  );
  const max = new Date(
    Math.max(...datedTasks.flatMap((t) => [t.start.getTime(), t.end.getTime()])),
  );
  const months = monthLabels(min, max);
  const rowHeight = compact ? 'h-8' : 'h-10';

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className={compact ? 'min-w-[640px]' : 'min-w-[900px]'}>
        <div className="grid border-b border-border bg-muted/40 text-xs text-muted-foreground"
          style={{ gridTemplateColumns: compact ? '180px 1fr' : '240px 1fr' }}>
          <div className="px-3 py-2 font-medium">施工内容</div>
          <div className="relative px-2 py-2">
            {months.map((m) => (
              <span
                key={m.label}
                className="absolute top-2 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${m.left}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {datedTasks.map(({ task, start, end }) => {
          const style = barStyle(start, end, min, max);
          const color = STATUS_COLOR[task.status] ?? 'bg-primary';
          return (
            <div
              key={task.id}
              className={`grid border-b border-border last:border-b-0 ${rowHeight} items-center`}
              style={{ gridTemplateColumns: compact ? '180px 1fr' : '240px 1fr' }}
            >
              <div className="truncate px-3 text-sm" title={task.name}>
                <span
                  className="font-medium"
                  style={{ paddingLeft: `${(task.depth ?? 0) * 14}px` }}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {taskLevelIndent(task.depth ?? 0)}
                  </span>
                  {task.name}
                </span>
                {task.assignee?.name && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {task.assignee.name}
                  </span>
                )}
              </div>
              <div className="relative h-full px-2">
                <div
                  className={`absolute top-1/2 ${compact ? 'h-3' : 'h-4'} -translate-y-1/2 rounded-full ${color} opacity-25`}
                  style={style}
                />
                <div
                  className={`absolute top-1/2 ${compact ? 'h-3' : 'h-4'} -translate-y-1/2 overflow-hidden rounded-full ${color}`}
                  style={{
                    ...style,
                    clipPath: `inset(0 ${100 - task.progress}% 0 0)`,
                  }}
                  title={`${task.progress}% · ${STATUS_LABEL[task.status] ?? task.status}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
