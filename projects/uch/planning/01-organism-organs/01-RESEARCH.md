# Phase 01: Organism Organs — Graph & DNA Layer — Research

**Researched:** 2026-07-31
**Domain:** Workspace-scoped graph structures (Knowledge / Decision / Task / Evolution History / DNA) on GraphStore + Storable
**Confidence:** HIGH (all codebase claims file-verified; design decisions flagged ASSUMED)

## Summary

The phase builds five missing "organism organs" of the Workspace Brain in a new `src/workspace-graphs/` subsystem, closing the 13% vision gap (section 2.1 of `docs/vision-conformance-2026-07-31.md`). All five must reuse the existing `GraphStore` (SQLite-backed graph container at `src/kernel/storage/graph-store.ts`) and the `Storable` persistence pattern (`src/cognitive-plane/persistence/persistence-engine.ts`), wire into `WorkspaceBrain` (`src/workspace-brain/workspace-brain.ts`), and be fed by the existing neural event bus (`src/event-bus/neural-event-bus.ts`) — zero new runtime dependencies.

Three file-verified facts dominate planning:

1. **`GraphStore` is SQLite-backed, not JSON-backed.** The constructor creates `graph.sqlite` at a `basePath` via `node:sqlite` `DatabaseSync` (graph-store.ts:29-51). It is *already durable on disk*; it is **not** a `Storable` (no `persist`/`load` methods) and it has **no full-enumeration methods** (`getAllNodes`/`getAllEdges` do not exist — only `findNodesByType`, `searchNodes`, counts). This makes the D-05 `persist(filePath)`/`load(filePath)` contract a genuine design decision for the graph organs (see Open Question 1).
2. **`WorkspaceBrain` is a constructor-wired composer** — organs are `readonly` properties assigned in the constructor, with event subscriptions via `this.eventBus.subscribeToProtocol(...)` inline in the constructor (workspace-brain.ts:37-116). The organism-level pattern is `this.config.eventBus.subscribe('file:saved', async (event) => {...})` inside an `initialize()` method (organism.ts:462-488). WorkspaceBrain currently has **no `persist`/`load` methods at all** — the new organs will be the first Storable components in workspace-brain.
3. **The current test baseline is 87 files / 1,568 tests passing / 0 failures** (re-verified 2026-07-31 by two independent `npx vitest run` executions — plan-phase orchestrator and plan-checker). Note: `src/neural-fs/__tests__/neural-fs.test.ts:45` ("normalizes backslash paths") was observed failing ONCE in an earlier run and passing in two subsequent runs — it is drive-state-dependent flaky (compares `fs.ls('\\')` vs `fs.ls('/')` and `\concepts` → `[]`), NOT a stable failure. Do not treat it as known debt; do not fix unless it fails reproducibly. The "must not regress" floor for this phase is **1,546 passing** (CONTEXT D-06); the current verified green count is 1,568.

