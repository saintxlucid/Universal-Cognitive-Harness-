/**
 * RFC-0005 failure physics — independent held-out corpus.
 *
 * Written independently from the training corpus
 * (benchmark/corpus.ts): different wording, same failure families
 * (spof / network / db / complexity). Used to validate that the
 * bootstrap-calibrated threshold θ = 0.5 generalizes beyond the 17-case
 * benchmark set (RFC-0005 milestone: independent held-out corpus).
 *
 * Groups: veto (must veto), negative (must never veto), advisory (must
 * never veto, but surface the concept).
 */

import type { EvaluationTarget } from '../types.js';

export type HeldOutGroup = 'veto' | 'negative' | 'advisory';

export interface HeldOutCase {
  id: string;
  group: HeldOutGroup;
  target: EvaluationTarget;
}

const code = (diff: string): EvaluationTarget => ({ kind: 'code', diff, paths: [] });
const prose = (text: string, kind: 'design' | 'plan' | 'architecture' = 'design'): EvaluationTarget =>
  ({ kind, text });

export const FAILURE_PHYSICS_HELDOUT_CORPUS: HeldOutCase[] = [
  /* ---------------- veto group ---------------- */
  {
    id: 'heldout-veto-single-writer',
    group: 'veto',
    target: prose('The cluster has only one instance that can accept writes.'),
  },
  {
    id: 'heldout-veto-gateway-no-redundancy',
    group: 'veto',
    target: prose('The gateway is a single server with no failover configured.', 'architecture'),
  },
  {
    id: 'heldout-veto-raw-http',
    group: 'veto',
    target: code([
      '+const resp = await fetch("https://edge.example.com/sync");',
      '+return resp.json();',
    ].join('\n')),
  },
  {
    id: 'heldout-veto-unretried-write',
    group: 'veto',
    target: code('+await pool.query("UPDATE accounts SET balance = ?", [amount]);'),
  },
  {
    id: 'heldout-veto-quadruple-nesting',
    group: 'veto',
    target: code([
      '+for (let i = 0; i < n; i++) {',
      '+  for (let j = 0; j < m; j++) {',
      '+    for (let k = 0; k < p; k++) {',
      '+      for (let l = 0; l < q; l++) {',
      '+        work(i, j, k, l);',
      '+      }',
      '+    }',
      '+  }',
      '+}',
    ].join('\n')),
  },
  {
    id: 'heldout-veto-coordinator-no-standby',
    group: 'veto',
    target: prose('The coordinator has no standby; if it dies, the whole system stops.', 'architecture'),
  },

  /* ---------------- negative group ---------------- */
  {
    id: 'heldout-negative-replicated-writes',
    group: 'negative',
    target: prose('Writes go to a primary with two synchronous replicas and automatic failover.'),
  },
  {
    id: 'heldout-negative-retried-call',
    group: 'negative',
    target: code([
      '+const r = await fetch("https://api.example.com/v2/data", { timeout: 5000 });',
      '+if (!r.ok) return retry(r, { attempts: 3, backoff: true });',
    ].join('\n')),
  },
  {
    id: 'heldout-negative-guarded-query',
    group: 'negative',
    target: code([
      '+try {',
      '+  const rows = await db.query({ text: "SELECT id FROM users WHERE email = ?", values: [email] });',
      '+} catch (e) { useReplica(); }',
    ].join('\n')),
  },
  {
    id: 'heldout-negative-map-lookup',
    group: 'negative',
    target: code([
      '+const lookup = new Map();',
      '+for (const x of xs) lookup.set(x, true);',
    ].join('\n')),
  },
  {
    id: 'heldout-negative-distributed-queue',
    group: 'negative',
    target: prose('Every replica can serve reads; the queue is drained by any worker.'),
  },

  /* ---------------- advisory group ---------------- */
  {
    id: 'heldout-advisory-retry-storm',
    group: 'advisory',
    target: code(
      '+for (const id of ids) retry(() => fetch("https://api.example.com"), { retries: 4 });',
    ),
  },
  {
    id: 'heldout-advisory-scan-in-loop',
    group: 'advisory',
    target: code('+for (const a of xs) if (ys.includes(a)) hits++;'),
  },
  {
    id: 'heldout-advisory-backlog-batching',
    group: 'advisory',
    target: prose('The queue backlog should be drained in batches before adding more workers.', 'plan'),
  },
  {
    id: 'heldout-advisory-batch-http',
    group: 'advisory',
    target: code('+const r = await fetch("https://batch.example.com", { timeout: 10000 });'),
  },
  {
    id: 'heldout-advisory-wide-touch',
    group: 'advisory',
    target: code([
      'diff --git a/a.ts b/a.ts', 'diff --git a/b.ts b/b.ts', 'diff --git a/c.ts b/c.ts',
      'diff --git a/d.ts b/d.ts', 'diff --git a/e.ts b/e.ts', 'diff --git a/f.ts b/f.ts',
      'diff --git a/g.ts b/g.ts', 'diff --git a/h.ts b/h.ts',
      '+export const x = 2;',
    ].join('\n')),
  },
];
