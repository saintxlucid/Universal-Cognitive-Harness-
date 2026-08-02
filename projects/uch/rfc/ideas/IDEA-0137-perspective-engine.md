# IDEA-0137 — Perspective Engine

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-21 intake — "the same underlying reality
  can be represented in radically different ways without changing the
  reality itself": Business / Engineering / Financial / Psychological /
  Legal / User / Ethical / Systems / Network / Timeline / Graph /
  Mathematical / Story views. "Sometimes the solution appears simply
  because you changed the representation."
- **Related:** VISION sec 1 (truth vs representation), IDEA-0133
  (reality graph — views are render targets), IDEA-0056 (COM), RFC-0004
  (CIR — one representation), ProjectionEngine (grant containment —
  different domain), multiAgentConsensus (multi-agent, not multi-view),
  connectome

## Motivation

The Truth/Representation philosophy as an operation: any problem state
can be re-rendered into a different view, and representation change is
itself a cognitive move. The claim: a Perspective Engine that
automatically re-renders a problem across views — sometimes the
solution is visible in only one of them.

## The corpus cannot cover it because

ProjectionEngine projects workspace state per grant (authority
semantics — what an agent may see, not how to see it); connectome
activation re-weights association neighborhoods; multiAgentConsensus
asks multiple agents, not multiple renderings of one state; CIR is a
single instruction representation. No artifact re-renders the same
reality into business / engineering / financial / legal / timeline /
graph / narrative views.

## Proposal sketch

- Perspective = renderer: each view declares what node kinds and
  relations it surfaces and its transformation (graph → timeline →
  table → narrative → ...), deterministic where the source is
  deterministic.
- Perspective registry: 13 named views as first-class render targets;
  switching views is a cognitive operation (IDEA-0135's Translate
  primitive); with the reality graph (IDEA-0133) views are exports of
  one substrate; without it, transformers over existing artifacts.
- Integrity rule: every view round-trips — two views describe the same
  reality (VISION sec 1), so cross-view contradiction is an anomaly
  signal for the truth engine, not a permitted divergence.

## Risk assessment

- View theater: views must be transformations over the same reality
  (round-trip test), not re-descriptions — otherwise the engine
  multiplies representations instead of illuminating one.
- Scope: earliest viable prototype needs no reality graph — timeline /
  graph / table renders over the ADR-002 trace ledger are possible
  today.

## Where it lands

Extension of IDEA-0133 render targets + CQL (IDEA-0057); the ADR-002
ledger is the first data source.

## Code impact

None until a render prototype; timeline / graph / table renders over
the ledger are the P1 slice.

## Next stage

Prototype timeline / graph / table renders over the ADR-002 ledger;
add the narrative (LLM) view; then register the full 13-view catalog.
