# IDEA-0138 — Systems Thinking Engine

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-21 intake — "this deserves to become one
  of the largest engines": Feedback Loops, Stocks, Flows, Delays,
  Leverage Points, Emergence, Dependencies, Bottlenecks, Positive
  Loops, Negative Loops, Causal Graphs, Dynamic Simulation — essential
  for organizations, cities, AI systems, businesses, games, and
  ecosystems.
- **Related:** IDEA-0047 (UER — causal graph, post-hoc), IDEA-0086
  (belief propagation — confidence flow over support/attack edges),
  connectome (activation), IDEA-0015 (engineering gravity — debt as
  attraction field), IDEA-0012 (digital twin — scenario simulation),
  IDEA-0050 (fabric — models as artifacts), IDEA-0057 (CQL), IDEA-0133
  (reality graph — models as derived views)

## Motivation

Systems modeling as an engine: represent a domain as stocks, flows,
delays, and feedback loops; find leverage points; simulate dynamics.
The claim: this is a first-class cognitive operation family, not a
framework — it becomes essential exactly where feedback structure is
the problem.

## The corpus cannot cover it because

UER is a causal graph of what happened (post-hoc, static); belief
propagation flows confidence over semantic edges but models no
dynamics (no accumulation, no rates, no delays); IDEA-0015 models debt
as attraction but not stocks and flows; the digital twin (IDEA-0012)
simulates scenarios over projected state, not system-dynamics models.
No stocks / flows / delays / leverage-points modeling exists —
'leverage' is effectively grep-absent from src, and the modeling-family
gap is consistent with the Innovation family gap (IDEA-0132).

## Proposal sketch

- Systems model as a first-class artifact: stocks (accumulators), flows
  (rates), delays, feedback loops (positive / negative), causal edges
  (UER semantics); loop detection over existing graphs is the first
  slice (workspace-graphs + UER already carry the edges).
- Leverage-point analysis over the loop structure (Meadows-style
  ordering: parameters < flows < rules < goals < paradigm) — ranked
  intervention candidates with expected amplification.
- Dynamic simulation: the model simulates using the IDEA-0012 / IDEA-
  0013 machinery — scenarios, sensitivity, counterfactuals over the
  systems model, not just projected state.
- Relationship: models live in the fabric (IDEA-0050); the causal spine
  reuses UER (IDEA-0047) edge semantics; belief propagation (IDEA-0086)
  flows over model edges; models are derived views (IDEA-0133), never
  the primary representation.

## Risk assessment

- Modeling overhead: adopt only where feedback structure is the
  problem; a systems model for every task is cargo cult. Anchor: models
  are derived views and opt-in.
- Duplication with UER: UER records what happened; the systems model
  explains and projects — the delta is dynamics (stocks/flows/delays),
  not new causal storage.

## Where it lands

New engine over `src/workspace-graphs/` + UER; simulation reuses
IDEA-0012; first target = feedback-loop detection over workspace-graphs.

## Code impact

None until the loop-detection prototype; loop detection over existing
graphs needs no new storage.

## Next stage

Prototype feedback-loop detection over workspace-graphs + UER; then
leverage-point ranking; then stocks/flows/delays modeling with the
IDEA-0012 simulator.
