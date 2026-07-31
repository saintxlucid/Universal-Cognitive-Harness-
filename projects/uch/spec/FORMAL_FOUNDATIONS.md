# Formal Foundations of the Cognitive Runtime

**Level 0 — The Axiomatic Base. Everything below depends on these definitions.**

This document defines the mathematical substrate, information-theoretic framework, and economic calculus that govern every computation in the Cognitive Runtime. No organ, protocol, or policy may contradict these foundations.

---

## Part I: Mathematical Substrate

### §1.1 Set Theory

The cognitive runtime operates over finite, typed sets.

| Symbol | Meaning | Example |
|--------|---------|---------|
| 𝕊 | All possible signals | |
| ℂ | All possible components | |
| 𝕄 | All possible memory entities | |
| 𝔼 | All possible events (raw, pre-signal) | |
| ℙ | All possible policies | |
| 𝕂 | All possible concepts/knowledge | |
| 𝔹 | All possible beliefs | |
| 𝔾 | All possible goals | |
| 𝕍 | All possible values (scalar metrics) | |
| 𝕋 | Physical time (ℝ⁺ ∪ {0}) | |
| ℕ | Natural numbers (signal counter space) | |

Every entity in the system belongs to exactly one set at any instant. An entity is identified by its globally unique identifier, not by its properties.

### §1.2 Functions and Mappings

A **cognitive function** is a total or partial function between typed sets:

```
f: A → B  where A, B ⊂ (𝕊 ∪ ℂ ∪ 𝕄 ∪ 𝔹 ∪ ...)
```

Every cognitive function must declare:
1. **Domain** — which inputs it accepts
2. **Codomain** — which outputs it produces  
3. **Cost** — its metabolic cost profile
4. **Information signature** — ΔH (entropy change) per operation

A function is **well-formed** iff:
- It is deterministic for the same input within the same causal context
- Its cost is bounded and pre-declared
- Its information signature is measurable

### §1.3 Graph Theory

The cognitive runtime maintains exactly three graph structures:

1. **The Causal Graph** — `G_c = (E, V)` where vertices are signals and edges are `causalParent` relationships. This graph is a **directed acyclic graph** (DAG). Cycles are forbidden by Law 3.

2. **The Connectome** — `G_n = (C, R)` where vertices are components and edges are signal routes. This graph is a **directed graph with weighted edges**. Edge weights represent:
   - Latency (ms)
   - Throughput (signals/s)
   - Reliability (0.0–1.0)
   - Energy cost per signal

3. **The Semantic Graph** — `G_s = (K, E)` where vertices are concepts and edges are relationships (`is_a`, `part_of`, `causes`, `precedes`, `requires`, `contradicts`). This graph is **directed and temporally edge-labeled**.

**Graph Invariants:**

- The Causal Graph is always acyclic. Cycles are detected and rejected at signal emission time.
- The Connectome must remain weakly connected. Partitioned components enter emergency broadcast mode.
- The Semantic Graph has no constraint on cycles — recursive definitions are valid concepts.

### §1.4 Temporal Logic

Time is modeled as a **hybrid temporal system** combining:

1. **Physical time** τ ∈ 𝕋 — wall clock, monotonic.
2. **Logical clocks** λ ∈ ℕ — Lamport-style per-component counters.
3. **Version vectors** — for distributed state.

Every entity carries:
- `birth_τ: 𝕋` — when it was created
- `birth_λ: ℕ` — logical clock at creation
- `half_life: 𝕋` — decay parameter
- `valid_window: [𝕋, 𝕋 | ⊥]` — temporal validity

**Temporal relationships:**

- `A happens-before B` iff `A.λ < B.λ` and `A` is in `B.causalParent` closure.
- `A concurrent B` iff neither `A happens-before B` nor `B happens-before A`.
- `A valid-at t` iff `t ∈ A.valid_window`.

### §1.5 Identity

