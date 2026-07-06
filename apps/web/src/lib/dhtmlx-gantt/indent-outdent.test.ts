import { describe, expect, it, vi } from 'vitest';
import type { GanttStatic } from 'dhtmlx-gantt';
import {
  canIndentTask,
  canOutdentTask,
  indentTask,
  outdentTask,
  resolveSelectedTaskId,
} from './indent-outdent';

function mockGantt(overrides: Partial<GanttStatic> = {}): GanttStatic {
  const types = { project: 'project', task: 'task' };
  return {
    config: { root_id: 0, types },
    isTaskExists: (id: string | number) =>
      id === 'prev' || id === 'parent' || id === 'child' || id === 'root-parent',
    isChildOf: () => false,
    isReadonly: () => false,
    getTask: (id: string | number) => ({ id, $open: false, type: 'task' }),
    getPrev: (id: string | number) => (id === 'child' ? 'prev' : null),
    getPrevSibling: (id: string | number) => (id === 'child' ? 'prev' : null),
    getParent: (id: string | number) => {
      if (id === 'child') return 'parent';
      if (id === 'parent') return 0;
      return 0;
    },
    open: vi.fn(),
    showTask: vi.fn(),
    refreshTask: vi.fn(),
    batchUpdate: (cb: () => void) => cb(),
    getTaskIndex: () => 0,
    getChildren: () => [],
    hasChild: () => false,
    moveTask: () => true,
    updateTask: vi.fn(),
    ...overrides,
  } as unknown as GanttStatic;
}

describe('indent-outdent', () => {
  it('canIndentTask when previous visible row exists', () => {
    const gantt = mockGantt();
    expect(canIndentTask(gantt, 'child')).toBe(true);
  });

  it('canIndentTask is false when already child of previous row', () => {
    const gantt = mockGantt({
      getParent: (id: string | number) => (id === 'child' ? 'prev' : 0),
    });
    expect(canIndentTask(gantt, 'child')).toBe(false);
  });

  it('canIndentTask is false for first row', () => {
    const gantt = mockGantt({
      getPrev: () => null as unknown as string,
    });
    expect(canIndentTask(gantt, 'child')).toBe(false);
  });

  it('canOutdentTask when task has non-root parent', () => {
    const gantt = mockGantt();
    expect(canOutdentTask(gantt, 'child')).toBe(true);
    expect(canOutdentTask(gantt, 'parent')).toBe(false);
  });

  it('indentTask moves under previous visible row', () => {
    const moveTask = vi.fn(() => true);
    const updateTask = vi.fn();
    const gantt = mockGantt({ moveTask, updateTask, getChildren: () => ['x'] });

    expect(indentTask(gantt, 'child')).toBe(true);
    expect(moveTask).toHaveBeenCalledWith('child', -1, 'prev');
    expect(updateTask).toHaveBeenCalledWith('child');
  });

  it('outdentTask moves after parent', () => {
    const moveTask = vi.fn(() => true);
    const updateTask = vi.fn();
    const gantt = mockGantt({ moveTask, updateTask });

    expect(outdentTask(gantt, 'child')).toBe(true);
    expect(moveTask).toHaveBeenCalledWith('child', 1, 0);
    expect(updateTask).toHaveBeenCalled();
  });

  it('resolveSelectedTaskId uses getSelectedId in community build', () => {
    const gantt = mockGantt({
      getSelectedId: () => 'child',
    });
    expect(resolveSelectedTaskId(gantt)).toBe('child');
  });
});
