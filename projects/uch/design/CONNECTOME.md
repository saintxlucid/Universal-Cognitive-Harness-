# CONNECTOME.md — Concept Store Design

Status: design reference for the scaffolded `src/connectome/` organ (expanded
from ledger research — graph-memory / MRAgent framing, ledger 3.2).

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

Scaffold state as of 2026-07-31:

- `registerConnection` / `removeConnection` — typed edges with description and
  optional metadata.
- `getConnectionsFrom/To` — adjacency queries.
- `findPaths(from, to, maxDepth)` — DFS path enumeration (the reconstruction
  primitive).
- `getStats` — integrity metrics (total + by-type counts).

## 4. Expansion path (per ADR-001 Phase-I criterion #5: connectome wiring)

1. **Weighted edges** — `FORMAL_FOUNDATIONS` requires edge weights; add
   `weight: number` to `Connection` and use it for path ranking.
2. **Activation propagation** — cue-tag-content reconstruction with decaying
   activation (nearest-neighbor activation like the kernel's `ActivationField`)
   so `getConnectionsFrom` can return activation-ordered neighborhoods.
3. **Auto-wiring** — subscribe to `wireConnectome` in the exoskeleton (already
   invoked) and let organ registration emit `connectome:link` signals; the
   Connectome learns the substrate's shape from events, not hand-registration.
4. **Graph integrity tests** — the organ's own benchmark (`graph integrity`)
   needs regression tests for weak connectivity and the emergency-broadcast
   invariant in `LAWS_OF_COGNITIVE_PHYSICS.md`.
5. **Persistence** — the Connectome should persist to `.uccp/persist/`
   alongside the other cognitive-plane stores so `state restore integrity`
   (Persistence Engine contract) covers the graph.

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
