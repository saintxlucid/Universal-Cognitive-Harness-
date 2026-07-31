# RETRIEVAL-SCALING.md — When Kernel Memory Becomes the Bottleneck

Status: scaling reference (not v1 architecture). The research ledger's Faiss
pipeline (ledger 2.4, 7.1) is real but calibrated for hundreds of billions of
tokens against a specific model's hidden states. This document answers one
question: **what do we do when `RetrievalFusion`'s latency becomes the
bottleneck?**

## 1. Current architecture (v1, correct for today)

`src/kernel/retrieval/fusion.ts` runs an in-memory hybrid pipeline:

1. Semantic search on the concept graph (embedding cosine)
2. BM25 keyword search on the sparse term index
3. RRF fusion (k = 60) + MMR reranking (diversity)
4. Provenance weighting + recency decay

Plus `src/kernel/retrieval/context-compressor.ts` (2026-07-31): dedupe,
score-gating, truncation before context reaches the Executive/Integration
layers — this reduces what generation must consume (and the Energy Budget must
pay for) without touching the index itself.

This is correct for workspace-scale corpora (thousands of episodes/concepts).
Every component is deterministic, dependency-free, and in-memory. **Do not
replace it because a bigger system needs a bigger index — replace the index
behind the same interface when the latency measurement says so.**

## 2. When to escalate

Trigger conditions (all measurable, none hypothetical):

- `recall()` p95 latency exceeds the organ contract's budget for two
  consecutive consolidation cycles
- Graph store node count crosses the point where full-graph cosine scans
  dominate query time (measure: proportion of query time in `search()` vs
  `mmrRerank()`)
- Memory-organ episode/semantic counts exceed the in-memory heap budget for
  the process

## 3. The scaling ladder

| Tier | Technique | References | When |
|---|---|---|---|
| 1 | Current: in-memory graph + BM25 + RRF | — | Default, workspace scale |
| 2 | Approximate search: HNSW graph index | Malkov & Yashunin 2018 | p95 latency breach with 10⁴–10⁶ vectors |
| 3 | Quantization: OPQ (optimized product quantization) + IVF | Ge et al. 2013 | Memory-bound at 10⁶+ vectors; 100×+ compression of index footprint |
| 4 | Disk-backed ANN + sharding | Faiss IndexShards | Persistent corpora beyond heap |

Implementation rule: each tier plugs in behind the `RetrievalFusion` search
interface (returns `ScoredResult[]`, RRF fusion unchanged). The fusion layer is
the contract; the index is an implementation detail. This keeps the organ's
benchmarks (retrieval precision, latency) stable across tiers.

## 4. What does NOT change when scaling

- RRF fusion of hybrid signals (semantic/keyword/graph/temporal)
- MMR diversity reranking
- Provenance weighting and recency decay
- Context compression before generation
- The `recall` / `recallFormatted` / `recallCompressed` kernel API

## 5. Ledger provenance

- OPQ: Ge, He, Ke, Sun. "Optimized Product Quantization for Approximate
  Nearest Neighbor Search." CVPR 2013.
- HNSW: Malkov & Yashunin. "Efficient and robust approximate nearest neighbor
  search using Hierarchical Navigable Small World graphs." TPAMI 2018.
- Ledger calibration note: the original Faiss pipeline was built against a
  specific model's hidden states at hundreds-of-billions-of-tokens scale; UCH
  embeddings are sparse hashes at workspace scale — only the quantization
  techniques transfer, not the scale assumptions.

## 6. Cognitive Virtual Memory — working-set paging (ADR-005 §7)

Human brains don't keep everything loaded. Neither should UCH. **Cognitive Virtual
Memory** is the scaling model for long-horizon cognition: only the current working set
is resident in active cognition; everything else is *paged* — exactly like RAM.
Design-level guidance, not v1 architecture; implementation is deferred until the trigger
metrics below fire.

### 6.1 The mapping

| OS concept | Cognitive equivalent |
|---|---|
| RAM (resident set) | The context window / working set handed to the Executive and Integration layers (post-`recallCompressed`) |
| Virtual address space | The entire cognitive store: episodic + semantic + connectome + graphs + ledger |
| Page-in | `recall`/`recallCompressed` from the index (kernel API unchanged) |
| Page-out | Compression, consolidation, sleep-cycle distillation, forgetting |
| Page table | Residency map: what is resident, when it was last touched, why it is resident |
| Working set | Active files + concepts + hypotheses + decisions (see `LIVE-COGNITIVE-STATE.md`) |
| Eviction | LRU × importance (connectome activation) × policy (retention, privacy erasure) |

### 6.2 Trigger metrics (all measurable, all pre-deferred)

- **Context pressure**: resident set routinely exceeds the context budget after
  compression → enable residency management.
- **Page-in latency**: `recall()` p95 breach despite retrieval-ladder escalation
  (§3 tier 2–4) → the residency map becomes the hot path.
- **Reconstruction churn**: the same evidence is recalled, compressed, and re-recalled
  across consecutive turns → explicit page-in/page-out events with residency tracking.

### 6.3 Design rules

1. The kernel API does not change: `recall` / `recallFormatted` / `recallCompressed`
   become the page-in path; compression, consolidation, and sleep are the page-out path.
2. Eviction never loses provenance: paged-out evidence leaves an addressable stub
   (id + summary + retention policy) — reversible per Law 12 (Reversibility).
3. The residency map is a first-class ledger structure; page-in/out are observable
   events on the neural event bus, so the Live Cognitive State can report the current
   working set honestly.
4. COT vault contents are never paged into the working set by default (privacy:
   `PRIVACY-ERASURE.md`, EXOSYMBIOSIS §9).
