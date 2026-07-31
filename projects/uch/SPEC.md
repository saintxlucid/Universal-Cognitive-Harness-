# Cognitive Operating System — Specification

> **Canon note (2026-08-01).** This document is the legacy COS-era
> specification. The normative corpus of UCH is now the Five-Book Canon:
> Genesis (product) · Constitution + Laws (immutable law) · Blueprint
> (engineering) · Standards/RFCs (contracts) · Ascension (scale). See
> [docs/README.md](docs/README.md) for the canon map and
> [rfc/RFC-0000-specification-governance.md](rfc/RFC-0000-specification-governance.md)
> for the governance system. This file is retained for historical
> continuity and is superseded where it conflicts with the canon.

## Executive Summary

The COS is a **Cognitive Kernel** — a persistent intelligence runtime that sits beneath any agent framework and above any LLM. It provides structured long-horizon memory, principled retrieval, adaptive learning, and self-improving cognition. It is **not** a library, MCP server, or agent framework. It is an **Artificial Cognitive Infrastructure** — a new layer in the AI computing stack.

## System Architecture

### Stack Position
```
Applications (ChatGPT, Claude, IDE, Discord bots, NPCs)
    ↓
Agents (LangGraph, CrewAI, AutoGen, OpenAI SDK)
    ↓  ←── COS sits HERE
Cognitive Operating System (persistent runtime)
    ↓  ←── LLM becomes a computational resource
Models (GPT, Claude, Gemini, Qwen, DeepSeek)
    ↓
Hardware (GPU, CPU, TPU)
```

### Internal Layered Architecture
```
┌──────────────────────────────────────────────────────────┐
│                  API / MCP / SDK Surface                  │
├──────────────────────────────────────────────────────────┤
│                    Cognitive Modules                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Sensory  │ │ Attention│ │ Underst- │ │ Reason     │  │
│  │ Cortex   │ │ Cortex   │ │ anding   │ │ Graph      │  │
│  │          │ │          │ │ Cortex   │ │            │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├────────────┤  │
│  │ Memory   │ │ Memory   │ │ Dream    │ │ Executive  │  │
│  │ Organ    │ │ Evolution│ │ Engine   │ │ Cortex     │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├────────────┤  │
│  │ Meta     │ │ Identity │ │ Creativ- │ │ Tool       │  │
│  │ Brain    │ │ Engine   │ │ ity Eng  │ │ Intelli-   │  │
│  │          │ │          │ │ ine      │ │ gence      │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
├──────────────────────────────────────────────────────────┤
│                  NeuralFS (Cognitive Filesystem)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Concept  │ │ Experien-│ │ Skill    │ │ World      │  │
│  │ Store    │ │ ce Store │ │ Store    │ │ Model      │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├────────────┤  │
│  │ Project  │ │ Belief   │ │ Goal     │ │ Reasoning  │  │
│  │ Store    │ │ Store    │ │ Store    │ │ Trace St.  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
├──────────────────────────────────────────────────────────┤
│                    Storage Infrastructure                 │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Graph Layer  │ Vector Layer  │ Object Store     │    │
│  │ Event Log    │ Version Store │ Cache Layer      │    │
│  │ Archive      │ MVCC Layer    │ CRDT Sync Layer  │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## Core Data Model

### Concept — The Fundamental Unit of Cognition

```rust
struct Concept {
    id: UUID,
    name: String,
    concept_type: ConceptType,  // Entity | Relation | Process | Quality | Value
    
    // The "DNA" — rich semantic structure
    purpose: String,
    definition: String,
    
    // Relationships (the Connectome)
    is_a: Vec<ConceptID>,   // Inheritance
    part_of: Vec<ConceptID>, // Composition
    causes: Vec<ConceptID>,  // Causality
    precedes: Vec<ConceptID>, // Temporal ordering
    requires: Vec<ConceptID>, // Dependencies
    contradicts: Vec<ConceptID>, // Mutual exclusion
    
    // Provenance (required for all data)
    provenance: Provenance,
    
    // Temporal validity
    temporal: TemporalWindow,
    
    // Lifecycle and confidence
    confidence: Confidence,
    entrenchment: EntrenchmentLevel,  // 1-5
    epistemic_status: EpistemicStatus, // Observation | Fact | Knowledge | Belief | Speculation | Rejected
    
