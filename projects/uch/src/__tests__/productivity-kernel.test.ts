import { describe, it, expect } from 'vitest';
import { ProductivityKernel, type ProductivityEvent } from '../productivity-kernel/productivity-kernel.js';

describe('Productivity Kernel', () => {
  it('captures tasks into the inbox without friction', () => {
    const k = new ProductivityKernel();
    const task = k.capture('write release notes');
    expect(task.clarified).toBe(false);
    expect(task.completed).toBe(false);
    expect(k.getInbox()).toHaveLength(1);
  });

  it('surfaces two-minute-rule actions from captured durations', () => {
    const k = new ProductivityKernel();
    k.capture('reply to email', 2);
    k.capture('refactor the auth module', 90);
    const actions = k.getTwoMinuteActions();
    expect(actions).toContain('reply to email');
    expect(actions).not.toContain('refactor the auth module');
  });

  it('clarify marks items actionable and tracks latency', () => {
    const k = new ProductivityKernel();
    const task = k.capture('fix the flaky test');
    expect(k.clarify(task.id)).toBe(true);
    expect(k.clarify(task.id)).toBe(false); // idempotent
    expect(k.getInbox()[0]!.clarified).toBe(true);
    expect(k.getCaptureToClarifyLatencyMs()).toBeGreaterThanOrEqual(0);
  });

  it('initializes a day plan with MITs, time blocks and pomodoro cycles', () => {
    const k = new ProductivityKernel();
    const plan = k.initializeDay([
      { name: 'ship the payments fix', urgency: 'urgent', importance: 'important', durationMin: 60 },
      { name: 'write design doc', urgency: 'not-urgent', importance: 'important', durationMin: 45 },
      { name: 'triage inbox', urgency: 'urgent', importance: 'not-important', durationMin: 15 },
    ]);
    expect(plan.mit).toContain('ship the payments fix');
    expect(plan.timeBlocks.length).toBeGreaterThan(0);
    expect(plan.timeBlocks[0]!.task).toBeDefined();
    expect(plan.pomodoroCycles).toBeGreaterThan(0);
    expect(k.getDayPlan()!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('executes only planned tasks and tracks interruptions', () => {
    const k = new ProductivityKernel();
    k.initializeDay([
      { name: 'land the auth refactor', urgency: 'urgent', importance: 'important', durationMin: 90 },
    ]);
    expect(k.execute('unplanned task')).toBe(false);
    expect(k.execute('land the auth refactor', true)).toBe(true);
    expect(k.getInterruptionRate()).toBe(1);
  });

  it('computes plan-execution and MIT completion benchmarks', () => {
    const k = new ProductivityKernel();
    k.capture('migrate the queue broker');
    k.capture('ship the payments fix');
    k.capture('land the auth refactor');
    k.initializeDay([
      { name: 'migrate the queue broker', urgency: 'urgent', importance: 'important', durationMin: 120 },
      { name: 'ship the payments fix', urgency: 'urgent', importance: 'important', durationMin: 60 },
      { name: 'land the auth refactor', urgency: 'urgent', importance: 'important', durationMin: 90 },
    ]);
    expect(k.getDayPlan()!.mit).toHaveLength(3);
    expect(k.execute('migrate the queue broker')).toBe(true);
    expect(k.getMITCompletionRate()).toBeCloseTo(1 / 3);
    expect(k.getPlanExecutionRate()).toBeCloseTo(1 / 3);
  });

  it('reports a full status snapshot', () => {
    const k = new ProductivityKernel();
    k.capture('a');
    k.initializeDay([{ name: 'a', urgency: 'urgent', importance: 'important' }]);
    k.execute('a');
    const status = k.getStatus();
    expect(status.inbox).toBe(1);
    expect(status.planned).toBe(1);
    expect(status.executed).toBe(1);
    expect(status.planExecutionRate).toBe(1);
    expect(status.mitCompletionRate).toBe(1);
  });

  it('checks the 3-3-3 structure with commitments and warnings', () => {
    const k = new ProductivityKernel();
    const result = k.threeThreeThree(3, ['fix a', 'fix b', 'fix c', 'fix d'], ['email', 'standup']);
    expect(result.structure).toContain('3 hours');
    expect(result.commitments).toHaveLength(5);
    expect(result.warning).toContain('reprioritize');
  });

  it('emits task_captured events when a sink is configured', () => {
    const events: ProductivityEvent[] = [];
    const k = new ProductivityKernel({ eventSink: (ev) => events.push(ev) });
    const task = k.capture('write release notes', 2);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('productivity:task_captured');
    expect(events[0]!.payload.task_id).toBe(task.id);
    expect(events[0]!.payload.duration_min).toBe(2);
  });

  it('emits day_planned events on initializeDay', () => {
    const events: ProductivityEvent[] = [];
    const k = new ProductivityKernel({ eventSink: (ev) => events.push(ev) });
    k.initializeDay([
      { name: 'ship the payments fix', urgency: 'urgent', importance: 'important', durationMin: 60 },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('productivity:day_planned');
    expect(events[0]!.payload.mit_count).toBeGreaterThan(0);
    expect(events[0]!.payload.pomodoro_cycles).toBeGreaterThan(0);
  });

  it('records nothing when no sink is configured', () => {
    const k = new ProductivityKernel();
    k.capture('a');
    k.initializeDay([{ name: 'a', urgency: 'urgent', importance: 'important' }]);
    expect(k.getStatus().executed).toBe(0);
    expect(k.getInbox()).toHaveLength(1);
  });
});
