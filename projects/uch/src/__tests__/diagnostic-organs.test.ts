import { describe, it, expect } from 'vitest';
import { EtiologyEngine } from '../etiology/etiology-engine.js';
import { FrontierMapper } from '../frontier-mapper/frontier-mapper.js';

describe('Etiology Engine', () => {
  function engine() {
    return new EtiologyEngine();
  }

  function investigationInput() {
    return {
      symptom: 'tests flake 3x in a window',
      evidence: [
        { fact: 'failed on CI only', source: 'ci-logs' },
        { fact: 'passes locally 10/10', source: 'local-run' },
      ],
      whys: [
        'test depends on global state',
        'another test mutates the shared fixture',
        'teardown order is non-deterministic',
        'the suite runs files in parallel',
        'parallel runner shares the database connection pool',
      ],
      fishboneCauses: {
        process: ['non-deterministic teardown'],
        technology: ['shared connection pool'],
      },
      hypotheses: [
        { category: 'technology', cause: 'shared connection pool exhausted', likelihood: 0.8, impact: 0.9 },
        { category: 'process', cause: 'test order coupling', likelihood: 0.5, impact: 0.6 },
      ],
      systemNotes: ['CI runs 8 parallel workers'],
    };
  }

  it('investigates a symptom into a causal graph node', () => {
    const et = engine();
    const node = et.investigate(investigationInput());
    expect(node.symptom).toBe('tests flake 3x in a window');
    expect(node.why_answers).toHaveLength(5);
    expect(node.fishbone_categories.process).toContain('non-deterministic teardown');
    expect(node.hypothesis_status).toBe('proposed');
    expect(node.inquiry.design).toBe('log-derived');
    expect(node.pareto_rank).toBeGreaterThanOrEqual(0);
  });

  it('ranks the top hypothesis first via pareto', () => {
    const et = engine();
    const node = et.investigate(investigationInput());
    expect(node.pareto_rank).toBe(0);
    expect(et.prioritize()[0]!.id).toBe(node.id);
  });

  it('validates and rejects hypotheses with rate benchmark', () => {
    const et = engine();
    const n1 = et.investigate(investigationInput());
    const n2 = et.investigate(investigationInput());
    expect(et.validateHypothesis(n1.id, 'controlled-change')).not.toBeNull();
    expect(n1.hypothesis_status).toBe('validated');
    et.rejectHypothesis(n2.id);
    expect(n2.hypothesis_status).toBe('rejected');
    expect(et.getValidationRate()).toBeCloseTo(0.5);
  });

  it('enforces one-change-at-a-time on fixes', () => {
    const et = engine();
    const node = et.investigate(investigationInput());
    expect(et.applyFix(node.id, 'isolate the fixture')).toBeNull(); // not validated yet
    et.validateHypothesis(node.id, 'controlled-change');
    const fixed = et.applyFix(node.id, 'isolate the fixture');
    expect(fixed!.fix_applied).toBe('isolate the fixture');
    expect(fixed!.fixed_at).not.toBeNull();
    expect(et.applyFix(node.id, 'second fix')).toBeNull(); // blocked
  });

  it('tracks recurrence and resets the node', () => {
    const et = engine();
    const node = et.investigate(investigationInput());
    et.validateHypothesis(node.id, 'replication');
    et.applyFix(node.id, 'pool isolation');
    expect(et.recordRecurrence(node.id)).toBe(true);
    expect(node.recurrence_count).toBe(1);
    expect(node.fix_applied).toBeNull();
    expect(et.getRecurrenceRate()).toBeCloseTo(1);
  });

  it('reports open investigations and status', () => {
    const et = engine();
    et.investigate(investigationInput());
    expect(et.getOpenInvestigations()).toHaveLength(1);
    const status = et.getStatus();
    expect(status.investigations).toBe(1);
    expect(status.validationRate).toBe(0);
    expect(et.getInvestigation('nope')).toBeUndefined();
  });
});

describe('Frontier Mapper', () => {
  const notes = [
    { title: 'A', finding: 'no effect observed', year: 2019, limitation: 'small sample' },
    { title: 'B', finding: 'effect exists', year: 2021, futureRecommendation: 'study under new population' },
    { title: 'C', finding: 'inconsistent results', year: 2022 },
  ];

  it('scans and discovers gaps of multiple types', () => {
    const fm = new FrontierMapper();
    const gaps = fm.scan({
      topic: 'caching in edge runtimes',
      location: 'packages/edge-cache',
      notes,
    });
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    const types = new Set(gaps.map((g) => g.gap_type));
    expect(types.has('contradiction')).toBe(true);
    expect(types.has('methodological')).toBe(true);
    expect(types.has('knowledge')).toBe(true);
  });

  it('classifies discovery method from evidence', () => {
    const fm = new FrontierMapper();
    const gaps = fm.scan({ topic: 't', location: 'l1', notes });
    const contradiction = gaps.find((g) => g.gap_type === 'contradiction');
    expect(contradiction!.discovered_via).toBe('contradiction-scan');
    const methodological = gaps.find((g) => g.gap_type === 'methodological');
    expect(methodological!.discovered_via).toBe('limitation-scan');
  });

  it('deduplicates open gaps across rescans', () => {
    const fm = new FrontierMapper();
    fm.scan({ topic: 't', location: 'l2', notes });
    const before = fm.getGaps('l2').length;
    fm.scan({ topic: 't', location: 'l2', notes });
    expect(fm.getGaps('l2').length).toBe(before);
    expect(fm.scanCount).toBe(2);
  });

  it('claims and resolves gaps', () => {
    const fm = new FrontierMapper();
    const [gap] = fm.scan({ topic: 't', location: 'l3', notes });
    expect(fm.claim(gap!.id)).toBe(true);
    expect(gap!.status).toBe('claimed');
    expect(fm.claim('missing')).toBe(false);
    expect(fm.resolve(gap!.id)).toBe(true);
    expect(gap!.status).toBe('resolved');
  });

  it('computes precision/recall against a labeled gap set', () => {
    const fm = new FrontierMapper();
    fm.scan({ topic: 't', location: 'l4', notes });
    fm.label('l4', ['contradiction', 'methodological', 'knowledge']);
    const b = fm.benchmarkPrecision('l4');
    expect(b.recall).toBeCloseTo(1);
    expect(b.precision).toBeGreaterThan(0);
    const stats = fm.getStats();
    expect(stats.recall).toBeCloseTo(1);
    expect(stats.byType.contradiction).toBeGreaterThanOrEqual(1);
  });

  it('flags stale open gaps after the retention window', () => {
    const fm = new FrontierMapper();
    const [gap] = fm.scan({ topic: 't', location: 'l5', notes });
    gap!.discovered_at = new Date(Date.now() - 91 * 86400000).toISOString();
    gap!.staleness_days = 91;
    const stale = fm.getStaleGaps();
    expect(stale.map((g) => g.id)).toContain(gap!.id);
    expect(fm.getStats().staleGaps).toBeGreaterThanOrEqual(1);
  });
});