    // Metadata for forgetting/evolution
    importance: f64,       // 0.0-1.0
    access_count: u64,
    last_access: Timestamp,
    prediction_value: f64, // How much this improves predictions
    emotional_weight: f64, // Salience/valence
    
    // Storage
    embedding: Vec<f32>,    // Dense vector for similarity
    sparse_hash: Vec<u64>,  // Sparse code for pattern separation
    created_at: Timestamp,
    updated_at: Timestamp,
}
```

### Episode — An Atomic Experience

```rust
struct Episode {
    id: UUID,
    timestamp: Timestamp,
    
    // Content (one of)
    text: Option<String>,
    structured: Option<JSON>,
    tool_call: Option<ToolInvocation>,
    observation: Option<Observation>,
    
    // Context
    session_id: UUID,
    agent_id: UUID,
    user_id: UUID,
    project_id: UUID,
    
    // Links
    concepts: Vec<ConceptID>,
    preceding_episode: Option<UUID>,
    
    // Provenance
    provenance: Provenance,
    
    // Storage optimization
    compressed: bool,
    summary: Option<String>, // Created during consolidation
}
```

### Edge — Relationship with Time

```rust
struct Edge {
    id: UUID,
    source: UUID,       // Concept or Episode
    target: UUID,       // Concept or Episode
    relationship: String, // "PREFERS", "WORKS_AT", "CAUSES", "PART_OF", etc.
    
    // Bi-temporal model
    valid_at: Timestamp,    // When this was true in the real world
    invalid_at: Option<Timestamp>, // When it stopped being true
    created_at: Timestamp,  // When the system learned it
    expired_at: Option<Timestamp>, // When the system learned it was false
    
    // Provenance
    provenance: Provenance,
    confidence: Confidence,
    
    // Source episode
    source_episode: UUID,
}
```

## Memory Systems

### Dual-System Architecture (Complementary Learning Systems)

| Property | Episodic System (Hippocampus) | Semantic System (Neocortex) |
|----------|------------------------------|---------------------------|
| **Learning rate** | Fast (one-shot) | Slow (interleaved replay) |
| **Representation** | Sparse, pattern-separated | Distributed, overlapping |
| **Storage** | Append-only event log | Knowledge graph + embeddings |
| **Forgetting** | Interference-based pruning | Decay + abstraction |
| **Lookup** | Hash-based + temporal index | Similarity + graph traversal |
| **Purpose** | Veridical recall of specifics | Generalization + prediction |

### Retrieval Pipeline (Multi-Signal Fusion)

```
Query
  ├── Semantic (cosine similarity on concept embeddings)
  ├── BM25 (keyword matching on concept names/definitions)
  ├── Graph BFS (n-hop traversal from related concepts)
  ├── Temporal (filter by valid_at / invalid_at window)
  └── Sparse (match on sparse hash codes for pattern completion)
       │
       ▼
  Score Fusion (RRF: Reciprocal Rank Fusion)
       │
       ▼
  Re-ranking (MMR for diversity, cross-encoder for precision)
       │
       ▼
  Context Assembly (pack into ~1.6K token prompt blocks)
