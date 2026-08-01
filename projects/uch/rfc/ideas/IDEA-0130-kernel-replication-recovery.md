# IDEA-0130 — Kernel deltas: Replication + formal Recovery (Ω-0)

- **Status:** Idea (SOP-08 stage 1 — no code)
- **Origin:** 2026-08-01 reimplementation-objective intake (round 19) —
  "Ω-0 Cognitive Microkernel. Everything else should run on it."
  Kernel list: Identity, Clock, Scheduler, Transactions, Signals,
  Memory Manager, Policy Engine, Capability Manager, Security,
  Observability, Ledger, Persistence, Replication, Recovery.
  "Everything else becomes userspace. Exactly like Linux."
- **Related:** ADR-006 (12 kernel primitives, verified 10/12 + 2
  partial), WS-A (process model), WS-E (self-diagnosis — 12 SMART
  metrics), WS-D (transactional cognition), IDEA-0070 (organ health/
  watchdogs/safe mode/restart-restore-replay — recovery embryo),
  IDEA-0064 (multi-UCH networking), IDEA-0047 UER (cross-host
  exchange format — replication's seed), WS-B vmem, neural-fs
  persistence, CIC (session isolation), IDEA-0089 (capability
  leasing)

## Motivation

The Ω-0 list restates ADR-006's 12 primitives (Identity = manifest;
Clock = catalog.ts cognitive clock; Scheduler = accelerators/
scheduler; Transactions = WS-D; Signals = neural-event-bus; Memory
Manager = WS-B vmem; Policy Engine = constitution + integrity
checklist; Capability Manager = capability-registry + grants;
Security = permissions + CIC + WS-P quarantine; Observability =
trace recorder + SMART; Ledger = ADR-002 trace ledger; Persistence =
Storable + .uccp) — with two additions: **Replication** and
**Recovery** as kernel-grade primitives, not applications.

## The corpus cannot cover it because

Replication is grep-absent: zero implementation, zero design docs
(the only "replication" hits are EI domain-knowledge concepts — Raft
tiers, CRDTs — and failure-physics cases). Cross-host movement today
is export/import (CIC, .cog distribution), not state replication:
no leader/follower or CRDT semantics for the cognitive ledger, no
replica set for the workspace manifest, no convergence guarantee
across two attached harnesses. Recovery exists only as embryo:
WS-E diagnoses, IDEA-0070 proposes restart-restore-replay, WS-D
ledger is append-only — but no kernel primitive _restores_ a
cognitive state to a consistent point after failure (the time
machine reads, it does not resurrect).

## Proposal sketch

- **Replication primitive (kernel-grade):** replicate the cognitive
  ledger (ADR-002) and workspace state across hosts with convergence
  semantics — CRDT-style for the signal/decision streams, Raft-style
  ordering for the ledger where total order matters; the UER
  cross-host exchange format (IDEA-0047 P3) is the wire format;
  attach (ADR-001) becomes join-a-replica, not copy-a-state.
- **Recovery primitive (kernel-grade):** restore-to-consistent-point
  — WS-D commit points define recoverable states; on failure, roll
  forward to the last committed point and replay the deterministic
  subset (ADR-002 + IDEA-0117 execution graph) — the WS-E diagnosis
  decides the recovery mode (restart / restore / replay /
  quarantine per IDEA-0070).
- **Boundary rule (per ADR-006):** replication and recovery are
  primitives only in the minimal sense (convergence + restore
  semantics); the topologies (how many replicas, which hosts) stay
  userspace.

## Risk assessment

- Scope creep into distributed systems: replication must be defined
  at the _cognitive_ level (what must converge: ledger, signals,
  manifest) not the generic DB level — the minimal primitive is
  convergence of the ledger, not a general distributed store.
- Recovery theater: without crash injection tests, restore is a
  fairy tale; the verification gate is a real kill-test (WS-E
  diagnostics + restore-to-commit-point).

## Where it lands

- ADR-006 amendment (kernel list 12 → 14 with status);
  design docs `design/REPLICATION.md` + `design/RECOVERY.md`;
  prototype over trace-persistence write-path + UER exchange format.

## Code impact

- None at SOP-08 stage 1. Later: ledger replica module
  (convergence over the ADR-002 write path — blocked on W-01
  persistence write-path landing), recovery orchestrator in the
  boot lifecycle (W-09).

## Next stage

Define convergence semantics for the ledger; prototype
restore-to-commit-point over WS-D + replay.
