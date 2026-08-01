# Signal Lifecycle Engine — design contract (IDEA-0084)

- **Status:** Prototype design (2026-08-01)
- **Idea note:** `rfc/ideas/IDEA-0084-signal-lifecycle-engine.md`
- **G1 register:** `research/foundations/21-signal-lifecycle.md`
- **Prototype:** `src/nervous-system/signal-lifecycle.ts`
- **Seed anchors:** `Signal.freshness` (fixed 30000), the
  `signalPriorityForType` catalog, memory-hygiene staleAfterTicks,
  AttentionCortex bottleneck, Law 15 (absorption), ADR-002 replay.

## 1. Purpose

Give every signal a lifecycle like a packet: born with a TTL, decaying
through a freshness curve, garbage-collected when expired — plus an
admission stage (noise gate) where irrelevant observations are
attenuated before they consume attention, with every decision
ledgered.

## 2. Freshness model

A signal's freshness stage is a function of age and TTL:

```
age = tick − bornAt
ratio = age / ttl
stage: fresh (ratio < 0.25) → useful (0.25 ≤ ratio < 0.5) →
       weak (0.5 ≤ ratio < 1.0) → expired (ratio ≥ 1.0)
```

- **TTL derivation:** per-type default TTLs from the priority tier —
  emergencies (priority ≥ 3) never expire (TTL = ∞); background
  observations (priority 0) expire fast. The `signalPriorityForType`
  catalog is the seed.
- **Expiry semantics:** expired signals are not delivered to cortex
  consumers — the ledger still records them (TTL gates live
  processing, never replay). An `expire()` pass produces a
  `signal:expired` event per expired signal (GC hook).
- **Amplification:** repeated signals of one (source, type) class
  raise the class's weight — the repetition path of Law 17 fusion.

## 3. Noise gate

An admission stage between the bus and the cortex:

- Score = relevance against the current attention window (a prototype
  heuristic: priority weight × freshness × class weight).
- Decision: **admit** (delivered), **attenuate** (delivered with a
  reduced weight), or **absorb** (not delivered; consumed at the
  lowest capable layer per Law 15).
- Every refusal/attenuation is ledgered with its reason — a wrongly
  filtered signal can be recovered (the filter's own SLO).

## 4. Prototype scope

- Pure module: no bus wiring (SOP-08 Prototype discipline). It takes
  `Signal`-shaped inputs and returns lifecycle/GC/admission results.
- TTL policy on three signal types per the idea's next stage:
  `file:saved` (background, short TTL), `test:failed` (spinal,
  mid TTL), `connectome:link` (spinal, mid TTL); a `signal:expired`
  event type constant is declared but the bus is not modified.
- The class-weight table is in-memory, keyed by (source, type).

## 5. Risk notes

- TTL vs causality: expired ≠ untrue. The engine's documentation and
  the `expiredForReplay()` escape hatch make explicit that replay and
  time-machine paths ignore TTL.
- Over-filtering: the gate records refusals; the recovery path is the
  audit trail, not silent data loss.
