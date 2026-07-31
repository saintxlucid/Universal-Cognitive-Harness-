import { describe, it, expect } from 'vitest';
import {
  ENGINEERING_BENCHMARK_CORPUS,
  runEngineeringBenchmark,
} from '../index.js';

describe('Engineering benchmark corpus', () => {
  it('covers all three groups with labeled cases', () => {
    const groups = new Set(ENGINEERING_BENCHMARK_CORPUS.map((c) => c.group));
    expect(groups.has('veto')).toBe(true);
    expect(groups.has('advisory')).toBe(true);
    expect(groups.has('negative')).toBe(true);
    expect(ENGINEERING_BENCHMARK_CORPUS.length).toBeGreaterThanOrEqual(12);
  });

  it('every case has a unique id and expected concepts', () => {
    const ids = ENGINEERING_BENCHMARK_CORPUS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of ENGINEERING_BENCHMARK_CORPUS) {
      if (c.group === 'negative') continue;
      expect(c.expected.length, `case ${c.id} needs expected concepts`).toBeGreaterThan(0);
    }
  });
});

describe('Engineering benchmark runner', () => {
  const report = runEngineeringBenchmark();

  it('meets the veto recall contract (>= 80%)', () => {
    expect(report.vetoRecall).toBeGreaterThanOrEqual(0.8);
  });

  it('meets the overall recall contract (>= 80%)', () => {
    expect(report.recall).toBeGreaterThanOrEqual(0.8);
  });

  it('passes every negative control (no veto leaks on clean targets)', () => {
    expect(report.negativeControlPassRate).toBe(1);
    const fails = report.cases.filter((c) => c.group === 'negative' && !c.passed);
    expect(fails).toEqual([]);
  });

  it('passes every planted veto case individually (deterministic gates)', () => {
    const vetoFails = report.cases.filter((c) => c.group === 'veto' && !c.passed);
    expect(vetoFails).toEqual([]);
  });

  it('evaluates every target in well under 1 s (zero-LLM path)', () => {
    expect(report.avgLatencyMs).toBeLessThan(1000);
    expect(report.maxLatencyMs).toBeLessThan(1000);
    for (const c of report.cases) {
      expect(c.latencyMs, `case ${c.id} exceeded 1 s`).toBeLessThan(1000);
    }
  });

  it('reports per-case detail (missing/unexpected) for diagnosis', () => {
    expect(report.cases.length).toBe(ENGINEERING_BENCHMARK_CORPUS.length);
    for (const c of report.cases) {
      expect(Array.isArray(c.missing)).toBe(true);
      expect(Array.isArray(c.unexpected)).toBe(true);
      expect(c.latencyMs).toBeGreaterThanOrEqual(0);
    }
    expect(report.passedCases).toBeGreaterThanOrEqual(
      Math.ceil(0.8 * report.totalCases),
    );
  });

  it('is deterministic across runs (latency excluded)', () => {
    const stable = (r: ReturnType<typeof runEngineeringBenchmark>): string =>
      JSON.stringify({
        ...r,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        maxLatencyMs: 0,
        cases: r.cases.map(({ latencyMs: _latency, ...rest }) => rest),
      });
    expect(stable(runEngineeringBenchmark())).toBe(stable(runEngineeringBenchmark()));
  });

  it('latency stats are internally consistent', () => {
    expect(report.p95LatencyMs).toBeLessThanOrEqual(report.maxLatencyMs);
    expect(report.avgLatencyMs).toBeLessThanOrEqual(report.maxLatencyMs);
  });
});