**Primary recommendation:** One GraphStore-backed organ per graph (Knowledge, Decision, Task, Evolution History), one JSON Storable for Workspace DNA, wired into `WorkspaceBrain` as readonly properties with constructor event subscriptions, each organ implementing `persist(filePath)`/`load(filePath)` per the Storable contract, and one vitest file per organ in `src/__tests__/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### D-01: New subsystem location
- Create a cohesive `src/workspace-graphs/` subsystem for the five structures.
- Locked: do NOT spread them across existing directories; they are one
  cohesive "graph + DNA" layer owned by `WorkspaceBrain`.

#### D-02: Reuse existing foundations, do not hand-roll
- Reuse `src/kernel/storage/graph-store.ts` (`GraphStore`) as the base graph container.
- Reuse `src/cognitive-plane/persistence/persistence-engine.ts` (`Storable`,
  `writeSnapshot`, `readSnapshot`, `mapToRecord`, `recordToMap`) for persistence.
- Reuse branded types from `src/shared/branded-types.ts` where applicable.
- Locked: no new runtime dependencies (UCH runtime dependency is exactly 1: `openai`).

#### D-03: Wire into WorkspaceBrain
- `src/workspace-brain/workspace-brain.ts` composes the five new structures
  alongside genome, identity, world-model, architecture-graph, timeline, health.
- Locked: new organs are attach points of the existing brain, NOT new entry points.

#### D-04: Feed from the neural event bus
- Subscribe to existing signal/event types: `git:commit`, `file:saved`,
  `build:finished`, `test:failed`, `error:occurred`, `pr:created`, `review:requested`.
- Locked: no new event types; the 16-event universal hook surface is complete.

#### D-05: Persistence contract
- Each organ implements `persist(filePath)` / `load(filePath)` following the
  Storable pattern used by the 15 existing stores (see `UCCP-persist-load-SUMMARY.md`).
- Persistence root: `.uccp/persist/` under the project.

#### D-06: Tests
- One vitest file per organ following `src/__tests__/*.test.ts` conventions
  (deterministic, no live LLM calls). Existing suite: 1,251 passing tests —
  must not regress. *(NOTE: baseline re-verified 2026-07-31: 87 files / 1,568 tests passing / 0 failures; floor for this phase = 1,546 passing.)*

#### D-07: Scope limits
- IDE driver deepening, Ollama runtime profile, issue/sprint/doc ingestion
  stores, and cross-project graphs are P1 — OUT OF SCOPE for this phase.

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
</user_constraints>

## Project Constraints (from AGENTS.md)

There is **no project-level AGENTS.md** (`projects/uch/AGENTS.md` does not exist — verified). The workspace root `AGENTS.md` applies; directives relevant to this phase:

- Prefer GSD workflow for file-changing work — this phase IS a GSD phase (compliant by construction).
- Never commit secrets; use `.env.example` for variable names only — organ properties must not carry secrets (see Security Domain).
- Run `npm test` / `npm run test:all` for verification — `projects/uch` uses `npm test` = `vitest run` (package.json:18).
- Prefer conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Record sessions with `scripts/agent-session.ps1` and findings in `.agent/memory/` (execution-time concern, not planning).

<phase_requirements>
## Phase Requirements

| Organ | Research Support (file-verified) |
|-------|----------------------------------|
| **Workspace Knowledge Graph** | `GraphStore` full API: `addNode`/`addEdge` (upsert + contradiction invalidation), `bfs(startId, maxDepth=3)`, `findPaths(from, to, maxDepth=5)`, `findNodesByType`, `searchNodes` (graph-store.ts:53-156). Node/edge shapes (graph-store.ts:5-23). Provenance/Confidence/EpistemicStatus types to embed in `properties` (provenance.ts:1-33; concept.ts:5-38). Event payloads to feed it: `file:saved` → `payload.path` (organism.ts:466), `git:commit` → `payload.message` (organism.ts:476). Memory-internal analog to project from: `SemanticGraph` (semantic-graph.ts:1-166). |
| **Workspace Decision Graph** | `DecisionLog.DecisionEntry` (id, title, rationale, alternatives, outcome, timestamp, traceIds — decision-log.ts:10-21) must NOT be duplicated — graph adds only nodes referencing `decision:{id}` + `cause-effect`/`alternative`/`supersede` edges. No supersede field exists in DecisionEntry (verified decision-log.ts) — supersede semantics must come from graph edges. `DecisionRecord.status` ('active'/'superseded'/...) exists in world-model (world-model.ts:13-23) for seeding. |
| **Workspace Task Graph** | `TaskScheduler.ScheduledTask` (id, name, status, priority, createdAt, startedAt/completedAt — task-scheduler.ts:6-19) has **no dependency field** — Task Graph adds `depends_on` edges + status-transition edges + file/decision linkage. TaskScheduler persists `tasks`/counters via Storable (task-scheduler.ts:195-216) — queue data lives there; the graph only adds structure. |
| **Workspace Evolution History** | `EvolutionEngine.EvolutionCycleReport` (cycleId, startedAt/completedAt, durationMs, baselineRuns, afterRuns, improvements, mutationsProposed/Applied/Kept, successful — evolution-engine.ts:137-149) and `Adaptation` (evolution-engine.ts:151-155). **No history store exists** — `adaptations` is an in-memory array (evolution-engine.ts:73, 118-120); the organ persists it. Engines (benchmark/experiment/mutation) live in `src/cognitive-plane/evolution/`. |
| **Workspace DNA** | `ConceptDNA` shape to generalize: `GeneMarker {locus, allele, chromosome, dominant, expressivity}`, `MutationEvent {generation, locus, fromAllele, toAllele, cause, timestamp}`, encode/decode (concept-genome.ts:3-29, 96-202, 426-454). WorkspaceGenome fields for the fingerprint inputs: `dna.*`, `architecture.*`, `health.*`, `evolution.*` (workspace-brain/genome.ts:9-52). Hash precedent: `createHash('sha256')` from `node:crypto` (version-store.ts:71). |
| **All 5 wired into WorkspaceBrain** | Composition pattern extracted: constructor assigns readonly organs + subscribes (workspace-brain.ts:37-116); WorkspaceBrainConfig `{workspace_id, name, root_path, eventBus}` (workspace-brain.ts:20-25). Event types verified in `EventType` union (neural-event-bus.ts:1-76). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Graph storage (nodes/edges/adjacency/traversal) | Kernel storage (`GraphStore`) | — | D-02 locked: `src/kernel/storage/graph-store.ts` is the base graph container; organs must NOT re-implement graphs |
| Graph persistence (SQLite) | Kernel storage (`GraphStore` → `graph.sqlite`) | Storable pattern for organ metadata | GraphStore auto-creates SQLite at basePath (graph-store.ts:29-51); JSON snapshot layer is impossible without new GraphStore methods |
| Organ JSON persistence (Storable contract) | Cognitive plane (`persistence-engine.ts`) | — | D-02/D-05: `Storable`, `writeSnapshot`, `readSnapshot`, `mapToRecord`, `recordToMap` (persistence-engine.ts:4-52) |
| Source data (decisions/tasks/evolution) | Cognitive plane stores (`DecisionLog`, `TaskScheduler`, `EvolutionEngine`) | — | Graphs add edges only; data stays in the owning stores (CONTEXT canonical refs) |
| Provenance/Confidence typing | Kernel types (`kernel/types/provenance.ts`) | — | Law 4 (Evidence Over Assertion): graph edges carry `provenance`/`confidence` in `properties` (see `ReasonGraph.recordCausalLink` precedent, reason-graph.ts:34-40) |
| Event ingestion | Event bus (`NeuralEventBus`) | WorkspaceBrain (wiring host) | Organs subscribe via the bus (`subscribe`/`subscribeToProtocol`, neural-event-bus.ts:124-189); WorkspaceBrain owns the bus instance (workspace-brain.ts:24, 52) |
| Workspace composition | WorkspaceBrain | — | D-03 locked: organs are attach points of the existing brain, not new entry points |

## Standard Stack

**No new runtime dependencies.** UCH's runtime dependency is exactly 1 (`openai ^7.2.0`, package.json:27), and D-02 locks this. The stack for this phase is the existing toolchain, all file-verified:

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| TypeScript | ^5.8.0 (dev) | Language; strict + noUncheckedIndexedAccess (tsconfig.json:9,18) | Existing toolchain |
| Node.js | 24.15.0 local (v20 in workspace root `.nvmrc` — see Environment) | Runtime; `node:sqlite` `DatabaseSync` powers GraphStore | Existing runtime; node:sqlite needs Node ≥22.5 (unflagged ≥23.4/22.13) |
| Vitest | ^3.0.0 (installed 3.2.7, dev) | Test runner; `vitest.config.ts` exists with coverage thresholds | Existing test infra |
| `GraphStore` | in-repo (`src/kernel/storage/graph-store.ts`) | SQLite graph container | D-02 locked |
| `persistence-engine.ts` | in-repo (`src/cognitive-plane/persistence/persistence-engine.ts`) | Storable + snapshot/Map utils | D-02 locked |
| `node:crypto` | Node built-in | `createHash('sha256')` for DNA fingerprint | Precedent: version-store.ts:1,71; zero-dependency |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `src/kernel/types/provenance.ts` (`Provenance`, `Confidence`, `EpistemicStatus`) | Provenance-bearing edge properties (Law 4) | All graph organs' edge `properties` |
| `src/shared/branded-types.ts` | `Confidence`, `Timestamp` brands | D-02 says "where applicable" — optional for organ internals (existing organs do NOT use them; only signal.ts does) |
| `src/cortex_kernel/reason-graph.ts` | Reference wrapper pattern: domain-specific edges over a shared `GraphStore` | Template for Knowledge/Decision Graph classes |
| `src/kernel/memory/memory-organ.ts` | Reference composition: organ owns `GraphStore(basePath)` + sibling stores | Template for organ constructor shape |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `GraphStore` (SQLite) per organ | JSON arrays/Maps like the 15 Storable stores | D-02 locks GraphStore for graphs; JSON-only would lose traversal/contradiction machinery and violate the decision |
| One shared `GraphStore` instance for all five organs | Per-organ `GraphStore` | Shared store mixes types in one SQLite file and couples organ lifecycles; per-organ isolates failure and matches "one organ one store" (see Assumptions A1) |
| In-memory Map+adjacency (ArchitectureGraph style) | SQLite GraphStore | ArchitectureGraph is NOT persisted and has no traversal — insufficient for D-05 durability |

**Installation:** none. Zero new packages.

**Version verification (ecosystem-appropriate commands):**
```bash
node --version        # v24.15.0 — verified 2026-07-31
npm test              # vitest run — 87 files, 1,568 passing, 0 failures (re-verified 2026-07-31)
npm run typecheck     # tsc --noEmit — baseline must stay clean
npm run build         # tsc — noEmitOnError (tsconfig.json:17)
```

## Package Legitimacy Audit

**No external packages — zero-dependency constraint per D-02.** This phase adds zero npm dependencies (only in-repo modules and Node built-ins: `node:sqlite`, `node:crypto`, `node:fs`, `node:path`). slopcheck/registry verification not applicable. The only package-install surface is dev-tooling already present (vitest, typescript — unchanged).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │            NeuralEventBus                    │
                    │  EventType: git:commit | file:saved |        │
                    │  build:finished | test:failed | error:occurred│
                    │  pr:created | review:requested (+ protocol)  │
                    └───────────────┬──────────────────────────────┘
                                    │ subscribe() / subscribeToProtocol()
                                    ▼
              ┌─────────────────────────────────────────────┐
              │              WorkspaceBrain                 │
              │  (constructor: readonly organs + subs)      │
              │  genome · identity · worldModel ·           │
              │  architecture · timeline · health           │
              │  + knowledgeGraph · decisionGraph ·         │
              │    taskGraph · evolutionHistory · dna       │  ← NEW (D-03)
              └──┬──────────┬──────────┬──────────┬─────────┘
                 ▼          ▼          ▼          ▼
   ┌─────────────────┐ ┌───────────────┐ ┌──────────────────┐
   │ workspace-graphs│ │ cognitive-plane│ │ kernel/storage    │
   │ 5 organ modules │ │ (read-only    │ │ GraphStore →      │
   │ (new subsystem) │ │  source data: │ │ .uccp/persist/    │
   │                 │ │ DecisionLog,  │ │ {organ}/graph.sqlite
   │                 │ │ TaskScheduler,│ │                  │
   │                 │ │ EvolutionEngine)                   │
   └────────┬────────┘ └───────────────┘ └──────────────────┘
            │ Storable persist/load (D-05)
            ▼
   persistence-engine.ts: writeSnapshot/readSnapshot (.uccp/persist/*.json for
   organ metadata + DNA) — graph bodies already durable via SQLite
```

Data flow for the primary use case (a `git:commit` event): bus delivers event → WorkspaceBrain subscription handler (or organ subscription) → Knowledge Graph upserts `commit:{hash}` node + `references` edges to touched files → Decision Graph/Task Graph nodes linked via ids → Evolution History unaffected (only `evolution` engine cycles write) → DNA fingerprint recomputed when genome/decisions change. On shutdown/start: organs' `load()` restore metadata; SQLite files self-restore graph bodies.

### Pattern 1: WorkspaceBrain composition (extracted verbatim from workspace-brain.ts:20-52, 60-71)

```typescript
// Source: src/workspace-brain/workspace-brain.ts (file-verified)
export interface WorkspaceBrainConfig {
  workspace_id: string;
  name: string;
  root_path: string;
  eventBus: NeuralEventBus;
}

export class WorkspaceBrain {
  readonly genome: WorkspaceGenome;      // factory fn
  readonly identity: WorkspaceIdentity;  // factory fn
  readonly worldModel: WorkspaceWorldModel; // factory fn
  readonly architecture: ArchitectureGraph; // class
  readonly timeline: WorkspaceTimeline;  // class
  readonly health: WorkspaceHealth;      // class
  private eventBus: NeuralEventBus;

  constructor(config: WorkspaceBrainConfig) {
    // ... organs assigned as readonly properties ...
    this.eventBus.subscribeToProtocol('memory:ingest', async (event) => {
      const observation = String(event.payload.observation ?? '');
      if (!observation) return;               // defensive payload guard
      this.timeline.addEvent({ /* ... */ });
    });
  }
}
```
**Rule:** new organs follow the same shape — `readonly` property + constructor assignment + constructor-time subscription with `String(event.payload.x ?? '')` guards. Naming precedent: `recordArchitectureNode`/`recordArchitectureEdge` facade methods (workspace-brain.ts:131-138) are the model for organ-facing public methods (e.g., `recordKnowledgeEdge`).

### Pattern 2: Organism-level event subscription (extracted verbatim from organism.ts:462-487)

```typescript
// Source: src/cognitive-plane/organism/organism.ts (file-verified)
async initialize(): Promise<void> {
  this.config.eventBus.subscribe('file:saved', async (event) => {
    await this.memory.ingestObservation(event, 0.6);
    this.memory.working.update({
      currentTask: `Saved ${String(event.payload?.path ?? 'unknown')}`,
    });
  });
  this.config.eventBus.subscribe('git:commit', async (event) => {
    this.memory.evolutionary.record(
      `Git commit: ${String(event.payload?.message ?? '').split('\n')[0]}`,
    );
  });
  this.config.eventBus.subscribe('error:occurred', async (event) => {
    this.memory.emotional.record(String(event.payload?.message ?? 'Unknown error'), 0.9, 'incident');
  });
}
```
**Rule:** `subscribe(eventType, async (event) => ...)` — typed `EventType` first arg, async handler, `String(payload.x ?? fallback)` coercion. The bus isolates handler failures (neural-event-bus.ts:280-282) and awaits promises. `subscribe` also accepts `EventType[]` (neural-event-bus.ts:147-149) — useful for one handler over `['test:failed','build:finished']`.

### Pattern 3: Graph organ over GraphStore (extracted from reason-graph.ts:25-40 + memory-organ.ts:29-35)

```typescript
// Source: src/cortex_kernel/reason-graph.ts (file-verified wrapper pattern)
export class ReasonGraph {
  private graph: GraphStore;
  constructor(graph: GraphStore, vectors: VectorStore) {
    this.graph = graph;   // GraphStore injected — organ does NOT own lifecycle
  }
  recordCausalLink(link: CausalLink): void {
    const edgeId = `causal-${link.causeId}-${link.effectId}-${Date.now()}`;
    this.graph.addEdge(edgeId, link.causeId, link.effectId, link.relationship, {
      confidence: link.confidence,
      evidence: link.evidence,
    }, link.confidence);   // ← provenance-bearing properties, Law 4
  }
}
```
**Rule:** the organ class owns a `GraphStore` (constructed at `{basePath}/{organ}` so each organ gets its own `graph.sqlite` — A1), maps domain calls to `addNode`/`addEdge` with deterministic ids, and embeds `provenance`/`confidence` objects in edge `properties`.

### Pattern 4: Storable persist/load (extracted verbatim from decision-log.ts:147-165, the canonical 15-store pattern)

```typescript
// Source: src/cognitive-plane/decisions/decision-log.ts (file-verified)
async persist(filePath: string): Promise<void> {
  const data = { entries: this.entries, maxEntries: this.maxEntries };
  writeSnapshot(filePath, data);
}
async load(filePath: string): Promise<number> {
  const data = readSnapshot<{ entries: DecisionEntry[]; maxEntries: number }>(filePath);
  if (!data) return 0;
  if (data.maxEntries !== undefined) this.maxEntries = data.maxEntries;
  this.entries = data.entries ?? [];
  return this.entries.length;
}
```
**Rule:** `persist` returns `Promise<void>`, `load` returns `Promise<number>` (count of restored items); `readSnapshot` returns `null` for missing files; Maps use `mapToRecord`/`recordToMap`; `dateReviver` reconstructs ISO `Date`s automatically (persistence-engine.ts:9-15, 23-27). **Design note:** `GraphStore` timestamps are epoch-ms numbers (`created_at: number`), so graph organs should use numeric timestamps in node/edge shapes; only JSON-side metadata needs `Date` care.

### Pattern 5: DNA encode/decode (extracted from concept-genome.ts:96-202, 426-454)

`ConceptDNA` = `{ genomeId, geneSequence: GeneMarker[], parentIds, mutationHistory: MutationEvent[], generation, fitness, compatibilityProfile }`. `encode()` derives `GeneMarker[]` from a source object (locus-prefixed markers: `type_`, `name_`, `def_`...), `decode()` reverses marker loci into a traits record. **Workspace DNA generalization:** same marker/mutation vocabulary, but alleles derived from `WorkspaceGenome.dna/architecture/health/evolution` + conventions + taste + recent decisions; fingerprint via `node:crypto` sha256 (precedent version-store.ts:71: `` `sha256:${createHash('sha256').update(stableSerialize(value)).digest('hex')}` ``).

### Recommended Project Structure (D-01 — one cohesive subsystem; module split per organ is agent's discretion)
```
src/workspace-graphs/
├── knowledge-graph.ts      # WorkspaceKnowledgeGraph — GraphStore-backed
├── decision-graph.ts       # WorkspaceDecisionGraph — GraphStore-backed
├── task-graph.ts           # WorkspaceTaskGraph — GraphStore-backed
├── evolution-history.ts    # WorkspaceEvolutionHistory — GraphStore-backed (+ counters)
├── workspace-dna.ts        # WorkspaceDNA — JSON Storable (fingerprint + mutations)
└── index.ts                # subsystem barrel (matches src/kernel/index.ts precedent)
src/__tests__/
├── workspace-graphs-knowledge.test.ts
├── workspace-graphs-decisions.test.ts
├── workspace-graphs-tasks.test.ts
├── workspace-graphs-evolution.test.ts
└── workspace-graphs-dna.test.ts
```
Dependency direction (cycle-safe, verified): `workspace-graphs → kernel/storage + kernel/types + cognitive-plane/persistence + cognitive-plane/{decisions,scheduler,evolution} (type-only for source data)`; **never** `workspace-graphs → workspace-brain` (that would create a cycle once workspace-brain imports workspace-graphs — see Pitfall 3). Barrel exports should be added to `src/index.ts` following the existing `WorkspaceBrain` export (index.ts:393-394 — file-verified).

### Anti-Patterns to Avoid
- **Wrapping GraphStore in a JSON snapshot for persist():** GraphStore has no `getAllNodes`/`getAllEdges` enumeration — snapshotting requires adding GraphStore methods or a parallel in-memory index. Don't build either until the persist/load semantics decision is locked (Open Question 1).
- **Random UUID edge ids in event handlers:** duplicate events (two `file:saved` for the same path) create duplicate edges. Use deterministic ids (`file:${path}`, `commit:${hash}`) — `addNode` is `INSERT OR REPLACE` (upsert-safe, graph-store.ts:53-56), and deterministic edge ids enable dedupe-by-replace.
- **Copying DecisionLog/TaskScheduler data into graph nodes:** the graphs add edges over existing ids (`decision:{id}`, `task:{id}`); duplicating titles/statuses creates drift and violates the CONTEXT canonical-ref instruction.
- **Storing `Date` objects in GraphStore `properties`:** properties go through `JSON.stringify` (graph-store.ts:55); `Date` becomes an ISO string and comes back as a string (no reviver in GraphStore — only `readSnapshot` has `dateReviver`). Use epoch numbers (matching `created_at: number`).
- **Subscribing in a method nobody calls:** WorkspaceBrain subscribes in the constructor (workspace-brain.ts:60); CognitiveOrganism subscribes in `initialize()` (organism.ts:462) which callers must invoke. Choose one and make the tests prove it fires.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph container (nodes/edges/adjacency) | Custom Maps/arrays | `GraphStore` (graph-store.ts) | D-02 locked; SQLite-backed, contradiction invalidation, indexed queries, BFS/findPaths built in |
| BFS traversal | Custom queue/visited code | `GraphStore.bfs(startId, maxDepth=3)` (graph-store.ts:105-127) | Already implemented with visited-set + depth levels |
| Path finding | Custom DFS | `GraphStore.findPaths(from, to, maxDepth=5)` (graph-store.ts:129-156) | Returns `{nodes, edges}[]` paths |
| Contradiction detection | Pairwise edge scanning | `GraphStore.detectContradictions()` (graph-store.ts:158-173) + automatic invalidation on `addEdge` (graph-store.ts:74-85) | Built into addEdge; edges auto-invalidate on same-relationship re-add |
| Edge supersede/cause-effect semantics | New storage layer | GraphStore edges with `relationship: 'supersedes' | 'causes' | 'alternative_to'` + `provenance` in properties | `ReasonGraph` precedent (reason-graph.ts:34-40) |
| JSON file persistence | Raw `fs.writeFileSync` | `writeSnapshot`/`readSnapshot` (persistence-engine.ts:17-27) | mkdir-recursive, pretty JSON, `dateReviver` |
| Map ↔ Record serialization | Manual loops | `mapToRecord`/`recordToMap` (persistence-engine.ts:29-39) | Used by all 15 stores |
| DNA fingerprint hashing | Hand-rolled string hash | `node:crypto` `createHash('sha256')` | Precedent version-store.ts:71; concept-genome's `hashString` is module-private (concept-genome.ts:55-63, not exported) |
| Event subscription plumbing | Direct coupling to drivers | `NeuralEventBus.subscribe`/`subscribeToProtocol` (neural-event-bus.ts:124-189) | Typed EventType, wildcard, filters, failure isolation, history |

**Key insight:** The kernel and cognitive-plane already own the hard parts (SQLite graph persistence, traversal, contradiction handling, snapshot I/O, hash utilities). The five organs are thin adapters: domain types + id schemes + event mapping + Storable glue. Every line of custom graph algorithm is a regression risk against the 1,568-test green baseline.

## Common Pitfalls

### Pitfall 1: GraphStore persist/load semantics ambiguity (SQLite vs Storable JSON)
**What goes wrong:** The plan assumes organs follow the 15-store JSON pattern, but GraphStore writes its own `graph.sqlite` at construction (graph-store.ts:29-51) — a JSON `persist()` can't serialize the graph without new enumeration APIs, and a no-op `persist()` violates the spirit of D-05.
**Why it happens:** GraphStore predates the Storable era and is not a Storable (no `persist`/`load` methods — full file read verified).
**How to avoid:** Lock the semantics in the plan (Open Question 1): recommended — `persist(filePath)` writes a small JSON manifest (organ version, graph path, node/edge counts) via `writeSnapshot`; `load(filePath)` reads the manifest and returns `nodeCount()` from the SQLite file. Graph body durability comes from SQLite itself. DNA (non-graph) uses the plain 15-store JSON pattern.
**Warning signs:** Planner tasks that say "serialize the graph to JSON"; any task proposing `getAllNodes` additions to GraphStore without explicit approval.

### Pitfall 2: Timestamp/Date type mismatch across layers
**What goes wrong:** `GraphNode.created_at`, `GraphEdge.valid_at/invalid_at/created_at` are epoch-ms **numbers** (graph-store.ts:5-23); `Concept.temporal`/`created_at` and `TimelineEvent.timestamp` are `Date`s (concept.ts:36-37, timeline.ts:18); `dateReviver` only revives ISO strings matching `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}` (persistence-engine.ts:10). Mixing them silently corrupts comparisons (e.g., `Date` vs `number` in JSON properties).
**Why it happens:** Two persistence generations with different timestamp conventions.
**How to avoid:** Organ node/edge types mirror GraphStore shapes (number timestamps); JSON metadata follows the 15-store Date convention. Convert at the organ boundary.
**Warning signs:** `valid_at` typed as `Date` anywhere near a GraphStore call; `getTime()` on a value from `graph.getNode()`.

### Pitfall 3: Circular imports workspace-brain ↔ workspace-graphs
**What goes wrong:** If a graph organ imports `DecisionRecord` from `../workspace-brain/world-model.js` (tempting — it's the brain's decision shape) while workspace-brain imports the organs, ESM circular import yields `undefined` class at module-eval time.
**Why it happens:** Type reuse pulls a runtime import across the subsystem boundary. (DecisionLog's `DecisionEntry` is the correct source — decision-log.ts:10-21 — and imports only persistence-engine, verified.)
**How to avoid:** workspace-graphs imports ONLY `kernel/*` + `cognitive-plane/*`; workspace-brain imports workspace-graphs. Type-only imports (`import type`) are safe; value imports of workspace-brain symbols are forbidden.
**Warning signs:** any `from '../workspace-brain/...'` inside `src/workspace-graphs/`.

### Pitfall 4: Duplicate nodes/edges from repeated events
**What goes wrong:** `file:saved` fires per save; a handler that creates `addNode(crypto.randomUUID(), ...)` per event grows the graph unboundedly; `addEdge` with same relationship re-add invalidates the prior edge (graph-store.ts:74-85) — silently erasing history for status-transition edges.
**Why it happens:** Event-driven ingestion without idempotency.
**How to avoid:** Deterministic node ids (`file:${path}`, `commit:${hash}`, `decision:${id}`, `task:${id}` — addNode is INSERT OR REPLACE, safe); deterministic edge ids for semantic edges (`supersedes:${a}:${b}`); distinct relationship names per transition kind if transition history must be preserved (or model status as nodes with `at` edges, not transitions between the same pair).
**Warning signs:** `crypto.randomUUID()` inside a subscribe handler; tests that publish the same event twice and assert growing counts.

### Pitfall 5: Test pollution of `.uccp/` (known project debt)
**What goes wrong:** Tests writing to workspace-relative paths accumulate `.uccp-test/` residue (~155 files per index §17.9); GraphStore constructs SQLite files at `basePath` on construction (graph-store.ts:29-33).
**Why it happens:** Persistence tests historically used relative paths; sqlite files are binary and don't clean themselves.
**How to avoid:** Mandatory temp-dir pattern — `mkdtempSync(join(tmpdir(), 'uch-wsgraphs-'))` in `beforeEach`, `rmSync(dir, { recursive: true, force: true })` in `afterEach`, and `graph.close()` before removal (exact precedent: neural-fs.test.ts:342-353).
**Warning signs:** any `'.uccp'` or `'./'` literal in a test's persist/load path.

### Pitfall 6: `noUncheckedIndexedAccess` strictness in new types
**What goes wrong:** `strict: true` + `noUncheckedIndexedAccess: true` (tsconfig.json:9,18) means `arr[0]` is `T | undefined`; organ code indexing `findNodesByType(...)[0]` or `bfs(...)[0]` fails `tsc --noEmit` (build has `noEmitOnError`, tsconfig.json:17).
**Why it happens:** The flag is on; the codebase convention is `x[0]!` non-null assertion (workspace-brain.test.ts:144) or `?.` guards (organism.ts:498).
**How to avoid:** Follow the `!`/`?.` convention in both organ code and tests (tests are excluded from tsconfig but linted by convention — `**/__tests__/**` excluded at tsconfig.json:22).
**Warning signs:** `Type 'undefined' is not assignable` in the new subsystem during `npm run typecheck`.

### Pitfall 7: Missing barrel/export wiring
**What goes wrong:** New organs exist but are unreachable — `src/index.ts` is the public API surface (~200 exports; WorkspaceBrain exported at index.ts:393-394 — file-verified); `agent/plugin.ts` and `cli/uccp.ts` construct WorkspaceBrain (plugin.ts:93-98, uccp.ts:110-115) and would silently not compose the new organs if wiring is forgotten.
**Why it happens:** The phase touches composition but the entry points are two files away.
**How to avoid:** Plan explicit tasks: (1) extend `WorkspaceBrainConfig`/constructor, (2) export organs from `src/index.ts`, (3) verify `UCHAgentPlugin` and `UCCPServer` constructors compile against the extended brain.
**Warning signs:** No diff in `src/index.ts` or `src/agent/plugin.ts` in the plan.

## Code Examples

Verified patterns from official (in-repo) sources:

### GraphStore node/edge ingestion (idempotent, provenance-bearing)
```typescript
// Pattern source: src/kernel/storage/graph-store.ts + src/cortex_kernel/reason-graph.ts
// (file-verified — shapes and semantics as implemented)
const graph = new GraphStore(basePath); // basePath dir auto-created; graph.sqlite inside

// Upsert-safe: INSERT OR REPLACE by id (graph-store.ts:53-56)
graph.addNode(`file:${path}`, 'artifact', basename, { language, lines: 42 });

// Edge with provenance in properties (reason-graph.ts:36-39 precedent)
graph.addEdge(
  `commit:${hash}:touches:${path}`,
  `commit:${hash}`,
  `file:${path}`,
  'touches',
  { provenance: { source: 'system_log', source_id: hash, timestamp: Date.now(), reliability: 0.9 },
    confidence: { value: 1.0, method: 'process_reliability', calibration_history: [] } },
  1.0,
);

// Traversal — built in, do not hand-roll (graph-store.ts:105-127, 129-156)
const levels: GraphNode[][] = graph.bfs('file:src/index.ts', 3);
const paths = graph.findPaths('file:a.ts', 'file:b.ts', 5);

graph.close(); // tests must close before rmSync (neural-fs.test.ts:349-352)
```

### Storable organ skeleton (canonical 15-store pattern)
```typescript
// Pattern source: src/cognitive-plane/decisions/decision-log.ts:147-165 (file-verified)
import { writeSnapshot, readSnapshot, type Storable } from '../cognitive-plane/persistence/persistence-engine.js';

export class WorkspaceEvolutionHistory implements Storable {
  private cycles: EvolutionCycleSummary[] = [];

  async persist(filePath: string): Promise<void> {
    writeSnapshot(filePath, { cycles: this.cycles, total: this.cycles.length });
  }
  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{ cycles: EvolutionCycleSummary[] }>(filePath);
    if (!data) return 0;
    this.cycles = data.cycles ?? [];
    return this.cycles.length;
  }
}
```

### Event subscription with deterministic upsert (idempotency guard)
```typescript
// Pattern source: src/cognitive-plane/organism/organism.ts:463-487 (file-verified)
this.eventBus.subscribe('git:commit', async (event) => {
  const message = String(event.payload?.message ?? '');
  const hash = String(event.payload?.hash ?? `commit-${event.timestamp.getTime()}`);
  if (!message) return;
  this.knowledgeGraph.recordCommit(hash, message); // deterministic ids inside
});
```

### Vitest temp-dir lifecycle (mandatory to avoid .uccp-test residue)
```typescript
// Pattern source: src/neural-fs/__tests__/neural-fs.test.ts:336-353 (file-verified)
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('WorkspaceKnowledgeGraph', () => {
  let dir: string;
  let graph: WorkspaceKnowledgeGraph;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-wsg-'));
    graph = new WorkspaceKnowledgeGraph(dir);
  });
  afterEach(() => {
    graph.close();
    rmSync(dir, { recursive: true, force: true });
  });
  // it(...) tests — deterministic, no LLM
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory graphs (ArchitectureGraph: Map + adjacency, architecture-graph.ts:16-31) | SQLite-backed `GraphStore` (`node:sqlite` DatabaseSync, graph-store.ts:25-51) | GraphStore introduced before this phase | Organs get durable graphs + traversal for free; but Storable contract must be reconciled with SQLite (Open Question 1) |
| No vitest config (defaults) | `vitest.config.ts` with v8 coverage thresholds (statements 70/branches 75/functions 78/lines 70) (vitest.config.ts:7-24) | 2026-07-31 | New organs must clear coverage thresholds in `npm run test:coverage` |
| Suite of 1,251 tests (CONTEXT D-06) | 87 files / 1,568 passing / 0 failures (re-verified by two runs, 2026-07-31) | suite growth before this phase | Baseline floor for "must not regress" is 1,546 passing |

**Deprecated/outdated:**
- `UCH-COMPLETE-INDEX.md` §15's "1,176 test cases" and CONTEXT D-06's "1,251 passing tests" — both superseded by the verified 1,547 (the index itself notes the 78-test addition on 2026-07-31 that took the suite to 1,251; further growth since then).
- Workspace root `.nvmrc` (Node 20) vs `node:sqlite` requirement (Node ≥22.5 flagged / ≥23.4 unflagged / ≥22.13 backport) — GraphStore tests pass on local Node 24.15.0, but Node 20 cannot import `node:sqlite`. If uch gains CI, it must pin Node ≥22.13+.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Each graph organ owns its own `GraphStore` at `{basePath}/{organ}/graph.sqlite` (vs one shared store) | Architecture Patterns | Low — shared store still works, but per-organ is cleaner; planner tasks for basePath layout would need adjustment |
| A2 | `persist(filePath)` for graph organs writes a JSON metadata manifest (counts/version) while SQLite holds the graph body; `load` returns node count | Common Pitfalls / Open Question 1 | Medium — if user wants full JSON snapshot of graph bodies, GraphStore enumeration methods must be added (new API surface) |
| A3 | `WorkspaceBrain` should gain a `persist`/`load` facade (or organs registered with `PersistenceProvider`) | Summary | Medium — no existing production caller persists the 15 stores either (verified: only tests + PersistenceProvider call `persist`); the attach pattern is unspecified by D-03/D-05 |
| A4 | Test files live in `src/__tests__/workspace-graphs-*.test.ts` | Validation Architecture | Low — D-06 wording ("following `src/__tests__/*.test.ts` conventions") supports this; colocated `__tests__/` is the alternative (neural-fs/agentic precedent) |
| A5 | DNA fingerprint = `sha256` over a stable serialization of genome + conventions + taste + recent decisions | Standard Stack | Low — scheme is agent's discretion; `node:crypto` precedent verified; input sources may shift |
| A6 | New organs should be exported from `src/index.ts` | Anti-Patterns | Low — consistent with every subsystem; omission only affects discoverability |

## Open Questions (RESOLVED)

> All four resolved 2026-07-31 during plan phase — recommendations adopted as locked plan contracts (plan-checker verified, iteration 2).

1. **Storable semantics for SQLite-backed graph organs** — RESOLVED: metadata-manifest persist/load (A2 adopted; no GraphStore enumeration APIs added)
   - What we know: `GraphStore` self-persists to `{basePath}/graph.sqlite` (graph-store.ts:29-51); has no `getAllNodes`/`getAllEdges` (full file read); D-05 mandates `persist`/`load` per organ.
   - What's unclear: should `persist()` snapshot the graph to JSON (requires new GraphStore APIs or parallel index), write a metadata manifest only (recommended, A2), or be a no-op flush?
   - Recommendation: metadata manifest + SQLite as source of truth; DNA and Evolution History counters as plain JSON.

2. **Where does `WorkspaceBrain` expose persistence?** — RESOLVED: `persistWorkspace(rootPath)`/`loadWorkspace(rootPath)`/`close()` facade on WorkspaceBrain (locked in 01-03 interfaces)
   - What we know: WorkspaceBrain has no `persist`/`load` today (grep of `src/workspace-brain/` — zero matches); `PersistenceProvider` orchestrates Storables with `{baseDir}/persist/{name}.json` resolution (persistence-provider.ts:24-41) but has no production caller.
   - What's unclear: does the phase add a `persist()`/`load()` facade on WorkspaceBrain, register organs with PersistenceProvider, or leave orchestration to callers (agent plugin / UCCP server)?
   - Recommendation: add thin `persistWorkspace(rootPath)`/`loadWorkspace(rootPath)` methods on WorkspaceBrain delegating to organs at `{rootPath}/.uccp/persist/{organ}.json` — single attach point, D-03-compliant.

3. **DNA fingerprint inputs** — RESOLVED: genome + worldModel standards + decision count/outcomes (all available inside WorkspaceBrain); TasteEngine deferred (locked in 01-02/01-03 interfaces). Which sources feed the hash (genome only, or + TasteEngine preferences + DecisionLog stats as the phase specifics suggest)? TasteEngine and DecisionLog live in cognitive-plane and are not currently owned by WorkspaceBrain (verified plugin.ts:108-110 constructs them separately). If included, WorkspaceBrain needs access — a constructor param or lazy wiring. Recommendation: genome + worldModel standards + decision count/outcomes available inside WorkspaceBrain; TasteEngine deferred unless cheaply injectable.

4. **Shared store vs per-organ store** (A1) — RESOLVED: per-organ GraphStore at `{basePath}/{organ}/graph.sqlite` (locked in 01-01/01-02 interfaces). One `graph.sqlite` per organ at `{basePath}/{organ}/` vs one shared store with type-scoped nodes. Recommendation: per-organ (isolation, independent clear/close, matches MemoryOrgan's one-store-per-component pattern, memory-organ.ts:29-35).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All code; `node:sqlite` (GraphStore), `node:crypto` | ✓ | v24.15.0 (2026-07-31 verified) | — |
| npm | Tooling | ✓ | 11.12.1 | — |
| TypeScript | Build/typecheck | ✓ | ^5.8.0 installed | — |
| Vitest | Tests | ✓ | ^3.0.0 (3.2.7) + vitest.config.ts | — |
| `node:sqlite` (built-in) | GraphStore persistence | ✓ | Node 24 (stable); needs ≥22.5 flagged / ≥23.4 unflagged | None — hard dependency of GraphStore (already in tests) |
| `node:crypto` (built-in) | DNA fingerprint | ✓ | Node 24 | None |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.
**Environment warnings:**
- Workspace root `.nvmrc` = `20` — Node 20 cannot import `node:sqlite`. GraphStore tests currently pass only because local Node is 24. Do NOT add uch CI on Node <22.13, and do not switch the local runtime to 20 (verified: `.nvmrc` at workspace root reads "20"; uch has no `.nvmrc`/`engines` of its own and no `.github/workflows` — glob verified).
- No ESLint config exists in `projects/uch` (root-verified: only `vitest.config.ts` matched `*.config.*`); `npm run lint` would fail pre-existing — not this phase's concern, do not attempt to fix unless asked.

## Validation Architecture

> `workflow.nyquist_validation`: not explicitly disabled in `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 (installed 3.2.7) |
| Config file | `vitest.config.ts` — include `src/**/*.test.ts`, v8 coverage thresholds (statements 70 / branches 75 / functions 78 / lines 70) |
| Quick run command | `npx vitest run src/__tests__/workspace-graphs-<organ>.test.ts` |
| Full suite command | `npm test` (vitest run) — baseline: **87 files, 1,568 tests passing / 0 failures** (re-verified 2026-07-31, ~10-13s) |
| Baseline guard | `npm run typecheck` (tsc --noEmit; tests excluded from tsconfig per `**/__tests__/**` at tsconfig.json:22, so organ SOURCE must be clean) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01/D-02 | WorkspaceKnowledgeGraph: node upsert (idempotent), provenance-bearing edges, bfs/findPaths reuse, SQLite file created at basePath | unit | `npx vitest run src/__tests__/workspace-graphs-knowledge.test.ts` | ❌ Wave 0 |
| D-01/D-02 | WorkspaceDecisionGraph: decision nodes reference `decision:{id}`, `causes`/`alternative_to`/`supersedes` edges, no data duplication from DecisionLog | unit | `npx vitest run src/__tests__/workspace-graphs-decisions.test.ts` | ❌ Wave 0 |
| D-01/D-02 | WorkspaceTaskGraph: `depends_on` edges, status-transition edges, file+decision linkage, no duplication from TaskScheduler | unit | `npx vitest run src/__tests__/workspace-graphs-tasks.test.ts` | ❌ Wave 0 |
| D-01/D-02 | WorkspaceEvolutionHistory: cycle nodes with outcomes (successful/improvements), persist/load round-trip with counts | unit | `npx vitest run src/__tests__/workspace-graphs-evolution.test.ts` | ❌ Wave 0 |
| D-01/D-02 | WorkspaceDNA: fingerprint stable across identical inputs, mutation events recorded, encode/decode round-trip | unit | `npx vitest run src/__tests__/workspace-graphs-dna.test.ts` | ❌ Wave 0 |
| D-03/D-04 | WorkspaceBrain composition: organs exposed as readonly properties; `git:commit`/`file:saved`/`error:occurred` published on a fresh NeuralEventBus produce graph mutations (workspace-brain.test.ts integration style) | integration | `npx vitest run src/__tests__/workspace-brain.test.ts` (extended) | ✅ exists — extend |
| D-05 | Storable contract: `persist`/`load` signatures + round-trip via temp dir, `load` returns count, missing file returns 0 | unit | per-organ files above | ❌ Wave 0 |
| D-06 | No regression: full suite | smoke | `npm test` | ✅ |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/workspace-graphs-*.test.ts`
- **Per wave merge:** `npm test` (full suite, ~14s)
- **Phase gate:** Full suite green + `npm run typecheck` + `npm run build` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/workspace-graphs-knowledge.test.ts` — knowledge graph behaviors (REQ: D-02/D-04)
- [ ] `src/__tests__/workspace-graphs-decisions.test.ts` — decision graph behaviors (REQ: D-02)
- [ ] `src/__tests__/workspace-graphs-tasks.test.ts` — task graph behaviors (REQ: D-02)
- [ ] `src/__tests__/workspace-graphs-evolution.test.ts` — evolution history + persist/load (REQ: D-02/D-05)
- [ ] `src/__tests__/workspace-graphs-dna.test.ts` — DNA fingerprint/mutations (REQ: D-02)
- [ ] Extend `src/__tests__/workspace-brain.test.ts` — brain composition + event wiring (REQ: D-03/D-04)
- Framework install: none needed — vitest + config verified present.

## Security Domain

> `security_enforcement`: not disabled — enabled. This is a **local, single-user persistence subsystem** (no network surface, no auth boundary introduced; UCCP server/auth untouched by this phase).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface — organs are in-process components of WorkspaceBrain |
| V3 Session Management | no | No sessions — state is workspace-local graphs |
| V4 Access Control | no | File-system permissions only; no new entry points (D-03) |
| V5 Input Validation | yes | Event payloads are untyped `Record<string, unknown>` (neural-event-bus.ts:83) — coerce with `String(payload.x ?? '')` before use (organism.ts:466,476,482 pattern); validate path strings before using as node ids |
| V6 Cryptography | partial | DNA fingerprint is one-way `sha256` (no secrets, no keys); `node:crypto` built-in, never hand-rolled (precedent version-store.ts:71) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secrets or personal data written into graph `properties` | Information Disclosure | Never store env values/passwords in node properties; follow workspace rule "Never commit secrets"; `writeSnapshot` files are plain JSON under `.uccp/persist/` — same exposure class as the 15 existing stores (accepted project posture, PRIVACY-ERASURE.md governs erasure) |
| Path traversal via `file:saved` payload path used as node id | Tampering | Node ids are keys in SQLite (`id TEXT PRIMARY KEY`) — treat payload paths as opaque strings, do not resolve them for file access in organ logic (organs never read the filesystem) |
| Unbounded graph growth from event spam | DoS (local) | Deterministic upsert ids (Pitfall 4); optional caps mirroring `maxEntries` (decision-log.ts:34) if planner deems necessary |
| SQLite file integrity | Tampering | GraphStore is existing shipped code with existing tests (neural-fs suite exercises it); organs must call `close()` in tests and never share one `GraphStore` across organs (Pitfall 3/Open Question 4) |

The project's threat model (`design/THREAT-MODEL.md`, T01–T14) already covers the hosting runtime (UCCP server, agent plugin); this phase adds no new trust boundary.

## Sources

### Primary (HIGH confidence — file-verified this session)
- `src/kernel/storage/graph-store.ts` — full GraphStore API, GraphNode/GraphEdge shapes, SQLite persistence, contradiction logic, bfs/findPaths
- `src/cognitive-plane/persistence/persistence-engine.ts` — Storable, dateReviver regex, writeSnapshot/readSnapshot, mapToRecord/recordToMap, serializeDates, collectPersistableStores
- `src/workspace-brain/workspace-brain.ts` — composition pattern, WorkspaceBrainConfig, subscribeToProtocol wiring, facade methods
- `src/workspace-brain/architecture-graph.ts` — ArchitectureNode/Edge shapes (in-memory analog)
- `src/kernel/storage/semantic-graph.ts` — memory-internal graph analog, bfsTraversal, contradiction handling
- `src/kernel/types/concept.ts`, `src/kernel/types/provenance.ts` — Concept, Provenance, Confidence, EpistemicStatus, TemporalWindow
- `src/cognitive-plane/organism/organism.ts` — subscribe('file:saved'|'git:commit'|'error:occurred') pattern, payload coercion, initialize()
- `src/cognitive-plane/decisions/decision-log.ts` — DecisionEntry shape, Storable example (persist/load lines 147-165)
- `src/cognitive-plane/scheduler/task-scheduler.ts` — ScheduledTask shape, statuses, Storable (handlers/timers excluded)
- `src/cognitive-plane/evolution/evolution-engine.ts` — EvolutionCycleReport/Adaptation, in-memory-only adaptations
- `src/kernel/concept-genome/concept-genome.ts` — ConceptDNA/GeneMarker/MutationEvent, encode/decode, private hashString
- `src/event-bus/neural-event-bus.ts` — EventType union (all 7 D-04 types present), subscribe/subscribeToProtocol signatures, failure isolation
- `src/nervous-system/signal.ts` — signalPriorityForType map (file/git/build/test/error/pr/review priorities)
- `src/__tests__/workspace-brain.test.ts` — vitest conventions, integration-style describe, non-null assertions
- `src/neural-fs/__tests__/neural-fs.test.ts` — GraphStore temp-dir test lifecycle (mkdtempSync/close/rmSync)
- `src/cortex_kernel/reason-graph.ts` — GraphStore wrapper pattern with provenance properties
- `src/kernel/memory/memory-organ.ts` — organ-owns-GraphStore composition
- `src/cognitive-plane/persistence/persistence-provider.ts` — register/persistAll/loadAll, `{baseDir}/{name}.json` resolution
- `src/agent/plugin.ts`, `src/cli/uccp.ts` — WorkspaceBrain construction sites, `.uccp/persist` paths, sha256 precedent via version-store.ts
- `src/workspace-brain/{genome,identity,world-model,timeline,health}.ts` — existing organ shapes; verified NO persist/load in workspace-brain
- `tsconfig.json`, `package.json`, `vitest.config.ts` — strict flags, scripts, zero-dep constraint, coverage thresholds
- Executable verification: `npx vitest run` → 87 files / 1,568 tests passing (2026-07-31)

### Secondary (MEDIUM confidence — project documents)
- `UCCP-persist-load-SUMMARY.md` — the 15-store Storable pattern contract (matches code)
- `docs/UCH-COMPLETE-INDEX.md` — §5.4 cognitive-plane, §5.5 workspace-brain, §9 persistence, §15 test suite, §17 gaps
- `docs/vision-conformance-2026-07-31.md` — §2.1 gap list (the phase's mandate)
- `planning/01-organism-organs/01-CONTEXT.md` — locked decisions D-01..D-07 (verbatim in User Constraints)

### Tertiary (LOW confidence)
- None — no web-sourced claims were required; every factual claim was verified against the codebase or project documents.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components file-verified; zero new dependencies confirmed in package.json
- Architecture: HIGH — composition, subscription, Storable, and GraphStore-wrapper patterns extracted verbatim from source
- Pitfalls: HIGH — all six pitfalls grounded in verified file behavior (SQLite constructor, no enumeration APIs, dateReviver regex, noUncheckedIndexedAccess, upsert/invalidation semantics)
- Design decisions (persist/load semantics, store layout, brain facade): MEDIUM — flagged in Assumptions Log (A1-A6) and Open Questions for user confirmation

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 (stable in-repo APIs; 30-day validity — only the test-count baseline (1,568 passing / 87 files) and Node version (24.15.0) are volatile)