```

### Sleep Cycle (Background Consolidation)

```rust
fn sleep_cycle() {
    loop {
        // 1. Prioritize which episodes to replay
        let candidates = prioritize_episodes(
            novelty_weight: 0.4,
            recency_weight: 0.3,
            importance_weight: 0.2,
            uncertainty_weight: 0.1,
        );
        
        // 2. Replay at 10-20x temporal compression
        for episode in candidates {
            replay(episode, &mut semantic_system);  // Train world model
        }
        
        // 3. Discover patterns across episodes
        let patterns = discover_patterns(candidates);
        
        // 4. Build abstractions (generalize specific → general)
        for pattern in patterns {
            create_abstraction_concept(pattern);
        }
        
        // 5. Detect contradictions
        let contradictions = find_contradictions();
        for c in contradictions {
            invalidate_outdated_facts(c);
            flag_for_review(c);
        }
        
        // 6. Merge duplicate concepts
        let duplicates = find_near_duplicate_concepts(threshold: 0.95);
        for d in duplicates {
            merge_concepts(d);
        }
        
        // 7. Prune low-utility memories
        prune_episodes(threshold: 0.1); // Prediction value < 0.1
        
        // 8. Update ontology
        refine_ontology();
        
        // 9. Generate insights
        for pattern in patterns {
            if pattern.is_novel() {
                let insight = synthesize_insight(pattern);
                store_insight(insight);
            }
        }
        
        wait(SLEEP_INTERVAL); // Configurable, default 5 minutes of idle
    }
}
```

### Forgetting Algorithm

```rust
fn forgetting_score(concept: &Concept) -> f64 {
    let age_factor = exp(-concept.age() / AGE_HALF_LIFE);
    let frequency_factor = concept.access_count as f64 / concept.lifetime_days();
    let importance_factor = concept.importance;
    let prediction_factor = concept.prediction_value;
    let interference_factor = concept.near_memory_count(); // Similar memories
    
    // Forgetting is adaptive: low importance + low frequency + high interference = prime for pruning
    let retention = (
        importance_factor * 0.4 +
        prediction_factor * 0.3 +
        frequency_factor * 0.2 +
        age_factor * 0.1
    ) / (1.0 + interference_factor * 0.3);
    
    1.0 - retention.clamp(0.0, 1.0)
}
```

## Neuromodulation Layer

System meta-parameters dynamically adjusted based on context:

| Parameter | Biological Analogue | Effect |
|-----------|-------------------|--------|
| `learning_rate` | Acetylcholine (ACh) | High = encoding mode (novel), Low = retrieval mode (familiar) |
| `exploration_rate` | Norepinephrine (NE) | High = explore (novel env), Low = exploit (familiar) |
| `discount_factor` | Serotonin (5-HT) | High = long-horizon planning, Low = immediate gratification |
| `reward_sensitivity` | Dopamine (DA) | Drives credit assignment, reinforcement learning |

```rust
struct NeuromodulationState {
    learning_rate: f64,    // 0.01 - 0.5 (ACh)
    exploration_rate: f64, // 0.0 - 1.0 (NE)
    discount_factor: f64,  // 0.5 - 0.99 (5-HT)
    reward_sensitivity: f64, // 0.0 - 1.0 (DA)
}

