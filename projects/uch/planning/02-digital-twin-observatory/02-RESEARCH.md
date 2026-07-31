# Phase 02 Research: Digital Twin + Cognitive Observatory

**Researched:** 2026-07-31
**Status:** Research complete — ready for planning
**Sources:** arXiv 2604.05119 (governance-aware agent telemetry), Langfuse positioning review, internal code audit (`src/`, 241+ modules)

---

## 1. The market gap (why this phase matters)

Langfuse-class products are excellent at **reconstructing** execution: traces,
spans, evaluations, prompts, observability, telemetry. Their intentional
boundary is that they do **not** attempt to be the persistent brain, the
workspace nervous system, or an evolving knowledge organism.

Two concrete gaps define this phase's differentiation:

| Question | Current tooling | This phase |
|---|---|---|
| What happened? | ✅ Traces/analytics | ✅ (existing, reused) |
| **What would happen if...?** | ❌ None (static graphs only) | **Digital Twin what-if projection** |
| **Why? / Should it have happened?** | ⚠️ Root-cause heuristics | **Observatory prescriptive layer** |
| **What should happen next?** | ⚠️ Suggestions | **Next-best-action with confidence + evidence** |
| **Should I intervene?** | ❌ None (read-only observability) | **Dry-run intervention surface** |

The governance-aware telemetry direction (arXiv 2604.05119) argues
observability must move toward **closed-loop enforcement**: telemetry that
not only describes behavior but *recommends and enforces better future
behavior*. This phase ships the *recommendation* half with an explicit
dry-run contract; enforcement is deliberately deferred (D-07) until the
recommendation loop accrues trust.

## 2. Internal audit — what already exists (reuse, do not rebuild)

| Capability | Module | Reuse in |
|---|---|---|
| Graph traversal (BFS/findPaths) | `kernel/storage/graph-store.ts` | Twin projection engine |
| Impact prediction | `cortex_kernel/reason-graph.ts` `predictImpact` (98-118) | Twin `simulateRemoval` |
| Transitive dependents | `coding/code-index.ts` `impactAnalysis` (509-540) | Twin `simulateChange` |
| Architecture structure | `workspace-brain/architecture-graph.ts` | Twin base graph |
| Workspace graphs (Phase 01) | `workspace-graphs/` (5 organs) | Twin inputs + observatory evidence |
| Descriptive analytics | `cognitive-plane/analytics/workspace-analytics.ts` | Observatory base |
| Proactive suggestions | `cognitive-plane/suggestions/suggestion-engine.ts` | Next-best-action candidates |
| Confidence calibration | `kernel/calibration/calibration.ts` (Brier/accuracy) | Twin + observatory confidence |
| Provenance/evidence | Phase 01 `provenanceProperties` contract | Every verdict |
| Grant/capability scoping | `control-plane/projections.ts` | What a client may simulate |
| Offline analysis | `cognitive-plane/dreaming/workspace-dreaming.ts` | Idle-time projection refreshes |
| Prediction accuracy tracking | `cognitive-brain/conscience.ts` | Evolution feedback loop |

## 3. Design constraints (locked)

1. **Deterministic core**: simulation and verdicts must run without LLM
   calls; any LLM layer sits behind the same interface (model-agnostic,
   matching Phase 01 organs' no-LLM-in-core rule).
2. **Frozen-state simulation**: twin never mutates live organs; projections
   run on an in-memory copy. Mutations flow one way (events → organs → twin).
3. **Provenance on every verdict**: `{ source, source_id, timestamp,
   reliability }` + confidence `{ value, method: 'process_reliability',
   calibration_history }` (Phase 01 contract).
4. **Zero new runtime dependencies** (current runtime deps: exactly 2 —
   `openai`, `@opentelemetry/api`).
5. **Dry-run only**: observatory `intervene` returns a proposal; enforcement
   requires explicit user confirmation (deferred auto-enforcement).
6. **Cap-guarded**: projection depth, node counts, and history bounded
   (Phase 01 maxNodes/maxCycles pattern).
7. **No regression**: suite baseline 98 files / 1,708 passing must hold.

## 4. Open questions (for the planner)

- OQ-1: Should `simulateRemoval` operate on the Phase 01 knowledge-graph,
  the workspace-brain architecture-graph, or a merged projection?
  (Recommended: architecture-graph as primary skeleton + knowledge-graph
  for evidence edges; merge is a read-only view.)
- OQ-2: Confidence composition — single scalar vs. per-question breakdown
  (coverage, calibration, historical accuracy of that subsystem)?
  (Recommended: breakdown object; scalar derived for CLI ergonomics.)
- OQ-3: Observatory `shouldItHaveHappened` baseline — compare against
  `prediction:made`/`prediction:failed` events already in the bus catalog?
  (Recommended: yes — the signal catalog already has the hooks.)
- OQ-4: Where does the twin attach in WorkspaceBrain — eager or lazy
  (Phase 01 established lazy for graph organs)?
  (Recommended: lazy, same rationale: fake-root test suite must not regress.)
- OQ-5: Does `intervene` propose executable commands (terminal-level) or
  only structured recommendations? (Recommended: structured only in this
  phase; execution surfaces are a later phase with their own trust model.)

## 5. Package legitimacy audit

No new packages required. All capabilities exist in-repo or in node:stdlib
(`node:crypto` for fingerprinting, `node:path`, `node:fs`). No install
surface → no supply-chain review needed for this phase.

---

*Phase: 02-digital-twin-observatory*
*Research complete: 2026-07-31*
