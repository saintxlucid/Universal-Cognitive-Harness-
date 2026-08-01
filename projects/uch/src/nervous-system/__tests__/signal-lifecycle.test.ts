/**
 * Signal Lifecycle Engine — prototype tests (IDEA-0084).
 *
 * Coverage: TTL derivation by priority tier (emergencies never
 * expire), the freshness curve (fresh → useful → weak → expired),
 * expiry → GC with the ledger retaining history, the noise gate
 * (admit/attenuate/absorb with ledgered reasons), repetition
 * amplification (Law 17 path), and the replay escape hatch.
 */

import { describe, expect, it } from 'vitest';
import {
  SignalLifecycleEngine,
  freshnessStage,
  lifecycleReport,
  ttlForPriority,
} from '../signal-lifecycle.js';

describe('TTL derivation by priority tier', () => {
  it('emergencies (priority >= 3) never expire by default', () => {
    expect(ttlForPriority(3)).toBe(Infinity);
    expect(ttlForPriority(4)).toBe(Infinity);
  });

  it('background observations (priority 0) expire fast', () => {
    expect(ttlForPriority(0)).toBe(5);
  });

  it('mid-tier signals (1-2) expire slowly', () => {
    expect(ttlForPriority(1)).toBe(20);
    expect(ttlForPriority(2)).toBe(20);
  });

  it('config can override the emergency TTL to finite', () => {
    expect(ttlForPriority(3, { emergencyTtl: 100 })).toBe(100);
  });
});

describe('freshness curve', () => {
  it('stages by age/TTL ratio', () => {
    expect(freshnessStage(0, 20)).toBe('fresh');
    expect(freshnessStage(4, 20)).toBe('fresh');
    expect(freshnessStage(5, 20)).toBe('useful');
    expect(freshnessStage(10, 20)).toBe('weak');
    expect(freshnessStage(20, 20)).toBe('expired');
    expect(freshnessStage(100, 20)).toBe('expired');
  });

  it('never-expiring signals stay fresh', () => {
    expect(freshnessStage(100000, Infinity)).toBe('fresh');
  });

  it('birth at the current tick is fresh; aging moves the stage', () => {
    const engine = new SignalLifecycleEngine();
    const state = engine.birth({ id: 's1', type: 'test:failed', priority: 1, bornAt: 10, source: 'tester' }, 10);
    expect(state.stage).toBe('fresh');
    const later = engine.evaluate('s1', 14);
    expect(later?.stage).toBe('fresh');
    const useful = engine.evaluate('s1', 15);
    expect(useful?.stage).toBe('useful');
    const weak = engine.evaluate('s1', 20);
    expect(weak?.stage).toBe('weak');
    const expired = engine.evaluate('s1', 30);
    expect(expired?.stage).toBe('expired');
  });
});

describe('expiry → GC', () => {
  it('expireDue collects expired signals and records them', () => {
    const engine = new SignalLifecycleEngine();
    engine.birth({ id: 'bg1', type: 'file:saved', priority: 0, bornAt: 0, source: 'fs' }, 0);
    engine.birth({ id: 'em1', type: 'agent:attached', priority: 3, bornAt: 0, source: 'agent' }, 0);
    const expired = engine.expireDue(10);
    expect(expired.map((e) => e.signalId).sort()).toEqual(['bg1']);
    expect(engine.expired().length).toBe(1);
    expect(engine.replaySeesExpired()).toBe(true);
  });

  it('GC removes the signal from live state but keeps history', () => {
    const engine = new SignalLifecycleEngine();
    engine.birth({ id: 'bg1', type: 'file:saved', priority: 0, bornAt: 0, source: 'fs' }, 0);
    engine.expireDue(10);
    expect(engine.stateOf('bg1')).toBeUndefined();
    expect(engine.stateOfCount()).toBe(0);
    expect(engine.expired()).toHaveLength(1);
  });

  it('expired signals are flagged before GC', () => {
    const engine = new SignalLifecycleEngine();
    engine.birth({ id: 'bg1', type: 'file:saved', priority: 0, bornAt: 0, source: 'fs' }, 0);
    expect(engine.isExpired('bg1', 10)).toBe(true);
    expect(engine.isExpired('bg1', 2)).toBe(false);
  });

  it("an emergency signal is never GC'd", () => {
    const engine = new SignalLifecycleEngine();
    engine.birth({ id: 'em1', type: 'agent:attached', priority: 3, bornAt: 0, source: 'agent' }, 0);
    expect(engine.expireDue(100000)).toEqual([]);
    expect(engine.stateOfCount()).toBe(1);
  });
});

