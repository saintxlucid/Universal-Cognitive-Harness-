# IDEA-0088 — Cognitive Locking + Extended Transactions

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 cognitive-microarchitecture intake (round 12) —
  "Semantic Locks: Not file locks. Knowledge locks. Prevent conflicting
  updates. Memory Transactions: extend them with nested transactions,
  savepoints, optimistic concurrency, conflict resolution, causal
  ordering. Treat cognition like a distributed database."
- **Related:** src/kernel/transactional/ (WS-D: propose → verify →
  commit/rollback, append-only ledger, refuse on failed verdict),
  src/kernel/merge/cognitive-merge.ts (disjoint union + conflict
  detection only, |Δconf| > 0.15 gate), IDEA-0056 (cognitive object
  model — one identity per object class), src/kernel/process/
  (PID namespace — attach joins a PID), CIC grants + projections
  (authority model), neural-fs (goal store), traceparent + tick
  (causal ordering substrate), IDEA-0034 decision law (verify gate)

## Motivation

WS-D made cognition transactional at the whole-organism level: a
proposed change goes verify-then-commit, and a failed verdict refuses
the commit. But it is linear and coarse: one transaction at a time,
no fine-grained contention, no partial rollback, no concurrent
writers. Two organs touching the same belief region cannot both be in
flight; a long verification blocks everything; and there is no way to
save a point mid-transaction and continue. The intake's claim: once
cognition has objects (IDEA-0056), it needs database-grade concurrency
— semantic locks on cognitive objects, nested transactions with
savepoints, optimistic concurrency, conflict resolution, and causal
ordering — because a multi-process, multi-organ organism is a
distributed system even when it runs on one machine.

## The corpus cannot cover it because

The transactional ledger is append-only and serial; cognitive merge
detects conflicts between two versions (Δ confidence) but is a
batch utility, not a runtime concurrency control. There are no locks
(semantic or otherwise) — the grep-proven absence; no savepoints;
no optimistic retry; no version vectors. Causal ordering exists as a
substrate (traceparent propagation, tick-based ordering) but is never
used for transaction ordering. Grants/projections control _authority_;
nothing controls _concurrency_.

## Proposal sketch

- Semantic locks: advisory locks keyed by cognitive object identity +
  concept region (IDEA-0056 classes), not file paths; lock scope is
  grant-aware (a writer locks what its grant can write); locks are
  tick-stamped and released on commit/rollback or expiry (IDEA-0089).
- Extended transactions over the WS-D ledger: nested transactions
  (child commit/rollback within parent), savepoints (mark → rollback
  to mark), optimistic concurrency (version vectors per object;
  conflicts detected at commit, resolved via cognitive merge's Δ gate
  or rejected with a retry).
- Causal ordering: transaction boundaries carry the traceparent +
  tick; a transaction never commits an object newer than its causal
  read point (per-object freshness check).
- Dissonance hook: a semantic-lock conflict on a belief is the
  mechanical trigger for psychology's dissonance compensation
  (IDEA-0092) — conflicts become first-class events, not errors.

## Risk assessment

- Deadlock: lock ordering discipline + lock expiry; the scheduler
  (task priority) must not invert while holding locks.
- Ledger truth: extended transactions never rewrite the append-only
  ledger — savepoints are journal markers, rollbacks are
  compensating entries (the ledger remains the replay source).

## Where it lands

- `src/kernel/transactional/` (savepoints, nesting, version vectors),
  `src/kernel/merge/` (runtime conflict resolution).

## Code impact

- None until the locking + nesting contract is specified; WS-D +
  cognitive merge are the seed.

## Next stage

- Prototype: two writers, optimistic conflict on one object,
  merge-gate resolution; then a savepoint mid-verification test.
