'use client';

import { Button, Input } from '@/components/ui/primitives';
import { ProjectDetail, ProjectTaskItem } from '@/lib/api';

export interface TaskFormValues {
  name: string;
  code: string;
  parentId: string;
  predecessorId: string;
  assigneeId: string;
  zoneId: string;
  laborCount: string;
  durationDays: string;
  startDate: string;
  endDate: string;
  prerequisites: string;
  progress: string;
  status: string;
}

export const emptyTaskForm = (): TaskFormValues => ({
  name: '',
  code: '',
  parentId: '',
  predecessorId: '',
  assigneeId: '',
  zoneId: '',
  laborCount: '',
  durationDays: '',
  startDate: '',
  endDate: '',
  prerequisites: '',
  progress: '0',
  status: 'pending',
});

export function taskToForm(task: ProjectTaskItem): TaskFormValues {
  return {
    name: task.name,
    code: task.code ?? '',
    parentId: task.parentId ?? '',
    predecessorId: task.predecessorId ?? '',
    assigneeId: task.assigneeId ?? '',
    zoneId: task.zoneId ?? '',
    laborCount: task.laborCount != null ? String(task.laborCount) : '',
    durationDays:
      task.durationDays != null ? String(task.durationDays) : '',
    startDate: task.startDate ? String(task.startDate).slice(0, 10) : '',
    endDate: task.endDate ? String(task.endDate).slice(0, 10) : '',
    prerequisites: task.prerequisites ?? '',
    progress: String(task.progress ?? 0),
    status: task.status,
  };
}

const selectClass =
  'flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm';

const STATUS_OPTIONS = [
  { value: 'pending', label: '待开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

interface TaskEditorProps {
  project: ProjectDetail;
  tasks: ProjectTaskItem[];
  form: TaskFormValues;
  editingId: string | null;
  saving: boolean;
  onChange: (form: TaskFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
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

export function TaskEditor({
  project,
  tasks,
  form,
  editingId,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: TaskEditorProps) {
  const roots = tasks.filter((t) => !t.parentId);
  const assignees = assigneeOptions(project);
  const isSubItem = !!form.parentId;

  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">
          {editingId
            ? '编辑施工内容'
            : isSubItem
              ? '添加子项'
              : '添加大项'}
        </h3>
        {editingId && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            取消编辑
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-muted-foreground">任务名称 *</span>
          <Input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="如：基础工程、钢筋绑扎"
            required
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">任务编号</span>
          <Input
            value={form.code}
            onChange={(e) => onChange({ ...form, code: e.target.value })}
            placeholder="可选"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">层级（大项/子项）</span>
          <select
            className={selectClass}
            value={form.parentId}
            onChange={(e) => onChange({ ...form, parentId: e.target.value })}
          >
            <option value="">大项（顶级）</option>
            {roots
              .filter((t) => t.id !== editingId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  子项 · {t.name}
                </option>
              ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">施工区域</span>
          <select
            className={selectClass}
            value={form.zoneId}
            onChange={(e) => onChange({ ...form, zoneId: e.target.value })}
          >
            <option value="">不限定</option>
            {(project.zones ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">负责人</span>
          <select
            className={selectClass}
            value={form.assigneeId}
            onChange={(e) => onChange({ ...form, assigneeId: e.target.value })}
          >
            <option value="">未指定</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">所需人工（人）</span>
          <Input
            type="number"
            min={0}
            value={form.laborCount}
            onChange={(e) => onChange({ ...form, laborCount: e.target.value })}
            placeholder="人数"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">所需工期（天）</span>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={form.durationDays}
            onChange={(e) => onChange({ ...form, durationDays: e.target.value })}
            placeholder="工期"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">开始时间</span>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => onChange({ ...form, startDate: e.target.value })}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">结束时间</span>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => onChange({ ...form, endDate: e.target.value })}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">前置任务</span>
          <select
            className={selectClass}
            value={form.predecessorId}
            onChange={(e) =>
              onChange({ ...form, predecessorId: e.target.value })
            }
          >
            <option value="">无</option>
            {tasks
              .filter((t) => t.id !== editingId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code ? `${t.code} · ` : ''}
                  {t.name}
                </option>
              ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">进度 %</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.progress}
            onChange={(e) => onChange({ ...form, progress: e.target.value })}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">状态</span>
          <select
            className={selectClass}
            value={form.status}
            onChange={(e) => onChange({ ...form, status: e.target.value })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm md:col-span-2 lg:col-span-3">
          <span className="text-muted-foreground">前提条件</span>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={form.prerequisites}
            onChange={(e) =>
              onChange({ ...form, prerequisites: e.target.value })
            }
            placeholder="如需完成某任务、材料到场、图纸确认等"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? '保存中...' : editingId ? '保存修改' : '添加'}
        </Button>
      </div>
    </form>
  );
}

export function formToPayload(form: TaskFormValues) {
  return {
    name: form.name,
    code: form.code || undefined,
    parentId: form.parentId || undefined,
    predecessorId: form.predecessorId || undefined,
    assigneeId: form.assigneeId || undefined,
    zoneId: form.zoneId || undefined,
    laborCount: form.laborCount ? Number(form.laborCount) : undefined,
    durationDays: form.durationDays ? Number(form.durationDays) : undefined,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    prerequisites: form.prerequisites || undefined,
    progress: Number(form.progress) || 0,
    status: form.status,
  };
}
