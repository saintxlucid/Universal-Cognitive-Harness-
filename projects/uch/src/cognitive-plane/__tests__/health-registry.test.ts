import { describe, expect, it } from 'vitest';
import { HealthRegistry, bootPlan, DEFAULT_WATCHDOG_CONFIG, type HealthEvent } from '../health/health-registry.js';

const makeRegistry = () => new HealthRegistry(DEFAULT_WATCHDOG_CONFIG);

describe('HealthRegistry', () => {
  it('starts organs alive and promotes to healthy on heartbeat', () => {
    const reg = makeRegistry();
    reg.register('reflection');
    expect(reg.get('reflection')?.state).toBe('alive');
    reg.reportHeartbeat('reflection', 1);
    expect(reg.get('reflection')?.state).toBe('healthy');
  });

  it('degrades after missed beats, then triggers recovery', () => {
    const reg = makeRegistry();
    reg.register('reflection');
    reg.reportHeartbeat('reflection', 1);
    const first = reg.tick(2);
    const second = reg.tick(3);
    expect(first.some((e) => e.kind === 'degraded')).toBe(false);
    expect(second.some((e) => e.kind === 'degraded')).toBe(true);
    expect(reg.get('reflection')?.state).toBe('degraded');
    reg.tick(4);
    const third = reg.tick(5);
    expect(third.some((e) => e.kind === 'recovering' && (e as { replayRequired: boolean }).replayRequired)).toBe(true);
    expect(reg.get('reflection')?.state).toBe('recovering');
  });

  it('recovers via the self-healing loop (restart → replay → healthy)', () => {
    const reg = makeRegistry();
    reg.register('reflection');
    reg.reportHeartbeat('reflection', 1);
    reg.tick(2);
    reg.tick(3);
    reg.tick(4);
    reg.tick(5); // recovering
    expect(reg.get('reflection')?.state).toBe('recovering');
    reg.reportRecovered('reflection', 6);
    expect(reg.get('reflection')?.state).toBe('healthy');
    expect(reg.eventsSince().some((e) => e.kind === 'recovered')).toBe(true);
  });

  it('fails an organ that exhausts the restart budget', () => {
    const reg = makeRegistry();
    reg.register('reflection');
    reg.reportHeartbeat('reflection', 1);
    // maxRestarts=3; each crash-recovery cycle takes recoverAfter+1 ticks
    for (let tick = 2; tick <= 20; tick++) {
      const events: HealthEvent[] = reg.tick(tick);
      if (events.some((e) => e.kind === 'failed')) break;
    }
    expect(reg.get('reflection')?.state).toBe('failed');
    expect(reg.get('reflection')?.restarts).toBeGreaterThan(0);
  });

  it('leaves sleeping organs out of liveness escalation', () => {
    const reg = makeRegistry();
    reg.register('dreaming');
    reg.reportHeartbeat('dreaming', 1);
    reg.suspend('dreaming', 2);
    reg.tick(100);
    expect(reg.get('dreaming')?.state).toBe('sleeping');
    expect(reg.get('dreaming')?.missedBeats).toBe(0);
  });

  it('resumes sleeping organs without escalation history', () => {
    const reg = makeRegistry();
    reg.register('dreaming');
    reg.reportHeartbeat('dreaming', 1);
    reg.suspend('dreaming', 2);
    reg.resume('dreaming', 5);
    expect(reg.get('dreaming')?.state).toBe('alive');
    expect(reg.eventsSince().some((e) => e.kind === 'resumed')).toBe(true);
  });

  it('never escalates failed organs', () => {
    const reg = makeRegistry();
    reg.register('x');
    reg.reportHeartbeat('x', 1);
    for (let tick = 2; tick <= 18; tick++) reg.tick(tick);
    expect(reg.get('x')?.state).toBe('failed');
    const before = reg.eventsSince().length;
    reg.tick(13);
    expect(reg.eventsSince().length).toBe(before);
  });

  it('keeps a full event journal', () => {
    const reg = makeRegistry();
    reg.register('a');
    reg.reportHeartbeat('a', 1);
    reg.tick(2);
    reg.tick(3);
    const kinds = reg.eventsSince().map((e) => e.kind);
    expect(kinds).toContain('degraded');
  });
});

describe('bootPlan (safe mode)', () => {
  it('safe mode admits kernel + constitution only', () => {
    const plan = bootPlan('safe', ['kernel', 'learning', 'evolution', 'constitution', 'plugins']);
    expect(plan.allowedOrgans).toEqual(['kernel', 'constitution']);
  });

  it('normal mode admits everything requested', () => {
    const plan = bootPlan('normal', ['kernel', 'learning', 'plugins']);
    expect(plan.allowedOrgans).toEqual(['kernel', 'learning', 'plugins']);
  });
});
