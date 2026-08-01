# IDEA-0060 — Cognitive Garbage Collector

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "Brains
  forget. Operating systems reclaim memory. UCH needs memory GC,
  knowledge GC, graph GC, signal GC, skill GC, experiment GC,
  relationship GC. Automatic."
- **Related:** `kernel/memory/vmem` (Hot→Warm→Cold→Archive paging),
  recency/decay store, sleep-cycle consolidation (8-stage distillation),
  decision-law evictScore / shouldStore, IDEA-0037 (thermodynamics —
  heat/load/decay), IDEA-0016 (economics — retention as investment),
  IDEA-0029 (cache hierarchy)

## Motivation

UCH reclaims memory (vmem paging, decay, sleep distillation) but
reclamation is organ-local and policy-scattered: vmem pages, stores
decay, sleep consolidates — each with its own trigger, score, and
budget. There is no single *reclamation authority* that knows every
object class (memory, belief, knowledge, skill, relationship, signal,
experiment) and reclaims across them under one policy. Operating systems
did not ship six bespoke deallocators; they shipped one GC story per
memory class with a unified lifecycle.

## The corpus cannot cover it because

vmem covers the cache ladder only; decay covers episodic stores;
sleep-cycle distillation is periodic and consolidation-only; nothing
collects: orphaned knowledge-graph nodes and edges (graph GC), retired
skills and distiled patterns that never re-fired (skill GC), stale
experiments/benchmarks (experiment GC), dangling relationships after
`removeNode` cascades, or dead signals in queues. Eviction scores exist
(decision-law evictScore, vmem score) but are not composed into one
reclaimable-object model.

## Proposal sketch

- One object registry: every Storable/persisted class registers a
  `reclaimable()` descriptor (weight, retention policy, decay law,
  provenance cost, resumption cost).
- Composed reclaim score = value (importance × confidence × recency ×
  reuse frequency) − cost (storage + resumption) − risk (IDEA-0062
  poisoned/compromised objects get *highest* priority — GC as immune
  mechanism, per IDEA-0038).
- Tiers: hot-keep / compact / archive / collect, mirroring vmem but
  applied uniformly; collection always lands in the ledger (Law: GC
  is provenance-visible, undoable via replay).

## Risk assessment

- Premature collection of the only evidence for a belief is a knowledge
  disaster; resumption-cost weighting and archive-before-delete are
  non-negotiable; confidence floors per class must match retrieve
  semantics (IDEA-0057 CQL must see the same retention policy).

## Where it lands

- `src/kernel/memory/gc/` beside vmem; policy table per object class in
  the constitution; design doc `design/COGNITIVE-GC.md`.

## Code impact

- New subsystem; vmem and decay stores get adapters instead of changes;
  sleep cycle gains a GC stage; zero changes to stores that do not opt in.

## Next stage

- Object-class inventory across `kernel/storage` + `connectome` +
  `mnemosyne`; reuse-frequency telemetry exists in traces (IDEA-0066
  profiler consumes it).
