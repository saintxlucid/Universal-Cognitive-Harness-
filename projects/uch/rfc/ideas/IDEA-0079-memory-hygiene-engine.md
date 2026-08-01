# IDEA-0079 — Memory Hygiene Engine

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Automatic: Duplicate detection, Conflict detection, Memory aging,
  Compression, Normalization, Summarization, Evidence refresh,
  Relationship repair."
- **Related:** src/sleep_cycle/cycle.ts (8-stage consolidation —
  extract/score/generate/review/publish, memoriesConsolidated/
  patternsLearned metrics), src/kernel/memory/vmem (Hot → Warm → Cold →
  Archive paging with recency × salience × energy score), src/kernel/
  retrieval/context-compressor.ts (dedupe by hash + token overlap,
  score gating), retrieval fusion (hybrid RRF), retrieval scaling
  design (HNSW ladder), IDEA-0050 (knowledge fabric — graph
  relationships), IDEA-0076 (lineage — repair needs lineage), IDEA-0074
  (failure taxonomy — memory failures), IDEA-0060 (garbage collector —
  reclamation policy)

## Motivation

Memories decay, duplicate, contradict, and drift — and a belief system
that never cleans them silently degrades: duplicate knowledge wastes
context, contradictory memories poison reasoning, stale evidence
outlives its source, broken relationships orphan concepts. The corpus
has each hygiene *mechanism* in embryo — sleep-cycle consolidation,
vmem aging, compressor dedupe — but scattered across organs with no
orchestrated hygiene pipeline and no policy for conflict resolution
or evidence refresh.

## The corpus cannot cover it because

Each mechanism is local: the sleep cycle consolidates, vmem ages,
the compressor dedupes at recall time — but nothing *detects
conflicts* between memories (two beliefs with the same subject and
contradictory evidence), nothing *refreshes evidence* (beliefs are not
re-validated against current sources), nothing *repairs relationships*
(broken graph edges persist until something touches them), and the
hygiene triggers are internal heuristics rather than a governed
policy. IDEAs 0060 (GC) and 0076 (lineage) are prerequisites the
engine would consume.

## Proposal sketch

- A hygiene pipeline over the memory organs: scan → classify
  (duplicate / conflict / stale / redundant / broken-link) → propose
  (what to merge, drop, refresh, relink) → verify (the merge is
  checked — no information loss) → commit → journal.
- Conflict policy: conflicts are *not* silently resolved — they are
  surfaced as evidence failures (IDEA-0074) with the lineage (IDEA-0076)
  attached, and resolution follows the sleep cycle's review stage.
- Evidence refresh: memories carry evidence references; refresh
  re-validates against the current world model (IDEA-0031/0017) and
  decays unverifiable claims per Law-5 trust decay.
- SLO hooks (IDEA-0071): duplication rate, conflict rate, freshness as
  observables.

## Risk assessment

- Aggressive hygiene destroys valid nuance (two similar memories may
  be deliberately distinct). Merges must be reversible (journaled,
  replayable per WS-D) and conservative: when in doubt, mark as
  conflict, do not merge.

## Where it lands

- `design/MEMORY-HYGIENE.md`; orchestrates sleep cycle + vmem +
  compressor; consumes GC (0060) and lineage (0076).

## Code impact

- None until the pipeline and conflict policy are specified; the sleep
  cycle's stages become the pipeline's execution substrate.

## Next stage

- Conflict-detection pass drafted against existing memory stores;
  evidence-refresh policy prototyped on one memory class.
