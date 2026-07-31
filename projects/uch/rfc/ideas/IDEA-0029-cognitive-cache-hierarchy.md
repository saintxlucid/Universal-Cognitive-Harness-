# IDEA-0029 — Cognitive Cache Hierarchy

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "CPUs have L1/L2/L3; UCH should too:
  L0 immediate attention, L1 working memory, L2 session memory, L3 workspace
  memory, L4 organization memory, L5 global knowledge, Archive — recall
  optimized by architecture, not by vectors"
- **Related:** src/kernel/memory/vmem (Hot→Warm→Cold→Archive paging),
  design/RETRIEVAL-SCALING.md (HNSW/OPQ ladder), src/kernel/retrieval
  (fusion, context compressor), IDEA-0030 (speculation)

## Motivation

Vector search is the fallback, not the design. The claim: recall should be
architectural — a defined cache hierarchy with promotion/demotion rules,
bandwidth and hit-rate budgets per level, so that hot knowledge lives at L0
without any query at all. Research note cited in the intake: current
runtimes distinguish episodic/semantic/procedural memory but a CPU-style
multi-level hierarchy is largely unexplored.

## The corpus cannot cover it because

vmem pages Hot→Warm→Cold→Archive and retrieval scales via the HNSW/OPQ
ladder — both are two-level-ish mechanisms without a full hierarchy, without
per-level bandwidth/hit-rate budgets, and without the architectural
optimization claim (recall by structure, not search).

## Proposal sketch

- Define levels L0–L5 + Archive with: capacity, promotion/demotion rules,
  bandwidth budget, expected hit rate, population source.
- Cache discipline: touch patterns promote; decay demotes; L0 is fed by
  prediction (IDEA-0030) and DMA-style streaming, not queries.
- Hit-rate telemetry becomes a physiology metric (IDEA-0011).

## Risk assessment

- Hierarchy theater: without hit-rate telemetry and measured speedups, L0–L5
  is a renaming of storage tiers. Metrics first.

## Where it lands

- Design doc `design/CACHE-HIERARCHY.md`; extends vmem + retrieval ladder.

## Code impact

- None until telemetry exists over the current vmem/retrieval path.

## Next stage

Instrument the existing vmem + retrieval paths for hit rate and promotion
cost; design the hierarchy from measured access patterns, not the metaphor.