Identity is modeled as a **persistent anchor** with mutable attributes.

```
Identity = ⟨id: UUID, species: SpeciesGenome, birth: 𝕋⟩
```

The identity anchor never changes. Attributes attached to it (memories, beliefs, skills) may change. Identity is verified by:
1. **Causal continuity** — the identity's signal chain has no gaps
2. **Genome match** — species genome matches the expected species
3. **Replication** — at least 3 independent stores agree on the anchor

---

## Part II: Information Theory

### §2.1 Core Definitions

A **signal** contains information proportional to its **surprise**: how much it reduces uncertainty about the system state.

**Entropy** of a component's state:

```
H(X) = -∑ p(x) · log₂ p(x)
```

where `X` is the random variable over possible states of a component.

**Information gain** of a signal:

```
IG(signal) = H(state_before) - H(state_after)
```

When `IG(signal) ≈ 0`, the signal carries negligible new information and should be **suppressed at the lowest capable nervous layer**.

**Novelty** of a signal given memory M:

```
N(signal, M) = 1 - max_similarity(signal.embedding, M.embeddings)
```

where `max_similarity` is the maximum cosine similarity between the signal's embedding and stored memory embeddings.

**Compression ratio** of a memory entity:

```
CR(entity) = |raw| / |stored|
```

where `|raw|` is the uncompressed size and `|stored|` is the compressed size. A CR of 1.0 means no compression. Higher CR means more abstraction.

### §2.2 Information Metrics

Every cognitive operation is scored on five information-theoretic dimensions:

| Metric | Symbol | Range | Meaning |
|--------|--------|-------|---------|
| Signal Entropy | `H(s)` | [0, H_max] | Uncertainty reduction potential |
| Novelty Score | `N(s, M)` | [0, 1] | How unlike anything seen before |
| Information Gain | `IG(s)` | [0, H_max] | Actual reduction in uncertainty |
| Prediction Error | `PE(s)` | [0, ∞) | |expected - observed| |
| Knowledge Density | `KD(M)` | [0, 1] | Information content / storage cost |

These metrics are **not advisory**. They are mandatory fields on every processed signal.

```
interface InformationMetrics {
  entropy: number;            // H(s) — computed at classification layer
  novelty: number;            // N(s, M) — computed at dedup layer
  informationGain: number;    // IG(s) — computed after processing
  predictionError: number;    // PE(s) — computed after outcome known
}
```

### §2.3 Entropy Reduction Pipeline

The nervous system processes signals through a cascade of entropy-reducing transformations:

```
Raw Event (max entropy)
    │
    ▼
[Classification] → assigns type, extracts structure
    │ H decreases by ≈20%
    ▼
[Deduplication] → merges identical events within time window
    │ H decreases by ≈40% (typical — 60% of events are redundant)
    ▼
[Aggregation] → groups related events into coherent units
    │ H decreases by ≈20%
    ▼
[Compression] → removes irrelevant detail, extracts essence
    │ H decreases by ≈10%
    ▼
[Importance] → scores by relevance to current goals
    │ H decreases by ≈5%
    ▼
[Priority] → assigns priority level (0–4) for routing
    │ H decreases by ≈5%
    ▼
[Evidence] → enriches with provenance, confidence, contradictions
    │ H_invariant
    ▼
Distilled Cognition (minimal entropy)
```

Each layer outputs:
- The signal (possibly transformed)
- InformationMetrics for the signal
- A boolean `escalate` — whether to pass to the next layer

A layer MUST NOT pass a signal upward if its entropy has dropped below `θ_escalation` (configurable threshold, default 0.15).

### §2.4 Compression as Cognition

Compression is not a storage optimization. Compression is cognition.

| Compression Type | Information Loss | Cognitive Function |
|-----------------|-----------------|-------------------|
| Deduplication | Zero-loss | Identifies exact repeats |
| Aggregation | Zero-loss | Groups related events |
| Abstraction | Lossy | Extracts pattern from instances |
| Generalization | Lossy | Creates rules from examples |
| Summarization | Lossy | Retains salient, discards specifics |
| Concept formation | Lossy | Creates category from similar entities |