impl Neuromodulation {
    fn update(&mut self, context: &Context) {
        if context.novelty > 0.7 {
            self.learning_rate = 0.3;    // High ACh: encode aggressively
            self.exploration_rate = 0.6;  // High NE: explore
        } else {
            self.learning_rate = 0.05;    // Low ACh: retrieval mode
            self.exploration_rate = 0.1;  // Low NE: exploit known paths
        }
        
        if context.task_horizon > 10 {
            self.discount_factor = 0.95;  // High 5-HT: long-term planning
        } else {
            self.discount_factor = 0.7;   // Low 5-HT: short-term
        }
    }
}
```

## Cognitive Constitution

### Epistemic Hierarchy

| Status | Confidence | Evidence Required | Action |
|--------|-----------|-------------------|--------|
| **Observation** | Direct provenance | Tool output / API | Store as-is, factual |
| **Fact** | > 0.99 | ≥ 2 independent verifications | Ground truth, infrequently revised |
| **Knowledge** | 0.95 - 0.99 | Provenance chain + contradiction test | Justified, used for reasoning |
| **Belief** | 0.70 - 0.95 | ≥ 1 evidence | Working hypothesis |
| **Speculation** | 0.30 - 0.70 | Logical consistency | Plausible guess |
| **Rejected** | < 0.30 | Contradiction | Archived, not used |

### Belief Revision (AGM-based)

```rust
fn revise(belief_set: &mut BeliefSet, new_proposition: Proposition) {
    let conflict = find_conflicts(belief_set, &new_proposition);
    
    match conflict {
        None => {
            // Expansion: add without removing
            belief_set.add(new_proposition);
        }
        Some(conflicting_beliefs) => {
            // Compare entrenchment levels
            let max_conflict_entrenchment = conflicting_beliefs
                .iter()
                .map(|b| b.entrenchment)
                .max()
                .unwrap();
            
            if new_proposition.entrenchment > max_conflict_entrenchment {
                // Revision: add new, remove conflicting
                for b in conflicting_beliefs {
                    belief_set.contract(b);
                }
                belief_set.add(new_proposition);
            } else if new_proposition.entrenchment < max_conflict_entrenchment {
                // No change, flag contradiction
                flag_contradiction(new_proposition, conflicting_beliefs);
            } else {
                // Equal entrenchment: minimal change heuristic
                resolve_equal_entrenchment(belief_set, new_proposition, conflicting_beliefs);
            }
        }
    }
}
```

## Hallucination Mitigation System

Every retrieved memory carries provenance metadata injected into the prompt:

```rust
fn format_retrieved_context(context: Vec<Memory>) -> String {
    context.iter().map(|m| format!(
        "--- Memory (confidence: {:.2}, source: {}, confirmed: {}, contradictions: {}) ---\n{}",
        m.confidence,
        m.provenance.source,
        m.last_confirmed,
        m.contradictions.len(),
        m.value
    )).collect::<Vec<_>>().join("\n\n")
}
```

The system distinguishes:
- **Observed directly** (confidence > 0.99)
- **Inferred from evidence** (0.70 - 0.99)
- **Speculative** (0.30 - 0.70)
- **Contradicted** (flagged)

Low-confidence retrievals include explicit caveats in the prompt to reduce hallucination.

## Interface Surface (5 Simultaneous Interfaces)

### 1. Core Runtime (Rust)
- The kernel: memory management, cognition, planning, indexing, retrieval, reasoning, learning, evolution, reflection
- Modular architecture — every cognitive function is a swappable module
- Runs as a daemon/service

### 2. SDK (Multi-Language)
- Python, TypeScript, Rust, Go thin clients
- Intelligence lives in the runtime, not the client
- Communication via gRPC + WebSocket

### 3. MCP Server
- Exposes COS to MCP-compatible assistants
- Memory operations, retrieval, reflection, learning tools
- Any MCP-capable agent can use it

### 4. REST API
- Full programmatic access to every cognitive function
- gRPC + WebSocket + Event Streams for real-time

### 5. Agent Plugins
- Adapters: LangGraph, CrewAI, AutoGen, OpenAI Agents SDK, Semantic Kernel, Mastra, LlamaIndex

## Implementation Plan — Phase I (Current)

```
Phase I — Core Memory Subsystems (4-6 weeks)
├── Week 1: Data Model + Storage Foundation
│   ├── Concept, Episode, Edge, Provenance types
│   ├── LSM Tree event log for episodic store
│   ├── B-Tree index for metadata lookup
│   └── MVCC for temporal versioning
├── Week 2: Semantic Knowledge Graph
│   ├── Property graph engine (adjacency list)
│   ├── Bi-temporal edge management
│   ├── Entity extraction pipeline
│   └── Automatic invalidation on contradiction
├── Week 3: Vector Search + Retrieval Pipeline
│   ├── HNSW index for hot memory
│   ├── Multi-signal retrieval fusion (semantic + BM25 + graph + temporal)
│   ├── RRF scoring + MMR re-ranking
│   └── Context assembly (~1.6K token prompt blocks)
├── Week 4: Episodic Memory System
│   ├── Append-only event log with sparse indexing
│   ├── Pattern separation (k-WTA expansion layer)
│   ├── Temporal context indexing
│   └── Episode replay mechanism
└── Week 5-6: Consolidation + Forgetting
    ├── Sleep cycle (background consolidation loop)
    ├── Pattern discovery and abstraction
    ├── Contradiction detection
    ├── Forgetting algorithm (adaptive pruning)
    └── Ontology refinement

Phase II — Cognition Layer (4-6 weeks)
├── Attention cortex (importance scoring)
├── Understanding cortex (concept extraction)
├── Executive cortex (planning + selection)
├── Meta brain (self-observation)
└── Identity engine

Phase III — Interfaces + Integration (4 weeks)
├── Core runtime (Rust daemon)
├── MCP server
├── Python + TypeScript SDK
├── REST + gRPC API
└── Agent framework adapters
```

## Research Foundation

All design decisions are grounded in:

1. **Biology**: Hippocampal episodic encoding, neocortical consolidation, sleep replay, neuromodulation
2. **AI systems**: Mem0 (retrieval fusion), Letta/MemGPT (memory hierarchy, sleep compute), Zep/Graphiti (temporal KG, provenance), LangMem (checkpointing)
3. **Databases**: LSM Trees (write-optimized log), B-Trees (read-optimized index), Property Graphs (relationships), HNSW/DiskANN (vector search), CRDTs (conflict-free sync)
4. **OS**: Microkernel architecture (module isolation), CFS+MLFQ scheduler (cognitive priorities), ARC caching (adaptive replacement), MVCC (temporal queries)
5. **Philosophy**: Pragmatic-Coherence truth theory, AGM belief revision, multi-anchor identity model, virtue epistemology
