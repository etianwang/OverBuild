import type { GanttStatic } from 'dhtmlx-gantt';

const INLINE_EDIT_COLUMNS = new Set([
  'text',
  'start_date',
  'duration',
  'progress',
]);

type InlineEditorCell = {
  id: string | number;
  columnName: string;
};

type InlineEditorState = {
  id: string | number | null;
  columnName: string | null;
};

type InlineEditorsApi = {
  startEdit: (taskId: string | number, columnName: string) => void;
  getState: () => InlineEditorState;
  isVisible: () => boolean;
  locateCell: (target: HTMLElement) => InlineEditorCell | null;
  getEditorConfig: (columnName: string) => unknown;
  attachEvent?: (name: string, handler: () => boolean) => string;
  detachEvent?: (id: string) => void;
};

type GanttWithIconClick = GanttStatic & {
  _is_icon_open_click?: (event: Event) => boolean;
};

function getInlineEditors(gantt: GanttStatic): InlineEditorsApi | null {
  const editors = gantt.ext?.inlineEditors as unknown as
    | InlineEditorsApi
    | undefined;
  return editors?.startEdit ? editors : null;
}

/** 仅允许双击打开单元格内联编辑，拦截 DHTMLX 默认的单击即编辑 */
export function guardInlineEditorsToDblClick(gantt: GanttStatic): () => void {
  const editors = getInlineEditors(gantt);
  if (!editors) {
    return () => undefined;
  }

  const originalStartEdit = editors.startEdit.bind(editors);
  let allowInlineEdit = false;

  const blockUnlessAllowed = () => allowInlineEdit;

  editors.startEdit = (taskId: string | number, columnName: string) => {
    if (!allowInlineEdit) return;
    originalStartEdit(taskId, columnName);
    allowInlineEdit = false;
  };

  const beforeEditEventId = editors.attachEvent?.(
    'onBeforeEditStart',
    blockUnlessAllowed,
  );

  const dblClickEventId = gantt.attachEvent('onTaskDblClick', (id, event) => {
    const nativeEvent = event as Event | undefined;
    const ganttWithIcons = gantt as GanttWithIconClick;
    if (nativeEvent && ganttWithIcons._is_icon_open_click?.(nativeEvent)) {
      return true;
    }

    if (!nativeEvent?.target) {
      return true;
    }

    const cell = editors.locateCell(nativeEvent.target as HTMLElement);
    if (
      !cell ||
      !INLINE_EDIT_COLUMNS.has(cell.columnName) ||
      !editors.getEditorConfig(cell.columnName)
    ) {
      return true;
    }

    allowInlineEdit = true;
    editors.startEdit(cell.id, cell.columnName);
    return false;
  });

  return () => {
    editors.startEdit = originalStartEdit;
    if (beforeEditEventId && editors.detachEvent) {
      editors.detachEvent(beforeEditEventId);
    }
    gantt.detachEvent(dblClickEventId);
  };
}
