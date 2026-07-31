# UCCP Organism Architecture

## The Five Nervous Systems

UCCP reimagines a software engineering platform as a **cognitive organism** with
five interconnected nervous systems, each with distinct responsibilities:

```
                    ┌─────────────────────────────────┐
                    │      Evolution System           │
                    │  (self-benchmark, experiment,   │
                    │   mutation, adaptation)         │
                    └──────────┬──────────────────────┘
                               │
    ┌──────────────┐    ┌──────┴──────┐    ┌──────────────┐
    │  Perception   │    │  Cognition   │    │   Memory     │
    │  System       │◄──►│  System     │◄──►│   System     │
    │ (signals,     │    │ (patterns,   │    │ (scientific, │
    │  trace,       │    │  decisions,  │    │  episodic,   │
    │  drivers)     │    │  analytics)  │    │  semantic)   │
    └──────────────┘    └──────┬──────┘    └──────────────┘
                               │
                    ┌──────────┴──────────────────────┐
                    │      Executive System           │
                    │  (plans, decisions, critique,   │
                    │   scheduling, orchestration)    │
                    └─────────────────────────────────┘
```

### 1. Perception System
Filesystem, Git, IDE, and agent drivers feeding signals into the trace engine.
- `FileSystemDriver` — watches file changes
- `GitDriver` — monitors commits, branches
- `SignalStore` — structured signals from all sources
- `TraceRecorder` — OTel-aligned trace spans

### 2. Cognitive System
All learning, reasoning, and analysis subsystems.
- `PatternLibrary` — declarative pattern matching (5 matcher types)
- `DecisionLog` — structured decisions with alternatives and rationale
- `WorkspaceAnalytics` — report generation, timeseries, breakdowns
- `CognitiveDiff` — state snapshot comparison
- `SuggestionEngine` — proactive suggestions (review, consolidation, investigation)

### 3. Memory System
The persistent brain, organized by epistemological rigor.
- `ScientificMemory` — every fact has certainty, confidence, evidence, contradiction
- `KnowledgeCompiler` — 9-stage compression: events→facts→knowledge→wisdom
- `EpisodicStore` — raw episodic traces
- `SemanticGraph` — concept relationships
- `CognitiveConstitution` — immutable laws (no fabrication, provenance, history)

### 4. Executive System
Planning, decision-making, and orchestration.
- `ExecutiveBrain` — high-level cognitive executive
- `Planner` — goal decomposition into steps
- `DecisionEngine` — structured option analysis
- `Critic` — self-critique and review
- `TaskScheduler` — priority task queue
- `RateLimiter` — per-agent sliding window
- `WebhookDispatcher` — event-driven notifications

### 5. Evolution System
The organism's capacity to improve itself.
- `BenchmarkEngine` — measure subsystem performance over time
- `ExperimentEngine` — design and analyze A/B experiments
- `MutationEngine` — propose, apply, rollback mutations
- `EvolutionEngine` — orchestrates full evolution cycles

---

## The Four Pillars (Cross-Cutting)

### Constitution
The **CognitiveConstitution** enforces immutable rules:
- **Law 1 (No Fabrication)**: Every memory, knowledge entry, or claim must cite a trace source
- **Law 2 (Provenance)**: Every trace must record who/what generated it
- **Law 3 (Immutable History)**: Past traces and decisions cannot be altered
- 7 additional foundational/advisory laws

All code must pass `constitution.checkCompliance()` before mutation.

### Trust
The **TrustEngine** assigns every source a trust level:
- 7 levels from `none` to `full`
- Decays over time based on subject type (source, memory, plugin, etc.)
- Verification bonuses for `recordSuccess()` calls
- Penalties for conflicts and failures
- Automatic `assess()` returns verdict + score + justification

### Science
The **ScientificMemory** applies the scientific method to every fact:
- `certainty`: `confirmed` / `plausible` / `uncertain` / `contradicted`
- `confidence`: 0–1 continuous scale
- `evidence`: array of source trace IDs
- `verification`: verification status with timestamps
- `contradictions`: list of contradicting evidence
- `predictionAccuracy`: track predictions → verify → update

### Taste
The **TasteEngine** learns preferences through continuous feedback:
- 9 dimensions: code-elegance, architecture-beauty, api-quality, ux-quality, readability, simplicity, consistency, balance, minimalism
- Each dimension tracks `examples`, `feedback`, `score`
- `assess(target, dimension)` returns learned score

---

## Cross-Module Data Flow

```
GitDriver ──► TraceRecorder ──► TraceLedger ──► PatternLibrary
                                                  │
Filesystem ──► SignalStore ─────────────────────► DecisionLog
                                                  │
Agent ──────► SuggestionEngine ◄─────────────────┘
                                                  │
                    ┌─────────────────────────────┘
                    ▼
           KnowledgeCompiler ──► ScientificMemory
                                      │
                           TrustEngine ◄──► ScientificMemory
                                      │
                           SelfReflectionEngine
                                      │
                           EvolutionEngine
```

---

## Persistence Layer

Every stateful store implements the `Storable` interface:
```typescript
interface Storable {
  persist(filePath: string): Promise<void>;
  load(filePath: string): Promise<number>;
}
```

The **PersistenceProvider** orchestrates all stores:
```
PersistenceProvider
  ├─ persistAll() / loadAll()
  ├─ register(name, store, fileName?)
  └─ per-store: persist(name) / load(name)
```

Supported stores: CognitiveConstitution, WorkspaceGenome, ScientificMemory,
KnowledgeCompiler, TrustEngine, SelfReflectionEngine, DecisionLog,
PatternLibrary, SuggestionEngine, TaskScheduler, ProjectHealthEngine,
TasteEngine, WorkspaceDreaming, CreativityEngine, WebhookDispatcher.

---

## SSE Transport

Agents connect via SSE (Server-Sent Events):
```
GET  /sse        → establishes SSE stream with heartbeat
POST /messages   → sends JSON-RPC messages (clientId required)
```

Session management:
- Automatic `session-created` event on connect
- Heartbeat every 15s
- Idle timeout at 5 minutes
- Session cleanup after 10 minutes closed

Available tools: `observe`, `remember`, `retrieve`, `plan`, `reflect`, `learn`,
`critique` — plus any registered via `registerTool()`.

---

## Configuration

All persistence paths are configurable in `UCCPConfig`:
```json
{
  "persistence": {
    "baseDir": ".uccp",
    "files": {
      "constitution": "constitution.json",
      "genome": "genome.json",
      "scientificMemory": "scientific-memory.json",
      "trustEngine": "trust-engine.json",
      "decisionLog": "decision-log.json"
    }
  }
}
```

---

## Status

| System | Modules | Tests | Status |
|--------|---------|-------|--------|
| Perception | 4 | 50+ | ✅ |
| Cognition | 10 | 120+ | ✅ |
| Memory | 8 | 100+ | ✅ |
| Executive | 6 | 60+ | ✅ |
| **Evolution** | **4** | **—** | **🆕** |
| Constitution | 1 | 10+ | ✅ |
| Trust | 1 | 15+ | ✅ |
| Science | 1 | 20+ | ✅ |
| Taste | 1 | 10+ | ✅ |
| Persistence | 2 | — | 🆕 |
| SSE Server | 1 | — | 🆕 |
| **Total** | **39+** | **~440** | |
