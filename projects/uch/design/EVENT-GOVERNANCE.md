# Governed Driver Event Path

- **Status:** Implemented (2026-07-31)
- **Scope:** ADR-001 Phase-I acceptance criterion #3
- **Module:** `src/control-plane/event-governance.ts`

## 1. Purpose

ADR-001 requires at least one driver event path that is **provenance-linked,
idempotent, policy-checked, and observable**. This document specifies that
path: the `EventGovernance` gate that every driver observation must pass
before it becomes a runtime event.

A driver never publishes directly to the event bus. It submits an observation
to the governance gate, which decides admission — and the runtime keeps the
audit trail of every decision.

## 2. The gate

```text
driver observation
  -> idempotency check (event_id dedupe)      [replay -> dropped, ledgered]
  -> policy check (PolicyEngine)              [deny rule -> denied, ledgered]
  -> grant check (GrantEngine authorize)      [scope/budget/rate -> denied]
  -> staleness check (maxEventAgeMs)          [old -> denied]
  -> admitted: published on the event bus with ProvenanceLink metadata
  -> every decision: recorded in the audit ledger
```

Order matters: dedupe runs first (cheap, deterministic), then policy, then
grant, then staleness. A denied event is **not** marked seen — once the
policy or grant that blocked it is fixed, the retry can be admitted.

## 3. Provenance

Every admitted event carries a `ProvenanceLink`:

| Field | Meaning |
| --- | --- |
| `event_id` | This event's id (the dedupe key) |
| `parent_id` | Id of the causal predecessor, if any (chain) |
| `driver_id` | Driver that produced the observation |
| `source_authority` | Authority the observation claims (`git`, `filesystem`, …) |
| `emitted_at` | When the driver observed the fact |

The link is attached to the published event's `metadata.provenance`, and
admitted events are retrievable from `governance.events()` with their full
chain intact. `parent_id` lets an event stream be causally replayed.

## 4. Idempotency

- The dedupe key is the source-provided `event_id`; drivers must issue stable
  ids for retries (re-sending the same observation after a network blip must
  be a no-op).
- Replays are dropped, recorded as `duplicate` in the ledger, and counted in
  `duplicateCount`. They are never re-published.
- The seen-set and the ledger are both capped at `maxLedger` (default 1000).

## 5. Policy checks

- When a `PolicyEngine` is configured, admission requires a matching
  `allow` rule; no match means **default deny**.
- Evaluation: `principal` = event source, `action` = event type,
  `resource` = `scope.workspace ?? scope.project ?? '*'`.
- Patterns support wildcards: `*` matches everything, a trailing `*` matches
  any value with that prefix (`git:*` matches any `git:` action, `ws-*`
  matches any `ws-` resource), exact values match exactly.
- Denials are published as `governance:event_denied` bus events with the
  original event id, type, source, and reason.

## 6. Grant checks

- When a `grant_id` is supplied, the observation is authorized through the
  `GrantEngine` (`src/cognitive-runtime/grants.ts`) at the observation's
  scope: operation family (default `observe`), actor binding, scope
  containment, rate limit, and budget all apply.
- This is the CIC enforcement point: **cross-project isolation** (an event
  scoped outside the grant is denied), **budget exhaustion** (daily/session
  token and operation budgets), and **deletion propagation** (revoking the
  grant denies every subsequent event) all fall out of the grant check.

## 7. Staleness

- With `maxEventAgeMs` set, observations older than the window are rejected
  as stale (flagged `stale: true` in the decision). This prevents an
  event-ledger replay from being re-applied as current state.

## 8. Observability

| Surface | Contents |
| --- | --- |
| `ledger()` | Every decision: admitted / denied / duplicate, with reason and time |
| `denials()` | Denial records only |
| `events()` | Admitted events with provenance chains |
| `admissionCount` / `denialCount` / `duplicateCount` | Running totals |
| Bus | Admitted events (original type, provenance metadata); denials as `governance:event_denied` |

## 9. Attachment wiring

`attach()` (`src/workspace-manifest/attach.ts`) issues the session grant,
builds an `EventGovernance` bound to the session's event bus and grant
engine, routes the `workspace:opened` / `agent:attached` lifecycle events
through it, and returns it as `result.governance`. A client routes driver
observations through the same gate:

```ts
await result.governance.admitAndPublish({
  event_id: 'git:commit-abc123',          // stable source id
  type: 'git:commit',
  source: 'agent-1',                       // principal
  driver_id: 'git',                        // provenance
  scope: { workspace: 'ws-test' },
  grant_id: result.grant.grant_id,         // CIC enforcement
  actor: { type: 'agent', id: 'agent-1' },
});
```

`detach()` revokes the grant; observations submitted after that are denied
(propagation of the workspace's departure).

## 10. Files

| File | Contents |
| --- | --- |
| `src/control-plane/event-governance.ts` | `EventGovernance` gate: dedupe, policy, grant, staleness, ledger, bus emission |
| `src/control-plane/policies.ts` | `PolicyEngine` with exact + namespaced wildcard patterns |
| `src/control-plane/__tests__/event-governance.test.ts` | 16 tests: provenance chains, idempotency, policy deny/allow, cross-project isolation, revocation, budget, staleness, observability, attach wiring |
