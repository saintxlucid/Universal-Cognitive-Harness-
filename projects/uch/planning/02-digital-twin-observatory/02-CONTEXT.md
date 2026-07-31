# Phase 02: Digital Twin + Cognitive Observatory — Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Source:** User vision statement ("Universal Cognitive Organism", 18-feature list) + Phase 01 completion (96% conformance)

<domain>
## Phase Boundary

Deliver the two features that define the platform's market gap versus
Langfuse-style agent-observability products — the move from "what happened"
to "what would happen / why / what should happen next":

1. **Workspace Digital Twin** — an internal simulation of the workspace that
   answers *what-if* queries ("what happens if I delete this service?") by
   projecting change across the graph/DNA layer, with confidence and
   provenance, BEFORE the change is made.
2. **Cognitive Observatory — Prescriptive Layer** — sits on top of the
   existing descriptive analytics and answers *why / should it have happened /
   what should happen next / should I intervene*, with per-query confidence
   and an intervention surface (recommendation, not enforcement, by default).

Both must reuse the Phase 01 `workspace-graphs/` organs + existing
`architecture-graph`, `code-index` impact analysis, `reason-graph`
predictImpact, and the control-plane `projections`/`event-governance`
machinery. Zero new runtime dependencies. No LLM calls in core simulation
logic (deterministic graph projection; optional LLM layer stays behind the
same interface, model-agnostic).
</domain>

<decisions>
## Implementation Decisions

### D-01: New subsystem location
- Create `src/digital-twin/` (simulation core) and `src/cognitive-plane/observatory/`
  (prescriptive analytics + intervention surface) — two cohesive subsystems.
- Locked: digital-twin must not import cognitive-plane observatory (twin is
  the projection engine; observatory is the policy/explanation layer).

### D-02: Reuse existing foundations, do not hand-roll
- Graph traversal: reuse `GraphStore` BFS/findPaths via the Phase 01 organs.
- Impact projection: reuse `reason-graph.ts predictImpact` semantics +
  `code-index.ts impactAnalysis` (transitive dependents).
- Descriptive base: `cognitive-plane/analytics/workspace-analytics.ts`.
- Confidence: `kernel/calibration` profile conventions (Brier/accuracy).
- Provenance: Phase 01 `provenanceProperties` contract (Law 4).
- Locked: no new runtime dependencies.

### D-03: What-if simulation model
- Deterministic structural projection: node removal/branch changes propagate
  along graph edges (touches/depends_on/references) with a frozen-state
  simulation (no mutation of live organs — simulation runs on an in-memory
  projected graph).
- Confidence = f(graph coverage, calibration, prediction history).
- `predictImpact`-style output: impacted nodes, paths, risk levels.
- Optional `llm` mode behind the same interface (model-agnostic; no LLM in
  the deterministic core).

### D-04: Observatory prescriptive layer
- `explain(event/decision)` → why-labels (root-cause candidates ranked by
  graph evidence), `shouldItHaveHappened` (deviation vs. prediction),
  `nextBestAction` (ranked suggestions from suggestion-engine + twin
  projections), `confidence`, `intervene(proposal)` → dry-run by default.
- Wired into the existing analytics report shape (additive, not breaking).

### D-05: Persistence contract
- Twin projections + observatory verdicts persist as JSON snapshots under
  `.uccp/persist/` following the Storable pattern (Phase 01 manifests).

### D-06: Tests
- One vitest file per module; deterministic, LLM-free; temp-dir lifecycle;
  suite must not regress below the 1,708 passing baseline.

### D-07: Scope limits
- No enforcement (auto-apply) of interventions — recommendations only.
- No cross-workspace simulation (deferred to collective-intelligence phase).
- No full Dream Engine completion in this phase.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & index
- `docs/organism-architecture.md` — five nervous systems (Observatory sits in
  the Cognition System; Twin spans Perception→Cognition)
- `docs/UCH-COMPLETE-INDEX.md` — full project map
- `docs/vision-conformance-2026-07-31.md` — post-Phase-01 state (96%)
- `design/ARCHITECTURE.md` — platform vision

### Reusable foundations (MUST reuse, D-02)
- `src/workspace-graphs/*.ts` — Phase 01 organs (knowledge/decision/task
  graphs, evolution history, DNA)
- `src/workspace-brain/architecture-graph.ts` — architecture nodes/edges
- `src/cortex_kernel/reason-graph.ts` — `predictImpact` precedent (lines 98-118)
- `src/coding/code-index.ts` — `impactAnalysis` (lines 509-540)
- `src/cognitive-plane/analytics/workspace-analytics.ts` — descriptive base
- `src/cognitive-plane/suggestions/suggestion-engine.ts` — next-action candidates
- `src/control-plane/projections.ts` — capability/authority intersection (what
  the twin may simulate per grant)
- `src/kernel/calibration/calibration.ts` — confidence scoring conventions
- `src/cognitive-plane/persistence/persistence-engine.ts` — Storable

### Wiring targets (D-03, D-04)
- `src/workspace-brain/workspace-brain.ts` — attach points (brain.twin,
  brain.observatory), persisted via persistWorkspace/loadWorkspace
- `src/cognitive-plane/index.ts` — observatory exports
- `src/index.ts` — public API exports

### Test conventions
- `src/__tests__/workspace-graphs-*.test.ts` — Phase 01 organ test style
- `src/__tests__/workspace-brain.test.ts` — brain wiring test style
- `src/__tests__/expanded-features.test.ts` — analytics/suggestions style
</canonical_refs>

<specifics>
## Specific Ideas

- Twin query surface: `simulateRemoval(nodeId)`, `simulateChange(nodeId,
  delta)`, `simulateBranch(path)` → `{ projection, confidence, impacted[],
  paths[], risk, provenance }`. Deterministic, frozen-state, cap-guarded.
- The twin is a *reading* layer over live organs: it never mutates them
  (frozen projection copy); mutations flow one way (events → organs → twin
  recomputes on demand).
- Observatory verdict shape: `{ question, answer, evidence[], confidence,
  alternatives[], dryRun: true }` — the arXiv 2604.05119 "closed-loop
  enforcement" gap is addressed by the dry-run + explicit confirm surface,
  NOT by auto-enforcement (D-07).
- Prediction history feeds back into the Evolution System (prediction
  accuracy tracked per subsystem — "Prediction Accuracy" health dimension).
- Model-agnostic: every LLM-capable path behind the same interface with a
  deterministic fallback, matching the Phase 01 organs' no-LLM-in-core rule.
</specifics>

<deferred>
## Deferred Ideas

- Cross-workspace simulation / collective intelligence (needs provenance +
  permission model from a later phase).
- Dream Engine (Layer 7) completion.
- Auto-enforcement of observatory interventions (policy-driven, after
  dry-run trust accrues).
- Full what-if on historical replay ("what if we had done X last sprint").
</deferred>

---

*Phase: 02-digital-twin-observatory*
*Context gathered: 2026-07-31 after Phase 01 execution*