describe('noise gate (admission before attention)', () => {
  const born = (engine: SignalLifecycleEngine, id: string, type: string, priority: number, tick: number, source = 'src') =>
    engine.birth({ id, type, priority: priority as 0 | 1 | 2 | 3 | 4, bornAt: tick, source }, tick);

  it('high-priority fresh signals admit', () => {
    const engine = new SignalLifecycleEngine();
    const state = born(engine, 's1', 'error:occurred', 2, 1);
    const record = engine.admit(state, 1);
    expect(record.decision).toBe('admit');
  });

  it('low-priority weak signals absorb (Law 15)', () => {
    const engine = new SignalLifecycleEngine();
    engine.birth({ id: 'bg1', type: 'file:saved', priority: 0, bornAt: 0, source: 'fs' }, 0);
    const state = engine.evaluate('bg1', 4);
    const record = engine.admit(state!, 4);
    expect(record.decision).toBe('absorb');
  });

  it('attenuated signals fall between absorb and admit', () => {
    const engine = new SignalLifecycleEngine();
    born(engine, 's1', 'test:passed', 1, 0);
    const weak = engine.evaluate('s1', 13);
    const record = engine.admit(weak!, 13);
    expect(['attenuate', 'absorb']).toContain(record.decision);
    expect(record.reason).toMatch(/score/);
  });

  it('every decision is ledgered with a reason', () => {
    const engine = new SignalLifecycleEngine();
    const state = born(engine, 's1', 'file:saved', 0, 1);
    engine.admit(state, 1);
    const records = engine.admissionLedgerFor(1);
    expect(records).toHaveLength(1);
    expect(records[0]?.reason).toBeTruthy();
  });

  it('repetition raises class weight and can move a signal from absorb to admit', () => {
    const engine = new SignalLifecycleEngine();
    const first = born(engine, 's1', 'test:failed', 1, 0);
    born(engine, 's2', 'test:failed', 1, 0);
    born(engine, 's3', 'test:failed', 1, 0);
    born(engine, 's4', 'test:failed', 1, 0);
    const fifth = born(engine, 's5', 'test:failed', 1, 0);
    expect(engine.classWeightOf('src', 'test:failed')).toBeGreaterThan(0.1);
    const firstAdmission = engine.admit(first, 0);
    const repeatedAdmission = engine.admit(fifth, 0);
    expect(repeatedAdmission.score).toBeGreaterThan(firstAdmission.score);
  });
});

describe('derived lifecycle report (SLO shape)', () => {
  it('aggregates admission decisions and admission rate', () => {
    const engine = new SignalLifecycleEngine();
    engine.birth({ id: 's1', type: 'error:occurred', priority: 2, bornAt: 1, source: 'a' }, 1);
    engine.birth({ id: 's2', type: 'error:occurred', priority: 2, bornAt: 1, source: 'a' }, 1);
    engine.birth({ id: 's3', type: 'file:saved', priority: 0, bornAt: 0, source: 'a' }, 0);
    engine.birth({ id: 's4', type: 'agent:attached', priority: 3, bornAt: 1, source: 'a' }, 1);
    for (const id of ['s1', 's2', 's3', 's4']) {
      const state = engine.stateOf(id);
      if (state) engine.admit(state, 2);
    }
    const report = lifecycleReport(engine, 2);
    expect(report.admitted + report.attenuated + report.absorbed).toBe(4);
    expect(report.admissionRate).toBeGreaterThan(0);
    expect(report.admissionRate).toBeLessThanOrEqual(1);
    expect(report.expired).toBe(0);
  });
});
