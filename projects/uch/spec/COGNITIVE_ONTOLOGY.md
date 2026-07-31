# Cognitive Ontology

**Shared vocabulary. Every component uses these definitions. Deviations cause semantic drift.**

This document defines every concept that crosses subsystem boundaries. If a term is not here, it is local to a single organ and may not appear in signals, policies, or persisted state that another organ reads.

---

## Core Entities

### Signal
The universal communication unit (Law 1).
- `id: string` — deterministic unique identifier
- `type: SignalType` — from the signal taxonomy below
- `source: ComponentID` — emitting component
- `target?: ComponentID | Broadcast` — intended recipient
- `payload: Record<string, unknown>` — structured data
- `energy: number` — metabolic cost
- `timestamp: LogicalClock` — monotonic clock value
- `freshness: Duration` — half-life before decay applies
- `causalParent?: SignalID` — preceding signal in causal chain
- `information: InformationMetrics` — entropy, novelty, information gain
- `interrupt: boolean` — whether this bypasses normal pipeline
- `interruptLevel?: 0 | 1 | 2 | 3 | 4` — interrupt priority if applicable

### InformationMetrics
Information-theoretic scoring (Formal Foundations §2.2).
- `entropy: number` — H(s), uncertainty reduction potential (0–H_max)
- `novelty: number` — N(s, M), dissimilarity from existing memory (0–1)
- `informationGain: number` — IG(s), actual uncertainty reduction (0–H_max)
- `predictionError: number` — |expected - observed|, 0 means perfect prediction

### EconomicProposal
Cost-benefit analysis for every operation (Formal Foundations §3.2).
- `operation: string` — operation identifier
- `cost: MetabolicProfile` — expected resource consumption
- `expectedBenefit: number` — estimated information gain (0–1)
- `confidence: number` — confidence in estimate (0–1)
- `risk: number` — probability of waste (0–1)
- `opportunityCost: string[]` — what this displaces
- `roi: number` — expectedBenefit · confidence / (cost · (1 + risk))
- `deadline?: Timestamp` — when benefit expires

### CapabilityProtocol
A protocol specification for cognitive module interaction (Formal Foundations §4.4).
- `id: string` — capability identifier
- `version: semver` — protocol version
- `signals: SignalType[]` — signal types this capability handles
- `dependsOn: CapabilityID[]` — capabilities this depends on
- `provides: CapabilityID[]` — capabilities this provides to others
- `lifecycle: LifecycleStage` — embryonic → experimental → ... → retired

### EntropyReductionStage
A transformation in the signal entropy pipeline (Formal Foundations §2.3).
- `name: Classification | Deduplication | Aggregation | Compression | Importance | Priority | Evidence`
- `entropyIn: number` — entropy before this stage
- `entropyOut: number` — entropy after this stage
- `reductionRatio: number` — 1 - (entropyOut / entropyIn)
- `informationLoss: boolean` — whether this stage is lossy

### Component
Any addressable unit: cell, tissue, organ, system.
- `id: ComponentID` — globally unique
- `kind: ComponentKind` — cell | tissue | organ | system
- `lifecycle: LifecycleStage`
- `declaredMetabolism: MetabolicProfile`
- `capabilities: Capability[]`

### Capability
Something a component can do.
- `name: string` — from capability taxonomy
- `version: semver`
- `inputs: Schema[]`
- `outputs: Schema[]`
- `metabolicCost: MetabolicProfile`

### MetabolicProfile
Declared resource consumption.
- `cpu: number` — estimated cycles per operation
- `memory: number` — bytes allocated
- `tokens: number` — LLM tokens consumed
- `latency: number` — milliseconds expected
- `storage: number` — bytes persisted per cycle
- `network: number` — bytes transferred

### SignalType
Classification from the signal taxonomy.

---

## Signal Taxonomy

### Perception Signals

| Type | Source | Description |
|------|--------|-------------|
| `file:opened` | FS Driver | File loaded into workspace |
| `file:saved` | FS Driver | File persisted |
| `file:created` | FS Driver | New file detected |
| `file:deleted` | FS Driver | File removed |
| `file:renamed` | FS Driver | File path changed |
| `git:commit` | Git Driver | Commit created |
| `git:branch_changed` | Git Driver | Active branch switched |
| `git:push` | Git Driver | Remote push completed |
| `git:pull` | Git Driver | Remote pull completed |
| `ide:focus_changed` | IDE Driver | Active file/tab changed |
| `ide:selection_changed` | IDE Driver | Text selection changed |
| `ci:started` | CI Driver | Pipeline triggered |
| `ci:passed` | CI Driver | Pipeline succeeded |
| `ci:failed` | CI Driver | Pipeline failed |
| `test:started` | Test Driver | Test suite began |
| `test:passed` | Test Driver | Test passed |
| `test:failed` | Test Driver | Test failed |
| `build:started` | Build Driver | Build began |
| `build:finished` | Build Driver | Build completed |
| `build:failed` | Build Driver | Build failed |

