# Cognitive Operating System (COS)

A portable cognitive infrastructure layer that sits beneath any agent framework and above any LLM — amplifying capabilities with structured long-horizon memory, principled retrieval, adaptive learning, and self-improving cognition.

## Vision

Not a memory library. Not an agent framework. Not an MCP server.

An **Artificial Cognitive Infrastructure** — a new layer in the AI computing stack.

```
Applications
    ↓
Cognitive Personalities
    ↓
Skill Ecosystem
    ↓
Cognitive Runtime
    ↓
Cognitive Kernel
    ↓
Neural Filesystem (NeuralFS)
    ↓
Knowledge Storage
    ↓
Models (LLMs become a computational resource, like a GPU)
    ↓
Accelerators
```

## Architecture

The system is designed as a **computational organism** — a collection of specialized cognitive systems that cooperate the way brain regions do, while remaining explicit, inspectable, versioned, and computationally efficient.

### 10-Layer Cortex

| Layer | Name | Function |
| ------- | ------ | ---------- |
| 1 | Sensory Cortex | Perception — chat, vision, code, filesystem, web, API |
| 2 | Attention Cortex | Scoring — importance, novelty, urgency, user intent |
| 3 | Understanding Cortex | Extraction — concepts, meaning, intent, goals, principles |
| 4 | Reason Graph | Relationships — causality, dependencies, contradictions, time |
| 5 | Memory Organ | Multi-store — episodic, semantic, procedural, identity, project, skills |
| 6 | Memory Evolution | Lifecycle — aging, importance, confidence, merging, forgetting |
| 7 | Dream Engine | Consolidation — pattern discovery, abstraction, contradiction detection |
| 8 | Executive Cortex | Selection — memory, tools, reasoning strategy, personality |
| 9 | Meta Brain | Self-observation — hallucination detection, failure analysis, retrieval quality |
| 10 | Identity Engine | Models of user, team, projects, self, goals, capabilities |

### Biological Code Architecture

```
frontal_cortex/       # Executive function, planning, decision-making
hippocampus/          # Episodic encoding, consolidation, recall
neocortex/            # Semantic abstraction, world models, generalization
basal_ganglia/        # Action selection, habits, procedural learning
cerebellum/           # Skill refinement, timing, coordination
amygdala/             # Salience, emotional weighting, relevance
insular_cortex/       # Interoception, self-awareness, error monitoring
visual_cortex/        # Perception pipelines, sensory processing
association_cortex/   # Cross-modal integration, abstraction
temporal_cortex/      # Language, semantics, concept storage
prefrontal_cortex/    # Working memory, goal maintenance, inhibition
sleep_cycle/          # Offline consolidation, pattern discovery
connectome/           # Graph of all relationships between concepts
ontology/             # The Cognitive Constitution — definitions of truth, belief, knowledge
```

## Documentation

- `docs/organism-architecture.md` — high-level organism architecture and system topology
- `docs/organism-implementation.md` — implementation reference for `CognitiveOrganism`, event bus wiring, harness integration, and biology APIs

## Current Phase

**Phase 1: Core Implementation** — The cognitive runtime is under active development with a working core, 215+ source modules, and a full test suite.

### Implemented Core

| System | Status |
|--------|--------|
| **Cognitive Memory System** | Working — episodic observation, provenance-weighted recall, outcome learning |
| **15 Cognitive Plane Stores** | Complete — constitution, genome, scientific memory, trust, reflection, decisions, patterns, suggestions, scheduler, health, taste, dreaming, creativity, compiler, webhooks |
| **Persistence Layer** | Working — JSON snapshot with Date serialization, Map↔Record converters, `Storable` interface |
| **CLI + MCP STDIO Server** | Built — `uch`, `uch serve`, `uch mcp`, `uch ingest` commands |
| **Agent Boot Module** | Working — auto-loads into Claude Code, Codex, OpenCode on startup |
| **Design & Threat Models** | Complete — ADR, conformance, CIC spec, threat model, privacy/erasure |
| **Test Suite** | 37 test files covering stores, agents, runtime, MCP, e2e, conformance |

### In Progress

- **NeuralFS**: Cognitive filesystem — scaffold exists
- **Dream Engine / Sleep Cycle**: Offline consolidation — module scaffolded
- **Connectome**: Relationship graph between concepts — module scaffolded
- **10-Layer Cortex**: Wired sensory→memory layers; reason graph, meta brain, identity engine in design

### Key Innovations

- **Concept Genome**: Every concept has DNA — identity, purpose, relationships, dependencies, evolution, evidence
- **NeuralFS**: A cognitive filesystem where concepts, experiences, and skills are first-class objects with provenance, confidence, and lifecycle
- **Cognitive Constitution**: Formal ontology defining what facts, beliefs, knowledge, understanding, identity, and trust mean
- **Forgetting Algorithm**: Intelligent decay based on importance, frequency, confidence, and prediction value
- **Provenance-Weighted Retrieval**: Every memory carries source, timestamp, confidence, evidence, validity window, and trust score
