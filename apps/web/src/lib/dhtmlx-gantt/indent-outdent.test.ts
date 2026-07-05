import { describe, expect, it, vi } from 'vitest';
import type { GanttStatic } from 'dhtmlx-gantt';
import {
  canIndentTask,
  canOutdentTask,
  indentTask,
  outdentTask,
} from './indent-outdent';

function mockGantt(overrides: Partial<GanttStatic> = {}): GanttStatic {
  return {
    config: { root_id: 0 },
    isTaskExists: (id) => id === 'prev' || id === 'parent' || id === 'root-parent',
    isChildOf: () => false,
    isReadonly: () => false,
    getTask: (id) => ({ id, $open: false }),
    getPrevSibling: (id) => (id === 'child' ? 'prev' : null),
    getParent: (id) => {
      if (id === 'child') return 'parent';
      if (id === 'parent') return 0;
      return 0;
    },
    getTaskIndex: () => 0,
    moveTask: () => true,
    updateTask: vi.fn(),
    ...overrides,
  } as unknown as GanttStatic;
}

describe('indent-outdent', () => {
  it('canIndentTask when previous sibling exists', () => {
    const gantt = mockGantt();
    expect(canIndentTask(gantt, 'child')).toBe(true);
  });

  it('canOutdentTask when task has non-root parent', () => {
    const gantt = mockGantt();
    expect(canOutdentTask(gantt, 'child')).toBe(true);
    expect(canOutdentTask(gantt, 'parent')).toBe(false);
  });

  it('indentTask moves under previous sibling', () => {
    const moveTask = vi.fn(() => true);
    const updateTask = vi.fn();
    const gantt = mockGantt({ moveTask, updateTask });

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
    expect(updateTask).toHaveBeenCalledWith('child');
  });
});
