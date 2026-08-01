# IDEA-0064 — Multi-UCH Cognitive Networking

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "Multiple
  UCHs communicate. Protocols. Replication. Synchronization. Conflict
  resolution. Distributed cognition."
- **Related:** design/CIC-SPECIFICATION.md (transport-neutral contract),
  traceparent propagation (W3C, cross-host in UER), ADR-005 (Universal
  Cognitive Protocol), `kernel/merge` (WS-I cognitive merge —
  conflict *detection* only), session-isolation rule, IDEA-0007
  (ecology), IDEA-0047 (UER cross-host graph), IDEA-0050 (knowledge
  fabric)

## Motivation

Two UCH organisms today can exchange CIC-envelope messages and share
traceparents, but there is no *data plane*: no replication of
episodic/belief/knowledge state between organisms, no sync protocol, no
conflict resolution beyond the single-shot merge check, no clock
coordination beyond tick ordering. Distributed systems solved exactly
this (Raft log replication, CRDTs, causal clocks, quorum reads). The
claim: a cognitive networking protocol with replication and conflict
resolution, so cognition is not per-host — it is per-organism across
hosts.

## The corpus cannot cover it because

CIC is a request/operation contract, not a replication protocol;
traceparent gives causal linkage but no state transfer; WS-I merge
detects conflicts on disjoint-union input but resolves none (|Δconf| is
reported, not reconciled); the session-isolation rule *requires* that
no state be shared across hosts today; IDEA-0007 (ecology) models the
ecosystem but specifies no wire protocol.

## Proposal sketch

- Protocol: op-based replication (state converges by replaying ops —
  the ledger already makes ops the unit, ADR-002), vector clocks +
  traceparent for causality, quorum/consensus per IDEA-0065 for
  concurrent writes.
- Conflict policy per object class: beliefs → evidence-mass wins
  (RFC-0005 instability); episodes → merge-by-append (log semantics);
  knowledge graph → CRDT edge semantics or WS-I verdict + human
  arbitration (IDEA-0040 jurisprudence as the court of last resort);
  genome → never auto-merge (IDEA-0008 governance gate).
- Session-isolation stays as the *default*; networking is grant-gated
  (peers must hold exchange grants — IDEA-0062 surface).

## Risk assessment

- Replication is where poisoning spreads (a poisoned belief propagates
  to every peer) — the security boundary (0062) and the replication
  boundary must be the same boundary; identity verification of peers
  before any state flows.

## Where it lands

- Protocol spec in the rfc/ series (RFC-0006 candidate); design doc
  `design/COGNITIVE-NETWORKING.md`; first transport is CIC over HTTP
  (SSE already exists in uccp).

## Code impact

- None until the op-replication contract is specified; WS-I merge
  verdicts become the reconciliation baseline.

## Next stage

- Op-set for replication (which ops replicate, which stay local);
  vector-clock scheme; peer-grant model per 0062.
