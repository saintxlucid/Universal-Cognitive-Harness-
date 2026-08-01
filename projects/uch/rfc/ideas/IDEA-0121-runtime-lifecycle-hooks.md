# IDEA-0121 — Runtime Lifecycle Hooks (11-phase lifecycle contract)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 cognitive-architecture intake (round 16,
  second half) — "Integration isn't with APIs anymore. It's with
  behavior. Every runtime has a lifecycle: Boot → Initialize →
  Authenticate → Discover → Observe → Execute → Learn → Checkpoint →
  Suspend → Resume → Shutdown. UCH hooks into every phase."
- **Related:** IDEA-0103 (Cognitive BIOS — the ten-stage BOOT
  sequence Identify→Authenticate→Enumerate→Capability Discovery→
  Topology Scan→Permission Negotiation→Security Scan→Memory
  Discovery→Tool Discovery→Ready; the lifecycle is the boot
  protocol's extension from boot to the full lifetime), IDEA-0118
  (UCCD — the Discover phase's output), IDEA-0120 (runtime
  composition — handoffs are lifecycle transitions), WS-D (propose→
  verify→commit checkpoints — the Checkpoint phase's mechanism),
  attach (session join — Resume), IDEA-0089 (capability leasing —
  renewals across the lifecycle), IDEA-0070 (health registry —
  liveness during Observe/Execute), IDEA-0032 (consciousness levels —
  stage-gated activation precedent), IDEA-0072 (universal lifecycle
  engine — stage machine for OBJECTS; this is the RUNTIME's
  lifecycle), IDEA-0069 (feature flags — per-phase enablement)

## Motivation

The intake's claim: today integrations connect to endpoints; UCH
should hook _behavior over time_. The corpus has the boot sequence
(0103, "exactly like USB enumeration") but nothing after Ready —
learn, checkpoint, suspend, resume, and shutdown are unowned as a
contract. Yet those phases are where cognition actually persists:
Checkpoint is where memory syncs, Learn is where the sleep cycle
distills, Suspend/Resume is where attach continuity lives. A
normative 11-phase lifecycle with UCH hook points makes every
participant's lifetime observable and governable, not just its
connection.

## The corpus cannot cover it because

- IDEA-0103 stops at Ready; post-boot phases (Observe/Execute/Learn/
  Checkpoint/Suspend/Resume/Shutdown) have no lifecycle contract,
  no phase-transition events, no hook-point semantics.
- WS-D checkpoints exist (transactional cognition), attach exists
  (session join), the sleep cycle exists (Learn) — but none is
  specified as a _phase of the runtime's lifecycle_ with transition
  events on the bus.
- Nothing defines what UCH does _at_ each phase (memory sync at
  Checkpoint, context compile at Resume, lesson distillation at
  Learn) or what a participant must declare about phase support.

## Proposal sketch

- **Lifecycle contract** `uch.runtime-lifecycle.v1`: 11 phases,
  per-phase hook points (what UCH may invoke, what events the
  participant must emit), declared per participant in UCCD (0118)
  — a participant declares which phases it supports; unsupported
  phases degrade gracefully (no phase → no hook, UCH still records
  observable events at whatever level exists).
- **Phase-transition events**: Booted, Initialized, Authenticated,
  Discovered, Observing, Executing, Learned, Checkpointed, Suspended,
  Resumed, Shutdown — published on the event bus (new EventTypes
  through the event-governance gate) so the ledger (ADR-002) records
  every lifetime.
- **UCH's own hooks**: Checkpoint → memory + ledger sync; Learn →
  sleep-cycle distillation and skill updates; Suspend → snapshot
  (WS-D); Resume → context recompile + Live Cognitive State restore;
  Shutdown → handoff record for the next session.
- **BIOS alignment**: the 0103 boot sequence becomes phases 1-4 of
  the 11-phase contract (Identify/Authenticate/Enumerate/Discover),
  preserving the USB-enumeration discipline.

## Risk assessment

- Phase coverage varies wildly across platforms — the declaration
  (UCCD) + degradation rule is mandatory; hooks must never be
  assumed present.
- Hook abuse: UCH's effectors at each phase must respect consent
  zones (0097 CIP Green/Yellow/Red) — lifecycle hooks are an
  effector surface.
- Event volume: phase events are low-frequency; no risk of bus
  flooding, but transition semantics must be idempotent (suspend
  twice = once).

## Where it lands

- Spec annex extending the BIOS protocol; `src/drivers/` lifecycle
  wrapper; new EventTypes via event-governance; integration with
  health registry (0070) and leasing (0089).

## Code impact

- None until designed; seeds are BIOS design (0103), WS-D
  transactional kernel, attach, sleep cycle, Live Cognitive State.

## Next stage

- Extend the BIOS research register to the 11-phase lifecycle;
  prototype: wrap one real CLI runtime (OpenCode or Claude Code) in
  the lifecycle and assert phase-transition events land in the
  ledger with correct ordering.