The **Knowledge Compiler** is a compression pipeline:
```
Events → Facts → Knowledge → Wisdom
CR: 1.0      2-5x     10-100x    1000x
```

### §2.5 Forgetting as Information-Theoretic Optimality

Forgetting is not failure. Forgetting is the organism maximizing knowledge density.

Given storage budget `B`, the organism optimizes:

```
max(∑ KD(entity) · IG(entity))
subject to ∑ |stored(entity)| ≤ B
```

This is a knapsack problem. The forgetting algorithm approximates it by removing entities with the lowest `KD · IG` product.

Forgetting score (revised from earlier):

```
F(entity) = (1 - importance · prediction_value) / (1 + CR(entity) · access_frequency)
```

Entities with high compression ratio and frequent access resist forgetting even if importance is low.

---

## Part III: Economic Calculus

### §3.1 The Fundamental Question

Every cognitive operation answers:

> Given cost C and expected benefit B, and given current energy budget E, should this operation execute?

Not "can it execute." **Should** it execute.

### §3.2 Cost-Benefit Model

Every operation declares:

```
interface EconomicProposal {
  operation: string;
  cost: MetabolicCost;           // expected resource consumption
  expectedBenefit: number;       // estimated information gain (0–1)
  confidence: number;            // confidence in the estimate (0–1)
  risk: number;                  // probability of waste (0–1)
  opportunityCost: string[];     // what this displaces
  roi: number;                   // expectedBenefit / cost.normalized
  deadline?: Timestamp;          // when benefit expires
}
```

The **ROI** of an operation:

```
ROI = expectedBenefit · confidence / (cost.normalized · (1 + risk))
```

where `cost.normalized` maps the MetabolicCost vector into a scalar via a configurable utility function.

### §3.3 Economic Decision Rules

1. **Threshold** — An operation with `ROI < θ_min` (default 0.1) is never scheduled.
2. **Competition** — When two operations compete for the same budget, the one with higher ROI executes.
3. **Preemption** — A running operation may be preempted if a new operation has `ROI > 2 · running_roi` **and** `confidence > 0.8`.
4. **Batching** — Operations with `ROI ∈ [θ_min, θ_batch]` are deferred to the next batch window.
5. **Strategic reserve** — 10% of total energy is reserved for unexpected executive operations.

### §3.4 Economic Agents

Within the cognitive economy:

| Agent | Role | Budget Source | Objective |
|-------|------|--------------|-----------|
| Executive | Plans and decides | Tax on all subsystems | Maximize long-term goal achievement |
| Memory | Stores and retrieves | Tax on perception | Maximize recall precision |
| Learning | Pattern discovery | Tax on memory | Maximize prediction accuracy |
| Perception | Signal intake | Fixed base allocation | Minimize information loss |
| Immune | Threat detection | Fixed base allocation | Minimize false negative rate |
| Evolution | Self-improvement | Surplus allocation | Maximize adaptation rate |

Each agent submits economic proposals. The Metabolism subsystem acts as the **market maker**, allocating energy to the highest-ROI proposals across all agents.

### §3.5 Works as a Circular Economy

```
Perception produces signals → Memory indexes signals → 
Learning extracts patterns → Executive uses patterns → 
Executive produces decisions → Perception consumes decisions →
feedback continues
```

Energy flows in the opposite direction:
```
Metabolism taxes Executive → Executive taxes Memory →
Memory taxes Perception → Perception pays for raw processing
```

This circular flow ensures that value (information gain) propagates upward while cost (energy) propagates downward.

---

## Part IV: Protocol Theory

### §4.1 What Is a Protocol?

A **protocol** is a set of rules that govern interactions between two or more components. Protocols replace direct dependencies. A component depends on a protocol, not on another component.

