# RFC-0003 — Memory

- **Status:** Accepted (specification in spec/COGNITIVE_BIOLOGY.md +
  spec/COGNITIVE_ONTOLOGY.md; reference implementation in src/kernel/memory/,
  src/mnemosyne/, src/hippocampus/, src/neural-fs/)
- **Family:** Psychology (Memory)
- **Related:** Law 5 (Universal Decay), Law 6 (Experiential Residue), Law 12
  (Reversibility), design/RETRIEVAL-SCALING.md, docs/memory-filing-rules.md
- **Date:** 2026-08-01

## Summary

Memory is the organism's accumulation of experience, organized by kind and
decay, retrievable under evidence rules. It is not a cache — it is the
organism's body of knowledge, with lifecycle: acquire → consolidate →
retrieve → decay → archive.

## Problem

Today's agents treat memory as a context window that dies with the session.
The substrate's memory must outlive pilots, survive decay honestly (Law 5),
and never present unverified claims as facts (Law 4, Law 31).

## Memory kinds (ontology)

| Kind | Store | Implementation | Status |
| --- | --- | --- | --- |
| Episodic | What happened | kernel/memory (episodic-store), hippocampus consolidator | Implemented |
| Semantic | What is known | mnemosyne (semantic-store), neural-fs concept/experience stores | Implemented |
| Procedural | How to do | skill-store, procedural-store | Implemented |
| Scientific | Verified claims with evidence | cognitive-plane scientific-memory, takes/calibration | Implemented |
| Working | Current context | context-compressor, agentic context | Implemented |
| Belief | Graded commitments | neural-fs belief-store, cognitive-time-machine beliefsAt | Implemented |
| Goal | Intentions | goal-store, productivity-kernel | Implemented |
| Identity | Who the organism is | workspace-manifest, genome | Implemented |
| Taste | Preferences | cognitive-plane taste-engine, calibration voice-gate | Implemented |
| Temporal | Time-indexed state | cognitive-time-machine, replay | Implemented |
| Dream/Compressed | Distilled structure | sleep_cycle, consolidation | Implemented |
| Archive | Decayed-but-retained | vmem archive tier (never auto-deleted) | Implemented |
| Simulation/Counterfactual | What-if | not yet — Phase 02 (Digital Twin) | Open |

## Normative requirements

1. **Acquisition** — memory enters through consolidation, never through
   direct foreign writes; filing rules enforced (docs/memory-filing-rules.md).
2. **Decay** — every memory carries a half-life (Law 5); decay is honest,
   never silent renewal (Constitution Article X §2).
3. **Retrieval** — retrieval is evidence-weighted and provenance-aware:
   hybrid RRF fusion, recency decay, context compression
   (design/RETRIEVAL-SCALING.md).
4. **Verification** — knowledge admission requires verification (Law 31);
   unverified claims are hypotheses with confidence + decay.
5. **Erasure** — user-requested erasure is honored and itself recorded
   (design/PRIVACY-ERASURE.md).
6. **Isolation** — grants and projections bound what any client can see;
   consolidation-only visibility (Constitution Article III §6).

## Five Gates verdict

| Gate | Verdict |
| --- | --- |
| G1 Scientific | Pass — memory consolidation theory (hippocampal replay), decay curves, retrieval models |
| G2 Architectural | Pass — Laws 5, 6, 12, 31; Article III §6 privacy |
| G3 Engineering | Pass — stores benchmarked; retrieval scaling ladder designed (HNSW/OPQ) |
| G4 Biological | Pass — Hippocampus/Mnemosyne dual naming with organ contracts |
| G5 Economic | Pass — memory is the product; retrieval quality is the moat |

## Open items

1. Retrieval scaling trigger metrics for the HNSW/OPQ ladder
   (design/RETRIEVAL-SCALING.md) — monitoring thresholds not yet wired.
2. Simulation/counterfactual memory (Digital Twin) — Phase 02 frontier.
3. Memory quantization/budgeting under extreme scale (Billions of episodes):
   sharding and cold storage beyond vmem tiers.
4. Cross-workspace memory federation — deferred (identity first, RFC-0001).

## Milestones

- [x] Episodic + semantic + procedural stores — done
- [x] Scientific memory with takes/calibration — done
- [x] Belief memory + time machine — done
- [x] Sleep-cycle consolidation + distillation — done
- [x] Retrieval fusion + compression — done
- [ ] Scaling ladder instrumentation — open
- [ ] Digital Twin simulation memory — open
