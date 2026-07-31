/**
 * Engineering Intelligence Layer — benchmark corpus.
 *
 * Labeled evaluation targets used to measure the deterministic gates:
 * planted violations (veto group: must hard-reject; advisory group: must
 * surface the expected concept) and negative controls (clean targets that
 * must NOT trip vetoes). Success contract (design/ENGINEERING-INTELLIGENCE.md
 * §6): veto recall >= 80%, zero-LLM evaluation < 1 s per target.
 */

import type { EvaluationTarget } from '../types.js';

export type BenchmarkGroup = 'veto' | 'advisory' | 'negative';

export interface BenchmarkCase {
  id: string;
  group: BenchmarkGroup;
  target: EvaluationTarget;
  /** Concept ids that MUST fire for this case to pass. */
  expected: string[];
  /** Concept ids that must NOT fire (negative controls). */
  forbidden?: string[];
}

const code = (diff: string): EvaluationTarget => ({ kind: 'code', diff, paths: [] });
const prose = (text: string, kind: 'design' | 'plan' | 'architecture' = 'design'): EvaluationTarget =>
  ({ kind, text });

export const ENGINEERING_BENCHMARK_CORPUS: BenchmarkCase[] = [
  /* ---------------------------------------------------------------- */
  /* Veto group — planted violations that must hard-reject            */
  /* ---------------------------------------------------------------- */
  {
    id: 'spof-singular-database',
    group: 'veto',
    target: prose('The system depends on a single database server for all writes.'),
    expected: ['sys.spof'],
  },
  {
    id: 'spof-negated-recovery',
    group: 'veto',
    target: prose(
      'The message broker has no failover and no standby; if it dies the pipeline stops.',
      'architecture',
    ),
    expected: ['sys.spof'],
  },
  {
    id: 'unrecovered-network-loss',
    group: 'veto',
    target: code([
      '+const r = await fetch("https://api.example.com/v1/users");',
      '+return await r.json();',
    ].join('\n')),
    expected: ['failure.network-loss'],
  },
  {
    id: 'unrecovered-db-stall',
    group: 'veto',
    target: code('+const rows = await pool.query("SELECT * FROM users");'),
    expected: ['failure.db-stall'],
  },
  {
    id: 'pathological-complexity',
    group: 'veto',
    target: code([
      '+for (const a of xs) {',
      '+  for (const b of ys) a.includes(b);',
      '+    for (const c of zs) b.includes(c);',
      '+      for (const d of ws) c.includes(d);',
      '+}',
    ].join('\n')),
    expected: ['cs.complexity.time'],
  },

  /* ---------------------------------------------------------------- */
  /* Advisory group — planted smells that must surface                */
  /* ---------------------------------------------------------------- */
  {
    id: 'in-loop-array-scan',
    group: 'advisory',
    target: code('+for (let i = 0; i < n; i++) { if (xs.includes(v)) count++; }'),
    expected: ['cs.complexity.time'],
  },
  {
    id: 'shift-unshift-queue',
    group: 'advisory',
    target: code('+for (let i = 0; i < n; i++) queue.shift();'),
    expected: ['cs.data-structures.deque'],
  },
  {
    id: 'retry-amplification',
    group: 'advisory',
    target: code('+retry(() => fetch("https://api.example.com"), { retries: 5, backoff: true });'),
    expected: ['sys.retry-amplification'],
  },
  {
    id: 'law-little-brooks',
    group: 'advisory',
    target: prose(
      'Process the queue backlog in batches; the project is late, so add headcount.',
      'plan',
    ),
    expected: ['law.little', 'law.brooks'],
  },
  {
    id: 'change-amplification',
    group: 'advisory',
    target: code(
      [
        'diff --git a/a.ts b/a.ts', 'diff --git a/b.ts b/b.ts', 'diff --git a/c.ts b/c.ts',
        'diff --git a/d.ts b/d.ts', 'diff --git a/e.ts b/e.ts', 'diff --git a/f.ts b/f.ts',
        'diff --git a/g.ts b/g.ts', 'diff --git a/h.ts b/h.ts',
        '+export const a = 1;',
      ].join('\n'),
    ),
    expected: ['se.change-amplification'],
  },
  {
    id: 'import-fanout',
    group: 'advisory',
    target: code([
      '+import a from "lib-a";', '+import b from "lib-b";', '+import c from "lib-c";',
      '+import d from "lib-d";', '+import e from "lib-e";', '+import f from "lib-f";',
      '+import g from "lib-g";', '+import h from "lib-h";', '+import i from "lib-i";',
    ].join('\n')),
    expected: ['se.coupling'],
  },
  {
    id: 'build-vs-buy',
    group: 'advisory',
    target: code(
      [
        'diff --git a/n0.ts b/n0.ts', 'new file mode 100644', '+export const a = 1;',
        'diff --git a/n1.ts b/n1.ts', 'new file mode 100644', '+export const b = 1;',
        'diff --git a/n2.ts b/n2.ts', 'new file mode 100644', '+export const c = 1;',
        'diff --git a/n3.ts b/n3.ts', 'new file mode 100644', '+export const d = 1;',
        'diff --git a/n4.ts b/n4.ts', 'new file mode 100644', '+export const e = 1;',
        'diff --git a/n5.ts b/n5.ts', 'new file mode 100644', '+export const f = 1;',
      ].join('\n'),
    ),
    expected: ['econ.build-vs-buy'],
  },

  /* ---------------------------------------------------------------- */
  /* Negative controls — clean targets that must not trip vetoes      */
  /* ---------------------------------------------------------------- */
  {
    id: 'clean-design',
    group: 'negative',
    target: prose('A minimal design with no dependencies.'),
    expected: [],
    forbidden: ['sys.spof'],
  },
  {
    id: 'redundant-system',
    group: 'negative',
    target: prose('The service runs in three replicas with automatic failover to a standby database.'),
    expected: [],
    forbidden: ['sys.spof'],
  },
  {
    id: 'mitigated-network',
    group: 'negative',
    target: code([
      '+const r = await fetch("https://api.example.com/v1/users", { timeout: 3000 });',
      '+retry(r, { backoff: true, fallback: cache });',
    ].join('\n')),
    expected: [],
    forbidden: ['failure.network-loss'],
  },
  {
    id: 'mitigated-db-stall',
    group: 'negative',
    target: code([
      '+try { const rows = await pool.query("SELECT 1", { timeout: 2000 }); }',
      '+catch (e) { useReadReplica(); }',
    ].join('\n')),
    expected: [],
    forbidden: ['failure.db-stall'],
  },
  {
    id: 'simple-loop-hashset',
    group: 'negative',
    target: code([
      '+const seen = new Set();',
      '+for (const x of xs) seen.add(x);',
    ].join('\n')),
    expected: [],
    forbidden: ['cs.complexity.time'],
  },
];
