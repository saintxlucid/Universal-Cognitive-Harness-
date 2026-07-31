import { describe, it, expect } from 'vitest';
import { planTasks, threeThreeThree } from '../productivity/productivity-os.js';

describe('Productivity OS', () => {
  const tasks = [
    { name: 'Fix crash bug', urgency: 'urgent' as const, importance: 'important' as const, leverage: 0.5, resistance: 0.9 },
    { name: 'Reply to email', urgency: 'urgent' as const, importance: 'not-important' as const, durationMin: 1 },
    { name: 'Write strategy doc', urgency: 'not-urgent' as const, importance: 'important' as const, leverage: 0.3 },
    { name: 'Old slides cleanup', urgency: 'not-urgent' as const, importance: 'not-important' as const },
    { name: 'Quarterly planning', urgency: 'not-urgent' as const, importance: 'important' as const, leverage: 0.2, durationMin: 120 },
  ];

  it('classifies tasks into the Eisenhower matrix', () => {
    const r = planTasks({ tasks });
    expect(r.eisenhower.do).toContain('Fix crash bug');
    expect(r.eisenhower.delegate).toContain('Reply to email');
    expect(r.eisenhower.delete).toContain('Old slides cleanup');
    expect(r.eisenhower.schedule).toContain('Write strategy doc');
  });

  it('picks MIT from the do-first quadrant', () => {
    const r = planTasks({ tasks });
    expect(r.mostImportantTasks[0]).toBe('Fix crash bug');
  });

  it('finds the vital few by leverage', () => {
    const r = planTasks({ tasks });
    expect(r.vitalFew[0]).toBe('Fix crash bug');
    expect(r.vitalFew).toContain('Write strategy doc');
  });

  it('recommends eating the frog for high-resistance work', () => {
    const r = planTasks({ tasks });
    expect(r.eatTheFrog).toBe('Fix crash bug');
  });

  it('routes two-minute items to immediate action', () => {
    const r = planTasks({ tasks });
    expect(r.twoMinuteActions).toContain('Reply to email');
  });

  it('exposes quickTasks as the explicit two-minute rule field', () => {
    const r = planTasks({ tasks });
    expect(r.quickTasks).toContain('Reply to email');
    expect(r.quickTasks).toEqual(r.twoMinuteActions);
  });

  it('marks the top MIT as the frog candidate when it carries resistance', () => {
    const r = planTasks({ tasks });
    expect(r.frog).toBe('Fix crash bug');
  });

  it('falls back to the most-resisted task when the top MIT has no resistance', () => {
    const r = planTasks({
      tasks: [
        { name: 'Top MIT task', urgency: 'urgent', importance: 'important' },
        { name: 'Dreaded chore', durationMin: 30, resistance: 0.8 },
      ],
    });
    expect(r.mostImportantTasks[0]).toBe('Top MIT task');
    expect(r.frog).toBe('Dreaded chore');
  });

  it('produces batching hints for short tasks sharing a theme', () => {
    const r = planTasks({
      tasks: [
        { name: 'Send invoice to client A', durationMin: 5 },
        { name: 'Send invoice to client B', durationMin: 5 },
        { name: 'Long task', durationMin: 90 },
      ],
    });
    const batch = r.batches.find((b) => b.tasks.length === 2);
    expect(batch?.tasks).toContain('Send invoice to client A');
    expect(batch?.tasks).toContain('Send invoice to client B');
  });

  it('produces time blocks within focus hours', () => {
    const r = planTasks({ tasks, focusHours: 4 });
    expect(r.timeBlocks.length).toBeGreaterThan(0);
    const total = r.timeBlocks.reduce((a, b) => a + b.minutes, 0);
    expect(total).toBeLessThanOrEqual(240);
  });

  it('validates SMART goal gaps', () => {
    const r = planTasks({ tasks: [{ name: 'x', notes: 'become better at programming' }] });
    expect(r.smartGoal.specific).toBe(false);
    expect(r.smartGoal.timeBound).toBe(false);
    expect(r.smartGoal.gaps.length).toBeGreaterThanOrEqual(2);
  });
});

describe('3-3-3 Method', () => {
  it('structures nine commitments', () => {
    const r = threeThreeThree({
      deepWorkHours: 3,
      urgentTasks: ['a', 'b', 'c', 'd'],
      maintenanceTasks: ['e', 'f'],
    });
    expect(r.structure).toContain('3 hours');
    expect(r.commitments.length).toBe(5);
    expect(r.warning).toContain('more than 3 urgent tasks');
  });
});
