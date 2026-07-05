import type { ZoomLevel } from '@/lib/dhtmlx-gantt/types';

export type GanttZoomLevel = ZoomLevel & { label: string };

/** 从细到粗排列：zoomIn 切到更细级别（index 更小） */
export const GANTT_ZOOM_LEVELS: GanttZoomLevel[] = [
  {
    name: 'day',
    label: '日',
    scale_height: 70,
    min_column_width: 36,
    scales: [
      { unit: 'month', step: 1, format: '%Y-%m' },
      { unit: 'day', step: 1, format: '%d' },
    ],
  },
  {
    name: 'week',
    label: '周',
    scale_height: 60,
    min_column_width: 52,
    scales: [
      { unit: 'month', step: 1, format: '%Y-%m' },
      { unit: 'week', step: 1, format: 'W%W' },
    ],
  },
  {
    name: 'month',
    label: '月',
    scale_height: 55,
    min_column_width: 72,
    scales: [
      { unit: 'year', step: 1, format: '%Y' },
      { unit: 'month', step: 1, format: '%m月' },
    ],
  },
  {
    name: 'year',
    label: '年',
    scale_height: 50,
    min_column_width: 44,
    scales: [{ unit: 'year', step: 1, format: '%Y' }],
  },
];

export function ganttZoomLevelLabel(name: string) {
  return GANTT_ZOOM_LEVELS.find((level) => level.name === name)?.label ?? name;
}
