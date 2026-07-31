import { describe, it, expect } from 'vitest';
import { createLawRegistry, ENGINEERING_LAWS } from '../laws/engineering-laws.js';
import { analyzeTarget } from '../analyzer.js';

const designCtx = (text: string) => analyzeTarget({ kind: 'design', text });

describe('Law registry', () => {
  const laws = createLawRegistry();

  it('registers the 12 canonical engineering laws', () => {
    expect(laws.size).toBe(12);
    const ids = laws.list().map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'law.amdahl', 'law.brooks', 'law.conway', 'law.gall', 'law.goodhart',
        'law.hofstadter', 'law.lehman', 'law.little', 'law.murphy', 'law.occam',
        'law.pareto', 'law.parkinson',
      ]),
    );
  });

  it('covers all five domains', () => {
    const domains = laws.list().map((l) => l.domain);
    expect(new Set(domains)).toEqual(new Set(['project', 'team', 'system', 'code', 'schedule']));
  });

  it('every law is a first-class primitive: statement, predicates, tradeoffs, provenance', () => {
    for (const law of ENGINEERING_LAWS) {
      expect(law.statement.length).toBeGreaterThan(20);
      expect(typeof law.applicability).toBe('function');
      expect(typeof law.check).toBe('function');
      expect(law.tradeoffs.length).toBeGreaterThan(0);
      expect(law.provenance.length).toBeGreaterThan(0);
    }
  });

  it('rejects duplicates and unknown lookups', () => {
    expect(() => laws.register(ENGINEERING_LAWS[0])).toThrow(/Duplicate law id/);
    expect(laws.get('law.nope')).toBeNull();
  });

  it('fires no findings on an inapplicable context', () => {
    const ctx = designCtx('A straightforward design with no relevant keywords.');
    expect(laws.evaluate(ctx)).toEqual([]);
  });
});

describe('Law triggers', () => {
  const laws = createLawRegistry();

  it("Amdahl fires on parallelization", () => {
    const findings = laws.evaluate(designCtx('Parallelize the batch worker with concurrent threads.'));
    expect(findings.map((f) => f.lawId)).toContain('law.amdahl');
  });

  it("Little fires on queueing design", () => {
    const findings = laws.evaluate(designCtx('The queue backlog grows while latency rises.'));
    expect(findings.map((f) => f.lawId)).toContain('law.little');
  });

  it("Goodhart warns on metric-driven change", () => {
    const findings = laws.evaluate(designCtx('We target 100% coverage and an SLA metric.'));
    expect(findings.map((f) => f.lawId)).toContain('law.goodhart');
    expect(findings.find((f) => f.lawId === 'law.goodhart')?.severity).toBe('warning');
  });

  it("Brooks warns on late-project staffing", () => {
    const findings = laws.evaluate(designCtx('The project is late; we add headcount to meet the deadline.'));
    expect(findings.map((f) => f.lawId)).toContain('law.brooks');
    expect(findings.find((f) => f.lawId === 'law.brooks')?.severity).toBe('warning');
  });

  it('Gall fires on large greenfield additions (new files)', () => {
    const diff = [
      'diff --git a/x.ts b/x.ts',
      'new file mode 100644',
      'diff --git a/y.ts b/y.ts',
      'new file mode 100644',
      'diff --git a/z.ts b/z.ts',
      'new file mode 100644',
      'diff --git a/w.ts b/w.ts',
      'new file mode 100644',
      'diff --git a/v.ts b/v.ts',
      'new file mode 100644',
      'diff --git a/u.ts b/u.ts',
      'new file mode 100644',
      '+export const ok = 1;',
    ].join('\n');
    const findings = laws.evaluate(analyzeTarget({ kind: 'code', diff, paths: [] }));
    expect(findings.map((f) => f.lawId)).toContain('law.gall');
  });

  it('Murphy fires on I/O-bearing code', () => {
    const ctx = analyzeTarget({
      kind: 'code',
      diff: '+const data = await fetch("https://api.example.com");',
      paths: [],
    });
    const findings = laws.evaluate(ctx);
    expect(findings.map((f) => f.lawId)).toContain('law.murphy');
  });

  it('Conway fires when team and architecture co-occur', () => {
    const findings = laws.evaluate(
      designCtx('The platform team owns the service boundaries of the architecture.'),
    );
    expect(findings.map((f) => f.lawId)).toContain('law.conway');
  });
});
