export type ColumnType = 'text' | 'number' | 'date' | 'person' | 'select';

export interface ScheduleColumn {
  id: string;
  label: string;
  type: ColumnType;
  visible: boolean;
  width?: number;
}

export const DEFAULT_SCHEDULE_COLUMNS: ScheduleColumn[] = [
  { id: 'name', label: '任务名称', type: 'text', visible: true },
  { id: 'code', label: '编号', type: 'text', visible: true },
  { id: 'durationDays', label: '工期(天)', type: 'number', visible: true },
  { id: 'startDate', label: '开始', type: 'date', visible: true },
  { id: 'endDate', label: '结束', type: 'date', visible: true },
  { id: 'laborCount', label: '人工', type: 'number', visible: true },
  { id: 'assigneeId', label: '负责人', type: 'person', visible: true },
  { id: 'prerequisites', label: '前提条件', type: 'text', visible: true },
  { id: 'progress', label: '进度%', type: 'number', visible: true },
  { id: 'status', label: '状态', type: 'select', visible: true },
];

const TYPE_OPTIONS: ColumnType[] = ['text', 'number', 'date', 'person', 'select'];

const TYPE_LABEL: Record<ColumnType, string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  person: '人员',
  select: '选项',
};

export function columnTypeLabel(type: ColumnType) {
  return TYPE_LABEL[type];
}

export function loadScheduleColumns(projectId: string): ScheduleColumn[] {
  if (typeof window === 'undefined') return DEFAULT_SCHEDULE_COLUMNS;
  try {
    const raw = localStorage.getItem(`schedule-columns-${projectId}`);
    if (!raw) return DEFAULT_SCHEDULE_COLUMNS;
    const parsed = JSON.parse(raw) as ScheduleColumn[];
    return DEFAULT_SCHEDULE_COLUMNS.map((col) => {
      const saved = parsed.find((c) => c.id === col.id);
      return saved ? { ...col, label: saved.label, visible: saved.visible } : col;
    });
  } catch {
    return DEFAULT_SCHEDULE_COLUMNS;
  }
}

export function saveScheduleColumns(projectId: string, columns: ScheduleColumn[]) {
  localStorage.setItem(`schedule-columns-${projectId}`, JSON.stringify(columns));
}

export { TYPE_OPTIONS };
