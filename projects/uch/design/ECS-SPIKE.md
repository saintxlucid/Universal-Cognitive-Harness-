# ECS-SPIKE.md — Cross-type queries vs a Bevy-style ECS (decision record)

- **Status:** Spike decision record — WS-H of COGNITIVE-KERNEL-SHIPPING.md / GAP-CLOSURE-PLAN §8
- **Date:** 2026-08-01
- **Scope:** Decision only. No code was written or changed; the verdict below is
  evidence-driven from the `src/` tree, not metaphor appeal.
- **Question:** Should UCH replace or augment its typed object-store model
  (entities = episodes / memories / beliefs / concepts / traces, components =
  behavior data, systems = processors) with a Bevy-style ECS to serve the
  cross-type query patterns the kernel actually needs?

## 1. Intent

GAP-CLOSURE-PLAN Phase 6 (§8) and COGNITIVE-KERNEL-SHIPPING WS-H contract:
enumerate the concrete cross-type query patterns UCH needs (5–8, with file
evidence), assess the current object-store model against a Bevy-style ECS for
those patterns, and produce an adopt / reject / hybrid decision with effort
estimate and risks. No ECS code beyond short illustrative sketches.

## 2. Query patterns the kernel actually needs (8, evidence-cited)

### P1 — Point-in-time belief snapshot: "all open hypotheses across all Episodes touching file X"

Reconstruct what the organism believed at time *t* — decisions, hypotheses,
verifications, errors, lessons — plus files touched and tools used.

- **Evidence:** `src/cognitive-plane/replay/cognitive-time-machine.ts` —
  `beliefsAt(t)` scans `ledger.getByTimeRange(new Date(0), at)`, re-derives
  belief kind from event type via the `BELIEF_KIND_BY_EVENT` string map, and
  probes up to three attribute keys per span (`payload.path` / `payload.file` /
  `file.path`) to compute `files_touched`. Optional `ClaimSource` join appends
  confidence-tagged claims. Tests: `src/__tests__/cognitive-time-machine.test.ts`.
- **Shape:** cross-type projection (events → belief entries) over one store,
  filtered by kind tag × time, joined with an external claim source.

### P2 — Cross-store state diff: "what changed between two moments across traces, decisions, and signals"

- **Evidence:** `src/cognitive-plane/diff/cognitive-diff.ts` — `CognitiveDiff`
  joins `TraceLedger` + `DecisionLog` + `SignalStore` with three separate
  `getByTimeRange` calls and hand-rolled set-diffs (`diffTraces`,
  `diffDecisions`). Line 55 reaches into private state —
  `[...this.ledger['traces'].values()]` — because the ledger has no bulk-export
  API. Used by `src/cognitive-recorder/`, tests in `expanded-features.test.ts`.
- **Shape:** temporal join across three heterogeneous stores with per-type
  change detection — the archetypal ECS "query multiple component types".

### P3 — Heterogeneous retrieval: "find relevant memory across concepts, episodes, and graph edges, score, merge, rank"

- **Evidence:** `src/kernel/retrieval/fusion.ts` — `RetrievalFusion` queries
  `SemanticGraph` + `EpisodicStore` and returns `ScoredResult` with
  `content: Concept | Episode | Edge` (a 3-type union) ranked by provenance
  factor + recency. `computeProvenanceFactor` reads component-like fields
  (reliability, confidence, entrenchment, epistemic_status, access_count) — but
  only off `Concept`; `Episode` has no such components.
- **Shape:** tag+similarity query across types, per-type scoring, merged ranking.

### P4 — Workspace knowledge join: "which commits touched this file, and what failures / PRs / reviews relate?"

- **Evidence:** `src/workspace-graphs/knowledge-graph.ts` +
  `src/kernel/storage/graph-store.ts` — nodes carry stringly-typed ids
  (`file:${path}`, `commit:${hash}`, `failure:${id}`, `pr:${id}`, `review:${id}`)
  in one SQLite `GraphStore`; queries via `findNodesByType`, `bfs`, `findPaths`,
  `searchNodes` (LIKE over JSON-serialized properties). Tests:
  `src/__tests__/workspace-graphs-knowledge.test.ts`.
- **Shape:** relational join on type tag + path property across node kinds.

### P5 — Episodic × concept join: "all episodes mentioning concept C" + access-frequency analysis

