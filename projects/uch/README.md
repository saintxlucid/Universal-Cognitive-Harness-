# UCH — Universal Cognitive Harness

A portable cognitive infrastructure layer that sits beneath any agent
framework and above any LLM — amplifying capabilities with structured
long-horizon memory, principled retrieval, adaptive learning, and
self-improving cognition.

| | |
| --- | --- |
| **Status** | Active development — core complete, 200+ source modules, 86 test files / 1547 tests passing |
| **Runtime** | Node.js 18+ (ESM, TypeScript strict) |
| **Interfaces** | MCP (STDIO), legacy HTTP/SSE, UCCP server, agent boot module (Claude Code / Codex / OpenCode) |
| **License** | MIT |

## What UCH Is

Not a memory library. Not an agent framework. Not an MCP server.

An **Artificial Cognitive Infrastructure** — a new layer in the AI
computing stack:

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

UCH is designed as a **computational organism** — a collection of
specialized cognitive systems that cooperate the way brain regions do,
while remaining explicit, inspectable, versioned, and computationally
efficient.

## Quick Start

```bash
cd projects/uch
npm install
npm run build          # tsc → dist/

# Run as an MCP server (default command):
node dist/cli/index.js
#   → UCH MCP Server v0.2.0 — LLM: disabled (set OPENAI_API_KEY)

# With an LLM provider:
#   copy .env.example → .env and set OPENAI_API_KEY

# CLI mode:
node dist/cli/index.js status
node dist/cli/index.js help
```

Use the package scripts: `npm test` (vitest), `npm run typecheck`
(`tsc --noEmit`), `npm run lint` (eslint), `npm run build`.

## Documentation Index

| Document | Purpose |
| --- | --- |
| `README.md` | This file — overview, quick start, status |
| `docs/README.md` | Docs hub — index of every reference |
| `docs/CLI.md` | Full `uch` command reference |
| `docs/MCP.md` | MCP tools, transports, and how to connect |
| `docs/SKILLS.md` | Skill system: catalog, import, provenance |
| `docs/memory-filing-rules.md` | Mandatory rules for writing to memory |
| `docs/extraction-map.md` | Provenance record of ported patterns |
| `docs/organism-architecture.md` | High-level organism architecture and topology |
| `docs/organism-implementation.md` | Implementation reference for `CognitiveOrganism` |
| `SPEC.md` | Full cognitive system specification |
| `spec/` | Formal foundations: ontology, constitution, genome, laws |
| `spec/CP.md` | Cognitive Protocol v1 — the versioned contract (envelope, ops, errors, conformance, bindings) |
| `design/` | ADR, architecture, conformance, threat model, privacy |
| `research/` | Research notes, evidence register, synthesis |
| `UCCP-persist-load-SUMMARY.md` | Persist/load implementation summary |

## Architecture

### 10-Layer Cortex

| Layer | Name | Function |
| --- | --- | --- |
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

See `docs/organism-architecture.md` and `spec/COGNITIVE_BIOLOGY.md` for
the full model.

## Implemented Core

