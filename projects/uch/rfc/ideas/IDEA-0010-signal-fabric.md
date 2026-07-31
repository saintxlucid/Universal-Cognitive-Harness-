# IDEA-0010 — Signal Fabric

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "forget the event bus; invent a fabric that
  understands urgency, entropy, confidence, provenance, decay, importance,
  dependencies"
- **Related:** RFC-0002 (signals), src/cognitive-plane/neural-event-bus,
  design/CONNECTOME.md, design/EVENT-GOVERNANCE.md

## Motivation

The claim: today's runtime routes messages; a cognitive substrate should
propagate **fields of meaning**. A signal carries urgency, entropy,
confidence, provenance, decay, importance, and dependency metadata, and the
fabric performs field processing (filtering, scheduling, propagation,
aggregation) before the destination ever sees it. It is a living nervous
system, not Kafka/RabbitMQ/NATS.

## The corpus cannot cover it because

The neural-event-bus is publish/subscribe with a static priority table and a
schema-versioning policy. It delivers; it does not *behave*: no per-signal
decay, no urgency-based preemption of lower-priority work, no dependency-gated
propagation, no confidence weighting in routing. Connectome activation has
decay, but only within the graph — not in signal transport.

## Proposal sketch

- Fabric = a middle layer between producers and schedulers/organs.
- Every signal carries the semantic vector (urgency, entropy, confidence,
  provenance, decay rate, importance, dependencies).
- Fabric operations: route (destination selection), filter (drop/age),
  propagate (fan-out with decay), aggregate (merge related signals),
  preempt (urgency reorders the scheduler queue).
- Contract to consumers: field view — "what is the current signal pressure on
  the planner?" not "what messages arrived?".

## Risk assessment

- Overlaps the connectome (activation) and the scheduler (preemption); the
  fabric must not duplicate either — it routes *between* them.
- Metric-first discipline: fabric semantics are only real when they change a
  measurable decision (latency, drop rate, decay curves, preemption count).

## Where it lands

- Spike document `design/SIGNAL-FABRIC.md`; extends RFC-0002 semantics.
- Observatory (IDEA-0014) renders fabric pressure as a field.

## Code impact

- None until the spike: reuse the event bus as transport; the fabric is a
  policy layer on top, not a replacement bus.

## Next stage

Spike: routing policy + preemption semantics against the existing priority
table; verdict — adopt, hybrid (fabric over bus), or reject.
