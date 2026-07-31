# UCH — Complete Project Index & Exhaustive Analysis

**Project:** `projects/uch` · Universal Cognitive Harness (UCH) v0.2.0
**Path:** `X:\Software Development\projects\uch`
**Generated:** 2026-07-31 · **Indexer:** OpenCode deep-scan (241 source modules, 64 test files, 28 skills, 6 specs, 15 research documents)

> This document is a full, exhaustive index of the UCH project: folder map, every file, every module's purpose and exports, architecture analysis, algorithms, persistence model, interfaces, tests, specifications, research corpus, known gaps, and recommendations. Use it as the canonical entry point for any agent or human working in this codebase.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Identity & Naming Lineage](#2-project-identity--naming-lineage)
3. [Stats at a Glance](#3-stats-at-a-glance)
4. [Complete Folder Map](#4-complete-folder-map)
5. [Source Module Index (file-by-file)](#5-source-module-index-file-by-file)
6. [Architecture Analysis](#6-architecture-analysis)
7. [Core Data Model](#7-core-data-model)
8. [Key Algorithms](#8-key-algorithms)
9. [Persistence Architecture](#9-persistence-architecture)
10. [Interface Surfaces & Transports](#10-interface-surfaces--transports)
11. [Specification Layer (spec/)](#11-specification-layer-spec)
12. [Research Corpus (research/)](#12-research-corpus-research)
13. [Documentation (docs/ + design/)](#13-documentation-docs--design)
14. [Skills Ecosystem (skills/)](#14-skills-ecosystem-skills)
15. [Test Suite Analysis](#15-test-suite-analysis)
16. [Configuration & Environment](#16-configuration--environment)
17. [Known Gaps, Discrepancies & TODOs](#17-known-gaps-discrepancies--todos)
18. [Recommendations](#18-recommendations)

---

## 1. Executive Summary

UCH (**Universal Cognitive Harness**, a.k.a. **COS — Cognitive Operating System**, **ACE — Artificial Cognitive Exoskeleton / "The Suit"**, and **UCCP** in its organism-era documentation) is an ambitious **TypeScript cognitive infrastructure project** — a persistent cognitive runtime that any IDE, agent, or AI runtime can plug into. It is deliberately *not* a memory library, *not* an agent framework, and *not* an MCP server: it positions itself as **"an artificial cognitive infrastructure — a new layer in the AI computing stack"** that sits between agent frameworks and LLMs.

**What exists today (Phase 1: Core Implementation):**
- A working **cognitive kernel** (episodic + semantic memory, provenance-weighted retrieval, belief revision, sleep-cycle consolidation, neuromodulation) — `src/kernel/`
- **15 cognitive-plane stores** (constitution, genome, scientific memory, trust, reflection, decisions, patterns, suggestions, scheduler, health, taste, dreaming, creativity, compiler, webhooks) — `src/cognitive-plane/`
- A biological **exoskeleton orchestrator** wiring 20+ organs: nervous system (5-layer signal routing), metabolism, connectome, immune, endocrine, sleep cycle, aether (persistent executive), consciousness, hippocampus, neocortex, cortex kernel — `src/exoskeleton/` + `src/{nervous-system,metabolism,aether,connectome,...}/`
- A full **agentic runtime** (ported Claude Code architecture): tool registry, permission engine, query loop, token budgets, compaction, history, tasks, skills — `src/agentic/`
- **CLI + MCP STDIO server (24 tools) + HTTP/SSE UCCP server + 5 transports** (MCP, SSE, HTTP, IPC, A2A, CLI) — `src/cli/`, `src/mcp/`, `src/interface/`, `src/control-plane/`
- **67 test files / 1,251 test cases** (Vitest), all deterministic (no live LLM calls)
- A **governed specification corpus**: 18 Laws of Cognitive Physics, Cognitive Constitution, Cognitive Biology, Ontology, Genome (three-layer identity), Formal Foundations (set theory + information theory + economics + protocol theory)
- **15 research documents** under a governance protocol, plus **17 design documents** (ADR-001..005, threat model, conformance, failure/retry, privacy/erasure, CIC spec, architecture vision, EXOSYMBIOSIS, UNIVERSAL-INTEGRATION, INTEGRATION-LEVELS, LIVE-COGNITIVE-STATE, EVENT-GOVERNANCE, PROJECTIONS, WORKSPACE-MANIFEST)

**Notable tensions found:** README says "37 test files / 215+ modules" while reality is 67 test files / 244 source modules; package-lock.json (v0.1.0) is stale vs package.json (v0.2.0); the Laws doc header says "13 laws" but defines 16; the `graphify-out/` AST artifacts (~4 MB) were untracked and have been removed. *(Resolved 2026-07-31: README stats, Laws header, and package-lock synced; chunkers/hippocampus/neural-fs now covered; vitest config + coverage thresholds added.)*

---

## 2. Project Identity & Naming Lineage

| Name | Where used | Meaning |
|---|---|---|
| **COS** | SPEC.md, design/ARCHITECTURE.md, research/ | Cognitive Operating System — the platform vision |
| **UCH** | package.json, src/harness-api/, README, boot module | Universal Cognitive Harness — the runtime-attachment layer; per ADR-005: the **Universal Cognitive Substrate** (persistent runtime) running **Universal Cognitive Harnesses** (per-ecosystem adapters) |
| **ACE / "The Suit"** | src/index.ts header, spec/GENOME.md | Artificial Cognitive Exoskeleton — "the model is the pilot, the suit is the exoskeleton" |
| **UCCP** | src/cli/uccp.ts, docs/organism-*.md, `.uccp/` dir, tests | Organism-era codename for the server/persistence layer |

**Core philosophy (from GENOME.md):** Persistence over ephemerality; Laws over configuration; Signal universality over direct coupling; Evidence over certainty; Governance over authority. Tagline: *"Persistent cognition. Replaceable pilots."*

**The 10 Immutable Commitments:** (1) never lose a memory, (2) never hide a decision, (3) never bypass governance, (4) never forget identity, (5) never stop learning, (6) never violate physics, (7) never trust one source, (8) never starve a component, (9) never silence without cause, (10) never rewrite alone.

---

## 3. Stats at a Glance

| Metric | Value |
|---|---|
| Source files (`.ts`, excl. tests & graphify cache) | **241** |
| Source lines | **33,673** |
| Source bytes | ~1.25 MB |
| Test files | **64** (1,176 test cases, ~13,200 lines) |
| Compiled `dist/` JS files | 244 (~1.13 MB) |
| Runtime dependency | 1 (`openai ^4.0.0`) |
| package-lock entries | 271 transitive packages |
| Docs (docs/) | 4 files (27 KB) |
| Specs (spec/) | 6 files (74 KB) |
| Research (research/) | 15 files (81 KB) |
| Design (design/) | 11 files (67 KB) |
| Skills (skills/) | 28 skill dirs, 137 files (838 KB), 124 reference files |
| Largest source dirs | cognitive-plane (47 files / 6,034 lines), kernel (35 / 5,720), agentic (21 / 3,076), control-plane (17 / 1,955), coding (7 / 1,485) |

---

## 4. Complete Folder Map

```
projects/uch/
├── .env.example                      # Env contract: OPENAI_API_KEY, CEREBRAS_API_KEY(1-3), UCH_LLM_PROVIDER...
├── package.json                      # v0.2.0, ESM, bin: uch → dist/cli/index.js
├── package-lock.json                 # STALE: still v0.1.0, declares @modelcontextprotocol/sdk (not in package.json)
├── tsconfig.json                     # ES2022, strict, bundler resolution, declaration+source maps, noEmitOnError
├── SPEC.md                           # (18.8 KB) The flagship "Cognitive Operating System" vision spec
├── UCCP-persist-load-SUMMARY.md      # GSD work summary: persist/load added to 15 stores
├── fixture-debug.json                # T01–T14 conformance fixture (T13 fails: token exhaustion detect)
│
├── src/                              # ═══ ALL SOURCE CODE (241 files) — see §5 ═══
│   ├── index.ts                      # Main barrel: ~200 exports across 35 subsystems
│   ├── __tests__/                    # 42 test files (see §15)
│   │
│   ├── accelerators/                 # "Cognitive Computer" Level 2-4: inference fabric, scheduler, 10 virtual processors + routing
│   ├── aether/                       # AetherCore (persistent executive) + Consciousness
│   ├── agent/                        # boot.ts + UCHAgentPlugin (auto-load for any AI agent)
│   ├── agentic/                      # Full agentic engine (tools, permissions, query loop, tasks...)
│   ├── basal_ganglia/                # ActionSelector (action selection)
│   ├── chunkers/                     # Recursive + semantic text chunkers
│   ├── cli/                          # CLI entry (index.ts) + UCCPServer (HTTP/SSE)
│   ├── coding/                       # Code toolkit: index, editor, runner, diff-review, skills
│   ├── cognitive-brain/              # Conscience + MemoryPipeline
│   ├── cognitive-memory/             # SkillRegistry
│   ├── cognitive-plane/              # 15 stores + organism + trace engine + protocol (47 files)
│   ├── cognitive-recorder/           # Activity recorder + event ledger (legacy)
│   ├── cognitive-runtime/            # CapabilityRegistry + MCPTransport
│   ├── connectome/                   # Connectome (wiring graph)
│   ├── context/                      # WorkspaceContextGatherer
│   ├── control-plane/                # Auth, budgets, cache, config, export, limits, monitor,
│   │                                 #   notifications, plugins, secrets, telemetry, transports,
│   │                                 #   lifecycle, policies (17 files)
│   ├── cortex_kernel/                # Attention/Understanding/Executive cortex + MetaBrain +
│   │                                 #   ReasonGraph + CortexKernel integrator
│   ├── drivers/                      # ACP, Agent, Filesystem, Git, IDE, MCP, Runtime drivers
│   ├── embeddings/                   # Embedder (provider-backed or local hash)
│   ├── event-bus/                    # NeuralEventBus + AgentCoordinator
│   ├── executive-brain/              # ExecutiveBrain + Planner + DecisionEngine + Critic
│   ├── exoskeleton/                  # ★ CognitiveExoskeleton root orchestrator + Immune + Endocrine
│   ├── git/                          # GitIngester
│   ├── harness-api/                  # UniversalCognitiveHarness + BiologicalFunctions (16 ops)
│   ├── hippocampus/                  # Hippocampus (episodic consolidation)
│   ├── interface/                    # A2A, CLI, HTTP, IPC transports + CognitiveAPI
│   ├── kernel/                       # ★ CognitiveKernel: memory system, retrieval, storage,
│   │                                 #   constitution, concept-genome, CIC, facts (35 files)
│   ├── llm/                          # LLMClient (openai/anthropic/google/auto) + AnthropicProvider
│   ├── mcp/                          # MCPStdioServer (24 tools, JSON-RPC over stdio)
│   ├── memory/                       # ProgressiveMemorySearch (3-layer)
│   ├── metabolism/                   # Metabolism (energy budgeting) + metabolic-profile
│   ├── neocortex/                    # Neocortex (pattern learner)
│   ├── nervous-system/               # NervousSystem (5-layer routing) + Signal model
│   ├── neural-fs/                    # NeuralFS + 8 stores (belief, concept, experience, goal,
│   │                                 #   project, reasoning-trace, skill, world-model)
│   ├── session/                      # SessionManager
│   ├── shared/                       # Branded types + MistakeLogger
│   ├── skills/                       # SkillPack scanner/installer, catalog/importer, creator, optimizer
│   ├── sleep_cycle/                  # SleepCycle (nap/deep-sleep/dreaming/waking)
│   ├── state-virtualization/         # StateVirtualization (agent state isolation)
│   ├── suit/                         # "The Suit": litmus/CodeScorer + instinct/ReflexEngine
│   ├── workspace-brain/              # WorkspaceBrain + genome, identity, world-model,
│   │                                 #   architecture-graph, timeline, health
│   └── graphify-out/                 # (untracked AST cache — removed; 158 hash files, ~2.1 MB)
│
├── dist/                             # Compiled output (tsc): 244 JS + 244 .d.ts + maps
├── docs/                             # organism-architecture, organism-implementation,
│                                     #   extraction-map, memory-filing-rules
├── design/                           # ADR-001..ADR-005, ARCHITECTURE, CIC-SPECIFICATION,
│                                     #   COGNITIVE-TRACE, COGNITIVE-MIDDLEWARE,
│                                     #   COGNITIVE-PACKAGES, CONFORMANCE, CONNECTOME,
│                                     #   EVENT-GOVERNANCE, EXOSYMBIOSIS, FAILURE-RETRY,
│                                     #   INTEGRATION-LEVELS, LIVE-COGNITIVE-STATE,
│                                     #   PRIVACY-ERASURE, PROJECTIONS, RETRIEVAL-SCALING,
│                                     #   THREAT-MODEL, UNIVERSAL-INTEGRATION,
│                                     #   WORKSPACE-MANIFEST
├── graphify-out/                     # .graphify_ast.json (1.9 MB code graph — untracked, removed)
├── research/                         # 15 governed research docs (see §12)
├── skills/                           # 28 skills: 10 native + 17 imported + 1 local import
│   └── .import-index.json            # Import provenance manifest (version 1)
├── spec/                             # 6 normative specs (see §11)
├── .uccp/                            # Production state root: calibration/, persist/, sessions/ (empty)
├── .uccp-test/                       # Test residue: ~155 journal/snapshot files
└── node_modules/                     # 271 packages
```

---

## 5. Source Module Index (file-by-file)

### 5.1 `src/index.ts` — Main Entry Barrel
The entire public API (~200 exports). Sections: Control Plane → Cognitive Plane (trace, persistence, replay, protocol, signals, search, scheduler, decisions, analytics, patterns, diff, suggestions, constitution, genome, compiler, scientific memory, trust, reflection, creativity, health, taste, dreaming, evolution, intelligence, memory, workspace) → Branded Types → Context → Drivers → Aether → Nervous System → Metabolism → Exoskeleton → Suit/Litmus → Suit/Instinct → CLI/Server → LLM → Accelerators → Embeddings → MCP → Session → Git → Interface → Organs (connectome, basal ganglia, hippocampus, neocortex, cortex kernel, sleep cycle) → Neural Event Bus → NeuralFS → Harness API → Legacy recorder → Reason Graph → Belief/Goal/Trace stores → WebSocket → Kernel sub-exports → Concept Genome → Agentic engine.

### 5.2 Kernel Layer — `src/kernel/` (51 tracked files; ADR-006 kernel services landed 2026-08-01)

**Core:**
| File | Purpose & key exports |
|---|---|
| `cognitive-kernel.ts` | ★ The central memory facade. `CognitiveKernel` composes `EpisodicStore` + `SemanticGraph` + `RetrievalFusion` + `SleepCycle` + `Neuromodulation` + `BeliefSet`; exposes `remember/recall/recallFormatted` (search + MMR rerank + formatted context), `addConcept/addRelationship/learnEvidence/updateContext`, episode queries, `init/shutdown` with optional `PersistentStore`, stats. Sleep default interval 300 s. |
| `index.ts` | Kernel barrel: re-exports types from storage/retrieval/consolidation/cortex/memory/constitution/concept-genome. |

**Storage (`kernel/storage/`):**
| File | Purpose |
|---|---|
| `episodic-store.ts` | Append-only episode store: `append`, `getRecent`, `getBySession/TimeRange/Concept`, `pruneOlderThan`, count. |
| `semantic-graph.ts` | Concept + edge graph: `addConcept/addEdge`, `getAllConcepts`, `bfsTraversal` (depth-limited), `getEdgesFrom`, counts. |
| `persistent-store.ts` | Snapshot + journal persistence: `init` replays `Journal` into stores; `appendEpisode/addConcept/addEdge` write WAL entries; `shutdown` rotates journal and writes snapshot. `StoreSnapshot` = {version, timestamp, episodes}. |
| `journal.ts` | WAL-style append-only `journal.ndjson`; operations: episode:append/mark_compressed/prune, concept:add, edge:add/invalidate, snapshot:created, consolidation:cycle; `replay()` (corrupt lines skipped), `rotate()` (archives to `journal-<epoch>.ndjson`). |
| `graph-store.ts` | Generic `GraphStore` (nodes/edges, adjacency) — foundation type. |
| `vector-store.ts` | `VectorStore` with `VectorRecord` + `SearchResult` — cosine search scaffolding. |
| `index.ts` | Storage barrel. |

**Types (`kernel/types/`):**
| File | Purpose |
|---|---|
| `concept.ts` | `Concept` (SPEC.md struct): name, `concept_type` (entity/relation/process/quality/value), purpose, definition, connectome relationship vectors, provenance, temporal window, confidence, entrenchment 1–5, `epistemic_status`, forgetting metadata (importance, access_count, prediction_value, emotional_weight), embedding + sparse_hash. `createConcept()`. |
| `episode.ts` | `Episode`: timestamp, content (text/structured/tool_call/observation), session/agent/user/project ids, concepts[], preceding_episode, provenance, compressed flag, summary, access metadata. `createEpisode()`. |
| `edge.ts` | `Edge` with bi-temporal validity, source_episode, relationship string, confidence. `createEdge()`. |
| `provenance.ts` | `SourceType` (user/tool_output/model_inference/retrieved_document/system_log/consolidation), `Provenance`, `Confidence` (with calibration_history), `EntrenchmentLevel`, `EpistemicStatus` (observation→fact→knowledge→belief→speculation→rejected), `TemporalWindow`; factory functions. |

**Retrieval (`kernel/retrieval/`):**
| File | Purpose & key exports |
|---|---|
| `fusion.ts` | ★ `RetrievalFusion`: 5-signal search (semantic cosine, BM25 keyword, graph BFS depth-2, temporal, recent fallback) → **RRF fusion** (k=60) → recency-decay boost → MMR rerank (λ=0.5) → formatted context with provenance headers. `ProvenanceWeightConfig` (reliability .35 / confidence .30 / entrenchment .20 / epistemic .15 + access bonus; clamp 0.05–1.5). |
| `evidence.ts` | Evidence classification: `EvidenceClass` (direct/probabilistic/hearsay/secondhand/speculative/unsubstantiated?), `classifyEvidence`, `createSafetyForEvidence` (exists/probable/unknown), `evidenceRank`, duplicate-check evaluation. |
| `recency-decay.ts` | Per-prefix half-life decay map (`DEFAULT_RECENCY_DECAY`), `recencyBoost(daysOld, cfg)`, `parseRecencyDecayEnv` (loud-fail parse), `resolveRecencyDecayMap`, `RecencyDecayParseError`. Evergreen tiers = coefficient 0. |
| `synthesis.ts` | `SynthesisEngine`: grounded synthesis with inline `[id#row]` citation parsing, structured citation normalization, regex fallback, contradiction detection, thin-coverage gaps, confidence scaling. |
| `gap-analysis.ts` | `GapAnalysisEngine`: coverage gaps, missing terms, stale pages, contradictions, confidence scaling. |

**Memory (`kernel/memory/`):**
| File | Purpose |
|---|---|
| `cognitive-memory-system.ts` | ★ Tiered memory (working/core/archival) with local hash embeddings (64-dim, word + trigram hashing), multi-factor consolidation score (importance .35/frequency .25/recency .2/cross-refs .2; promote ≥0.55, archive <0.3), outcome learning (reward_bias/learning_rate policy), lesson extraction on failure, cross-session recall, `persist/load` (JSON), memory profile. |
| `memory-organ.ts` | `MemoryOrgan` — memory organ abstraction with config. |
| `memory-evolution.ts` | `MemoryEvolution` + `EvolutionConfig/Report` — aging/merging/forgetting lifecycle. |

**Consolidation:**
| File | Purpose |
|---|---|
| `consolidation/sleep-cycle.ts` | `SleepCycle` (kernel variant): interval-driven (default 300 s), `cycle()` → consolidation report. |

**Constitution (`kernel/constitution/`):**
| File | Purpose |
|---|---|
| `epistemology.ts` | ★ Belief revision: `classifyEpistemicStatus` (fact >0.99+2 verifications; knowledge ≥0.95+contradiction-tested; belief ≥0.70; speculation ≥0.30; else rejected), `assessTruth` (pragmatic .40/coherence .30/contradiction .20/consensus .10), **AGM-style revision** by entrenchment comparison, equal-entrenchment confidence heuristic (>60% relative → accept), Bayesian `integrateEvidence` (posterior = likelihood·prior/(likelihood·prior + (1−likelihood)(1−prior))). |
| `coding-principles.ts` | `CodingPrinciplesEngine`: 4 principles — think-before-coding, simplicity-first, surgical-changes, goal-driven-execution. |
| `coding-guidelines.ts` | Agent constitution prompt: `CODING_GUIDELINES`, `buildCodingGuidelinesPrompt`, anti-pattern table, verification plan parser/validator (`parseVerificationPlan`, `validateVerificationPlan`, `isWeakVerify`, `renderVerificationPlan`). |
| `engineering-judgment.ts` | `EngineeringJudgmentEngine`: rejects abstraction-bypass, approves extension-with-tests, risk signals. |

**Cortex / concept-genome / CIC / facts:**
| File | Purpose |
|---|---|
| `cortex/neuromodulation.ts` | `Neuromodulation`: ACh learning_rate, NE exploration_rate, 5-HT discount_factor, DA reward_sensitivity; `update(ContextState)` adjusts by novelty/horizon/uncertainty/reward history. |
| `concept-genome/concept-genome.ts` | ★ Concept DNA: `ConceptDNA` (identity, purpose, relationships, dependencies, evolution, evidence), `GeneMarker`, `MutationEvent`, `FusionProposal`, similarity/compare, encode/decode, stats. |
| `cic/circuit-breaker.ts` | `CircuitBreaker` closed/open/half-open (threshold 5, cooldown 30 s, 3 probes); `CircuitBreakerOpenError/TimeoutError`. |
| `cic/threat-mitigations.ts` | `ThreatMitigationEngine` + 14 mitigations T01–T14 (unauthorized access, cross-project contamination, privilege escalation, consent bypass, data exfiltration, runaway process, cascading policy, replay, consolidation poisoning, retention, hard-delete audit, timing side channel, token exhaustion, session hijacking). |
| `facts/facts-fence.ts` | Markdown fact fence (`<!--- uch:facts:begin -->`), `FactRow` kinds (event/preference/commitment/belief/fact), visibility, notability; `parseFactsFence/renderFactsFence`, expiry, trajectory + regression flagging. |

**ADR-006 kernel services (`kernel/process/`, `kernel/memory/vmem/`, `kernel/organism/`, `kernel/transactional/`, `kernel/diagnostics/`, `kernel/merge/`, `kernel/packages/` — added 2026-08-01 per `design/COGNITIVE-KERNEL-SHIPPING.md`):**
| File | Purpose & key exports |
|---|---|
| `process/process-table.ts` | ★ `ProcessTable` — kernel's unit of persistent cognition: spawn (monotonic PID, never reused), attach (joins a PID — nothing transfers), kill (record preserved, Law 12), signal/drainSignals queue, threadsOf, persist/load. |
| `memory/vmem/vmem.ts` | ★ `CognitiveVMem` — cognitive virtual memory: Hot→Warm→Cold→Archive paging, deterministic score (recency decay × salience × energy), touch/promote/evict (archive never auto-deleted), compact (payload-hash merge), stats, persist/load. |
| `organism/versioned-store.ts` + `restore.ts` | `VersionedStore<T>` (monotonic commit versions, rollbackTo preserves history) + `restoreOrganism` (validator-gated snapshot → verify → roll forward/back; store untouched on rejection). |
| `transactional/transaction.ts` | ★ `TransactionalMemory` — ACID cognition: propose → verify (all gates) → commit/rollback (refuses on failed verdict); append-only ledger; `integrityGate`/`organicScoreGate` adapters. |
| `diagnostics/metrics.ts` + `health.ts` | 12 SMART-for-cognition metrics (memoryFragmentation…verificationCoverage) with warn/critical bands (energyEfficiency higher-is-better inversion), `diagnose()` worst-wins aggregation + remediation hints. |
| `merge/cognitive-merge.ts` | ★ `mergeCognition` — two belief sets → disjoint union; genuine conflicts (|Δconfidence| > 0.15, verdict/evidence mismatch) DETECTED + reported, never auto-resolved; deterministic, inputs never mutated. |
| `packages/manifest.ts` + `registry.ts` | `validatePackage` (name/semver/entry-hash via sha256/requires/no-absolute-path) + `PackageRegistry` (offline install/verify/remove/list, tamper detection; **policy entries land in `policy-quarantine/`, never applied — no package auto-modifies the Constitution**). |
| `neural-fs/mounts.ts` | `MountTable` — longest-prefix mount resolution, `canAccess` authority intersection (mount ∩ grant, mirrors ProjectionEngine), `CP_VERBS` (CP ops → FS verb families). |

### 5.3 Exoskeleton Core — `src/exoskeleton/`, `src/aether/`, `src/nervous-system/`, `src/metabolism/`, `src/connectome/`, `src/basal_ganglia/`, `src/hippocampus/`, `src/neocortex/`, `src/sleep_cycle/`, `src/cortex_kernel/`

| File | Purpose & key exports |
|---|---|
| `exoskeleton/exoskeleton.ts` | ★ **Root orchestrator.** `CognitiveExoskeleton` wires 30+ subsystems: eventBus, nervousSystem, metabolism, aether, consciousness, kernel, workspace, executive, traceRecorder, replay, signals, auth, secrets, policies, budgets, otlp, persistence, lifecycle, plugins, codeScorer, reflexEngine, immuneSystem, endocrineSystem, sleepCycle, actionSelector, connectome, hippocampus, neocortex, cortexKernel, fsDriver, gitDriver, agentic (tools/model/history/permissions/stop-hooks). Lifecycle-registered services; aether-registered ticks (endocrine/immune/hippocampus); default policies (allow-all + admin-only secrets); connectome wiring; `createEngine()` → agentic `QueryEngine` with memory adapter + MEMORY_EXTRACTION_HOOK + DREAM_TRIGGER_HOOK; `runAgentic()` streaming loop. |
| `exoskeleton/immune.ts` | `ImmuneSystem` (policy+auth+reflex based): `assess`, `tick`, `getStatus`. |
| `exoskeleton/endocrine.ts` | `EndocrineSystem`: 7 global modulatory signals (Urgency, Confidence, Uncertainty, Resource Pressure, Risk Level, Cognitive Load, Technical Debt); `tick()` pushes to nervous system + consciousness. |
| `aether/aether-core.ts` | ★ `AetherCore`: persistent executive — subsystem registry (register/tick/status), phases, agent counting, heartbeat `broadcastState`, tick loop (default 5 s), energy tracking. |
| `aether/consciousness.ts` | `Consciousness`: 5 layers (reflex/working/strategic/reflective/meta), `observe`, `focus`, priority-aware thought queue. |
| `nervous-system/signal.ts` | ★ Signal model (Law 1): immutable frozen signals with branded types, priority map for ~60 event types (0 peripheral → 4 cortex), layer↔priority maps, `createSignal` with entropy defaults (errors 0.95, session 0.9, build 0.5...), interrupt semantics (priority ≥3). |
| `nervous-system/nervous-system.ts` | `NervousSystem`: 5-layer router; `emit`, `emitFromEvent`, subscribe with filters, energy tracking, `blockOnMatch`, layer stats. |
| `metabolism/metabolism.ts` | `Metabolism`: component registration with declared costs, budgets, `allocate`, `consume`, overrides, energy ledger. |
| `metabolism/metabolic-profile.ts` | `MetabolicCost` (7 dims), `EnergyUnit`, `EnergyAllocation`, `zeroAllocation/subtractAllocation/canAfford`. |
| `connectome/wiring.ts` | `Connectome`: named connections (from/to/type/description) + query by component. |
| `basal_ganglia/action-selector.ts` | `ActionSelector`: priority-queue action selection. |
| `hippocampus/consolidator.ts` | `Hippocampus`: episodic consolidation over kernel (tick → consolidate recent episodes). |
| `neocortex/pattern-learner.ts` | `Neocortex`: pattern/skill learning from repeated events. |
| `sleep_cycle/cycle.ts` | `SleepCycle` (organism variant): phases awake/napping/deep-sleep/dreaming/waking; `nap()`, `deepSleep()`, `dream()` → `SleepReport`. |
| `cortex_kernel/attention-cortex.ts` | `AttentionCortex`: importance scoring (importance/novelty/urgency/intent), bottleneck detection. |
| `cortex_kernel/understanding-cortex.ts` | `UnderstandingCortex`: concept extraction, co-occurrence. |
| `cortex_kernel/executive-cortex.ts` | `ExecutiveCortex`: plan competition/selection. |
| `cortex_kernel/meta-brain.ts` | `MetaBrain`: self-observation, reflective insights. |
| `cortex_kernel/reason-graph.ts` | `ReasonGraph`: causal links, dependency chains, contradiction reports. |
| `cortex_kernel/integrator.ts` | `CortexKernel` + `ConsciousnessGate`: integration of cortex layers, insights. |

### 5.4 Cognitive Plane — `src/cognitive-plane/` (47 files, 6,034 lines)

| Subdir / file | Purpose & key exports |
|---|---|
| `organism/organism.ts` | ★ `CognitiveOrganism`: `MemoryOrgans` (8 organs — sensory PerceptionGrid [4 modalities], working, episodic=kernel, semantic, procedural, emotional, social, evolutionary) + 9 engines (AttentionEngine, PredictionEngine→Conscience, CuriosityEngine, DoubtEngine, WisdomEngine, CounterfactualEngine, IdentityEngine→WorkspaceIdentity, ImmuneSystem, EvolutionEngine). `initialize()` subscribes to `file:saved`/`git:commit`/`error:occurred`. |
| `constitution/constitution.ts` | `CognitiveConstitution`: immutable laws (severity immutable/foundational/advisory), `addLaw`, `checkCompliance`, `getViolations`, builtin laws (no fabrication, provenance, immutable history), `persist/load` (skips builtin laws). |
| `genome/species-genome.ts` | `SpeciesGenome`: NEVER-changing identity — philosophy, 18 laws, 10 commitments. |
| `genome/workspace-genome.ts` | `WorkspaceGenome`: per-workspace conventions/sections, `persist/load`. |
| `genome/adaptive-genome.ts` | `AdaptiveGenome`: skill proficiencies, confidence distributions. |
| `memory/scientific-memory.ts` | `ScientificMemory`: evidence-backed entries (certainty confirmed/likely/uncertain/speculative/contradicted, confidence, source, contradictions), `persist/load`, stats. |
| `compiler/knowledge-compiler.ts` | `KnowledgeCompiler`: 9-stage compression events→facts→knowledge→mental-model→framework→pattern→heuristic→principle→wisdom; counters persisted. |
| `trust/trust-engine.ts` | `TrustEngine`: 6 trust levels none→full, decay, verification bonuses, `getLowTrust`, `persist/load`. |
| `reflection/self-reflection-engine.ts` | `SelfReflectionEngine`: nightly reflection sessions (phases/categories), `persist/load`. |
| `decisions/decision-log.ts` | `DecisionLog`: alternatives, status, stats, `persist/load`. |
| `patterns/pattern-library.ts` | `PatternLibrary`: trace patterns + 5 matcher types, `persist/load`. |
| `suggestions/suggestion-engine.ts` | `SuggestionEngine`, `persist/load`. |
| `scheduler/task-scheduler.ts` | `TaskScheduler` (cron-ish, priorities, handlers excluded from persistence), `persist/load`. |
| `health-metrics/project-health-engine.ts` | `ProjectHealthEngine`: multi-dimension health, `persist/load`. |
| `taste/taste-engine.ts` | `TasteEngine`: 9 taste dimensions, preference learning, `persist/load`. |
| `dreaming/workspace-dreaming.ts` | `WorkspaceDreaming`: idle anomaly detection dreams, `persist/load`. |
| `creativity/creativity-engine.ts` | `CreativityEngine`: techniques (analogy/combine/reverse...), novelty classes, `persist/load`. |
| `signals/signal-store.ts` | `SignalStore`: record/filter/ack, auto-replay triggers. |
| `search/search-engine.ts` | `SearchEngine`: semantic search over ledger. |
| `analytics/workspace-analytics.ts` | `WorkspaceAnalytics`: trace/decision/signal/activity analytics + timeseries. |
| `diff/cognitive-diff.ts` | `CognitiveDiff`: trace/decision/signal diffs, state snapshots. |
| `replay/cognitive-replay.ts` | `CognitiveReplay`: flight-recorder replay of ledger. |
| `trace-engine/cognitive-trace.ts` | `CognitiveTrace` (OTel-aligned spans), `createTrace/endTrace/addTraceEvent`, span kinds. |
| `trace-engine/trace-ledger.ts` | `TraceLedger`: span store with stats. |
| `trace-engine/trace-recorder.ts` | `TraceRecorder`: subscribes event bus → traces. |
| `persistence/persistence-engine.ts` | ★ Shared persistence utilities: `Storable`, `dateReviver`, `writeSnapshot/readSnapshot`, `mapToRecord/recordToMap`, `serializeDates`, `collectPersistableStores`. |
| `persistence/persistence-provider.ts` | `PersistenceProvider`: store registry, `persistAll/loadAll`. |
| `persistence/trace-persistence.ts` | `TracePersistence`: JSONL trace file persistence (`.uccp/traces.jsonl`). |
| `protocol/capability-protocol.ts` | `CognitiveProtocolRegistry`, `CapabilityProtocol/Handler/Result`, `capabilityID`. |
| `protocol/protocol-adapter.ts` | `createProtocolAdapter`, `protocolHealthCheck`. |
| `evolution/benchmark-engine.ts` | `BenchmarkEngine`: `Benchmarkable` metric runs. |
| `evolution/experiment-engine.ts` | `ExperimentEngine`: designs/trials/results, min-sample guard. |
| `evolution/mutation-engine.ts` | `MutationEngine`: proposals, apply/rollback, mutable subsystem registry. |
| `evolution/evolution-engine.ts` | `EvolutionEngine`: cycle = benchmark + experiment + mutation; report/adaptations. |
| `calibration/takes.ts` | `TakeFence`: gradeable claims — conviction 0–1, quality correct/incorrect/partial/unresolvable, double-resolution rejection. |
| `calibration/calibration.ts` | `computeCalibrationProfile`: Brier scores, accuracy, scorecards, conviction buckets, bias tags. |
| `calibration/voice-gate.ts` | `gateVoice`: conversational vs jargon text gate (profile/nudge/footer/report/cli modes). |
| `calibration/store.ts` | `CalibrationStore`: JSON-backed takes store (`.uccp/calibration`). |
| `index.ts` | Plane barrel. |

### 5.5 Cognitive Brain / Memory / Recorder / Runtime / Workspace Brain / Executive Brain

| File | Purpose |
|---|---|
| `cognitive-brain/conscience.ts` | `Conscience`: session reflection, repetitive-pattern detection, anomaly detection, next-activity prediction, `ReflectionReport/PredictionResult`. |
| `cognitive-brain/memory-pipeline.ts` | `MemoryPipeline`: activity → kernel memory ingestion, concept extraction, `PipelineReport`. |
| `cognitive-memory/skill-registry.ts` | `SkillRegistry`: trigger matching, invocations, dependencies. |
| `cognitive-recorder/recorder.ts` + `event-ledger.ts` + `cognitive-activity.ts` | Legacy activity recorder: `Recorder`, `EventLedger` (indexed immutable ledger), `CognitiveActivity` + `createActivity/completeActivity`. |
| `cognitive-runtime/capability-registry.ts` | `CapabilityRegistry` + `Capability`. |
| `cognitive-runtime/mcp-transport.ts` | `MCPTransport`: JSON-RPC MCP client transport (initialize/list tools/call). |
| `workspace-brain/workspace-brain.ts` | ★ `WorkspaceBrain`: composes genome, identity, world-model, architecture-graph, timeline, health; records decisions, incidents, handoffs; lazy graph-organ attach points (knowledgeGraph/decisionGraph/taskGraph/evolutionHistory/dna) + `persistWorkspace`/`loadWorkspace`/`close` at `.uccp/persist/`. |
| `workspace-brain/genome.ts` | `createGenome`/`genomeSummary`. |
| `workspace-brain/identity.ts` | `WorkspaceIdentity` (mission/goals/style/last_updated). |
| `workspace-brain/world-model.ts` | `WorkspaceWorldModel`: subsystems, decisions, coding standards; `addDecision/addSubsystem/worldModelSummary`. |
| `workspace-brain/architecture-graph.ts` | `ArchitectureGraph`: nodes/edges of workspace architecture. |
| `workspace-brain/timeline.ts` | `WorkspaceTimeline`: timeline events (git/build/decision/incident...). |
| `workspace-brain/health.ts` | `WorkspaceHealth`: health metrics with lower/higher-is-better classification. |
| `workspace-graphs/knowledge-graph.ts` | `WorkspaceKnowledgeGraph`: artifact/commit/build/failure/pr/review nodes + touches edges, fed by the neural event bus (7 event types); cap-guarded. |
| `workspace-graphs/decision-graph.ts` | `WorkspaceDecisionGraph`: decision nodes (empty props — no DecisionLog duplication) + causes/alternative_to/supersedes/references edges. |
| `workspace-graphs/task-graph.ts` | `WorkspaceTaskGraph`: task nodes + depends_on/status_changed/touches/informed_by edges (edge-only decision links). |
| `workspace-graphs/evolution-history.ts` | `WorkspaceEvolutionHistory`: cycle nodes + counters (cycles/successful/failed/mutationsKept), manifest persist with counter restore. |
| `workspace-graphs/workspace-dna.ts` | `WorkspaceDNA`: per-workspace sha256 identity fingerprint + mutation tracking (stableSerialize, key-order invariant). |
| `executive-brain/executive-brain.ts` | ★ `ExecutiveBrain`: planner + decision engine + critic; publishes events; handoffs. |
| `executive-brain/planner.ts` | `Planner`: plans with steps, dependencies, status. |
| `executive-brain/decision-engine.ts` | `DecisionEngine`: decisions with options/status/revisits. |
| `executive-brain/critic.ts` | `Critic`: critiques with severity-classified issues. |
| `event-bus/neural-event-bus.ts` | ★ `NeuralEventBus`: pub/sub with `'*'` wildcard, filters, history, module/protocol routing, isolation. |
| `event-bus/agent-coordinator.ts` | `AgentCoordinator`: agent registration/status, handoffs, delegation. |

### 5.6 Agentic Engine — `src/agentic/` (21 files, 3,076 lines)

| File | Purpose |
|---|---|
| `tools/types.ts` | Tool contracts: `Tool/ToolDef/ToolInputSchema`, `PermissionDecision`, `CanUseToolFn`. |
| `tools/registry.ts` | Tool pool: `getAllBaseTools`, `getTools('reasoning'|...)`, `assembleToolPool`, deny-rule filtering, `registerTool(s)`. |
| `tools/implementations.ts` | 13 built-in tools: Bash, FileRead/Edit/Write, Glob, Grep, WebFetch, TodoWrite, Memory, AskUserQuestion, Sleep, Subagent; `isReadOnlyCommand/isDestructiveCommand`. |
| `permissions/permissions.ts` | Permission engine: rule matching (whole/content/wildcard/field), buckets, safety-sensitive paths (.env/.git/config) non-overridable, modes (plan/acceptEdits/dontAsk/headless). |
| `model/caller.ts` | `ModelCaller` interface + `LLMClientAdapter`. |
| `model/tool-parser.ts` | XML tool-call parsing (JSON/kv/self-closing), rendering, id generation. |
| `query/engine.ts` | ★ `QueryEngine`: streaming agent loop (submitMessage), stop hooks, extractMemories/triggerDream hooks. |
| `query/loop.ts` | `queryLoop`: turn execution, max-turns, abort, tool feedback. |
| `query/tool-execution.ts` | `runTools/runToolUse/runToolsPartitioned`, result messages. |
| `query/token-budget.ts` | Token budgets: `checkTokenBudget`, continuation tracker, per-model output limits, `computeCostUsd`. |
| `query/stop-hooks.ts` | `MEMORY_EXTRACTION_HOOK`, `DREAM_TRIGGER_HOOK`, `runAutoDream`. |
| `context/compaction.ts` | Context compaction: `shouldAutoCompact`, `compactConversation`, `summarizeMessages`, token estimation. |
| `context/prompt-builder.ts` | System prompt assembly: tool XML rendering, message building. |
| `context/system-context.ts` | System context: project guidance discovery (AGENTS.md/CLAUDE.md), memory dir. |
| `history/history.ts` | `HistoryManager`: JSONL conversation history, session listing, corrupt-line survival. |
| `state/store.ts` | Reactive store + `diffSubscribe`. |
| `state/session-state.ts` | Session state: usage tracking, message formatting. |
| `tasks/tasks.ts` | Task model: `LocalAgentTask`, `LocalShellTask`, `DreamTask`, registry, continuations. |
| `skills/skills.ts` | Skill loading: frontmatter parsing, `loadSkillsDir`, renderers, `BUNDLED_SKILLS`. |
| `types.ts` | Message/ContentBlock/ToolCall/Terminal/StreamEvent types. |
| `index.ts` | Full agentic barrel (see §5.1 reference). |

### 5.7 Coding Toolkit — `src/coding/` (7 files)

| File | Purpose |
|---|---|
| `toolkit.ts` | ★ `CodingToolkit` facade: code index + editor + runner + diff review + skills. |
| `code-index.ts` | `CodeIndex`: TS/Python symbol extraction, import graph, transitive impact. |
| `file-editor.ts` | `FileEditor`: edit with undo, path containment. |
| `command-runner.ts` | `CommandRunner`: denylist/allowlist, timeouts. |
| `diff-review.ts` | `DiffReview`: hunk parsing, TODO/secret/duplicate flags. |
| `coding-skills.ts` | Skill matching for coding contexts. |

### 5.8 Control Plane — `src/control-plane/` (17 files)

| File | Purpose |
|---|---|
| `auth/auth.ts` | `Auth`: agent registration, API keys, token create/verify/revoke. |
| `budgets/budgets.ts` | `BudgetTracker`: daily/session/per-agent token+cost budgets. |
| `cache/lru-cache.ts` | `LRUCache<T>` with TTL + eviction. |
| `config/config-loader.ts` | `ConfigLoader`: merge/env/file resolution of `UCCPConfig`. |
| `export/export-engine.ts` | `ExportEngine`: JSON/JSONL/CSV/Markdown export of traces/decisions/signals. |
| `limits/rate-limiter.ts` | `RateLimiter`: sliding-window limits. |
| `monitor/health-monitor.ts` | `HealthMonitor`: component health checks, categories, uptime. |
| `notifications/webhook-dispatcher.ts` | `WebhookDispatcher`: deliveries + stats, `persist/load`. |
| `plugins/plugin-loader.ts` | `PluginLoader`: manifest loading, hooks. |
| `secrets/secrets-store.ts` | `SecretsStore`: encrypted-at-rest-by-contract secret entries. |
| `telemetry/otlp-exporter.ts` | `OTLPExporter`: trace→span conversion, export queue. |
| `transport/mcp-sse.ts` | `MCPSSETransport`: JSON-RPC over SSE (client side). |
| `transport/sse-server.ts` | `SSEServer`: sessions by clientId, broadcast, heartbeat. |
| `transport/websocket-transport.ts` | `WebSocketServer` (minimal). |
| `lifecycle.ts` | `Lifecycle`: service registry with dependency-order start/stop. |
| `policies.ts` | `PolicyEngine`: allow/deny rules with priority + conditions. |
| `index.ts` | Barrel. |

### 5.9 Interface Layer — `src/interface/` + `src/mcp/`

| File | Purpose |
|---|---|
| `interface/cognitive-api.ts` | `CognitiveAPI`: operation dispatcher over the harness. |
| `interface/http-transport.ts` | `HTTPTransport`: REST-ish transport over exoskeleton. |
| `interface/cli-transport.ts` | `CLITransport`: command-line transport. |
| `interface/ipc-transport.ts` | `IPCTransport` (EventEmitter-based, message channels). |
| `interface/a2a-transport.ts` | `A2ATransport`: Agent-to-Agent messages, handshake/heartbeat. |
| `mcp/stdio-server.ts` | ★ `MCPStdioServer`: JSON-RPC 2.0 over stdio, **25 tools**: observe, remember, recall, session-save/load/list/handoff, git-ingest, plan, reflect, learn, critique, status, sm-store/sm-recall/sm-facts, constitution-check, summarize, extract-concepts, schedule, principles-check, organic-score, gap-analysis, mem-search, mem-get. |

### 5.10 Drivers — `src/drivers/` (7 files)

| File | Purpose |
|---|---|
| `filesystem/filesystem-driver.ts` | `FileSystemDriver`: read/write/delete/list + events (`file:created/saved/...`). |
| `git/git-driver.ts` | `GitDriver`: commit/status info + events (`git:commit/...`). |
| `acp/acp-driver.ts` | `ACPDriver`: Agent Client Protocol peer lifecycle. |
| `agent/agent-driver.ts` | `AgentDriver`: spawn/stop agent instances. |
| `ide/ide-driver.ts` | `IDEDriver`: diagnostics aggregation, cursor/selection state. |
| `mcp/mcp-driver.ts` | `MCPDriver`: external MCP connection/tool calls. |
| `runtime/runtime-driver.ts` | `RuntimeDriver`: runtime stats. |

### 5.11 Harness API, Agent Boot, and Remaining Modules

| File | Purpose |
|---|---|
| `harness-api/universal-harness.ts` | ★ `UniversalCognitiveHarness`: the original attachment facade — builds event bus + kernel + workspace/executive brains, `start/stop`, `getStatus` (`UCHStatus`). |
| `harness-api/biological-functions.ts` | ★ `BiologicalFunctions`: the 16 cognitive ops — observe, understand, remember, retrieve, predict, plan, reflect, learn, critique, simulate, execute, verify, compress, consolidate, sleep, evolve. |
| `agent/boot.ts` | ★ Auto-load bootstrap: `bootUCH(config)` singleton → `UCHAgentPlugin`; `getUCH()`. |
| `agent/plugin.ts` | ★ `UCHAgentPlugin`: full stack (kernel, workspace, executive, bio, llm, embedder, fabric, scheduler, accelerators, session, git ingester, scientific memory, constitution, decision log, MCP stdio, context gatherer, coding toolkit); `boot()` (kernel init + sleep + auto git ingest + fabric health), `getContext()`, `learnFromInteraction()`, `recordDecision/recordConvention`, `saveAndHandoff/loadSession`, `gatherContext`, `getSummary`, `shutdown`. Tool detection via env vars (CLAUDE_CODE/CODEX_API_KEY/OPENCODE/CURSOR/...). |
| `llm/provider.ts` | `LLMClient`: provider auto-selection (openai/anthropic/google/auto), no-op mode, embeddings. |
| `llm/anthropic-provider.ts` | `AnthropicProvider` + types. |
| `embeddings/embedder.ts` | `Embedder`: provider-backed or local hash embeddings + cosine. |
| `session/manager.ts` | `SessionManager`: sessions, memories, handoff export, load/restore. |
| `git/ingester.ts` | `GitIngester`: conventional-commit parse, ingestRecent(n) → episodes. |
| `context/gatherer.ts` | `WorkspaceContextGatherer`: projects/git/config/env summary. |
| `memory/progressive-search.ts` | ★ `ProgressiveMemorySearch`: 3-layer search (index → timeline → details), token estimates, private-block stripping. |
| `shared/branded-types.ts` | ★ Branded types: SignalID, ComponentID, EnergyUnit, Entropy, Novelty, Confidence, Timestamp, LawID, CapabilityID, SessionID, SignalPriority, InterruptLevel + factories + `InformationMetrics/MetabolicCost/EconomicProposal`. |
| `shared/mistake-logger.ts` | `MistakeLogger`: mistake records with RCA. |
| `skills/skillpack.ts` | `SkillPackScanner` + `SkillPackInstaller` (SKILL.md discovery, frontmatter, source prefix). |
| `skills/skill-catalog.ts` | `SkillCatalogScanner`, `SkillImporter` (+ `.import-index.json` provenance), table renderer. |
| `skills/skill-creator.ts` | `SkillCreator`: template-based SKILL.md generation. |
| `skills/skill-optimizer.ts` | `SkillOptimizer`: invocation analysis, low-success flagging. |
| `suit/litmus/code-scorer.ts` | ★ `CodeScorer` ("Organic Code Engine"): 16-dimension file scoring with penalties (missing tests, nesting, security, size, duplicates, TODOs), history. |
| `suit/instinct/reflex-engine.ts` | ★ `ReflexEngine` ("Engineering Reflex Engine", zero-LLM): 6 built-in reflexes — duplicate-abstraction, architecture-violation, complexity-gate, security-reflex, naming-reflex + 1; custom registration, severity block/warn/info. |
| `state-virtualization/state-virtualization.ts` | `StateVirtualization`: per-agent state attach/detach, shared snapshots, summaries. |
| `neural-fs/index.ts` | ★ `NeuralFS`: `FSEntry` tree over stores (concept/experience/skill/fact/prediction/project/directory). |
| `neural-fs/belief-store.ts` | `BeliefStore`: beliefs with status hypothesis/accepted/rejected/contested/superseded. |
| `neural-fs/concept-store.ts` | `ConceptStore`: concept directory entries. |
| `neural-fs/experience-store.ts` | `ExperienceStore`. |
| `neural-fs/goal-store.ts` | `GoalStore`: goals with status/priority. |
| `neural-fs/project-store.ts` | `ProjectStore`: project memory. |
| `neural-fs/reasoning-trace-store.ts` | `ReasoningTraceStore`: reasoning steps (observation/deduction/induction/abduction/analogy/hypothesis/conclusion/counterargument). |
| `neural-fs/skill-store.ts` | `SkillStore`. |
| `neural-fs/world-model.ts` | `WorldModel`: world facts + predictions. |
| `chunkers/recursive.ts` | Recursive text chunker. |
| `chunkers/semantic.ts` | Semantic chunker (sentence-boundary aware). |
| `chunkers/index.ts` | Barrel. |
| `cli/index.ts` | ★ CLI entry (see §10.1). |
| `cli/uccp.ts` | ★ `UCCPServer`: HTTP server, port 3100 — routes `/health`, `/mcp` (POST), `/sse` (GET), `/messages` (POST), `/api/status`, `/api/token`, `/api/suit/litmus`, `/api/suit/instinct`, `/api/aether`, `/api/aether/observe`; CORS; w/ circuit breaker + threat engine + cortex modules. |

---

## 6. Architecture Analysis

### 6.1 The Vision Stack
```
Applications → Cognitive Personalities → Skill Ecosystem → Cognitive Runtime
→ Cognitive Kernel → NeuralFS → Knowledge Storage → Models (LLM = computational resource) → Accelerators
```

### 6.2 The 10-Layer Cortex
| Layer | Name | Implementation status |
|---|---|---|
| 1 | Sensory Cortex | ✅ `PerceptionGrid` (4 modalities), drivers |
| 2 | Attention Cortex | ✅ `AttentionCortex`, `AttentionEngine` |
| 3 | Understanding Cortex | ✅ `UnderstandingCortex`, `MemoryPipeline` |
| 4 | Reason Graph | ✅ `ReasonGraph` (causality/dependencies/contradictions) |
| 5 | Memory Organ | ✅ `CognitiveKernel` + 8 `MemoryOrgans` |
| 6 | Memory Evolution | ✅ `MemoryEvolution`, `consolidate()`, forgetting |
| 7 | Dream Engine | 🟡 `SleepCycle` + `WorkspaceDreaming` scaffolded |
| 8 | Executive Cortex | ✅ `ExecutiveCortex`, `ExecutiveBrain` |
| 9 | Meta Brain | ✅ `MetaBrain` + `Conscience` |
| 10 | Identity Engine | ✅ `WorkspaceIdentity` + 3-layer genome |

### 6.3 Biological Code Architecture (implemented)
- **frontal_cortex** → `executive-brain/` · **hippocampus** → `hippocampus/` · **neocortex** → `neocortex/` · **basal_ganglia** → `basal_ganglia/` · **cortex_kernel** → `cortex_kernel/` · **connectome** → `connectome/` · **sleep_cycle** → `sleep_cycle/` · **nervous-system** → `nervous-system/` · **aether** → `aether/` · **metabolism** → `metabolism/` · **immune/endocrine** → `exoskeleton/`

### 6.4 The 5 Nervous Systems (docs/organism-architecture.md)
1. **Perception** — FileSystemDriver, GitDriver, SignalStore, TraceRecorder
2. **Cognitive** — PatternLibrary, DecisionLog, WorkspaceAnalytics, CognitiveDiff, SuggestionEngine
3. **Memory** — ScientificMemory, KnowledgeCompiler (9 stages), EpisodicStore, SemanticGraph, Constitution
4. **Executive** — ExecutiveBrain, Planner, DecisionEngine, Critic, TaskScheduler, RateLimiter, WebhookDispatcher
5. **Evolution** — BenchmarkEngine, ExperimentEngine, MutationEngine, EvolutionEngine
Plus 4 cross-cutting pillars: **Constitution, Trust, Science, Taste**.

### 6.5 The 19 Laws of Cognitive Physics (spec/LAWS_OF_COGNITIVE_PHYSICS.md)
1. **Signal Universality** — everything is an immutable signal
2. **Conservation of Energy** — no computation is free; declared metabolic costs
3. **Causality** — every state change causally attributable; no orphan causal graph
4. **Evidence Over Assertion** — no component owns truth
5. **Universal Decay** — everything decays (half-life per entity)
6. **Experiential Residue** — every computation leaves compressible lessons
7. **Triadic Validation** — no action without 3 independent perspectives (Executive + Memory + Judiciary)
8. **Recursive Organization** — same laws at every scale
9. **Developmental Lifecycle** — Embryonic→…→Archived; mutation preferred
10. **Identity Persistence** — genome outlives every component (≥3-store replication)
11. **Local Knowledge** — no component requires global knowledge (the most important scalability law)
12. **Reversibility** — replayable, not just undoable
13. **Minimal Consciousness** — signals terminate at lowest capable layer (peripheral→cortex)
14. **Economic Rationality** — every operation justifies its energy cost; ROI < 0.1 never scheduled (homeostasis exempt)
15. **Information Conservation** — ≈0 information-gain signals must not propagate past classifying layer
16. **Interrupt Hierarchy** — priority preemption with deadlines (peripheral 100 ms → executive 10 ms)
17. **Signal Fusion** — no action on a single weak signal; decisions require fused, risk-flagged evidence (Cortex Kernel)
18. **Governance Before Landing** — no workspace change lands without passing the governance gate (Constitution)
19. **Cognition Ownership** — the organism owns every cognitive artifact; drivers/packages/hosts hold grants, never ownership (added 2026-08-01, ADR-005 Amendment A; enforced at trace boundary, image cache, package gate; Constitution Art. III §6)

### 6.6 Normative Hierarchy
**Formal Foundations (L0)** → **Laws (L1, immutable)** → **Cognitive Biology (L2)** → **Constitution (L3, amendment-only)** → Legislature Policies → Executive Orders → Component Specs (L4). The Constitution defines separation of powers (Executive/Legislature/Judiciary), Triadic Validation (Reflex/Routine/Significant/Constitutional action classes), Rights of Components, amendment process (¾ supermajority), supremacy, judicial review, and 3 emergency levels (Watch/Lockdown/Survival).

### 6.7 Wiring / Dependency Topology (who imports what)
```
boot.ts → plugin.ts → kernel + workspace + executive + bio + llm + embedder + fabric
        → scheduler + accelerators + session + gitIngester + scientificMemory + constitution
        → decisionLog + contextGatherer + coding + mcpStdio

cli/index.ts → kernel + workspace + executive + bio + llm + embedder + session + gitIngester
             + scientificMemory + constitution + MCPStdioServer + exoskeleton (think/chat) + UCCPServer (serve)

exoskeleton.ts → eventBus + nervousSystem + metabolism + aether + consciousness + kernel
               + workspace + executive + traceRecorder + replay + signals + auth + secrets
               + policies + budgets + otlp + persistence + lifecycle + plugins + codeScorer
               + reflexEngine + immune + endocrine + sleepCycle + actionSelector + connectome
               + hippocampus + neocortex + cortexKernel + fsDriver + gitDriver
               + agentic (tools, model, permissions, history, stop-hooks, QueryEngine)

kernel → episodic-store + semantic-graph + persistent-store + journal + retrieval/fusion
       + sleep-cycle + neuromodulation + provenance/concept/episode/edge types + epistemology

cognitive-plane/organism → eventBus + kernel + scientificMemory + constitution + knowledgeCompiler
                         + conscience + trustEngine + evolution + workspace identity
```

**Key architectural observations:**
- The **CognitiveKernel is the memory backbone** — nearly every subsystem (organism, plugin, CLI, exoskeleton, UCCP server) constructs its own kernel instance; there is no single shared singleton by design (each attach point gets its own), but they all persist to `.uccp/persist`.
- The **exoskeleton is the reference composition** — the fullest wiring of the biological architecture + control plane + agentic engine.
- **Signals vs Events duality**: the nervous system defines strict immutable signals (Law 1), while the event bus provides the pragmatic pub/sub used by most modules. `createSignal` bridges them.
- **Branded types** enforce Law 1/16 invariants at compile time (SignalID, EnergyUnit, Entropy...).
- The **agentic engine is a port of the Claude Code architecture** (tools/permissions/query loop/compaction/tasks) integrated as `CognitiveExoskeleton.createEngine()`.

---

## 7. Core Data Model

### 7.1 Concept (kernel/types/concept.ts + SPEC.md)
`{ id, name, concept_type (entity|relation|process|quality|value), purpose, definition, is_a/part_of/causes/precedes/requires/contradicts (connectome vectors), provenance, temporal {valid_at, invalid_at, created_at, expired_at}, confidence {value, method, calibration_history[]}, entrenchment (1–5), epistemic_status, importance, access_count, last_access, prediction_value, emotional_weight, embedding, sparse_hash }`

### 7.2 Episode
`{ id, timestamp, content {text|structured|tool_call|observation}, session_id, agent_id, user_id, project_id, concepts[], preceding_episode, provenance, compressed, summary, access_count, last_access }`

### 7.3 Edge (bi-temporal)
`{ id, source, target, relationship, source_episode, valid_at/invalid_at, created_at/expired_at, confidence, provenance }` — supports contradiction invalidation (`contradicts` edges).

### 7.4 Provenance / Confidence
Every claim carries: source type (6 kinds), source_id, reliability (0–1), timestamp; confidence with calibration history; entrenchment; epistemic status. **Retrieval emits provenance headers** for hallucination mitigation: `confidence`, `provenance factor`, `reliability`, `epistemic status`, `source`.

### 7.5 NeuralFS
8 stores (belief, concept, experience, goal, project, reasoning-trace, skill, world-model) exposed as `FSEntry` tree: `{type: concept|experience|skill|fact|prediction|project|directory, name, meta}`.

---

## 8. Key Algorithms

| Algorithm | Location | Description |
|---|---|---|
| **5-signal retrieval fusion** | `kernel/retrieval/fusion.ts` | Semantic (cosine) + BM25 keyword + graph BFS (depth 2, 0.5/depth) + temporal + recent fallback → RRF (k=60) → recency boost → MMR (λ=0.5) |
| **Provenance weighting** | fusion.ts | `score × (0.35·reliability + 0.30·confidence + 0.20·entrenchment + 0.15·epistemic) + access bonus`, clamp 0.05–1.5 |
| **MMR diversity rerank** | fusion.ts | `λ·relevance − (1−λ)·maxSimilarity` to selected set |
| **Recency decay** | `kernel/retrieval/recency-decay.ts` | Per-prefix half-life: `boost = coeff × hl/(hl + days_old)`; evergreen tiers untouched |
| **Bayesian belief revision** | `kernel/constitution/epistemology.ts` | Posterior = `lp/(lp+(1−l)(1−p))`; AGM-style entrenchment comparison; equal-entrenchment >60% rule; truth = 0.4 pragmatic + 0.3 coherence + 0.2 contradiction + 0.1 consensus |
| **Epistemic classification** | epistemology.ts | fact >0.99 & ≥2 verifications; knowledge ≥0.95 & contradiction-tested; belief ≥0.70; speculation ≥0.30 |
| **Forgetting / consolidation** | `kernel/memory/cognitive-memory-system.ts`, memory-evolution | Multi-factor score = 0.35·importance + 0.25·freq + 0.2·recency + 0.2·cross-refs; promote ≥0.55, archive <0.3; episodic prune older than 24 h; SPEC: knapsack `max Σ KD·IG s.t. storage ≤ B` |
| **Sleep cycle (kernel)** | `kernel/consolidation/sleep-cycle.ts` | Interval 300 s; consolidation report; SPEC 9-step: prioritize (novelty .4/recency .3/importance .2/uncertainty .1) → replay 10–20× → pattern discovery → abstraction → contradiction invalidation → merge (0.95) → prune (prediction value <0.1) → ontology refine → insights |
| **Neuromodulation** | `kernel/cortex/neuromodulation.ts` | learning_rate (ACh), exploration_rate (NE), discount_factor (5-HT), reward_sensitivity (DA) modulated by context |
| **Cognitive scheduler** | `accelerators/scheduler.ts` | Profile (complexity/reasoning/creativity/verification/risk) → strategy: human_approval (risk ≥0.8), deterministic (frugality ≤0.25), cached, multi_model (verification ≥0.6), large_model (reasoning ≥0.6), small_model; FNV-1a cache keys, 200 entries, 60 s TTL; every strategy carries `virtualCpu`/`tier`/`preferredProviderId`/`model`/`providerCount` |
| **Virtual processors (L4)** | `accelerators/virtual-processors.ts` | 10-CPU namespace (reasoning/memory/engineering/security/creativity/planning/research/reflection/classification/embedding) with affinity vectors + min/default tiers; `resolveVirtualCpu` (weighted affinity; empty profile → classification.cpu frugal home), `requiredTier` (tiny/standard/deep mirroring scheduler thresholds), `resolveProvider` (cheapest healthy exact-tier provider; failures → cost → latency; ≥3 providers for verification) |
| **Inference fabric** | `accelerators/fabric.ts` | 8 accelerator kinds (semantic, compression, reasoning, prediction, memory, ontology, classification + code-scorer), provider health/reroute, preferred-provider + per-call model override (L4), `skipInference` deterministic fallbacks, coprocessor isolation |
| **Litmus code scoring** | `suit/litmus/code-scorer.ts` | 16-dimension profile with penalties (missing tests, nesting, security, size, duplicates, TODOs), threshold + history |
| **Reflex engine** | `suit/instinct/reflex-engine.ts` | 6 built-in zero-LLM reflexes: duplicate-abstraction, architecture-violation, complexity-gate, security, naming (+1); severity block/warn/info; error isolation |
| **Calibration (takes)** | `cognitive-plane/calibration/` | Brier score, accuracy, conviction buckets (0.05 increments, no false precision), bias tags, voice gate |
| **Knowledge compiler** | `cognitive-plane/compiler/` | 9 stages: events → facts (2–5×) → knowledge (10–100×) → wisdom (1000× compression ratio) |
| **Signal entropy defaults** | `nervous-system/signal.ts` | error 0.95, session/agent 0.9, build/test 0.5, memory 0.4, file/git 0.3 |
| **Circuit breaker** | `kernel/cic/circuit-breaker.ts` | closed/open/half-open; threshold 5, cooldown 30 s, 3 probes |
| **Local hash embeddings** | `cognitive-memory-system.ts`, `embeddings/embedder.ts` | 64-dim word + trigram hashing, normalized; used when no API key |
| **3-layer progressive search** | `memory/progressive-search.ts` | index (compact) → timeline (chronological) → details; ~10× token savings |
| **Agentic loop** | `agentic/query/` | streaming turns, tool feedback, permission gates, token budgets, compaction, stop hooks (memory extraction, dream trigger) |
| **Cognitive process model (ADR-006 A)** | `kernel/process/process-table.ts` | PID namespace (branded, monotonic, never reused across load), threads (drivers attached to same PID — attach joins, nothing transfers), kill preserves record (Law 12), signal queue |
| **Cognitive vmem (ADR-006 B)** | `kernel/memory/vmem/vmem.ts` | Hot→Warm→Cold→Archive paging; score = recency decay × salience × energy; eviction demotes lowest score; archive never auto-deleted; compaction merges shared payloadRef |
| **Organism versioning (ADR-006 C)** | `kernel/organism/` | VersionedStore (monotonic commits, rollback keeps history) + validator-gated restoreOrganism (verify before touch, no mutation on rejection) |
| **Transactional cognition (ADR-006 D)** | `kernel/transactional/` | propose → verify (all gates, order preserved) → commit/rollback; refuse on failed verdict or double-commit; append-only ledger |
| **Self-diagnosis SMART (ADR-006 E)** | `kernel/diagnostics/` | 12 health metrics, warn/critical bands, higher-is-better inversion (energyEfficiency), worst-wins overall + remediation hints |
| **FS mounts (ADR-006 F)** | `neural-fs/mounts.ts` | Longest-prefix mount resolve; canAccess = mount ∩ grant (ProjectionEngine mirror); CP_VERBS map |
| **Cognitive merge (trivial slice)** | `kernel/merge/cognitive-merge.ts` | Disjoint knowledge unions; conflicts detected (confidence/verdict/evidence), never auto-resolved; deterministic, immutable inputs |
| **Cognitive packages (offline core)** | `kernel/packages/` | validatePackage (sha256 entry hashes, semver, no abs paths) + PackageRegistry install/verify/remove offline with tamper detection; policy quarantine — Constitution never auto-modified |
| **CP instruction catalog** | `protocol/catalog.ts` | Assembly-table metadata for all 17 CP ops (category, organ, energy cost 1–10, expected output, verification requirement) + monotonic cognitive clock |
| **Driver compliance certification** | `drivers/compliance.ts` | POSIX-style: declared L0–L4 + supported ops → protocol coverage %, level fidelity (per-level op minimums), energy profile, certified/partial/not-certified verdict |

---

## 9. Persistence Architecture

**Two complementary patterns:**

1. **Kernel WAL + snapshot** (`kernel/storage/persistent-store.ts` + `journal.ts`):
   - Append-only `journal.ndjson` (per-run rotation to `journal-<epoch>.ndjson`), operations: episode:append, concept:add, edge:add/invalidate, snapshot:created, consolidation:cycle
   - `snapshot.json` = `{version: 1, timestamp, episodes: [...]}` with full Episode shape
   - `init()` replays journal into in-memory stores; `shutdown()` rotates + snapshots

2. **15 Storable stores** (`cognitive-plane/persistence/persistence-engine.ts`):
   - `writeSnapshot/readSnapshot` with `dateReviver` (Date reconstruction), `mapToRecord/recordToMap`, `serializeDates`
   - Stores: constitution (skips builtin laws), workspace genome, scientific memory, knowledge compiler (counters), trust, reflection, decisions, patterns, suggestions, task scheduler (handlers/timers excluded), project health, taste, dreaming, creativity, webhook dispatcher
   - `PersistenceProvider.persistAll/loadAll` registry
   - Runtime state root: `.uccp/` (`calibration/`, `persist/`, `sessions/`); traces at `.uccp/traces.jsonl`; history at `.uccp/history.jsonl`

**Durability guarantees (design):** persisted before acknowledgment; soft delete with 90-day tombstones; hard delete only with admin grant; orphaned-derived-object policy by confidence tier (<0.5 immediate, ≥0.8 preserved).

---

## 10. Interface Surfaces & Transports

### 10.1 CLI (`uch` — dist/cli/index.js)
Commands: `mcp` (default), `serve`, `status`, `ingest`, `session list|export`, `remember`, `recall`, `think|chat` (agentic run), `skills`, `skill scan|catalog|import|create|optimize|provenance`, `mem-search|mem-timeline|mem-get`, `gap-analysis`, `synthesize`, `takes add|resolve|list`, `calibration`, `principles-check`, `organic-score`, `help`.

### 10.2 MCP STDIO Server (25 tools)
`observe, remember, recall, session-save, session-load, session-list, session-handoff, git-ingest, plan, reflect, learn, critique, status, sm-store, sm-recall, sm-facts, constitution-check, summarize, extract-concepts, schedule, principles-check, organic-score, gap-analysis, mem-search, mem-get`

### 10.3 UCCP HTTP Server (port 3100)
`/health`, `/mcp` (POST JSON-RPC), `/sse` (GET, 15 s heartbeat), `/messages` (POST), `/api/status`, `/api/token`, `/api/suit/litmus`, `/api/suit/instinct`, `/api/aether`, `/api/aether/observe`; CORS enabled.

### 10.4 Transport implementations
| Transport | File | Status |
|---|---|---|
| MCP stdio | `mcp/stdio-server.ts` | ✅ production |
| MCP SSE | `control-plane/transport/mcp-sse.ts` + `sse-server.ts` | ✅ |
| HTTP | `interface/http-transport.ts` | ✅ |
| IPC | `interface/ipc-transport.ts` | ✅ |
| A2A | `interface/a2a-transport.ts` | ✅ |
| CLI | `interface/cli-transport.ts` | ✅ |
| WebSocket | `control-plane/transport/websocket-transport.ts` | 🟡 minimal |

### 10.5 Agent boot integration
- `bootUCH({toolName})` → `UCHAgentPlugin` (singleton), wired via CLAUDE.md / AGENTS.md / OpenCode plugin
- Lifecycle: `boot()` → `getContext()` before each message → `learnFromInteraction()` after → `saveAndHandoff()` on exit → `loadSession()` to resume in another tool
- Tool detection: env vars (`CLAUDE_CODE`, `CODEX_API_KEY`, `OPENCODE`, `CURSOR`, `GITHUB_COPILOT`, `WINDSURF`, `ANTIGRAVITY`)

### 10.6 Conformance status (design/CONFORMANCE.md)
MCP transport passes 9/10 fixtures (F10 pending); REST/CLI/A2A/IPC unimplemented; CIC envelope fields 5/10 in MCP adapter.

---

## 11. Specification Layer (spec/)

| File | Contents |
|---|---|
| `FORMAL_FOUNDATIONS.md` | Level 0 axioms: typed set theory (𝕊ℂ𝕄𝔼ℙ𝕂𝔹𝔾𝕍𝕋ℕ), exactly-3-graphs (causal DAG / connectome / semantic), hybrid time (τ + Lamport λ + version vectors), Shannon entropy + 5 mandatory metrics, entropy-reduction pipeline (classification ↓20% → dedup ↓40% → aggregation ↓20% → compression ↓10% → importance ↓5% → priority ↓5%), economic calculus (ROI, 5 decision rules, 6 economic agents, Metabolism as market maker), 7-layer protocol stack, execution model (5 interrupt levels), consciousness threshold `IG(s)·N(s,M) > θ_conscious`, branded-type enforcement, three-genome identity |
| `LAWS_OF_COGNITIVE_PHYSICS.md` | 32 laws in 5 families (Laws 1–19 original; 20–32 added 2026-08-01). Dual naming table (19 organs: engineering name first, biological in parens). Enforcement: static analysis (L1/L8/L11/L30), Judiciary (L2/L3/L4/L7/L14/L27), Metabolism (L14/L21), Nervous System (L15/L24), constitutional review (all 32), specification governance (RFC-0000) |
| `CONSTITUTION.md` | 8 articles: Separation of Powers, Triadic Validation, Rights of Components (6 sections incl. §6 Session Privacy / consolidation-only visibility, added 2026-08-01), Amendment Process, Supremacy, Judicial Review, Emergency Powers (Watch 24 h / Lockdown 1 h / Survival 15 min), amendability |
| `COGNITIVE_BIOLOGY.md` | 10 physiological processes: Plasticity, Homeostasis, Metabolism (7 cost dims incl. attention), Development (8 stages), Healing, Sleep (8 activities), Evolution (micro/meso/macro), Immune Response, Endocrine Regulation (7 signals), Thalamic Gating |
| `COGNITIVE_ONTOLOGY.md` | Shared vocabulary: ~50 signal types in 6 families, entity taxonomy (Thought 5 layers, Memory, Evidence, Threat, Policy), 8-stage lifecycle transition table, component taxonomy (cells/tissues/organs/systems), priority 0–4 |
| `GENOME.md` | ACE identity: philosophy (5), engineering principles (5), design values (7), pilot relationship + handoff package, 3 genomes (Species immutable / Workspace amendable / Adaptive learned), 10 Immutable Commitments |

---

## 12. Research Corpus (research/)

| Doc | Core content |
|---|---|
| `README.md` | Phase I research framing; 10 tracks T01–T10; Evidence/Inference/Hypothesis/Decision note contract |
| `RESEARCH_GOVERNANCE.md` | 6 non-negotiable boundaries (no hidden chain-of-thought, no implicit authority, no identity deception...), 6 design gates, unresolved research objects |
| `RESEARCH_PLAN.md` | 7 domains (A biological memory → G intelligence research) with concrete literature lists |
| `SYNTHESIS.md` | Comparative analysis of Mem0 / Letta-MemGPT / Zep-Graphiti / LangMem / neuroscience; "Memory is not the center of cognition. World model building is." |
| `EVIDENCE_REGISTER.md` | 16-row seed register (MemGPT, Letta, Mem0, Zep, A-MEM, MemMachine, MemGate, CoALA, Generative Agents, Reflexion, LongMemEval, Nature 2025 consolidation, MCP, A2A, CloudEvents) |
| `foundations/01-cognitive-constitution.md` | 14 constitutional invariants + canonical ontology (13 objects with "cannot be confused with") + 5 prohibitions |
| `foundations/02-cognitive-biology.md` | Organ as design unit; 15-organ system table; Cognitive Bus; scoped activation field |
| `foundations/03-cognitive-physics.md` | Quantities-separation table; activation hypothesis (8-term sigmoid); claim confidence logit; VoC economics; 8 disorder rates; governed evolution fitness |
| `foundations/04-cognitive-protocol.md` | Events for observation, commands for effects; 17 event families; 16-field event envelope; 7 interaction semantics; **no `Think` command**; 5 protocol tests |
| `interfaces/universal-cognitive-harness.md` | Driver→UCH facade→CIC→COS layering; 16-op surface with authority boundaries; compatibility ladder T0–T4 (transport axis — capability axis L0–L4 is `design/INTEGRATION-LEVELS.md`) |
| `interfaces/universal-cognitive-interoperability.md` | Contract-first, transport-second; CIC operation families; driver model; multi-agent namespaces; 4 falsifiable hypotheses |
| `knowledge/knowledge-compiler.md` | 8 compilation stages with diagnostics; Concept Genome minimum portable record; 7 safeguards; 3 evaluation hypotheses |
| `ai-memory/2026-memory-systems.md` | 7-system comparison table; 4 COS inferences; 3 falsifiable hypotheses + counterevidence |
| `biology/systems-consolidation.md` | 5 computational inferences from 2025 Nature engram study; what NOT to infer; 4 evaluation fixtures |
| `world-models/bounded-world-models.md` | Versioned scoped evidence-linked world models; 3 never-auto-convert object classes; prediction taxonomy; hypotheses WM-H1..H3 |

---

## 13. Documentation (docs/ + design/)

**docs/ (4 files):**
- `organism-architecture.md` — UCCP organism architecture: 5 nervous systems, 4 pillars, cross-module data flow, SSE transport spec, Storable/PersistenceProvider
- `organism-implementation.md` — `CognitiveOrganism` implementation reference: MemoryOrgans (8), engines (9), NeuralEventBus enhancements (module/protocol routing), BiologicalFunctions (16 ops)
- `extraction-map.md` — provenance record of adapted patterns (skill-pack, progressive search, coding principles, synthesis/gap analysis); CLI wiring table; 10 native + 17 imported skills; verification: 60 files/1138 tests
- `memory-filing-rules.md` — mandatory filing rules: Concept/Episode/Edge destinations, notability gate, citation requirements, 6 takes-attribution rules

**design/ (20 files):**
| Doc | Status | Summary |
|---|---|---|
| `ADR-001-workspace-owned-cognitive-runtime.md` | Accepted | UCH = workspace-owned cognitive runtime; COS substrate; 4 rejected alternatives; 6 acceptance criteria — all 6 implemented |
| `ADR-002-otel-trace-engine.md` | Accepted | OTel trace data model as canonical trace schema; OtelBridge; W3C traceparent propagation |
| `ADR-003-engineering-intelligence-layer.md` | Accepted | Engineering Judgment organ (Cerebellum): 10 tier domain stores, laws as reasoning primitives, EngineeringEvaluator gates, judgment-pack enrichment, learning loop |
| `ADR-004-cognitive-compute-fabric.md` | Accepted | Cognitive Compute Fabric — virtual processor namespace, affinity routing, provider resolution, dispatch contract (Level 4) |
| `ADR-005-universal-cognitive-protocol.md` | Accepted | Universal Cognitive Protocol — substrate-runs-drivers naming, 3-layer split, Episode canonicalization (episode_id + episode hash), L0–L4 ladder, Live Cognitive State, driver triad + Cognitive Coprocessor, Cognitive Virtual Memory; Amendment A (2026-08-01): harness→driver terminology + Cognitive Trace/Middleware/Packages |
| `ADR-006-cognitive-microkernel.md` | Accepted | Cognitive Microkernel — 12 kernel primitives (10 verified, 2 deltas resolved), kernel/service boundary, Cognitive Process model; **Phases A–F implemented 2026-08-01** (`src/kernel/{process,memory/vmem,organism,transactional,diagnostics}`, `neural-fs/mounts.ts`) |
| `COGNITIVE-TRACE.md` | Approved design | Cognitive Trace `uch.cognitive-trace.v1` — OTel-shaped schema, span kinds, uccp.* attributes, organ ownership table, 8-point driver contract, lifecycle, verification |
| `COGNITIVE-MIDDLEWARE.md` | Approved design | Cognitive Middleware — 9-stage governed pipeline (ingress→…→augment) + Cognitive Image cache: per-grant, regenerable, TTL-coherent read-optimized projection (attach = O(1)) |
| `COGNITIVE-PACKAGES.md` | Approved design | Cognitive Packages `uch.package.v1` — 4 kinds (driver/skill/policy/instrument), manifest contract, package governance gate (signed, scoped, intersected, vetoable, revocable) |
| `ENGINEERING-INTELLIGENCE.md` | Proposed (Phase A) | Full design: tier map vs live code, gaps, architecture, success criteria, delivery phases A–E |
| `ARCHITECTURE.md` | Vision | 5 interface surfaces, `CognitiveModule` contract, 7 design principles, 13-term constitution vocabulary, module directory |
| `CIC-SPECIFICATION.md` | Draft | Cognitive Interchange Contract v0.1: capability grants, scope cascade, 8 operation families, authorization flow, cognitive state document (§3.3) |
| `CONFORMANCE.md` | Approved v1.0 | 10 fixtures F01–F10; compatibility matrix (MCP 9/10) |
| `EVENT-GOVERNANCE.md` | Implemented | Provenance-linked, idempotent, policy-checked driver event gate; audit ledger; denial observability |
| `EXOSYMBIOSIS.md` | Design v0.1 | The UCH wearable: 5C cognition capture contract, COT tier ladder, sync planes, capture rails per host, hive-mind topology, driver triad, Episode mapping |
| `FAILURE-RETRY.md` | Approved v1.0 | 13 error codes, retry policies, full-jitter backoff, circuit breaker, crash recovery, rollback/timeout tables |
| `INTEGRATION-LEVELS.md` | Approved design | L0–L4 capability ladder: per-rail levels, 4 rules, conformance criteria, verified per-platform level map, roadmap mapping |
| `LIVE-COGNITIVE-STATE.md` | Approved design | Mind-state artifact `uch.cognitive-state.v1`: schema, lifecycle, source map, projection + privacy rules |
| `PRIVACY-ERASURE.md` | Draft | 6 sensitivity classes, consent lifecycle, soft/hard delete, orphaned-object policy, GDPR/CCPA/SOC2 mapping |
| `PROJECTIONS.md` | Implemented | Scope-contained workspace-state projections: containment cascade, capability authority intersection, attach wiring |
| `THREAT-MODEL.md` | Approved v1.0 | 14 threats T01–T14 with risk/mitigation/status; 3 trust boundaries |
| `UNIVERSAL-INTEGRATION.md` | Proposal (design) | Hive Mind: capture-surface matrix, HiveEvent schema v1 (incl. `cognitive.state`), Episode identity, integration-level mapping, M0–M3 roadmap |
| `WORKSPACE-MANIFEST.md` | Implemented | Versioned workspace manifest + discovery/negotiation/attach lifecycle; conformance to all 6 ADR-001 criteria |

---

## 14. Skills Ecosystem (skills/)

**28 skills — three populations:**
- **10 native UCH skills** (reference-free, MIT, author UCH): coding-principles, deep-research, plan, progressive-memory-search, requesting-code-review, skill-creator, spike, synthesis-gap-analysis, systematic-debugging, test-driven-development
- **17 imported** from `portable-skill-library` (via `.import-index.json`, version 1): api-designer, architecture-designer, code-documenter, code-reviewer, database-optimizer, debugging-wizard, devops-engineer, feature-forge, fullstack-guardian, mcp-developer, monitoring-expert, playwright-expert, postgres-pro, prompt-engineer, security-reviewer, spec-miner, test-master
- **1 local import**: karpathy-guidelines (from `andrej-karpathy-skills-main`, force)

124 reference files total. Managed by `src/skills/` (scanner, catalog, importer, creator, optimizer) + CLI (`uch skill ...`).

---

## 15. Test Suite Analysis

**Infrastructure:** Vitest 3 (no config file — pure defaults), 64 test files, **1,176 test cases**, ~205 describe blocks, 0 skips/0 todos/0 parameterized tests. All deterministic (providers faked — no live network/LLM).

**Largest suites:** expanded-features (97), organism-features (78), drivers (50), fixtures-F01-F10 (46), executive-brain-edge (44).

**Coverage highlights:** kernel (core/synthesis/gap-analysis/recency-decay/coding-principles), organism layer (constitution, genome, compiler, scientific memory, trust, reflection, creativity, taste, dreaming, endocrine/immune, sleep), agentic runtime (tools, parser, permissions, loop, tasks, budgets, history, compaction, skills, state), brains (executive, workspace, meta), transports (UCCP E2E, MCP SSE/stdio, A2A/IPC/CLI), drivers (7), cortex, control plane, threat mitigations (all-14 conformance), provenance/genome (phase4b), calibration.

**Zero coverage:** `src/chunkers/`, `src/hippocampus/`, `src/neural-fs/` (9 files). *(Resolved 2026-07-31 — 78 new tests added; see `src/{chunkers,hippocampus,neural-fs}/__tests__/`.)*

**Hygiene issues:** 13 stale compiled tests in `dist/` from deleted sources; `.uccp-test/` (~155 files) accumulates from persistence tests; no coverage tooling; no parameterized tests.

---

## 16. Configuration & Environment

- **`.env.example`:** `OPENAI_API_KEY` (required or `ANTHROPIC_API_KEY`); Inference Fabric — `CEREBRAS_API_KEY`/`_1`–`_3` (compute resources), `CEREBRAS_MODEL=llama-3.3-70b`; `UCH_LLM_PROVIDER=auto` (openai|anthropic|google); `UCH_LLM_MODEL`; `OPENAI_BASE_URL` (proxies/local models)
- **Runtime state:** `.uccp/` (calibration/, persist/, sessions/), `.uccp/traces.jsonl`, `.uccp/history.jsonl`
- **Config file:** `uccp.config.json` (loaded by `ConfigLoader` via UCCPServer)
- **Env-driven behavior:** recency decay map (`parseRecencyDecayEnv`), tool detection env vars, provider auto-select

---

## 17. Known Gaps, Discrepancies & TODOs

**Documentation inconsistencies:**
1. README claims "37 test files / 215+ source modules" — actual: 64 test files / 241 modules (README stale)
2. `package-lock.json` (v0.1.0, declares `@modelcontextprotocol/sdk ^1.30.0` + `openai ^7.2.0`) out of sync with `package.json` (v0.2.0, `openai ^4.0.0` only)
3. `LAWS_OF_COGNITIVE_PHYSICS.md` header says "13 laws" but defines 16
4. `SPEC.md` constitution predates the expanded 16-law set
5. Name proliferation: COS / UCH / ACE / UCCP all in active use

**Code gaps:**
6. ~~Zero test coverage: `src/chunkers/`, `src/hippocampus/`, `src/neural-fs/`~~ — covered 2026-07-31 (78 tests)
7. Scaffolded/incomplete: NeuralFS, Dream Engine, Connectome (README admits); `graphify-out/` artifacts were untracked and removed
8. Stale compiled test files in `dist/` — resolved: `**/__tests__/**` excluded from the build
9. `.uccp-test/` residue (~155 files) from tests writing to workspace-relative paths instead of temp dirs
10. No vitest config (defaults only), no coverage thresholds, no `test:coverage` script
11. WebSocket transport minimal; A2A/IPC/CLI/REST transports lack conformance implementation (only MCP passes 9/10)
12. `fixture-debug.json` shows T13 (token-exhaustion detection) failing at some point
13. CIC spec + PRIVACY-ERASURE remain drafts (2 of 7 research gates open)

---

## 18. Recommendations

1. **Sync package-lock.json** with package.json (or regenerate) — the stale MCP SDK declaration confuses consumers *(done 2026-07-31 — lock regenerated at v0.2.0, openai ^7.2.0 aligned)*
2. **Update README stats** (64 test files, 241 modules, 1,176 tests) and the Laws header (16 laws) *(done 2026-07-31)*
3. **Add tests for chunkers, hippocampus, neural-fs** — currently the only zero-coverage areas *(done 2026-07-31 — 78 tests, suite at 1,251)*
4. **Add a vitest.config.ts** with coverage thresholds and `os.tmpdir()` persistence paths for tests (removes `.uccp-test/` residue) *(config + thresholds added 2026-07-31; tmp-path migration still open)*
5. **Clean dist/** stale test artifacts (run a full `npm run build` from clean)
6. **Resolve naming**: pick one public brand (UCH or ACE) for docs/CLI consistency
7. **Prioritize conformance**: implement CIC envelope (5/10 fields) and the remaining transports to close design gates
8. Consider a **shared kernel singleton** strategy for the agent plugin vs per-subsystem kernels to avoid state fragmentation across `.uccp/persist` writers

---

*End of UCH Complete Index. Generated from direct source analysis: 241 source files read/indexed, 64 test files inventoried, 6 specs + 15 research docs + 7 design docs + 28 skills cataloged.*