- **Evidence:** `src/kernel/storage/episodic-store.ts` — `concept_index:
  Map<string, string[]>` is hand-maintained at `append()`; `getByConcept(id)`
  serves the join; `getAccessFrequency(since)` scans ALL episodes and aggregates
  per concept. `src/kernel/cognitive-kernel.ts` (lines 276–288) exposes the
  store's query menu (`getRecent`, `getBySession`, `getByTimeRange`,
  `getByConcept`).
- **Shape:** entity→related-entity join via a secondary index + aggregation.

### P6 — Engineering review: "score a change against 150 concepts across 10 tiers, apply laws, compose with judgment/critique/plan"

- **Evidence:** `src/engineering-intelligence/evaluator.ts` (domains = Tier
  I–X registries, `src/engineering-intelligence/domains/`), enriched from the
  event bus (`enrichment/engineering-enrichment.ts`), and composed by
  `src/executive-brain/executive-brain.ts` `evaluateChange()` (lines 228–260):
  judgment + critique + engineeringReview + planner in one assessment.
- **Shape:** read-mostly pipeline over static registries — a fixed processor,
  not an ad-hoc query.

### P7 — Connectome activation: "spread activation from a cue across linked cognition"

- **Evidence:** `src/connectome/wiring.ts` — `activate(cue)` BFS with per-hop
  decay over opaque string node ids (`problem-type:…`, `framework:…` — see
  `src/exoskeleton/exoskeleton.ts` wireFrameworkConnectome). `findConnection` is
  a linear scan of all edges; `checkIntegrity` full-scans components. Nodes
  cannot resolve back to Episodes/Beliefs/Concepts without an external layer.
- **Shape:** graph-traversal query over cross-type edges, activation as edge
  component.

### P8 — Epistemic elevation eligibility: "which memory objects qualify for the next DIKW tier?"

- **Evidence:** `src/kernel/epistemic/elevation-engine.ts` — `MemoryObject`
  aggregates tier, context_score, corroboration_count, `InquiryContract`,
  last gate result; `attemptPromotion` is a 5-gate processor; the contract in
  `inquiry-contract.ts` is explicitly "the cross-cutting evidentiary metadata
  contract" any organ's claims must attach. `getStatus()` aggregates by tier.
- **Shape:** system over one entity type with many behavioral facets +
  cross-organ evidence contract.

## 3. Current model — what it is

Typed classes owning their data + query methods, each `Storable`:

- `TraceLedger` (in-memory Maps + child-span tree), `DecisionLog`,
  `SignalStore`, `EpisodicStore` (episodes + hand-maintained sparse/temporal/
  concept indexes), `SemanticGraph`, `GraphStore` (SQLite nodes/edges),
  `Connectome`, `cognitive-recorder` EventLedger, `workspace-graphs` (5 graph
  organs), `neural-fs` (belief/concept/experience/goal/skill/… stores),
  `engineering-intelligence` registries, elevation engine, persistence via
  `Storable` + snapshots (`cognitive-plane/persistence/persistence-engine.ts`).
- Types are strict: branded ids where needed, `noUncheckedIndexedAccess`,
  e.g. `Concept` (`src/kernel/types/concept.ts`) already carries component-style
  fields (provenance, confidence, entrenchment, epistemic_status, access_count).

## 4. Assessment: current model vs ECS for these patterns

### Where the current model is genuinely awkward

1. **Cross-type joins are hand-written per consumer.** P2 joins three stores
   with three API calls + manual set-diff; P1 re-derives tags from event-type
   strings and probes attribute keys; P7's edges reference opaque ids. Every
   new cross-type query means new application-code glue.
2. **Encapsulation already broke once.** P2 uses `ledger['traces']` (private
   state) — a symptom of stores lacking bulk/query surfaces for joins.
3. **Query-by-tag is stringly-typed.** `findNodesByType('artifact')`,
   `BELIEF_KIND_BY_EVENT`, `file:`/`commit:` id prefixes — tags are strings,
   not typed component queries. Typos and shape drift are runtime errors.
4. **Secondary indexes are hand-maintained per store.** `EpisodicStore`'s
   `concept_index` is the only cross-reference index; P4/P5/P7-type joins
   otherwise scan. A component-tag index would serve P1/P4/P5 directly.
5. **Duplicated query surface.** `getByTimeRange` exists in TraceLedger,
   EpisodicStore, DecisionLog, and EventLedger with identical filter+sort
   semantics — four copies of one query.

### Where ECS would add overhead with no benefit

1. **Scale doesn't justify archetype storage.** ECS pays off at 100k+ entities
   with cache-friendly iteration and parallel systems. UCH corpora are small:
   `GraphStore` caps at 10k nodes, all other stores are in-memory Maps; every
   pattern above is served by O(N) scans in milliseconds.
