# RFC-0002 — Signals

- **Status:** Accepted (specification in spec/LAWS_OF_COGNITIVE_PHYSICS.md Law 1;
  reference implementation in src/event-bus/ + src/nervous-system/)
- **Family:** Physics (Signals)
- **Related:** Law 1 (Signal Universality), Law 16 (Interrupt Hierarchy), Law 17
  (Signal Fusion), design/EVENT-GOVERNANCE.md, design/COGNITIVE-TRACE.md
- **Date:** 2026-08-01

## Summary

Every interaction between components is an immutable, causally attributed
signal. Signals are the substrate's only communication primitive — no method
calls, no shared mutable state, no hidden channels.

## Problem

Coupling is the slow death of long-lived systems. Direct calls make causality
untraceable, replay impossible, and parallel evolution of components
dangerous. The signal model makes every interaction observable (Law 1),
prioritizable (Law 16), fusible (Law 17), and replayable (Law 12).

## Normative requirements (current state)

1. **Immutability** — a signal is immutable once emitted. Implemented:
   `NeuralEventBus` (src/event-bus/neural-event-bus.ts) emits immutable
   events with String()-coerced payloads for cross-module safety.
2. **Causal attribution** — every signal carries source, id, and trace
   context. Implemented: event_id, provenance chains, W3C traceparent.
3. **Governance gate** — every driver observation passes policy + grant
   checks before entering the bus. Implemented: `EventGovernance`
   (src/control-plane/event-governance.ts), audit ledger, denial events.
4. **Priority** — signals are routed by priority levels. Implemented:
   five-layer nervous system (peripheral → spinal → brainstem → thalamus →
   cortex) with priority table; signal priority map extended for
   `engineering:reviewed`, `skill:distilled`, `connectome:link`.
5. **Termination** — signals terminate at the lowest capable layer (Law 13).
   Implemented: reflex fast-path router (prefix trie, zero-LLM).
6. **Fusion** — multiple signals may fuse into a ranked composite.
   Implemented: SignalFusionEngine (src/cortex_kernel/signal-fusion-engine.ts).

## Five Gates verdict

| Gate | Verdict |
| --- | --- |
| G1 Scientific | Pass — event-driven architectures, interrupt theory, signal processing |
| G2 Architectural | Pass — Law 1, Law 16, Law 17; Constitution Article III §2 (Right to Signal) |
| G3 Engineering | Pass — bus is benchmarked (signal priority tests, latency assertions), conformance-tested |
| G4 Biological | Pass — Dual Naming: Nervous System / Thalamus / Spinal Cord mapping |
| G5 Economic | Pass — observability, auditability, and replay are the product's core value |

## Open items

1. Signal schema registry: formal per-type payload schemas with versioning
   (event schema versioning was identified in GAP-CLOSURE-PLAN §11.4).
2. Backpressure and congestion policy for the bus under burst load.
3. Signal delivery guarantees: at-least-once vs. exactly-once semantics per
   event type (idempotency exists; delivery ordering under failure is open).
4. External signal translation (MCP/ACP → internal signals) — driver-bound
   work, deferred to driver epoch.

## Milestones

- [x] Immutable event bus with governance gate — done
- [x] Priority routing (5-layer nervous system) — done
- [x] Reflex fast path (zero-LLM) — done
- [x] Trace integration (W3C) — done
- [ ] Schema registry + per-type versioning — open (RFC-0002 amendment)
- [ ] Delivery guarantees under failure — open (needs chaos testing, Book III territory)
