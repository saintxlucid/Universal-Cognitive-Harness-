# IDEA-0087 — Concept Locality (Memory + Knowledge Placement)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 cognitive-microarchitecture intake (round 12) —
  "Memory Locality: CPUs optimize cache locality; UCH should optimize
  concept locality — related memories physically close together.
  Knowledge Locality: Keep architecture near architecture, security
  near security. Traversal becomes faster."
- **Related:** src/kernel/memory/vmem/ (Hot → Warm → Cold → Archive
  paging by recency × salience × energy), design/RETRIEVAL-SCALING.md
  (HNSW/OPQ ladder behind RetrievalFusion), src/kernel/activation/
  connectome.ts (neighborhoods), IDEA-0029 (cognitive cache hierarchy —
  recall by architecture, not vectors), src/kernel/retrieval/
  context-compressor.ts, IDEA-0049 (cognitive storage engine),
  engineering-intelligence domain tiers (knowledge grouped by tier:
  security, databases, architecture)

## Motivation

The vmem tiers decide _when_ something is hot or cold; the connectome
decides _what is related_. Nothing decides _where related things
physically live_. Retrieval is index-driven — embedding similarity,
keyword fusion — never locality-driven: two concepts that activate
together constantly (security + verification, architecture + coupling)
may sit in different pages, forcing repeated cold loads. The intake's
claim: like a CPU that places hot code and its data close, UCH should
place related cognition close, so that a traversal that touches a
neighborhood touches few pages. This also completes the
memory-vs-knowledge layer distinction: memory locality governs
episodic recall; knowledge locality governs the engineering
intelligence graph.

## The corpus cannot cover it because

Paging is temporal (recency/salience/energy score), not spatial:
pages are formed by the score, not by concept distance; there is no
placement policy and no neighborhood packing. The retrieval ladder
(HNSW/OPQ) optimizes _search_ over distance, but the _storage_
layout is untouched — index distance and physical distance are
unrelated. Connectome neighborhoods exist as a query surface
(getNeighborhood) but are never used to steer placement or
compaction.

## Proposal sketch

- Placement policy: concept neighborhood = connectome neighborhood
  (or embedding cluster); a page is a neighborhood; page size is
  bounded by the vmem tier it lands in.
- Locality hints: reads record traversal cost (pages touched per
  neighborhood walk); a placement agent re-packs neighborhoods whose
  traversal cost exceeds a threshold (compaction = knowledge
  re-packing, not just temporal refresh).
- Knowledge locality: the engineering-intelligence graph groups by
  domain tier already; the policy extends to per-domain page affinity
  (architecture near architecture) so domain traversals hit resident
  pages.
- Complementary to IDEA-0029: locality is the architectural mechanism;
  the cache hierarchy is the ladder that moves neighborhoods between
  tiers.

## Risk assessment

- Fragmentation churn: aggressive re-packing burns energy (budgets
  gate it) and must be ledgered as background work (DMA-style,
  IDEA-0030), never on the hot path.
- Metric hygiene: traversal-cost telemetry (IDEA-0071) precedes any
  re-packing policy — measure first, move second.

## Where it lands

- `src/kernel/memory/vmem/` (placement + compaction),
  `src/kernel/activation/` (neighborhood extraction for placement).

## Code impact

- None until the placement policy is specified; connectome
  neighborhoods + vmem compaction are the seed.

## Next stage

- Locality audit: measure pages-touched per neighborhood walk on a
  synthetic connectome; then prototype neighborhood packing.
