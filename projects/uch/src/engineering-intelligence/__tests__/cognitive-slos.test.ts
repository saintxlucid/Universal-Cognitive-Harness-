import { describe, expect, it } from 'vitest';
import { SloMonitor, COGNITIVE_SLO_CATALOG } from '../slo/cognitive-slos.js';

describe('COGNITIVE_SLO_CATALOG', () => {
  it('names the 15 cognitive observables with units and orientation', () => {
    expect(COGNITIVE_SLO_CATALOG).toHaveLength(15);
    const ids = COGNITIVE_SLO_CATALOG.map((s) => s.id);
    expect(ids).toContain('reasoning.latency.p95');
    expect(ids).toContain('memory.hit.rate');
    expect(ids).toContain('hallucination.rate');
    expect(ids).toContain('contradiction.rate');
    expect(ids).toContain('token.roi');
  });

  it('every entry has a unit, measurement point, and target', () => {
    for (const slo of COGNITIVE_SLO_CATALOG) {
      expect(slo.unit.length).toBeGreaterThan(0);
      expect(slo.measurementPoint.length).toBeGreaterThan(0);
      expect(slo.target).toBeGreaterThan(0);
      expect(slo.target).toBeLessThanOrEqual(1);
    }
  });

  it('failure-rate SLIs are lower-is-better with small targets', () => {
    const hallucination = COGNITIVE_SLO_CATALOG.find((s) => s.id === 'hallucination.rate');
    expect(hallucination?.higherIsBetter).toBe(false);
    expect(hallucination?.target).toBeLessThanOrEqual(0.05);
  });
});

describe('SloMonitor', () => {
  it('starts green with no observations (compliant by default)', () => {
    const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 100);
    expect(m.status('memory.hit.rate')?.band).toBe('green');
    expect(m.status('memory.hit.rate')?.compliance).toBe(1);
  });

  it('computes compliance over a window of outcomes', () => {
    const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 100);
    for (let t = 1; t <= 10; t++) m.observeOutcome('memory.hit.rate', t, true);
    for (let t = 11; t <= 20; t++) m.observeOutcome('memory.hit.rate', t, false);
    const st = m.status('memory.hit.rate');
    expect(st?.observed).toBe(20);
    expect(st?.good).toBe(10);
    expect(st?.compliance).toBe(0.5);
    // target 0.9 → budget 0.1, spent 0.5 → over budget → red
    expect(st?.band).toBe('red');
    expect(st?.budgetRemaining).toBeLessThan(0);
  });

  it('is green when compliance is within the error budget', () => {
    const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 100);
    for (let t = 1; t <= 100; t++) {
      m.observeOutcome('truth.accuracy', t, t % 100 !== 0);
    }
    const st = m.status('truth.accuracy');
    expect(st?.compliance).toBeCloseTo(0.99);
    expect(st?.band).toBe('green');
  });

  it('turns yellow before red as the budget burns', () => {
    const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 100);
    // 100 observations, 97 good → spent 0.03 of budget 0.1 → 70% left → yellow
    for (let t = 1; t <= 100; t++) m.observeOutcome('truth.accuracy', t, t <= 97);
    expect(m.status('truth.accuracy')?.band).toBe('yellow');
    // 92 good → spent 0.08 → 20% left → yellow still
    for (let t = 101; t <= 100; t++) m.observeOutcome('truth.accuracy', t, false);
    const st = m.status('truth.accuracy');
    expect(st?.band).toBe('yellow');
  });

  it('slides the window: stale observations expire', () => {
    const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 10);
    for (let t = 1; t <= 20; t++) m.observeOutcome('memory.hit.rate', t, false);
    const st = m.status('memory.hit.rate');
    expect(st?.observed).toBeLessThanOrEqual(10);
  });

  it('evaluates latency SLIs against the threshold', () => {
    const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 100);
    m.observe('reasoning.latency.p95', 1, 1500);
    m.observe('reasoning.latency.p95', 2, 2500);
    m.observe('reasoning.latency.p95', 3, 300);
    const st = m.status('reasoning.latency.p95');
    expect(st?.good).toBe(2);
    expect(st?.observed).toBe(3);
  });

  it('ignores unknown SLO ids', () => {
    const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 100);
    m.observe('does.not.exist', 1, 5);
    expect(m.status('does.not.exist')).toBeUndefined();
  });

  it('maps bands to health states (IDEA-0070 binding)', () => {
    const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 100);
    expect(m.bandToHealth('green')).toBe('healthy');
    expect(m.bandToHealth('yellow')).toBe('degraded');
    expect(m.bandToHealth('red')).toBe('recovering');
  });

  it('is deterministic across repeated runs', () => {
    const run = (): string => {
      const m = new SloMonitor(COGNITIVE_SLO_CATALOG, 50);
      for (let t = 1; t <= 60; t++) m.observeOutcome('memory.hit.rate', t, t % 3 !== 0);
      const st = m.status('memory.hit.rate');
      return `${st?.compliance}|${st?.band}`;
    };
    expect(run()).toBe(run());
  });
});
