import { describe, it, expect } from 'vitest';
import { rcaAnalyze, traceFiveWhys, fishbone, paretoPrioritize, CAUSE_CATEGORIES } from '../rca/rca.js';

describe('F.O.C.U.S. RCA', () => {
  it('runs the full pipeline with ranked hypotheses', () => {
    const r = rcaAnalyze({
      problem: 'Login service fails for 12% of users during peak traffic',
      evidence: [
        { fact: 'Failures cluster 9-11am', source: 'error logs' },
        { fact: 'DB connection pool saturates', source: 'metrics' },
      ],
      hypotheses: [
        { category: 'technology', cause: 'Connection pool too small', likelihood: 0.9, impact: 0.8 },
        { category: 'people', cause: 'Team unaware of limits', likelihood: 0.3, impact: 0.5 },
      ],
    });
    expect(r.focus).toContain('12%');
    expect(r.rootCause?.cause).toBe('Connection pool too small');
    expect(r.rootCause?.category).toBe('technology');
    expect(r.solve.correctiveActions[0]).toContain('Correct the cause');
    expect(r.organize.evidenceQuality).toBe('adequate — facts outnumber assumptions');
  });

  it('warns when no evidence or hypotheses exist', () => {
    const r = rcaAnalyze({ problem: 'System is bad', evidence: [] });
    expect(r.organize.evidenceQuality).toContain('no evidence');
    expect(r.rootCause).toBeNull();
    expect(r.solve.correctiveActions[0]).toContain('Generate candidate causes');
  });
});

describe('Five Whys trace', () => {
  it('produces the causal chain and guards against shallow analysis', () => {
    const t = traceFiveWhys('Deployment failed', [
      'Auth step skipped',
      'Missing env var in pipeline',
      'Secrets not propagated on new agent',
    ]);
    expect(t.chain.length).toBe(3);
    expect(t.rootCause).toContain('Secrets');
    expect(t.mistakeGuard).toContain('root cause reached');
  });

  it('flags shallow chains', () => {
    const t = traceFiveWhys('Deployment failed', ['Some error']);
    expect(t.mistakeGuard).toContain('stopped too early');
  });
});

describe('Fishbone', () => {
  it('covers all six categories and advises broadening', () => {
    const r = fishbone({
      problem: 'Defects escaping to production',
      causes: { process: ['no review step'], technology: ['weak linter'] },
    });
    expect(r.categories.length).toBe(CAUSE_CATEGORIES.length);
    expect(r.coverage.filled).toBe(2);
    expect(r.advice).toContain('broaden');
  });
});

describe('Pareto prioritization', () => {
  it('finds the vital few causes', () => {
    const r = paretoPrioritize([
      { cause: 'config drift', impact: 60 },
      { cause: 'race condition', impact: 25 },
      { cause: 'cosmetic', impact: 10 },
      { cause: 'typo', impact: 5 },
    ]);
    expect(r.vitalFew[0]).toBe('config drift');
    expect(r.vitalFew).toContain('race condition');
    expect(r.vitalFew).not.toContain('typo');
  });
});
