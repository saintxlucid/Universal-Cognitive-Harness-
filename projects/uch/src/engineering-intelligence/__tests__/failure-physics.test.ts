/**
 * Failure Physics prototype tests (RFC-0005 Part 3):
 * unit coverage of the instability model + the corpus parity contract.
 */

import { describe, expect, it } from 'vitest';
import type { BenchmarkCase } from '../benchmark/corpus.js';
import {
  VETO_THRESHOLD,
  calibrateThreshold,
  evaluateInstability,
  nestingDepth,
  runInstabilityParityBenchmark,
} from '../failure-physics/instability.js';

const code = (diff: string): BenchmarkCase['target'] => ({ kind: 'code', diff, paths: [] });
const prose = (text: string): BenchmarkCase['target'] => ({ kind: 'design', text });

describe('nestingDepth', () => {
  it('counts consecutive nested loops across + diff lines', () => {
    const diff = [
      '+for (const a of xs) {',
      '+  for (const b of ys) a.includes(b);',
      '+    for (const c of zs) b.includes(c);',
      '+      for (const d of ws) c.includes(d);',
      '+}',
    ].join('\n');
    expect(nestingDepth(diff)).toBe(4);
  });

  it('counts a single loop as depth 1', () => {
    expect(nestingDepth('+for (let i = 0; i < n; i++) { if (xs.includes(v)) count++; }')).toBe(1);
  });

  it('resets depth after a non-add line', () => {
    const diff = [
      '+for (const a of xs) {',
      '-removed line',
      '+  for (const b of ys) {',
      '+    for (const c of zs) b.includes(c);',
      '+}',
    ].join('\n');
    expect(nestingDepth(diff)).toBe(2);
  });
});

describe('evaluateInstability', () => {
  it('vetoes unrecovered SPOF claims', () => {
    const v = evaluateInstability(prose('The system depends on a single database server.'));
    expect(v.veto).toBe(true);
    expect(v.vetoFamily).toBe('spof');
    expect(v.maxInstability).toBeGreaterThanOrEqual(VETO_THRESHOLD);
  });

  it('does not veto a replicated standby system', () => {
    const v = evaluateInstability(
      prose('The service runs in three replicas with automatic failover to a standby database.'),
    );
    expect(v.veto).toBe(false);
  });

  it('vetoes unrecovered network loss', () => {
    const v = evaluateInstability(
      code(['+const r = await fetch("https://api.example.com/v1/users");', '+return await r.json();'].join('\n')),
    );
    expect(v.veto).toBe(true);
    expect(v.vetoFamily).toBe('network');
  });

  it('does not veto mitigated network loss', () => {
    const v = evaluateInstability(
      code(
        ['+const r = await fetch("https://api.example.com/v1/users", { timeout: 3000 });', '+retry(r, { backoff: true, fallback: cache });'].join('\n'),
      ),
    );
    expect(v.veto).toBe(false);
  });

  it('vetoes unrecovered db stall and spares the mitigated variant', () => {
    const bad = evaluateInstability(code('+const rows = await pool.query("SELECT * FROM users");'));
    expect(bad.veto).toBe(true);
    expect(bad.vetoFamily).toBe('db');

    const good = evaluateInstability(
      code(
        ['+try { const rows = await pool.query("SELECT 1", { timeout: 2000 }); }', '+catch (e) { useReadReplica(); }'].join('\n'),
      ),
    );
    expect(good.veto).toBe(false);
  });

  it('vetoes pathological nesting but spares a single scan loop', () => {
    const bad = evaluateInstability(
      code(
        ['+for (const a of xs) {', '+  for (const b of ys) a.includes(b);', '+}'].join('\n'),
      ),
    );
    expect(bad.veto).toBe(true);
    expect(bad.vetoFamily).toBe('complexity');

    const ok = evaluateInstability(code('+for (let i = 0; i < n; i++) { if (xs.includes(v)) count++; }'));
    expect(ok.veto).toBe(false);
  });

  it('spares a hash-set loop (defense raises evidence mass)', () => {
    const v = evaluateInstability(
      code(['+const seen = new Set();', '+for (const x of xs) seen.add(x);'].join('\n')),
    );
    expect(v.veto).toBe(false);
    expect(v.maxInstability).toBeLessThan(0);
  });

  it('produces no belief when no failure family signals fire', () => {
    const v = evaluateInstability(prose('A minimal design with no dependencies.'));
    expect(v.beliefs).toEqual([]);
    expect(v.veto).toBe(false);
  });
});

describe('corpus parity contract (RFC-0005 Prototype)', () => {
  it('is separable: every veto instability exceeds every non-veto instability', () => {
    const { thresholdRange } = calibrateThreshold();
    expect(thresholdRange).not.toBeNull();
    const [lo, hi] = thresholdRange!;
    expect(hi).toBeGreaterThan(lo);
    expect(VETO_THRESHOLD).toBeGreaterThan(lo);
    expect(VETO_THRESHOLD).toBeLessThanOrEqual(hi);
  });

  it('achieves exact parity with the rule-based vetoes on the 17-case corpus', () => {
    const report = runInstabilityParityBenchmark();
    expect(report.totalCases).toBe(17);
    expect(report.ruleVetoRecall).toBe(1);
    expect(report.instabilityVetoRecall).toBe(1);
    expect(report.negativeControlPassRate).toBe(1);
    expect(report.advisoryNonVetoRate).toBe(1);
    expect(report.separable).toBe(true);

    const vetoed = report.cases.filter((c) => c.veto).map((c) => c.id);
    expect(vetoed).toEqual(
      expect.arrayContaining([
        'spof-singular-database',
        'spof-negated-recovery',
        'unrecovered-network-loss',
        'unrecovered-db-stall',
        'pathological-complexity',
      ]),
    );
    expect(vetoed).toHaveLength(5);
  });
});
