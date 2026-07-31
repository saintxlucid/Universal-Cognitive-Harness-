---
track: T02
status: exploratory
sources:
  - https://arxiv.org/abs/2310.08560
  - https://arxiv.org/abs/2504.19413
  - https://arxiv.org/abs/2501.13956
  - https://arxiv.org/abs/2502.12110
  - https://arxiv.org/abs/2604.04853
  - https://arxiv.org/abs/2606.06054
---

# AI Memory Systems: Mechanisms, Not Winners

## Question

Which mechanisms improve persistent agent performance without creating a
larger, less trustworthy prompt-injection and data-governance surface?

## Comparative findings

| System family | Demonstrated mechanism | Valuable research hypothesis | Failure pressure |
| --- | --- | --- | --- |
| MemGPT / Letta | Active-context, core-memory, and archival tiers. | A bounded working set can be explicitly managed. | Core memory can become stale, oversized, or agent-corrupted. |
| Mem0 | Extract, update, consolidate, and retrieve salient facts. | Claim-level memory is more token-efficient than transcripts. | Extraction errors can become durable falsehoods. |
| Zep / Graphiti | Entity/relationship memory with temporal provenance. | Bitemporal claims improve update and contradiction handling. | Entity resolution and graph maintenance are costly and fallible. |
| A-MEM | Dynamic indexed notes and evolving links. | Concepts can be revised as new evidence arrives. | Unconstrained link growth creates opaque, self-reinforcing graphs. |
| MemMachine | Raw episodic retention plus contextual retrieval. | Derived memories must always be traceable to source episodes. | Episode retention creates privacy, cost, and search challenges. |
| MemGate | Query-conditioned trust gating between retrieval and model context. | Recall requires relevance, scope, and security admission—not similarity alone. | Learned gates can fail silently and require adversarial evaluation. |
| GraphRAG | Structured extraction and graph-mediated corpus retrieval. | Offline/global question answering benefits from graph summaries. | Indexing cost and stale extracted graphs make it unsuitable as the sole live memory. |

## Direct evidence

- MemGPT demonstrates the usefulness of OS-inspired virtual-context management.
- Mem0 evaluates selective, consolidated memory against long-conversation
  baselines, including temporal and multi-hop questions.
- Zep/Graphiti makes changing relationships and source provenance central to a
  temporal graph model.
- MemMachine argues that destructive extraction loses ground truth and uses
  whole episodes with contextual expansion at recall time.
- MemGate identifies semantically relevant but unsafe or inappropriate recall as
  a separate security problem.

## Inferences for COS

1. A COS needs both **immutable evidence** and **derived cognitive objects**;
   neither raw transcripts nor summaries alone are sufficient.
2. Retrieval must be multi-stage: scope/permission filter, candidate generation,
   temporal and trust gate, reranking, bounded evidence packet, and response
   claim verification.
3. A concept graph is an index and reasoning aid, never a substitute for source
   evidence.
4. Consolidation must create versioned claims and models, preserving links to
   original episodes and allowing retraction.

## Falsifiable hypotheses

- H1: A source-episode + temporal-claim model will reduce stale-answer errors
  versus fact-only extraction under controlled project-change fixtures.
- H2: A scope/trust gate will reduce cross-project leakage and tool-call drift
  without reducing answer evidence recall below a defined threshold.
- H3: Bounded, cited evidence packets will outperform raw history under equal
  token budgets for workspace-state questions.

## Counterevidence to seek

- Cases where full context remains superior at an acceptable cost.
- Cases where graph traversal adds no measurable value beyond hybrid search.
- Cases where consolidation increases error or latency enough to outweigh
  retrieval savings.
- Attacks that bypass a trust gate through poisoned source episodes or metadata.