### Cognitive Signals

| Type | Source | Description |
|------|--------|-------------|
| `thought:observed` | Consciousness | New thought entered a layer |
| `thought:acknowledged` | Consciousness | Thought was processed |
| `memory:stored` | Memory System | Episode persisted |
| `memory:recalled` | Memory System | Episode retrieved |
| `memory:consolidated` | Hippocampus | Buffer → long-term transfer |
| `memory:decayed` | Memory System | Entity removed via decay |
| `pattern:detected` | Neocortex | Recurring pattern identified |
| `pattern:strengthened` | Neocortex | Pattern confidence increased |
| `skill:used` | Neocortex | Skill invoked |
| `skill:improved` | Neocortex | Proficiency increased |

### Executive Signals

| Type | Source | Description |
|------|--------|-------------|
| `plan:created` | Executive | Plan formulated |
| `plan:step_completed` | Executive | Plan step finished |
| `plan:failed` | Executive | Plan aborted |
| `plan:adapted` | Executive | Plan modified mid-execution |
| `decision:made` | Decision Engine | Decision recorded |
| `decision:validated` | Judiciary | Decision approved |
| `decision:rejected` | Judiciary | Decision denied |
| `critique:issued` | Critic | Feedback produced |

### Homeostatic Signals

| Type | Source | Description |
|------|--------|-------------|
| `energy:low` | Metabolism | Budget running low |
| `energy:critical` | Metabolism | Budget exhausted |
| `energy:surplus` | Metabolism | Idle capacity available |
| `pressure:memory` | Hippocampus | Consolidation needed |
| `pressure:decay` | Memory System | Entities expiring |
| `pressure:load` | Any | Component under stress |

### Regulatory Signals

| Type | Source | Description |
|------|--------|-------------|
| `sleep:initiated` | Sleep Cycle | Offline maintenance began |
| `sleep:completed` | Sleep Cycle | Maintenance finished |
| `immune:threat_detected` | Immune System | Anomaly identified |
| `immune:contained` | Immune System | Component quarantined |
| `immune:resolved` | Immune System | Remediation complete |
| `endocrine:updated` | Endocrine System | Global signals changed |
| `evolution:mutation_proposed` | Evolution Engine | Component change suggested |
| `evolution:mutation_applied` | Evolution Engine | Component changed |

### Session Signals

| Type | Source | Description |
|------|--------|-------------|
| `session:started` | Interface | Agent connected |
| `session:ended` | Interface | Agent disconnected |
| `session:synced` | Interface | Agent context synchronized |
| `agent:attached` | Interface | Agent entered exoskeleton |
| `agent:detached` | Interface | Agent left exoskeleton |

---

## Entity Taxonomy

### Thought
A unit of consciousness content.
- `id: string`
- `layer: ConsciousnessLayer`
- `content: string`
- `priority: number` — 0.0–1.0
- `source: string`
- `timestamp: Date`
- `acknowledged: boolean`
- `tags: string[]`

### ConsciousnessLayer
- `reflex` — immediate, pre-reasoning
- `working` — current active cognition
- `strategic` — planning, hours to days ahead
- `reflective` — self-observation
- `meta` — redesigning the Brain itself

### Memory
A persisted experience.
- `id: string`
- `type: MemoryType`
- `content: EpisodeContent`
- `timestamp: Date`
- `importance: number`
- `confidence: number`
- `source: ComponentID`
- `accessCount: number`
- `lastAccess: Date`
- `decayFunction: DecayFn`

### MemoryType
- `episodic` — specific experiences
- `semantic` — general knowledge
- `procedural` — how-to knowledge
- `working` — transient current context

### Evidence
A knowledge claim with provenance.
- `id: string`
- `proposition: string`
- `confidence: number` — 0.0–1.0
- `origin: ComponentID`
- `verificationStatus: VerificationStatus`
- `contradictions: EvidenceID[]`
- `timestamp: Date`
- `freshness: Duration`