| System | Status |
| --- | --- |
| **Cognitive Memory System** | Working — episodic observation, provenance-weighted recall, outcome learning |
| **Retrieval** | Working — RRF fusion over semantic/keyword/graph/temporal signals, recency decay (per-prefix half-lives), provenance weighting, MMR rerank |
| **Synthesis** | Working — grounded claims with `[id]` citation markers, contradiction detection, gap reporting (`SynthesisEngine`) |
| **Takes / Calibration** | Working — gradeable claims with conviction, Brier scorecards, bias tags (`uch takes`, `uch calibration`) |
| **Coding Principles** | Working — 4-principle evaluation with plan verification loop (`uch principles-check`) |
| **15 Cognitive Plane Stores** | Complete — constitution, genome, scientific memory, trust, reflection, decisions, patterns, suggestions, scheduler, health, taste, dreaming, creativity, compiler, webhooks |
| **Persistence Layer** | Working — JSON snapshot with Date serialization, Map↔Record converters, `Storable` interface |
| **Skill System** | Working — catalog, import with provenance index, creation, optimization (`uch skill …`) |
| **CLI + MCP STDIO Server** | Built — 23 MCP tools, `uch` command surface |
| **Agent Boot Module** | Working — auto-loads into Claude Code, Codex, OpenCode on startup |
| **Agentic Resilience Runtime** | Working — backend protocols (state/disk + permissions), middleware pipeline + 5 built-ins, tool-call repair, layered compaction, credential pool, error classification + failover chain, prompt profiles, TTL availability registry, lane queue, subagent registries (persistence, orphans, expiry) |
| **Cognitive Protocol (CP) v1** | Stable — 17-op semantic instruction set (`uch-cp` 1.0.0), envelope validation, version gating, conformance suite, MCP (`cp.list`/`cp.invoke`) + HTTP (`/cp/v1`) + in-process bindings |
| **NeuralFS Version Store** | Working — content-addressed commits (sha256 CIDs), snapshot trees over concepts/episodes/edges/beliefs, diff, checkout (time travel), restore, append-only JSONL journal persistence |
| **Driver Registry** | Working — unified `Driver` interface (start/stop/handleEvent) + registry over 7 drivers: filesystem, git, runtime, agent, acp, ide, mcp |
| **LLM Drivers** | Working — `LLMDriver` interface (complete, stream, multimodal, embed) + OpenAI / Anthropic / Google drivers |
| **Design & Threat Models** | Complete — ADR, conformance, CIC spec, threat model, privacy/erasure |
| **Test Suite** | 86 files / 1547 tests — stores, agents, runtime, MCP, e2e, conformance, agentic resilience |

## In Progress

- **NeuralFS store coverage**: concept/experience/skill/world/project stores working; belief, goal, reasoning-trace stores scaffolded (version store complete)
- **Dream Engine / Sleep Cycle**: Offline consolidation — module scaffolded
- **Connectome**: Relationship graph between concepts — module scaffolded
- **10-Layer Cortex**: Wired sensory→memory layers; reason graph, meta brain, identity engine in design
- **Resilience wiring**: `queryLoop` integration of failover chain + credential pool (modules complete, standalone)

## Key Innovations

- **Concept Genome**: Every concept has DNA — identity, purpose, relationships, dependencies, evolution, evidence
- **NeuralFS**: A cognitive filesystem where concepts, experiences, and skills are first-class objects with provenance, confidence, and lifecycle
- **Cognitive Constitution**: Formal ontology defining what facts, beliefs, knowledge, understanding, identity, and trust mean
- **Forgetting Algorithm**: Intelligent decay based on importance, frequency, confidence, and prediction value
- **Provenance-Weighted Retrieval**: Every memory carries source, timestamp, confidence, evidence, validity window, and trust score
- **Synthesis with Citations**: Every claim the brain makes carries a resolvable citation marker; unattributable claims surface as gaps, never as assertions
- **Calibration**: The brain records gradeable claims, grades them against reality, and exposes Brier scores and bias tags so its own confidence becomes measurable
- **Recency Decay**: Per-prefix half-life map (evergreen concepts vs. decaying episodes) composes multiplicatively with provenance weights in retrieval fusion

## Environment

See `.env.example`. At minimum one LLM provider key is required for
embeddings and AI features; everything else works in deterministic
local mode.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` | LLM provider keys |
| `UCH_LLM_PROVIDER` | `openai \| anthropic \| google \| auto` |
| `UCH_LLM_MODEL` | Default model override |
| `OPENAI_BASE_URL` | Custom endpoint (proxies, local models) |
| `CEREBRAS_API_KEY[_1..3]`, `CEREBRAS_MODEL` | Inference fabric compute resources |
| `UCH_RECENCY_DECAY` | Recency decay overrides (`prefix:halflifeDays:coefficient,…`) |
