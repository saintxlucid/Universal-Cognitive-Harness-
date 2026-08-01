# IDEA-0089 — Capability Leasing

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 cognitive-microarchitecture intake (round 12) —
  "Capability Leasing: Capabilities expire unless renewed. Prevents
  stale plugins."
- **Related:** src/cognitive-plane/protocol/capability-protocol.ts
  (lifecycle states: active / deprecated, etc. — state, not time),
  src/agentic/tools/availability.ts (30s TTL on tool availability —
  the one time-bounded capability in the corpus), workspace-manifest
  grants + ProjectionEngine (authority), src/cognitive-plane/health/
  health-registry.ts (tick heartbeats), IDEA-0080 (plugin trust
  scoring — scorecards with versions), src/kernel/packages/ (WS-P
  package registry + quarantine), capability negotiation
  (src/workspace-manifest/negotiation.ts — version + capability
  agreement at attach), IDEA-0068 (capability negotiation + discovery)

## Motivation

Capabilities have lifecycle states but no clock. A grant once issued
is authoritative until explicitly revoked; a driver, plugin, or
capability that has gone stale — unmaintained, unverified, absent for
weeks — keeps its authority forever. The intake's claim: capabilities
should be _leased_ — granted with a term, renewable, and expired
automatically when the holder stops renewing. This is how distributed
systems prevent stale authority (leases, TTLs, heartbeats), and UCH
already has the heartbeat machinery (health registry) and the TTL
pattern (availability registry) — what is missing is applying the
lease model to the capability/authority plane itself.

## The corpus cannot cover it because

Grants and projections are static until revocation; capability
lifecycle states (active → deprecated) are transitions, not
time-bounded terms. Availability TTLs bound _tool health checks_,
not _authority_. Plugin trust scores carry versions but no expiry;
a scorecard from a year ago is treated like one from yesterday.
Heartbeats exist per-organ (health registry) but are not wired into
authority — a silent organ keeps full authority.

## Proposal sketch

- Lease terms on capability grants: every grant carries a default
  lease (per capability tier — kernel capabilities long, plugin
  capabilities short), renewed by heartbeat (health registry) or an
  explicit `lease.renew` op.
- Expiry semantics: an expired lease does not hard-fail the holder —
  it triggers re-negotiation (IDEA-0068 dialect agreement) with a
  downgraded provisional state; the projection engine re-derives
  authority accordingly.
- Trust interaction: plugin trust scorecards (IDEA-0080) age with
  time (score decay for staleness); leases are recorded in the ledger
  so expiry is replayable.
- Leasing covers capabilities, grants, drivers, and packages — the
  same term model everywhere (IDEA-0072 lifecycle instances).

## Risk assessment

- Renewal churn: very short leases on hot capabilities cause
  renegotiation storms — default terms must be derived from observed
  heartbeat cadence, and renewal must be cheap (a tick update, not a
  full negotiation).
- Authority gap: expiry must never silently drop a capability mid-
  critical-action — expiry is deferred while a transaction (IDEA-0088)
  is in flight, then applied at the next commit boundary.

## Where it lands

- `src/workspace-manifest/` (lease fields on grants), capability
  protocol (lease ops), health registry (renewal source).

## Code impact

- None until the lease contract is specified; availability TTL +
  health heartbeats + grants are the seed.

## Next stage

- Prototype: grant with a short lease, silent holder, auto-expiry →
  renegotiation path; assert ledgered expiry and provisional
  downgrade.
