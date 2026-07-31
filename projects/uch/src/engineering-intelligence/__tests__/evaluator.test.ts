import { describe, it, expect } from 'vitest';
import { createEngineeringJudgment } from '../index.js';
import { analyzeTarget } from '../analyzer.js';
import type { EvaluationTarget } from '../types.js';

const evalTarget = (diff: string): EvaluationTarget => ({ kind: 'code', diff, paths: [] });

describe('Analyzer — deterministic facts', () => {
  it('extracts loop structure and array scans', () => {
    const ctx = analyzeTarget(
      evalTarget([
        '+function f(arr) {',
        '+  for (const a of arr) {',
        '+    for (const b of a.items) arr.includes(b);',
        '+  }',
        '+}',
      ].join('\n')),
    );
    expect(ctx.codeFacts.loopCount).toBe(2);
    expect(ctx.codeFacts.nestedLoopPairs).toBe(1);
    expect(ctx.codeFacts.arrayScansInLoop).toBe(1);
    expect(ctx.codeFacts.maxNestingDepth).toBe(2);
  });

  it('detects I/O surfaces, parallelism, and retries', () => {
    const ctx = analyzeTarget(
      evalTarget([
        '+const r = await fetch("https://api.example.com");',
        '+const db = await pool.query("SELECT 1");',
        '+await Promise.all([a(), b()]);',
        '+fs.writeFileSync("/tmp/x", data);',
        '+retry(() => work(), { backoff: true });',
      ].join('\n')),
    );
    expect(ctx.codeFacts.networkAccess).toBe(true);
    expect(ctx.codeFacts.databaseAccess).toBe(true);
    expect(ctx.codeFacts.fileSystemAccess).toBe(true);
    expect(ctx.codeFacts.parallelCalls).toBe(1);
    expect(ctx.codeFacts.retryCount).toBeGreaterThanOrEqual(1);
  });

  it('extracts diff statistics', () => {
    const ctx = analyzeTarget(
      evalTarget([
        'diff --git a/a.ts b/a.ts',
        'new file mode 100644',
        '+const x = 1;',
        '+const y = 2;',
        '-const z = 3;',
      ].join('\n')),
    );
    expect(ctx.diffStats.newFiles).toBe(1);
    expect(ctx.diffStats.linesAdded).toBe(2);
    expect(ctx.diffStats.linesRemoved).toBe(1);
  });

  it('is deterministic', () => {
    const d = '+const x = await fetch("https://a.b");\n+for (let i = 0; i < n; i++) xs.includes(i);';
    const a = analyzeTarget(evalTarget(d));
    const b = analyzeTarget(evalTarget(d));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('EngineeringEvaluator', () => {
  const judgment = createEngineeringJudgment();

  it('vetoes pathological complexity: nested loops with in-loop scans', () => {
    const review = judgment.evaluator.evaluate(
      evalTarget([
        '+for (const a of xs) {',
        '+  for (const b of ys) a.includes(b);',
        '+    for (const c of zs) b.includes(c);',
        '+      for (const d of ws) c.includes(d);',
        '+}',
      ].join('\n')),
    );
    const veto = review.findings.filter((f) => f.gate === 'veto');
    expect(veto.length).toBeGreaterThanOrEqual(1);
    expect(veto[0].severity).toBe('blocking');
    expect(veto[0].conceptId).toBe('cs.complexity.time');
    expect(veto[0].tier).toBe('tier-01-cs');
  });

  it('flags in-loop array scans and shift/unshift as structure smells', () => {
    const review = judgment.evaluator.evaluate(
      evalTarget([
        '+for (let i = 0; i < n; i++) queue.shift();',
        '+for (const b of ys) a.includes(b);',
      ].join('\n')),
    );
    const ids = review.findings.map((f) => f.conceptId);
    expect(ids).toContain('cs.data-structures.deque');
    expect(ids).toContain('cs.complexity.time');
  });

  it('enumerates failure surfaces for network + DB + disk + clock', () => {
    const review = judgment.evaluator.evaluate(
      evalTarget([
        '+const r = await fetch("https://api.example.com");',
        '+const db = await pool.query("SELECT 1");',
        '+fs.writeFileSync("/tmp/x", data);',
        '+const t = Date.now();',
      ].join('\n')),
    );
    const tier3 = review.findings.filter((f) => f.tier === 'tier-03-systems');
    const ids = tier3.map((f) => f.conceptId);
    expect(ids).toContain('sys.failure-propagation');
    expect(ids).toContain('sys.graceful-degradation');
    expect(tier3.length).toBeGreaterThanOrEqual(3);
  });

  it('warns on retry amplification when retries meet network I/O', () => {
    const review = judgment.evaluator.evaluate(
      evalTarget('+retry(() => fetch("https://api.example.com"), { retries: 5, backoff: true });'),
    );
    const ids = review.findings.map((f) => f.conceptId);
    expect(ids).toContain('sys.retry-amplification');
  });

  it('runs law triggers and reports them as tier-06 findings', () => {
    const review = judgment.evaluator.evaluate({
      kind: 'plan',
      text: 'Process the queue backlog in batches; the project is late, so add headcount.',
    });
    const lawFindings = review.findings.filter((f) => f.tier === 'tier-06-laws');
    const ids = lawFindings.map((f) => f.conceptId);
    expect(ids).toContain('law.little');
    expect(ids).toContain('law.brooks');
  });

  it('reports economics signals for greenfield-sized diffs', () => {
    const lines = ['diff --git a/a.ts b/a.ts', 'new file mode 100644', '+export const a = 1;'];
    for (let i = 0; i < 5; i++) {
      lines.push('diff --git a/f' + i + '.ts b/f' + i + '.ts', 'new file mode 100644', '+export const x = 1;');
    }
    const review = judgment.evaluator.evaluate(evalTarget(lines.join('\n')));
    const econ = review.findings.filter((f) => f.tier === 'tier-05-economics');
    expect(econ.map((f) => f.conceptId)).toContain('econ.build-vs-buy');
  });

  it('is deterministic and produces stable ids and scores', () => {
    const target = evalTarget('+const r = await fetch("https://api.example.com");');
    const a = judgment.evaluator.evaluate(target);
    const b = judgment.evaluator.evaluate(target);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.targetId.startsWith('code-')).toBe(true);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });

  it('clean design text scores 100 with no findings', () => {
    const review = judgment.evaluator.evaluate({
      kind: 'design',
      text: 'A minimal design with no dependencies.',
    });
    expect(review.findings).toEqual([]);
    expect(review.score).toBe(100);
    expect(review.summary).toContain('Score 100/100');
  });

  it('respects the maxFindings cap', () => {
    const target = evalTarget(
      '+retry(() => fetch("https://api.example.com"), { retries: 5 });\n+for (let i = 0; i < n; i++) q.shift();\n+const db = await pool.query("SELECT 1");',
    );
    const { evaluator } = createEngineeringJudgment();
    const uncapped = evaluator.evaluate(target);
    const capped = new (evaluator.constructor as new (
      domains: unknown,
      laws: unknown,
      config?: { maxFindings?: number },
    ) => typeof evaluator)(judgment.domains, judgment.laws, { maxFindings: 1 }).evaluate(target);
    expect(capped.findings.length).toBe(1);
    expect(capped.findings.length).toBeLessThan(uncapped.findings.length);
  });
});
