# UCH Organism Implementation Reference

This document explains the new explicit organism abstraction added to `projects/uch`.
It covers the cognitive organism layer, the memory organ system, attention/prediction components,
Immune and Identity subsystems, event bus integration, and harness wiring.

## Overview

The `CognitiveOrganism` encapsulates a higher-level cognitive body built on top of UCH's existing
kernel, memory, trust, constitution, and conscience subsystems.

Key design goals:

- expose an explicit organism boundary for cross-module coordination
- make memory, attention, curiosity, doubt, wisdom, and identity first-class objects
- support neuro-symbolic event-driven integration via the `NeuralEventBus`
- wire organism lifecycle events into the root harness at startup

## Core implementation

### Source file

- `projects/uch/src/cognitive-plane/organism/organism.ts`

### Main export

- `CognitiveOrganism`
- `CognitiveOrganismConfig`

### What it provides

- `memory: MemoryOrgans`
- `attention: AttentionEngine`
- `prediction: PredictionEngine`
- `curiosity: CuriosityEngine`
- `doubt: DoubtEngine`
- `wisdom: WisdomEngine`
- `counterfactual: CounterfactualEngine`
- `identity: IdentityEngine`
- `immune: ImmuneSystem`
- `evolution: EvolutionEngine`

## Memory Organs

`MemoryOrgans` is the organism's internal memory subsystem and includes:

- `sensory: PerceptionGrid`
  - classifies incoming `NeuralEvent` messages into modalities like `visual`, `language`,
    `engineering`, and `behavioral`
  - maintains the most recent observations
- `working: WorkingMemory`
  - stores current mission, objective, branch, and task context
- `episodic: CognitiveKernel`
  - uses the kernel as an episodic memory store for observations
- `semantic: ScientificMemory`
  - stores structured facts, with certainty, confidence, provenance, and tags
- `procedural: ProceduralMemory`
  - stores named procedures and workflows
- `emotional: EmotionalMemory`
  - records significance-tagged emotional events for incidents and lessons
- `social: SocialMemory`
  - models relationships, expertise, and communication style of collaborators
- `evolutionary: EvolutionaryMemory`
  - keeps a changelog of organism-level adaptation and learning

### Memory ingestion

`MemoryOrgans.ingestObservation(event, importance)`:

- perceives the event via `PerceptionGrid`
- records an emotional memory for importance and category
- writes the observation to the kernel as an episodic memory
- adds provenance metadata for later reasoning

### Semantic storage

`MemoryOrgans.storeSemanticFact(key, value, source)` is a utility wrapper that stores
facts in semantic memory with default organism metadata.

## Cognitive engines

### AttentionEngine

`AttentionEngine.focus(items)` ranks items using a weighted blend of:

- importance
- novelty
- urgency
- risk

This engine returns a sorted `AttentionSignal[]` for downstream prioritization.

### PredictionEngine

`PredictionEngine` delegates to `Conscience.predict(agentId, context)` and wraps the result
in a future-oriented prediction object with confidence and alternative actions.

### CuriosityEngine

Generates open questions based on organism memory state:

- missing mission or goals
- missing semantic facts
- lack of significant emotional events
- missing evolutionary changelog entries

### DoubtEngine

Evaluates uncertainty and risk from:

- semantic memory statistics
- contradiction counts
- low-trust subjects from the `TrustEngine`

### WisdomEngine

`WisdomEngine.summarize()` blends constitutional law counts and knowledge compiler
wisdom artifacts into a concise wisdom summary.

### CounterfactualEngine

Simulates alternative universes for proposals, returning multiple outcomes and risk levels.
This engine supports broad scenario thinking and can be extended to model decision alternatives.

### IdentityEngine

Wraps `WorkspaceIdentity` and exposes:

- `getProfile()` to read the workspace identity
- `updateVision(mission, goals)` to update mission and goal state

### ImmuneSystem

The organism immune system scans cognitive health by checking:

- contradicted semantic memory entries
- low-trust subjects from the trust engine
- constitutional compliance violations

It produces `ImmuneIssue[]` objects with severity, subject, and description.

## Organism lifecycle and event wiring

### Initialization

`CognitiveOrganism.initialize()` registers the organism to core workspace events:

- `file:saved`
- `git:commit`
- `error:occurred`

For each event type it:

- ingests the event into episodic memory
- updates working memory context
- records evolutionary milestones
- stores semantic artifacts when relevant

### Summarization

`CognitiveOrganism.summarizeOrganism()` returns a short organism health summary combining:

- workspace mission
- sensory observation count
- semantic memory count
- top attention focus reason
- current uncertainty

This method is useful for debugging, health reporting, and early validation.

## Integration with UniversalCognitiveHarness

### Root harness

- `projects/uch/src/harness-api/universal-harness.ts`

The harness now builds the organism during construction and starts it during `start()`.

### Harness wiring

`UniversalCognitiveHarness`:

- creates a shared `NeuralEventBus`
- creates a `CognitiveKernel`
- creates `WorkspaceBrain`, `ExecutiveBrain`, and `BiologicalFunctions`
- constructs `CognitiveOrganism` with:
  - `eventBus`
  - `kernel`
  - `semanticMemory: new ScientificMemory()`
  - `identity: this.workspace.identity`
  - `constitution: new CognitiveConstitution()`
  - `knowledgeCompiler: new KnowledgeCompiler()`
  - `trustEngine: new TrustEngine()`
  - `conscience: new Conscience(this.eventLedger, this.kernel)`

During `start()` the harness calls:

- `this.kernel.startSleep()`
- `await this.cognitiveOrganism.initialize()`
- `await this.eventBus.publish({ type: 'workspace:opened', ... })`

### Event bus wiring

The harness also wires `NeuralEventBus` events to the workspace and executive systems:

- `file:saved` → create observation, publish `memory:ingest`, notify workspace
- `git:commit` → add timeline event, publish `module:handoff` to executive
- `error:occurred` → log incident, update health metrics, notify executive
- `agent:attached` / `agent:detached` → manage virtualization
- `session:started` → start kernel sleep cycles

## NeuralEventBus enhancements

### Source file

- `projects/uch/src/event-bus/neural-event-bus.ts`

### Global wildcard subscription

`NeuralEventBus.subscribe(handler)` now supports a global handler that receives every event.
This is implemented by treating `handler` as a subscription to `'*'` event type.

### Event routing and modules

The bus supports:

- `registerModule(moduleName, protocols)`
- `subscribeToModule(moduleName, handler)`
- `subscribeToProtocol(protocolName, handler)`
- `publishToModule(moduleName, event)`
- `publishProtocol(protocolName, source, payload, targets)`

These features make the event bus a flexible cognitive substrate for module communication,
protocol-based coordination, and cross-cutting workflows.

## Harness API surface

### BiologicalFunctions

- `observe()`
- `understand()`
- `remember()`
- `retrieve()`
- `predict()`
- `plan()`
- `reflect()`
- `learn()`
- `critique()`
- `simulate()`
- `execute()`
- `verify()`
- `compress()`
- `consolidate()`
- `sleep()`
- `evolve()`

`BiologicalFunctions` provides a thin runtime API layer over the kernel, executive, and workspace subsystems.
It is the public-facing bio layer for the harness.

## Export surface

### Root entry points

- `CognitiveOrganism`, `CognitiveOrganismConfig`
- `NeuralEventBus`
- `UniversalCognitiveHarness`

These exports are available from `projects/uch/src/index.ts` so UCH consumers can instantiate the harness or
the organism directly.

## Tests and validation

### Key tests

- `projects/uch/src/__tests__/organism-features.test.ts`
  - validates organism initialization
  - verifies summarization output
  - confirms memory organs and event handling behavior
- `projects/uch/src/__tests__/universal-harness.test.ts`
  - validates harness startup, biological function API, and event wiring
- `projects/uch/src/__tests__/neural-event-bus.test.ts`
  - validates event bus queueing and subscription semantics

## Notes and future extension points

This implementation is intended as a platform for future organism-level capabilities:

- richer attention / salience scoring
- longer-term episodic consolidation and sleep-driven replay
- curiosity-driven exploration and active learning
- explicit organism health and immune status dashboards
- multi-agent coordination via the `NeuralEventBus`
- integration with RAG retrieval and planner outputs

## Recommended next documentation steps

- add diagram for `CognitiveOrganism` event flow
- document `MemoryOrgans` stores with example data shape
- extend `ImmuneSystem` to include behavioral anomaly detection
- add a usage guide for `BiologicalFunctions` within the harness CLI or MCP transport