### VerificationStatus
- `unverified` — not yet checked
- `confirmed` — independently verified
- `contradicted` — conflicting evidence exists
- `expired` — freshness threshold passed

### Threat
An anomaly detected by the Immune system.
- `id: string`
- `severity: ThreatSeverity`
- `source: ComponentID`
- `description: string`
- `causalChain: SignalID[]`
- `status: ThreatStatus`
- `detectedAt: Date`

### ThreatSeverity
- `critical` — organism-wide impact
- `high` — system-level impact
- `medium` — component-level impact
- `low` — informational

### ThreatStatus
- `detected` — identified, not yet contained
- `contained` — component quarantined
- `analyzing` — root cause in progress
- `resolved` — remediation complete
- `archived` — historical record

### Policy
A governance rule evaluated by the Engine.
- `id: string`
- `effect: PolicyEffect`
- `principals: string[]`
- `actions: string[]`
- `resources: string[]`
- `conditions?: Record<string, unknown>`
- `priority: number`

### PolicyEffect
- `allow` — action permitted
- `deny` — action forbidden

---

## Lifecycle Stages

```typescript
type LifecycleStage =
  | 'embryonic'
  | 'experimental'
  | 'learning'
  | 'stable'
  | 'optimized'
  | 'deprecated'
  | 'retired'
  | 'archived';
```

### Stage Transitions

| From | To | Trigger |
|------|-----|---------|
| embryonic | experimental | Spec review complete |
| experimental | learning | Confidence > 0.5 |
| learning | stable | Confidence > 0.8 |
| stable | optimized | Benchmark verification |
| stable | deprecated | Replacement approved |
| deprecated | retired | No consumers remain |
| retired | archived | Retention period passed |
| *any* | *mutated* | Evolution approved |

---

## Component Taxonomy

### Cells (atomic units)
- `sensor:cell` — file watcher, git poller, IDE hook
- `scorer:cell` — single-dimension code evaluation
- `reflex:cell` — single reflex check
- `indexer:cell` — memory index maintenance
- `router:cell` — signal forwarding rule

### Tissues (cooperating cells)
- `perception:tissue` — all sensor cells
- `scoring:tissue` — all score dimensions
- `reflex:tissue` — all reflex checks
- `retrieval:tissue` — search + rank + merge cells

### Organs (functional subsystems)
- `aether` — persistent executive core
- `consciousness` — multi-layer awareness
- `hippocampus` — episodic consolidation
- `neocortex` — pattern learning
- `cortex:kernel` — higher-order integration
- `connectome` — nervous system wiring
- `basal:ganglia` — action selection
- `immune` — threat detection
- `endocrine` — global modulation
- `sleep:cycle` — offline maintenance
- `code:scorer` — litmus engine
- `reflex:engine` — instinct engine
- `policy:engine` — rule evaluation
- `metabolism` — energy allocation

### Systems (coordinated organs)
- `executive:system` — aether + consciousness + cortex:kernel
- `memory:system` — hippocampus + episodic + semantic + working
- `sensory:system` — all drivers + perception tissue
- `motor:system` — execution + action selection
- `regulatory:system` — immune + endocrine + homeostasis
- `evolution:system` — mutation + benchmark + experiment
- `interface:system` — all transports + protocol adapters

---

## Signal Priority Levels

```typescript
type SignalPriority = 0 | 1 | 2 | 3 | 4;
```

| Level | Name | Examples | Routing Layer |
|-------|------|----------|---------------|
| 0 | Peripheral | file:saved, git:commit | Peripheral NS |
| 1 | Notable | test:failed, ci:failed | Spinal NS |
| 2 | Important | policy:violation, immune:threat | Brainstem |
| 3 | Critical | energy:critical, memory:pressure | Thalamus |
| 4 | Executive | session:started, user:message | Cortex |

---

## Energy Units

```typescript
interface EnergyAllocation {
  cpu: number;        // milliseconds per cycle
  memory: number;     // MB allocated
  tokens: number;     // LLM tokens per operation
  latency: number;    // milliseconds budget
  storage: number;    // KB per cycle
  network: number;    // KB per cycle
}
```

The Metabolism subsystem tracks these per component and enforces budgets at cycle boundaries.

---

## Ontology Maintenance

This ontology is **versioned** and **reviewed**:
- Minor additions (new signal types, new entities) require Immunology review
- Major changes (new entity categories, lifecycle changes) require Constitutional amendment
- Every organ specification must reference this ontology for all cross-boundary types
- A component that introduces a term not in this ontology is rejected until the ontology is updated
