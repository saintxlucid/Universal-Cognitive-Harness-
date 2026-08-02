import { describe, it, expect } from 'vitest';
import { gtdWorkflow, planPomodoros } from '../productivity/productivity-os.js';

describe('GTD workflow', () => {
  it('captures everything into the inbox', () => {
    const r = gtdWorkflow([{ name: 'A' }, { name: 'B' }]);
    expect(r.inbox).toEqual(['A', 'B']);
  });

  it('routes two-minute items to immediate action', () => {
    const r = gtdWorkflow([{ name: 'Reply to email', actionable: true, durationMin: 1 }]);
    expect(r.organized.do).toContain('Reply to email');
    expect(r.clarified[0]?.action).toBe('do');
  });

  it('delegates items with a delegate target', () => {
    const r = gtdWorkflow([{ name: 'Book venue', actionable: true, delegateTo: 'Alice' }]);
    expect(r.organized.delegate).toContain('Book venue');
    expect(r.clarified[0]?.reason).toContain('Alice');
  });

  it('defers items with a defer context', () => {
    const r = gtdWorkflow([{ name: 'Renew license', actionable: true, deferredTo: 'next-week' }]);
    expect(r.organized.defer).toContain('Renew license');
  });

  it('sends non-actionable reference material to the archive', () => {
    const r = gtdWorkflow([{ name: 'Meeting notes reference', actionable: false }]);
    expect(r.organized.reference).toContain('Meeting notes reference');
  });

  it('deletes non-actionable junk', () => {
    const r = gtdWorkflow([{ name: 'Old idea', actionable: false }]);
    expect(r.organized.delete).toContain('Old idea');
  });

  it('keeps plain actionable items as the next action', () => {
    const r = gtdWorkflow([{ name: 'Write report', actionable: true }]);
    expect(r.organized.do).toContain('Write report');
    expect(r.clarified[0]?.reason).toContain('only one who can do it');
  });

  it('orders the review queue: do first, then deferred', () => {
    const r = gtdWorkflow([
      { name: 'Deferred item', actionable: true, deferredTo: '@waiting' },
      { name: 'Immediate item', actionable: true, durationMin: 10 },
    ]);
    expect(r.nextActions).toEqual(['Immediate item', 'Deferred item']);
  });
});

describe('Pomodoro scheduler', () => {
  it('schedules whole sessions and breaks from minutes', () => {
    const r = planPomodoros({ tasks: [{ name: 'Deep work', minutes: 50 }] });
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions[0]?.task).toBe('Deep work');
    expect(r.sessions[0]?.endMin - r.sessions[0]?.startMin).toBe(25);
  });

  it('respects an explicit pomodoro count', () => {
    const r = planPomodoros({ tasks: [{ name: 'Write', pomodoros: 3 }] });
    expect(r.sessions).toHaveLength(3);
    expect(r.focusMinutes).toBe(75);
  });

  it('inserts a long break after every longBreakEvery sessions', () => {
    const r = planPomodoros({
      tasks: [{ name: 'Study', pomodoros: 4 }],
      longBreakEvery: 4,
      longBreakMin: 15,
    });
    expect(r.breaks).toHaveLength(4);
    expect(r.breaks[3]?.long).toBe(true);
    expect(r.breaks[3]?.endMin - r.breaks[3]?.startMin).toBe(15);
    expect(r.breaks[0]?.long).toBe(false);
  });

  it('computes totals deterministically', () => {
    const r = planPomodoros({
      tasks: [
        { name: 'A', pomodoros: 1 },
        { name: 'B', pomodoros: 1 },
      ],
    });
    expect(r.totalMinutes).toBe(
      r.focusMinutes + r.breaks.reduce((acc, b) => acc + (b.endMin - b.startMin), 0),
    );
    expect(r.totalMinutes).toBe(25 + 5 + 25 + 5);
  });

  it('warns when no sessions can be scheduled', () => {
    const r = planPomodoros({ tasks: [] });
    expect(r.sessions).toHaveLength(0);
    expect(r.warning).not.toBeNull();
  });
});