### §4.2 Protocol Properties

Every protocol must define:

1. **Messages** — the set of valid signal types
2. **Sequences** — valid message orderings
3. **States** — the set of states each participant may be in
4. **Transitions** — valid state changes given messages
5. **Guarantees** — delivery, ordering, idempotency, exactly-once
6. **Failure modes** — timeout, malformed, unauthorized, unavailable

### §4.3 The Protocol Stack

```
┌─────────────────────────────────────────────┐
│ Layer 7: Cognitive Protocols                │
│ (constitution, governance, identity,        │
│  learning, evolution, dreaming)             │
├─────────────────────────────────────────────┤
│ Layer 6: Organ Protocols                    │
│ (memory, planning, decision, creativity,    │
│  reflection, taste, health, scheduling)     │
├─────────────────────────────────────────────┤
│ Layer 5: Transport Protocols                │
│ (MCP, SSE, gRPC, REST, WebSocket, SDK)     │
├─────────────────────────────────────────────┤
│ Layer 4: Signal Envelope                    │
│ (routing, delivery, ordering, guarantees)   │
├─────────────────────────────────────────────┤
│ Layer 3: Network Layer                      │
│ (component discovery, capability registry)  │
├─────────────────────────────────────────────┤
│ Layer 2: Data Layer                         │
│ (encoding, compression, encryption, format) │
├─────────────────────────────────────────────┤
│ Layer 1: Physical Layer                     │
│ (raw bytes, transport medium)               │
└─────────────────────────────────────────────┘
```

### §4.4 Cognitive Plane as Protocol

The Cognitive Plane is NOT a module or namespace. It is a **protocol** — the set of contracts that cognitive modules use to interact.

**Cognitive Plane Protocol** (v1):

```
Interface CognitiveCapability {
  id: string;                        // capability identifier
  version: semver;                   // protocol version
  signals: SignalType[];             // signal types this capability handles
  dependsOn: CapabilityID[];         // capabilities this depends on
  provides: CapabilityID[];          // capabilities this provides to others
  lifecycle: LifecycleStage;         // embryonic → experimental → ... → retired
}
```

Every module that was in the Cognitive Plane becomes a **capability provider** that implements one or more protocols. Modules do not import each other. They emit and subscribe to signals according to protocol specifications.

---

## Part V: Execution Model

### §5.1 Interrupts

An **interrupt** is a signal that bypasses the normal entropy-reduction pipeline because it demands immediate attention.

Interrupt levels (matching signal priority, with semantics):

| Level | Name | Trigger | Response Deadline |
|-------|------|---------|-------------------|
| 0 | Peripheral Interrupt | File change, git event | 100ms |
| 1 | Spinal Interrupt | Test result, build result | 500ms |
| 2 | Brainstem Interrupt | Error, policy violation | 200ms |
| 3 | Thalamic Interrupt | Session event, agent attach | 50ms |
| 4 | Executive Interrupt | User message, emergency | 10ms |

Interrupt handling:

```
if signal.level >= current_execution_level:
    preempt current execution
    handle interrupt
    resume preempted execution (or discard if stale)
else:
    queue for normal pipeline processing
```

### §5.2 Consciousness Threshold

A signal reaches consciousness (the Cortex) iff:

```
IG(signal) · N(signal, M) > θ_conscious
```

Where `θ_conscious` is dynamically adjusted based on:
- Current cognitive load (inverse of available energy)
- Recent prediction error rate (higher error = lower threshold)
- User attention signal (user is active = lower threshold)

The threshold prevents cognitive flooding. When the organism is idle, thresholds lower and more signals reach consciousness (curiosity mode). When the organism is busy, thresholds raise and only high-value signals pass through.

### §5.3 Reflex Model

A **reflex** is a zero-LLM, deterministic response to a signal pattern. Reflexes execute at the Spinal or Brainstem level and never reach the Cortex.

