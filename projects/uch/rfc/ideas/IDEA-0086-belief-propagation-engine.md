# IDEA-0086 — Belief Propagation Engine

- **Status:** Prototype (2026-08-01) - G1 register + design doc +
  reference module with tests; NOT wired into any gate (SOP-08
  Prototype discipline).
- **Origin:** 2026-08-01 cognitive-microarchitecture intake (round 12) —
  "Confidence Propagation: If Evidence A supports B, then B confidence
  updates automatically. Trust Propagation: Trust flows through
  relationships. Contradiction Propagation: One contradiction ripples
  through dependent beliefs."
- **Related:** src/kernel/activation/activation-field.ts (confidence ×
  0.9 per propagation hop — activation propagates, belief does not),
  src/kernel/activation/connectome.ts (activation BFS + per-hop decay),
  src/cognitive-plane/memory/scientific-memory.ts ('contradicted'
  certainty state), src/kernel/types/provenance.ts (EpistemicStatus),
  src/kernel/constitution/epistemology.ts, CIR optimizer's
  contradiction-elimination pass, src/cognitive-plane/replay/uer-graph.ts
  (influence-path queries — the graph exists), decision law
  (IDEA-0034, confidence + risk), RFC-0005 instability (I(b) =
  confidence − evidence mass), Law 5 (trust decay), Law 4 (evidence
  over assertion — "prevents hallucination propagation")

## Motivation

Confidence is everywhere and nowhere. Every concept carries a
confidence value; epistemology classifies it; the activation field
decays it per hop. But no engine propagates belief change along
support edges: when a memory that supports a conclusion is
contradicted, the conclusion's confidence does not move. Trust
decays (Law 5) but never flows through relationships. The intake's
claim is that cognition needs belief structure — a graph over
memories/concepts with support and attack edges — so that confidence,
trust, and contradiction update automatically, the way a database
maintains referential integrity. UER already provides the causal
graph; this is its belief-semantic layer.

## The corpus cannot cover it because

Propagation is mechanical (activation spreading) but not semantic:
activation-field's `confidence * 0.9` decay treats every edge alike
and never recomputes a target's confidence from its evidence mass.
Contradiction detection exists (CIR pass at compile time; 'contradicted'
certainty at memory level) but there is no ripple — no affected-set
computation, no dependent-belief invalidation, no resolution
operation. Trust scoring exists (plugin trust, IDEA-0080) as
independent scorecards; nothing composes trust along chains. The
decision law (IDEA-0034) and instability (RFC-0005) are the right
math but are invoked at evaluation points, not maintained as state.

## Proposal sketch

- Belief graph: nodes = memories/concepts with (confidence, evidence
  mass), edges = support / attack / trust, edges tagged with the
  provenance chain (IDEA-0035/lineage-service).
- Propagation rules: confidence of a node = f(own evidence, support
  edges' confidence, attack edges, decay over hops); trust flows along
  relationship edges with Law-5 decay; updates are ledgered and
  versioned (causal ordering per IDEA-0088).
- Contradiction ripple: a contradiction computes its affected set via
  reverse support edges, re-evaluates each member with the belief
  algebra (A + evidence B → C), and emits `belief:changed` events —
  vetoes reuse RFC-0005 instability.
- Ties: decision-law utilities consume propagated confidence; the
  ripple is the mechanism behind psychology's dissonance compensation
  (IDEA-0092).

## Risk assessment

- Cascades: unbounded propagation must be bounded by hop limits and
  energy per tick (backpressure, IDEA-0085); large affected sets are
  queued as background work, not synchronous.
- Overwrite: propagated values never overwrite direct evidence —
  direct observation always outranks inference (Law 4).

## Where it lands

- `src/cognitive-plane/belief/` new module; reads connectome + UER
  edges; emits belief events on the bus.

## Code impact

- None until the propagation rules are specified; connectome +
  activation-field + scientific-memory are the seed inputs.

## Next stage

- Seed the belief graph from connectome/UER edges; wire
  belief:changed events onto the bus.
