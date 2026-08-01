# IDEA-0084 — Signal Lifecycle Engine

- **Status:** Prototype (2026-08-01) - G1 register + design doc +
  reference module with tests; NOT wired into any gate (SOP-08
  Prototype discipline).
- **Origin:** 2026-08-01 cognitive-microarchitecture intake (round 12) —
  "Signal TTL: Signals expire. Exactly like packets. Fresh → Useful →
  Weak → Expired → Garbage Collection. Signal Noise Filter: Ignore
  irrelevant observations. Attention becomes earned."
- **Related:** src/nervous-system/signal.ts (SignalPriority 0-4 +
  priorityForLayer + Law 16 interrupt hierarchy/preemption),
  src/event-bus/neural-event-bus.ts, IDEA-0010 (signal fabric —
  urgency/entropy/decay/preemption over the bus), IDEA-0079 (memory
  hygiene — staleAfterTicks), src/agentic/tools/availability.ts
  (30s tool TTL), src/accelerators/scheduler.ts (60s cache TTL),
  Law 15 (information conservation: zero-gain signals absorbed at the
  lowest nervous layer), Law 17 (signal fusion: weak signals aggregate),
  src/cortex_kernel/attention-cortex.ts (importance bottleneck),
  src/kernel/retrieval/context-compressor.ts (dedupe + scoring)

## Motivation

The bus already has a priority dimension: every EventType maps to a
SignalPriority, higher-priority signals preempt lower-priority
execution (Law 16), and the ux-charter guarantees user interrupts
outrank internal work. What the bus lacks is a _freshness_ dimension.
A `file:saved` event and an `agent:attached` event are both delivered
the same way hours later; stale signals are processed exactly like
fresh ones. The intake's claim is that signals need a lifecycle the
way packets do — born with a TTL, decaying through usefulness, and
garbage-collected when expired — plus an admission stage where
irrelevant observations are filtered _before_ they consume attention,
so attention is earned rather than assumed.

## The corpus cannot cover it because

TTL exists only in point cases (tool availability cache, scheduler
cache, hygiene's staleAfterTicks on memory items) and is not a
property of the signal envelope itself; there is no freshness curve,
no expiry→GC path on the bus, and no event type for "signal expired".
Noise filtering exists at the cortex (AttentionCortex bottleneck,
integrator threshold adjustments) and at retrieval (mnemosyne noise
floor), but there is no signal-layer admission gate between the bus
and the cortex — every delivered signal competes for attention whether
or not it is relevant to current focus. Amplification exists as
connectome register-or-strengthen, but only for links, not as a
signal-level policy (repeated weak signals mattering more).

## Proposal sketch

- Signal envelope extension: `{ priority, bornAt, ttl }` with a
  freshness curve (fresh → useful → weak → expired) evaluated against
  the cognitive tick; per-type default TTLs derived from priority tier
  (emergencies never expire; background observations expire fast).
- Expiry semantics: expired signals are not delivered to cortex
  consumers (the ledger still records them — TTL gates live processing,
  never replay); an `signal:expired` event feeds the GC (IDEA-0060).
- Noise gate: an admission stage between bus and cortex that scores
  signals against the current attention window (IDEA-0093's conserved
  attention budget); low-relevance signals are attenuated or absorbed
  at the lowest capable layer (Law 15), not dropped silently — the
  decision is ledgered.
- Amplification: repetition raises a signal class's weight (mirrors
  connectome strengthening; Law 17 fusion already requires multiple
  independent sources — this gives the _repetition_ path).

## Risk assessment

- TTL vs causality: an expired signal can still be the cause of a
  current state — TTL must be a live-processing gate, never a truth
  judgment; replay/time-machine paths ignore TTL entirely.
- Over-filtering: the noise gate must record refusals so a wrongly
  filtered signal can be recovered (the filter's own SLO, IDEA-0071).

## Where it lands

- `src/nervous-system/` (envelope + freshness + GC), `src/cognitive-plane/`
  admission gate; extends signal.ts + neural-event-bus.ts.

## Code impact

- None until the envelope schema and one prototype TTL policy are
  specified; the signal catalog (signalPriorityForType) is the seed.

## Next stage

- Wire the engine into the bus admission path; measure cortex load
  reduction and ledger integrity on real signal streams.
