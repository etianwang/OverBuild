import { describe, expect, it, vi } from 'vitest';
import type { GanttStatic } from 'dhtmlx-gantt';
import { guardInlineEditorsToDblClick } from './inline-edit-policy';

function mockGantt() {
  const events = new Map<string, Array<(...args: unknown[]) => unknown>>();
  const editorEvents = new Map<string, Array<(...args: unknown[]) => unknown>>();
  const startEdit = vi.fn();
  const editors = {
    startEdit,
    getState: () => ({ id: null, columnName: null }),
    isVisible: () => false,
    locateCell: () => ({ id: 'task-1', columnName: 'text' }),
    getEditorConfig: (column: string) =>
      column === 'text' ? { type: 'text', map_to: 'text' } : null,
    attachEvent: (name: string, handler: (...args: unknown[]) => unknown) => {
      const list = editorEvents.get(name) ?? [];
      list.push(handler);
      editorEvents.set(name, list);
      return `editor-${name}-${list.length}`;
    },
    detachEvent: vi.fn(),
  };

  const gantt = {
    ext: { inlineEditors: editors },
    attachEvent: (name: string, handler: (...args: unknown[]) => unknown) => {
      const list = events.get(name) ?? [];
      list.push(handler);
      events.set(name, list);
      return `${name}-${list.length}`;
    },
    detachEvent: vi.fn(),
  } as unknown as GanttStatic;

  return { gantt, events, editorEvents, startEdit, editors };
}

describe('guardInlineEditorsToDblClick', () => {
  it('blocks single-click startEdit through wrapped editors.startEdit', () => {
    const { gantt, startEdit } = mockGantt();
    guardInlineEditorsToDblClick(gantt);

    gantt.ext.inlineEditors.startEdit('task-1', 'text');
    expect(startEdit).not.toHaveBeenCalled();
  });

  it('starts edit on double-click of editable cell', () => {
    const { gantt, events, startEdit } = mockGantt();
    guardInlineEditorsToDblClick(gantt);

    const dblClick = events.get('onTaskDblClick')?.[0];
    dblClick?.('task-1', { target: {} });

    expect(startEdit).toHaveBeenCalledWith('task-1', 'text');
  });

  it('registers onBeforeEditStart on inlineEditors', () => {
    const { gantt, editorEvents } = mockGantt();
    guardInlineEditorsToDblClick(gantt);

    const beforeEdit = editorEvents.get('onBeforeEditStart')?.[0];
    expect(beforeEdit?.()).toBe(false);
  });
});