```
Reflex = ⟨trigger: SignalPattern, action: DeterministicAction, priority: 0..4⟩
```

If a reflex matches, the matched signal:
1. Does NOT propagate upward
2. Is recorded in the trace for audit
3. The reflex action executes immediately

Reflexes are learned (via the Instinct Engine) or declared (via the Constitution).

---

## Part VI: Type-Level Enforcement

### §6.1 The Principle

Formal constraints that exist only in documentation are aspirational. Formal constraints encoded in the type system are enforced.

### §6.2 Branded Types

Every core set from §1.1 becomes a branded TypeScript type:

```typescript
declare const BRAND_SIGNAL: unique symbol;
type SignalID = string & { [BRAND_SIGNAL]: true };

declare const BRAND_COMPONENT: unique symbol;
type ComponentID = string & { [BRAND_COMPONENT]: true };

declare const BRAND_ENERGY: unique symbol;
type EnergyUnit = number & { [BRAND_ENERGY]: true };

declare const BRAND_ENTROPY: unique symbol;
type Entropy = number & { [BRAND_ENTROPY]: true };
```

### §6.3 Phantom Type Constraints

Protocol states encoded as phantom types:

```typescript
interface ProtocolState<Protocol extends string, State extends string> {
  _protocol: Protocol;
  _state: State;
}

type MemoryProtocol_Ready = ProtocolState<'memory', 'ready'>;
type MemoryProtocol_Storing = ProtocolState<'memory', 'storing'>;
type MemoryProtocol_Retrieving = ProtocolState<'memory', 'retrieving'>;
```

Transitions between invalid states are compile-time errors.

### §6.4 Compile-Time Invariant Checking

Each law becomes a type-level constraint:

```typescript
// Law 3 — Causality: signal must have causalParent if not a root signal
type RootSignal = Signal & { causalParent: undefined };
type DerivedSignal = Signal & { causalParent: SignalID };
type ValidSignal = RootSignal | DerivedSignal;

// Law 11 — Local Knowledge: component state cannot reference external state
type ValidComponentState<T> = T extends { globalKnowledge: any } ? never : T;

// Law 1 — Signal Universality: no direct imports between components
// Enforced by architectural lint rule, not type system
```

---

## Part VII: Layered Identity (Genome Hierarchy)

### §7.1 The Three Genomes

Identity is not atomic. It is a stack of three genomes:

```
┌─────────────────────────────────────┐
│ Species Genome — NEVER changes      │
│ Defines what ACE *is*               │
│ - Core philosophy (persistence,     │
│   signal universality, governance)   │
│ - Immutable commitments (10 items)  │
│ - Laws 1–13 as identity markers     │
├─────────────────────────────────────┤
│ Workspace Genome — Changes per repo │
│ Defines workspace *personality*     │
│ - Language conventions              │
│ - Testing philosophy                │
│ - Architecture preferences          │
│ - Coding standards                  │
│ - Tool preferences                  │
├─────────────────────────────────────┤
│ Adaptive Genome — Learns over time  │
│ Defines current *state of self*     │
│ - Learned preferences (Taste)       │
│ - Skill proficiencies               │
│ - Confidence distributions          │
│ - Working relationships             │
│ - Recent adaptation history         │
└─────────────────────────────────────┘
```

### §7.2 Genome Rules

1. **Species genome is immutable after ratification.**
2. **Workspace genome seeds from species genome + workspace discovery.**
3. **Adaptive genome seeds from workspace genome + first 100 episodes.**
4. **A higher layer may not contradict a lower layer.** The adaptive genome may learn preferences, but it may not violate the species genome's commitments.
5. **All three genomes are persisted and replicated.**

---

## Part VIII: Cognitive Physics (DRAFT — proposed by RFC-0005, not yet normative)

