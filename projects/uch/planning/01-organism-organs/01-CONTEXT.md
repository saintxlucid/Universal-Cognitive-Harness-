# Phase 01: Organism Organs — Graph & DNA Layer — Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Source:** Vision conformance pass (`docs/vision-conformance-2026-07-31.md`) + user vision statement

<domain>
## Phase Boundary

Deliver the five missing "organism organs" of the UCH Workspace Brain — the
13% gap between the Universal Cognitive Harness vision and shipped code:

1. **Workspace Knowledge Graph** — workspace-scoped concept/artifact graph
2. **Workspace Decision Graph** — decisions as nodes with cause-effect, alternative, supersede edges
3. **Workspace Task Graph** — tasks as nodes with dependency edges, status transitions, file + decision linkage
4. **Workspace Evolution History** — persisted history of evolution cycles with outcomes
5. **Workspace DNA** — per-workspace encoded identity/culture fingerprint with mutation tracking

All five must be wired into the existing `WorkspaceBrain` and fed by the
existing neural event bus (`git:commit`, `file:saved`, `build:finished`,
`error:occurred`, `test:failed`), following the established `GraphStore` +
`Storable` persistence patterns.
</domain>

<decisions>
## Implementation Decisions

### D-01: New subsystem location
- Create a cohesive `src/workspace-graphs/` subsystem for the five structures.
- Locked: do NOT spread them across existing directories; they are one
  cohesive "graph + DNA" layer owned by `WorkspaceBrain`.

### D-02: Reuse existing foundations, do not hand-roll
- Reuse `src/kernel/storage/graph-store.ts` (`GraphStore`) as the base graph container.
- Reuse `src/cognitive-plane/persistence/persistence-engine.ts` (`Storable`,
  `writeSnapshot`, `readSnapshot`, `mapToRecord`, `recordToMap`) for persistence.
- Reuse branded types from `src/shared/branded-types.ts` where applicable.
- Locked: no new runtime dependencies (UCH runtime dependency is exactly 1: `openai`).

### D-03: Wire into WorkspaceBrain
- `src/workspace-brain/workspace-brain.ts` composes the five new structures
  alongside genome, identity, world-model, architecture-graph, timeline, health.
- Locked: new organs are attach points of the existing brain, NOT new entry points.

### D-04: Feed from the neural event bus
- Subscribe to existing signal/event types: `git:commit`, `file:saved`,
  `build:finished`, `test:failed`, `error:occurred`, `pr:created`, `review:requested`.
- Locked: no new event types; the 16-event universal hook surface is complete.

### D-05: Persistence contract
- Each organ implements `persist(filePath)` / `load(filePath)` following the
  Storable pattern used by the 15 existing stores (see `UCCP-persist-load-SUMMARY.md`).
- Persistence root: `.uccp/persist/` under the project.

### D-06: Tests
- One vitest file per organ following `src/__tests__/*.test.ts` conventions
  (deterministic, no live LLM calls). Existing suite: 1,251 passing tests —
  must not regress.

### D-07: Scope limits
- IDE driver deepening, Ollama runtime profile, issue/sprint/doc ingestion
  stores, and cross-project graphs are P1 — OUT OF SCOPE for this phase.
</decisions>

### the agent's Discretion
- Exact node/edge type shapes for each graph (fields, relation kinds).
- How Workspace DNA is encoded (hash fingerprint scheme, mutation event shape).
- Whether the five organs are one module each or split types/index files.
- Exact event-bus subscription wiring inside `WorkspaceBrain`.

### Deferred Ideas (OUT OF SCOPE)
- Per-IDE driver adapters (VS Code/Cursor/JetBrains/Neovim/Zed).
- Ollama/local-model runtime profile.
- Open Issues / Current Sprint / Design Documents stores.
- Cross-project (Related Projects) graph.
- Dream Engine (Layer 7) completion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & index
- `docs/UCH-COMPLETE-INDEX.md` — full project map (241 modules, every subsystem's purpose)
- `docs/vision-conformance-2026-07-31.md` — gap list this phase closes (section 2.1)
- `docs/organism-architecture.md` — the five nervous systems + four pillars
- `design/ARCHITECTURE.md` — platform vision

### Reusable foundations (MUST reuse, D-02)
- `src/kernel/storage/graph-store.ts` — GraphStore (nodes/edges/adjacency)
- `src/cognitive-plane/persistence/persistence-engine.ts` — Storable, writeSnapshot/readSnapshot/mapToRecord/recordToMap
- `src/shared/branded-types.ts` — branded types
- `src/kernel/storage/semantic-graph.ts` — concept graph (memory-internal analog)
- `src/workspace-brain/architecture-graph.ts` — closest existing analog for a workspace graph organ

### Wiring targets (D-03, D-04)
- `src/workspace-brain/workspace-brain.ts` — composer to extend
- `src/nervous-system/signal.ts` — event/signal catalog (~55 types; subscribe, do not add)
- `src/event-bus/neural-event-bus.ts` — pub/sub used by WorkspaceBrain
- `src/cognitive-plane/decisions/decision-log.ts` — DecisionLog (list; the graph organ must NOT duplicate its data, only add edges)
- `src/cognitive-plane/scheduler/task-scheduler.ts` — TaskScheduler (queue; Task Graph adds dependency edges + linkage)
- `src/cognitive-plane/evolution/evolution-engine.ts` — EvolutionEngine (cycle source for Evolution History)

### Persistence pattern reference
- `UCCP-persist-load-SUMMARY.md` — the exact Storable pattern applied to 15 stores

### Existing organ analog (for DNA)
- `src/kernel/concept-genome/concept-genome.ts` — ConceptDNA (per-concept; Workspace DNA is the per-workspace generalization)

### Test conventions
- `src/__tests__/workspace-brain.test.ts` — WorkspaceBrain test style
- `src/__tests__/organism-features.test.ts` — organism-level test style
</canonical_refs>

<specifics>
## Specific Ideas

- The five organs complete the "digital organism" list from the vision:
  Genome ✅ Identity ✅ Memory ✅ World Model ✅ Timeline ✅ **Knowledge Graph ❌
  Skill Library ✅ Architecture Graph ✅ **Decision Graph ❌ **Task Graph ❌
  **Evolution History ❌ Health ✅ **DNA ❌ (asterisks = this phase).
- Workspace DNA should expose a compact fingerprint (e.g., hash of genome +
  conventions + taste + recent decisions) so "switching projects = switching
  brains" has a machine-readable identity token.
- Graph organs should emit provenance-bearing edges (Law 4: Evidence Over
  Assertion; the kernel already has Provenance/Confidence types).
- All organs must be model-agnostic (no LLM calls in organ logic).
</specifics>

<deferred>
## Deferred Ideas

- Per-IDE driver adapters (VS Code/Cursor/JetBrains/Neovim/Zed).
- Ollama/local-model runtime profile.
- Open Issues / Current Sprint / Design Documents stores.
- Cross-project (Related Projects) graph.
- Dream Engine (Layer 7) completion.

</deferred>

---

*Phase: 01-organism-organs*
*Context gathered: 2026-07-31 via vision conformance pass*