2. **It would duplicate the write model.** Law 12 (Reversibility) already makes
   the OTel trace ledger the append-only source of truth; P1/P2 are read models
   over it. An ECS world would be a second write model to keep consistent with
   the ledger — more state to corrupt, no new guarantee.
3. **Persistence is settled.** `Storable` + snapshots + SQLite are implemented,
   tested (~2,200 tests), and versioned. ECS worlds serialize poorly (archetype
   tables + component blobs); adoption means a parallel persistence layer and a
   migration of every snapshot format.
4. **Type discipline erodes.** `noUncheckedIndexedAccess`, branded ids, and
   typed interfaces are the house style (`Concept` is the proof). ECS
   component storage is `Map<ComponentId, unknown>`-shaped — the strictness
   that caught real bugs here would move into runtime validation.
5. **Systems already exist.** The event bus (`neural-event-bus.ts`) already
   decouples processors (engineering-enrichment subscribes to git/file/test
   events; exoskeleton wires connectome links from framework events); class
   processors (SleepCycle, ElevationEngine, ExecutiveBrain) already play the
   "system" role. ECS's scheduler adds a second execution model for zero
   scheduling benefit at this scale.
6. **Nothing is blocked.** All 8 patterns are implemented and green today. ECS
   is a solution in search of a problem the current code has not hit.

## 5. Decision: hybrid (reject ECS runtime, adopt the query discipline)

**Reject** the Bevy-style ECS runtime (world, archetypes, component storage,
system scheduler, ECS persistence) as the storage model for UCH cognition.

**Adopt** the one ECS idea the evidence supports — typed, tag-based, cross-type
*queries* — as a thin read-model layer over the existing stores:

- A **typed query facade** (`CognitiveQuery`) exposing the 8 patterns as named,
  typed operations (e.g. `beliefsTouching(path, at)`, `stateDiff(from, to)`,
  `retrieve(text, {kinds})`) implemented ONCE over the existing stores, instead
  of per-consumer glue. Precedent already exists: `RetrievalFusion` is exactly
  this for P3.
- A **write-through component-tag index registry** (file→span ids,
  beliefKind→entry ids, claim→evidence ids) fed at write time by the stores or
  the event bus — the P5 `concept_index` pattern generalized. Indexes are
  derived data; the ledger/stores remain the source of truth (Law 12).

Illustrative sketch (NOT an implementation — the spike's contract):

```ts
// Today (P1/P2): per-consumer glue, three stores, three time-range APIs.
const spans  = ledger.getByTimeRange(from, to);            // TraceLedger
const decs   = decisionLog.getByTimeRange(from, to);       // DecisionLog
const sigs   = signalStore.getByTimeRange(from, to);       // SignalStore
// ...then hand-rolled set-diffs per type, private-state hacks in places.

// Hybrid target (same stores underneath):
const diff = query.stateDiff({ from, to });                // one typed op
const open = query.beliefsTouching('src/db.ts', now);      // index-backed
```

No store is rewritten; `Storable` snapshots, SQLite graphs, and the trace
ledger stay exactly as they are. The facade and indexes are new additive
modules with their own tests — consistent with WS conventions (additive files
only, no edits to wave-owned files).

## 6. Effort estimate and risks

- **Hybrid (recommended):** ~5–8 engineer-days — facade types + index registry
  + 2–3 pattern ports (P1, P2) as proof, with scoped vitest tests.
- **Full ECS adoption:** 20–30+ days — rewrite 10+ stores + persistence
  migration + port of ~2,200 tests and every consumer across 145+ test files,
  with high regression risk and collision risk against in-flight waves
  (dozens of dirty files are wave-owned today).

**Risks (hybrid):** facade becomes a god-module (mitigate: named ops only,
read-model-only rule, no write path); index staleness (mitigate: write-through
at stores or event-bus subscriptions — the bus already carries `file:saved`,
`git:commit`, `test:failed`); scope creep into a mini-ECS (mitigate: explicitly
reject world/scheduler/persistence in the ADR).

**Risks (full ECS):** regression across the whole suite; persistence format
migration; second write model inconsistent with the Law-12 ledger; loss of
`noUncheckedIndexedAccess`-grade type safety; zero measurable performance gain
at current corpus scale.

## 7. Recommendation

Reject the Bevy-style ECS runtime; adopt a hybrid — a thin typed read-model
query facade plus write-through component-tag index registry over the existing
stores (~5–8 days, no store rewrites) — for ADR consideration.
