# Cognitive OS — Research Synthesis

## Architecture Inspiration from Five Major Systems

### Mem0
**Adopt**: Multi-signal retrieval fusion (semantic + BM25 + entity matching), multi-axis scoping (user/agent/app/session), async pipeline pattern, temporal attribute extraction at write time
**Avoid**: Pure ADD-only accumulation (needs consolidation), MD5-only deduplication (use embedding similarity), LLM-in-the-loop for every write

### Letta/MemGPT
**Adopt**: Three-tier memory hierarchy (core ↔ recall ↔ archival), sleep-time compute (dual-agent, offline consolidation), memory blocks as first-class typed objects, agent self-editing memory, hybrid retrieval (BM25 + vector via RRF)
**Avoid**: Coupling memory into interactive agent loop, assuming LLM reliability for tool calls, too many memory instructions

### Zep/Graphiti
**Adopt**: Bi-temporal edges (valid_at + invalid_at), automatic fact invalidation, non-lossy history, provenance linkage to source, three-tier graph (episode → entity/fact → community), hybrid retrieval (semantic + keyword + graph BFS + temporal)
**Avoid**: Over-engineering for simple use cases, using small LLMs for extraction, treating it as vector DB replacement

### LangMem
**Adopt**: Checkpointing, namespaces, state restoration versioning  
**Avoid**: Too slow for real-time (59s p95 search)

### Neuroscience
**Adopt** (from hippocampus): Sparse coding/pattern separation, pattern completion via attractor dynamics, complementary learning systems (fast episodic + slow semantic), sleep consolidation via replay, memory reconsolidation (update without overwrite)
**Adopt** (from neuromodulation): Dynamic meta-parameters (learning rate from ACh, exploration from NE, discount from 5-HT, reward from DA)
**Adopt** (from predictive coding): Hierarchical prediction-error minimization as learning mechanism

---

## The Cognitive OS Architecture — Distilled

### Core Insight
Memory is not the center of cognition. **World model building** is. Memory exists to feed the world model. Every subsystem serves the goal of building, maintaining, and refining predictive models of reality.

### 1. Dual-System Memory (Complementary Learning Systems)

```
┌────────────────────────────────────────────┐
│         COGNITIVE OS MEMORY                │
│                                            │
│  ┌────────────────────────────┐           │
│  │  EPISODIC SYSTEM (Fast)     │           │
│  │  • Append-only event log    │           │
│  │  • Sparse hash-linked index │           │
│  │  • Pattern separation       │           │
│  │    (k-WTA expansion layer)  │           │
│  │  • Pattern completion       │           │
│  │    (attention-based recall) │           │
│  │  • Temporal context indexed │           │
│  │  • Never deleted, low cost  │           │
│  └──────────┬─────────────────┘           │
│             │ Replay (offline)             │
│             ▼                              │
│  ┌────────────────────────────┐           │
│  │  SEMANTIC SYSTEM (Slow)     │           │
│  │  • Knowledge graph          │           │
│  │    (bi-temporal edges)      │           │
│  │  • World model              │           │
│  │    (predictive, hierarchical)│          │
│  │  • Concept Genome nodes     │           │
│  │  • Learned from interleaved │           │
│  │    replay of episodes       │           │
│  │  • Supports generalization  │           │
│  │  • Supports inference       │           │
│  └────────────────────────────┘           │
│                                            │
│  ┌────────────────────────────┐           │
│  │  PROCEDURAL SYSTEM         │           │
│  │  • Tool use patterns       │           │
│  │  • Cached routines         │           │
│  │  • Reinforcement-shaped    │           │
│  │  • Confidence-tracked      │           │
│  └────────────────────────────┘           │
└────────────────────────────────────────────┘
```

### 2. Retrieval Architecture (Multi-Signal Fusion with Graph Traversal)

```
Query
  │
  ├──→ Semantic (cosine similarity on embeddings)
  ├──→ BM25 keyword (sparse lexical matching)
  ├──→ Graph BFS (n-hop entity traversal)
  └──→ Temporal filter (valid_at / invalid_at windows)
        │
        ▼
  Score Fusion (RRF / weighted combination)
        │
        ▼
  Re-ranking (MMR for diversity / cross-encoder for precision)
        │
        ▼
  Context Assembly (pack into prompt blocks, ~1.6K tokens avg)
```

### 3. Memory Lifecycle (Consolidation + Forgetting)

```
Write → Episodic Store (immediate)
          │
          ▼
    [Sleep Cycle — periodic background process]
          │
  ┌───────┴───────────┐
  │                    │
  ▼                    ▼
Semantic             Probe for
Network             Contradictions
Training              │
(interleaved          ▼
 replay)           Invalidate
  │                 old edges
  ▼                    │
Raise              Create new
Abstractions        edges
  │                    │
  ▼                    ▼
Prune low-utility    Merge duplicate
episodic traces      concepts
  │                    │
  └────────┬───────────┘
           ▼
     Ontology Refinement
```

### 4. Information Quality System (Provenance)

Every piece of information carries a complete provenance record:

```json
{
  "value": "Karim prefers explicit architectures over implicit magic",
  "provenance": {
    "source_episode": "episode_uuid_abc123",
    "source_type": "conversation",
    "observed_at": "2026-07-30T14:30:00Z",
    "extracted_at": "2026-07-30T14:30:05Z",
    "confidence": 0.96,
    "evidence_count": 5,
    "last_confirmed": "2026-07-30T14:35:00Z",
    "contradictions": [],
    "version": 1
  },
  "temporal": {
    "valid_at": "2026-07-30T14:30:00Z",
    "invalid_at": null
  },
  "metadata": {
    "importance": 0.87,
    "access_count": 12,
    "last_access": "2026-07-30T16:00:00Z",
    "prediction_value": 0.73,
    "emotional_weight": 0.0
  }
}
```

### 5. Meta-Parameter Modulation (Neuromodulation-Inspired)

System dynamically adjusts based on context:

| Parameter | Biological analogue | Effect |
|-----------|-------------------|--------|
| Learning rate | Acetylcholine (ACh) | High = encoding mode, Low = retrieval mode |
| Exploration rate | Norepinephrine (NE) | High = explore novel paths, Low = exploit known |
| Discount factor | Serotonin (5-HT) | High = long-horizon planning, Low = immediate |
| Reward sensitivity | Dopamine (DA) | Drives credit assignment and reinforcement |

### 6. Hallucination Mitigation

- Every retrieved memory carries confidence, source, and evidence count
- Retrieved information is flagged with provenance metadata in prompts
- The system explicitly distinguishes between "observed directly" vs. "inferred" vs. "speculative"
- Contradictions trigger re-evaluation, not silent overwrite
- Confidence-weighted responses: low confidence → qualify output

## Next Phase: Implementation

The architecture is now sufficiently defined to begin implementation. The recommended order:

1. **Core Data Model** — Concept, Episode, Edge, Provenance record types
2. **Episodic Store** — Append-only event log with sparse indexing
3. **Retrieval Pipeline** — Multi-signal fusion with temporal awareness
4. **Semantic Graph** — Bi-temporal knowledge graph with automatic invalidation
5. **Sleep Cycle** — Background consolidation, pattern discovery, pruning
6. **Procedural Learning** — Tool use patterns and skill acquisition
7. **Neuromodulation Layer** — Dynamic meta-parameter adjustment
8. **MCP Interface** — Expose all capabilities via MCP protocol
