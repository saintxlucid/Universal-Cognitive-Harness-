# IDEA-0101 — Living Architecture (The Alive Projection)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 compatibility-layer intake (round 14) — Layer
  10 of the ten-layer vertical integration model: "instead of static
  diagrams, every component publishes its state. The architecture
  diagram becomes alive: you click a service and see health,
  dependencies, recent architectural decisions, active tasks, related
  discussions, open risks, confidence. Documentation becomes a live
  projection of the system." The intake's own verdict positions this
  alongside the observatory as the view layer over the event ledger.
- **Related:** IDEA-0014 (cognitive observatory — live MRI view;
  prescriptive layer flagged as Phase-02 frontier), src/cognitive-
  plane/health/health-registry.ts (per-organ health states, WS-E SMART
  metrics), src/workspace-graphs/ (architecture-graph, decision-graph,
  task-graph, evolution-history — the structural substrate),
  src/cognitive-plane/decisions/decision-log.ts, src/connectome/
  wiring.ts (activation-ordered neighborhoods), design/LIVE-COGNITIVE-
  STATE.md (the per-organism state document — the per-node analog),
  src/cognitive-plane/trust/trust-engine.ts (confidence/trust scores),
  IDEA-0071 (cognitive SLOs — the health numbers' semantics),
  src/cognitive-plane/replay/uer-graph.ts (causal edges between nodes)

## Motivation

The corpus's nine lower layers of the intake's model are executed:
identity (workspace manifest), shared cognitive state (Live Cognitive
State + attach), intent synchronization (intent objects + task graphs),
execution fabric (ADR-004 + scheduler), cross-model cognition (fabric
routing + consensus), universal memory (model-independent memory
manager), semantic git (workspace graphs + UER + archaeology + time
machine), universal debugging (ADR-002 replay), cognitive time travel
(cognitive-time-machine). Layer 10 is the _projection_: every artifact
of those layers is queryable, but nothing fuses them into one
navigable surface — click a component, see its health, its
dependencies, its recent decisions, its active tasks, its open risks,
its confidence. The intake's claim: the architecture diagram is not a
drawing; it is a live projection of the system's state graph.

## The corpus cannot cover it because

- The data exists per-store: health-registry knows health,
  architecture-graph knows dependencies, decision-graph/decision-log
  know decisions, task-graph knows active tasks, trust/calibration
  know confidence, connectome knows proximity. No component fuses them
  **per node** into a single view — the observatory (IDEA-0014) is
  scoped to a live MRI of the organism, not a per-component projection
  of the workspace's architecture.
- The per-organism Live Cognitive State document is exactly the fused
  shape — but for the whole organism, not per architecture node; the
  per-node analog ("what is this service believing/doing/risking right
  now") has no schema.
- Nothing renders the workspace-graphs as a navigable, clickable,
  time-aware surface (the intake's "documentation becomes a live
  projection"); docs remain static prose (ARCHITECTURE.md, organism-
  architecture.md).

## Proposal sketch

- **Node state document**: `uch.node-state.v1` — the Live Cognitive
  State shape generalized to a graph node: `{node, health (WS-E),
dependencies (architecture-graph, with drift vs code reality),
decisions (decision-graph, recent), tasks (task-graph, active),
risks (risk register / failure taxonomy), confidence (trust engine +
calibration), focus (connectome neighborhood)}` — every field maps
  to an existing store; the document is a projection, not new state.
- **View layer**: one renderer (HTML report / CLI `uch diagram
<node>` / MCP tool) that walks the architecture graph and emits a
  node-state document per node; the "living" property comes from
  regeneration on every relevant event (file:saved, decision:recorded,
  task:completed — the event bus already fires these) and time-travel
  affordances (compare node-state at t0 vs t1 via the time machine).
- **Prescriptive upgrade**: the view is read-only; the prescriptive
  layer (what to do next, intervene) remains the observatory's
  Phase-02 frontier — this note only claims the projection.
- **Trust boundary**: the projection shows _UCH's recorded state_,
  never external application internals (Red zone per IDEA-0097).

## Risk assessment

- Surface bloat: a projection is only useful if it reduces to
  questions — the renderer must answer "what changed for this node
  since yesterday" before it answers "everything".
- Staleness: a "living" view that lags is worse than a static diagram —
  regeneration must be event-driven and cheap (incremental per-node).
- Scope: view layer only; the fusion is the novelty, not new stores.

## Where it lands

- `src/cognitive-plane/projection/` (node-state assembler + renderer),
  MCP tool + CLI, docs generated from the projection where feasible.

## Code impact

- None until designed; seeds are health-registry, workspace-graphs,
  decision-log, trust-engine, connectome, Live Cognitive State.

## Next stage

- Prototype: assemble `uch.node-state.v1` for one real node (e.g. the
  engineering-intelligence organ) from the existing stores; assert the
  document's fields against each store's data; render one HTML view.
