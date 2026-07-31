# CONNECTOME.md — Concept Store Design

Status: design reference for `src/connectome/` (expanded from ledger research —
graph-memory / MRAgent framing, ledger 3.2). Expansion path §4 implemented
2026-07-31 (weighted edges, activation propagation, auto-wiring, integrity
check, persistence).

## 1. Contract (MANIFESTO §6)

| Engineering Name | Biological Metaphor | Contract | Module | Measured By |
|---|---|---|---|---|
| Concept Store | Connectome | Relationship graph | `src/connectome/` | Graph integrity, query latency |

The Connectome is the relationship graph of the cognitive substrate. Per
`spec/FORMAL_FOUNDATIONS.md`, the Connectome is `G_n = (C, R)` — a directed
graph with weighted edges where vertices are components and edges are signal
routes. It must remain weakly connected; partitioned components enter emergency
broadcast mode (`spec/LAWS_OF_COGNITIVE_PHYSICS.md`).

## 2. The cue-tag-content model (ledger 3.2)

The research ledger's graph-memory framing — **cue-tag-content** with *active
reconstruction* rather than static retrieval — maps directly onto this organ:

- **Cue**: an activation key (a concept id, a component name, a signal type).
  In UCH terms, cues are the connection endpoints: `from` and `to`.
- **Tag**: the associative bridge — a typed, weighted edge (`event-driven`,
  `data-flow`, `control`, `reference`). Tags are *semantic bridges*: the same
  content can be reachable through many tags, and the tag set is what makes the
  graph associative rather than merely hierarchical.
- **Content**: the reachable artifact (component, concept, episode).

The **active reconstruction** property: retrieval is not a lookup that returns
a stored answer; it is a traversal that *reconstructs* a reachable context from
cues by walking the tag graph. `findPaths(from, to)` in the current
implementation is the seed of this behavior — the design intent is that any
query is a multi-cue traversal whose result is the reconstructed neighborhood,
not a single node.

## 3. Current implementation (`src/connectome/wiring.ts`)

Implemented as of 2026-07-31:

- `registerConnection` / `removeConnection` — typed edges with description,
  optional metadata, and **weight** (default 1, clamped to `[0, maxWeight]`).
- `link(from, to, type, description?, weight?)` — register-or-strengthen: an
  existing edge of the same endpoints/type gets its weight increased
  (capped at `maxWeight`) instead of duplicated; endpoints are registered as
  nodes. This is the auto-wiring primitive.
- `getConnectionsFrom/To` — adjacency queries (activation-ordered from source).
- `activate(cue, strength)` — cue-tag-content activation propagation: BFS with
  per-hop decay (`activationDecayPerHop`), sets edge activation +
  `lastActivatedAt`; returns the activation-ordered neighborhood.
- `getNeighborhood(cue, maxDepth?)` — activation-ordered reachable set
  (the reconstruction query).
- `findPaths(from, to, maxDepth)` — DFS path enumeration (the reconstruction
  primitive).
- `rankPaths(from, to)` — paths ranked by summed edge weight.
- `checkIntegrity()` — weak connectivity, connected components,
  dangling-edge count, and the **emergency broadcast flag** (partitioned
  components per FORMAL_FOUNDATIONS).
- `persist(filePath)` / `load(filePath)` — `Storable` contract; connections,
  weights, activation, and node set survive a round trip.
- `getStats` — integrity metrics (total + by-type counts, node count).

## 4. Expansion path (per ADR-001 Phase-I criterion #5: connectome wiring)

1. **Weighted edges** — implemented: `weight` on `Connection`, clamped by
   `maxWeight`, used by `rankPaths` and integrity reporting.
2. **Activation propagation** — implemented: `activate()` BFS with decaying
   activation, activation-ordered neighborhoods via `getNeighborhood()`; edge
   activation + `lastActivatedAt` tracked.
3. **Auto-wiring** — implemented: the exoskeleton subscribes to
   `connectome:link` signals (`nervousSystem.subscribeToAll`) and emits boot
   seed links as events; the Connectome learns the substrate's shape from
   events, not hand-registration.
4. **Graph integrity tests** — implemented: `checkIntegrity()` covers weak
   connectivity, connected components, dangling edges, and the
   emergency-broadcast invariant; regression tests in
   `src/__tests__/connectome-expansion.test.ts`.
5. **Persistence** — implemented: `Storable` `persist`/`load` to
   `.uccp/persist/` alongside the other cognitive-plane stores, so
   `state restore integrity` (Persistence Engine contract) covers the graph.

## 5. Relationship to other organs

- **Memory System** — memories are *content*; the Connectome's tags index them
  associatively (hybrid retrieval already fuses BM25 + vector + RRF in
  `src/kernel/retrieval/fusion.ts`; the Connectome adds the associative-graph
  signal).
- **Learning System** — abstractions discovered there become new cue nodes with
  edges to the components they generalize.
- **Routing System** — signal delivery uses the Connectome to decide *where a
  signal goes*; weights encode learned routing preferences (Law 13 compliance).
- **Sleep Cycle** — the offline pass re-weights and prunes edges (decay), which
  is where the "organization erosion" countermeasure (ledger 7.1) lives for the
  graph.

## 6. Benchmarking

The organ is a component, not a metaphor, only because it is independently
benchmarkable:

- **Graph integrity**: weak connectivity holds; no dangling edges (every edge
  endpoint resolves to a registered node).
- **Query latency**: `findPaths` and neighborhood queries bounded (maxDepth
  capped, adjacency indexed).
- **Reconstruction quality**: multi-cue traversal returns the expected
  reachable set (testable deterministically).