> **Status:** Draft. This part is proposed text, not normative. It does not
> bind any implementation until RFC-0005 passes Acceptance. Content mirrors
> rfc/ideas/IDEA-0001/0003/0004/0005. Until acceptance, the numbers below are
> candidates, not constants.

### §8.1 Measured Quantities and Units

The runtime defines first-class measured quantities over the §2 primitives.
A quantity is a value with a unit basis; quantities are typed (branded per
§6.2) and never bare numbers in organ logic.

| Quantity | Symbol | Definition | Unit basis |
| --- | --- | --- | --- |
| Signal momentum | `p(s)` | `IG(s) · salience(s)` | entropy · priority |
| Knowledge velocity | `v(K)` | belief-revision rate per episode | Δconfidence / episode |
| Memory half-life | `t½` | decay parameter (Law 5) | time |
| Trust gradient | `∇T` | Δtrust per interaction hop | trust / hop |
| Attention density | `A(t)` | signals reaching cortex per tick | signal / tick |
| Learning rate | `L` | convergence speed of prediction error | ΔPE / episode |
| Evidence mass | `m(b)` | verified evidence weight of belief `b` | evidence × verification |
| Cognitive pressure | `P` | demand / available energy | energy-demand / energy-budget |
| Uncertainty field | `U(r)` | confidence dispersion over region `r` | std(confidence) |

### §8.2 Conservation Laws (candidate set)

| Law | Statement | Legal transforms |
| --- | --- | --- |
| C1 | Experience is never destroyed | compress, forget, archive, generalize — each recorded in the ledger |
| C2 | Every decision retains a provenance chain | trace linkage never severed (Law 3) |
| C3 | Knowledge requires evidence | confidence may decay; evidence is retained (Law 4) |
| C4 | Signal information is conserved under lawful transformation | replayable ledger (Law 12) |

"Forgotten" means a recorded transition to a lower-fidelity form with a trace
entry — never a silent deletion. Auditing a transform pathway means checking
it against this table.

### §8.3 Failure Physics (candidate)

Instability of a belief:

```
I(b) = confidence(b) − m(b)        // m(b) = evidence mass, §8.1
```

| Failure | Physical framing | Stability condition |
| --- | --- | --- |
| Hallucination | instability: confidence exceeds evidence mass | `I(b) ≤ θ` |
| Knowledge drift | entropy: belief moved from evidence without a recorded cause | drift attributable in ledger |
| Contradiction | potential energy: stored tension between beliefs | resolvable via revision (Law 4) |
| Dead memory | mass: storage with zero access and zero predictive value | eligibility for C1 transform |

Verification is stabilization: energy invested to reduce `I(b)`. Veto gates
(organic-score, constitution) are stability conditions, not policy opinions.

### §8.4 Cognitive Calculus (candidate closed forms — to be researched)

| Quantity | Candidate form | Research base |
| --- | --- | --- |
| Confidence update | `p' = p + α · (m(b) − p)` | Bayesian / AGM belief revision |
| Trust decay | `t(τ) = t₀ · 2^(−τ/t½)` | Law 5 exponential decay |
| Learning convergence | `PE(n) = PE₀ · n^(−β)` | power-law skill acquisition |
| Memory strength | spacing-based retention | Ebbinghaus forgetting curve |

No closed form enters the specification without a research evidence register
and a benchmark (RFC-0005 open items).

---

## Appendix A: Formal Notation Reference

| Notation | Meaning |
|----------|---------|
| ⟨a, b, c⟩ | Ordered tuple |
| {x \| P(x)} | Set of x where P(x) holds |
| f: A → B | Total function from A to B |
| f: A ⇀ B | Partial function from A to B |
| [a, b] | Closed interval |
| τ ∈ 𝕋 | τ is a time value |
| ⊥ | Bottom / undefined / null |
| H(X) | Shannon entropy of X |
| IG(s) | Information gain of signal s |
| N(s, M) | Novelty of signal s given memory M |
| KD(M) | Knowledge density of memory M |
