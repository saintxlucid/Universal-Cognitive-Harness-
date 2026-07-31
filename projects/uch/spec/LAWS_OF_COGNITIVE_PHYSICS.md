# Laws of Cognitive Physics

**Level I — Immutable. Never changes. No component may violate.**

These 19 laws define what is *impossible* in the Cognitive Exoskeleton, not just what is allowed. They are mathematically invariant. Any component, organ, plugin, or interface that violates them is malformed and must be rejected.

---

## Law 1 — Signal Universality

> Every observable interaction between any two components is represented as an **immutable signal**.

No method calls. No direct imports. No shared mutable state. All communication — perception, memory, planning, execution, feedback — flows through signals.

A signal is immutable once emitted. It carries:
- `id` — unique, deterministic
- `type` — from the ontology
- `source` — emitting component
- `target` — intended recipient (may be empty for broadcast)
- `payload` — structured data
- `energy` — metabolic cost
- `timestamp` — logical clock
- `freshness` — half-life for decay

**Rationale:** Immutability enables replay, audit, causal reconstruction, and parallel processing without locks.

---

## Law 2 — Conservation of Energy

> No computation is free. Every operation consumes measurable resources and must be schedulable.

Every component declares its metabolic cost model:
- CPU cycles
- Memory allocation
- Token consumption
- Latency budget
- Storage I/O
- Network bandwidth

The Metabolism subsystem allocates energy budgets. No component may consume energy it was not allocated. A component with zero budget does not execute.

**Rationale:** Prevents resource exhaustion by any single subsystem. Makes cost visible, not accidental.

---

## Law 3 — Causality

> Every observable state change must be causally attributable to one or more prior signals.

The system maintains a causal graph: signal A → signal B → state change C. No state change occurs without a parent signal. No orphan state.

This gives:
- **Replayability** — any state can be reconstructed from its causal chain
- **Auditability** — every decision has a provenance trail
- **Determinism** — given the same signal sequence, the same state emerges

**Rationale:** Without causality, debugging becomes archaeology.

---

## Law 4 — Evidence Over Assertion

> No component owns truth. Only evidence exists.

Every claim carries:
- `origin` — which component produced it
- `confidence` — 0.0 to 1.0
- `verification` — independent confirmation status
- `age` — timestamp of observation
- `contradictions` — references to conflicting evidence

Truth is emergent from the evidence set. No single component declares reality. The Judiciary may weigh evidence. No component may assert fact without provenance.

**Rationale:** Prevents any single subsystem from hallucinating state that other subsystems trust.

---

## Law 5 — Universal Decay

> Everything decays. Every entity carries a birth timestamp, half-life, and decay function.

This applies to:
- Memories
- Beliefs
- Policies
- Skills
- Confidence scores
- Relationships between concepts
- Learned patterns
- Cache entries
- Cached model outputs

When confidence or relevance drops below a threshold, the entity is eligible for archival or garbage collection. The organism knows what it no longer knows.

**Rationale:** Without decay, the system accumulates stale truth until it contradicts reality silently.

---

## Law 6 — Experiential Residue

> Every completed computation leaves residue.

Residue includes:
- Lessons extracted
- Confidence deltas
- Performance metrics
- Error patterns
- Skill proficiency updates
- Pattern recognition improvements

No work disappears. Residue feeds the Neocortex, Evolution Engine, and skill registry. The organism improves from every operation, even failed ones.

Residue must be **compressible** to prevent unbounded growth. Compression is the mechanism by which data becomes wisdom.

**Rationale:** Without residue, the organism never learns. Without compression, it only accumulates.

---

## Law 7 — Triadic Validation

> No action executes with fewer than three independent perspectives.

Every action requires:
1. **Executive** — decides the action is desirable
2. **Memory** — provides context and precedent
3. **Judiciary** — validates against constitution and policy

These are perspectives, not specific organs. The same physical component may not serve more than one perspective in the same decision.

**Rationale:** Prevents single-component catastrophic decisions. Ensures every action is contextualized and validated.

---

## Law 8 — Recursive Organization

> Everything is composed of smaller things that obey the same laws.

The hierarchy:
- **Cells** — atomic units of computation
- **Tissues** — cooperating cell groups
- **Organs** — functional subsystems
- **Systems** — coordinated organ groups
- **Organism** — the complete exoskeleton

Every level obeys Laws 1–13. There is no special case at any scale. A cell routes through the Nervous System. A System routes through the Nervous System. Same rules.

**Rationale:** Prevents architectural special-casing as the system grows. Laws hold at 10 components and 10,000.

---

## Law 9 — Developmental Lifecycle

> Every component passes through defined lifecycle stages.

```
Embryonic → Experimental → Learning → Stable → Optimized → Deprecated → Retired → Archived
```

A component may also **mutate** — evolve without replacement. Mutation is preferred over replacement when the component's purpose is unchanged.

There is no "enabled" or "disabled" binary. Components grow, mature, decline, and die. The Connectome routes around retired components automatically.

**Rationale:** Enables evolution without rewrites. The organism grows new capabilities rather than swapping them.

---

## Law 10 — Identity Persistence

> The organism's identity outlives every component.

The workspace genome, constitution, and core belief set persist across:
- Organ replacement
- Model provider changes (GPT → Claude → DeepSeek)
- Storage engine migrations
- Process restarts
- Version upgrades

Identity is not stored in any single organ. The Genome is replicated across at least three stores. Loss of identity is unrecoverable.

**Rationale:** Without identity persistence, every restart is a reincarnation. The organism must remember who it is.

---

## Law 11 — Local Knowledge

> No component requires global knowledge to function.

Every component acts only on:
1. Its local state
2. Signals it has received

A component may not query another component's internal state. It may not assume knowledge of the global topology. It may not depend on the existence of any other specific component.

The Nervous System routes signals. Components do not address each other by identity — they emit typed signals and the Nervous System delivers them.

**Rationale:** The single most important scalability law. Components that require global knowledge cannot be independently deployed, tested, or evolved.

---

## Law 12 — Reversibility

> Every significant state transition must be reconstructible.

Not necessarily reversible (undo), but **replayable**: given the same signal sequence, the same state emerges. This implies:
- Signals are durable (persisted)
- Signal order is preserved per causal chain
- State transitions are deterministic given their input signals

This leads naturally toward event sourcing without mandating a specific storage format.

**Rationale:** Enables debugging, auditing, simulation, and recovery. A system that cannot be replayed cannot be understood in production.

---

## Law 13 — Minimal Consciousness

> Only information requiring executive reasoning may reach the executive layers.

Signals terminate at the lowest capable nervous layer:
- **Peripheral** — IDE events, file changes → terminate at reflex if no executive action needed
- **Spinal** — rapid reflex patterns → terminate without cortical involvement
- **Brainstem** — life-sustaining homeostasis → continuous low-level regulation
- **Thalamus** — signal prioritization → only novelty passes upward
- **Cortex** — executive reasoning → only what requires conscious thought

If a reflex can handle it, the cortex is never woken.

**Rationale:** The single biggest latency and cost optimization. Prevents the executive from drowning in peripheral noise.

---

---

## Law 14 — Economic Rationality

> Every operation must justify its energy cost through expected information gain.

No computation executes without an economic proposal (defined in the Formal Foundations, Part III). The proposal must declare:
- `expectedBenefit` — estimated information gain (0–1)
- `confidence` — confidence in the estimate (0–1)
- `risk` — probability of waste (0–1)
- `opportunityCost` — what this operation displaces

The Metabolism subsystem acts as market maker, allocating energy to the highest-ROI proposals. An operation with `ROI < θ_min` (default 0.1) is never scheduled.

**Exception:** Homeostatic operations (immune scans, heartbeat signals, constitution enforcement) execute at a fixed minimum allocation regardless of ROI.

**Rationale:** Without economic discipline, the organism spends energy on low-value computation while starving high-value cognition.

---

## Law 15 — Information Conservation

> A signal that carries zero information gain must be absorbed at the lowest capable nervous layer.

Every signal is scored on information-theoretic metrics defined in the Formal Foundations (Part II):
- `entropy` — uncertainty reduction potential
- `novelty` — dissimilarity from existing memory
- `informationGain` — actual uncertainty reduction after processing
- `predictionError` — difference from expected outcome

A signal where `informationGain ≈ 0` and `novelty < θ_novel` (default 0.1) MUST NOT propagate beyond the layer that classified it.

Each nervous layer is an entropy-reduction stage:
```
Classification (H↓20%) → Deduplication (H↓40%) → Aggregation (H↓20%) →
Compression (H↓10%) → Importance (H↓5%) → Priority (H↓5%)
```

**Rationale:** Without information conservation, the cortex drowns in redundant signals. The organism confuses activity with progress.

---

## Law 16 — Interrupt Hierarchy

> A higher-priority signal may preempt any lower-priority execution.

Interrupt levels correspond to nervous layers:

| Level | Name | Preempts | Deadline |
|-------|------|----------|----------|
| 0 | Peripheral | Nothing | 100ms |
| 1 | Spinal | Peripheral | 500ms |
| 2 | Brainstem | Spinal | 200ms |
| 3 | Thalamic | Brainstem | 50ms |
| 4 | Executive | All | 10ms |

A preempted operation is either:
- **Resumed** — if its context remains valid after the interrupt handler completes
- **Discarded** — if its deadline passed or its preconditions changed

The interrupted operation's causal chain is preserved. The interrupt becomes a parent of the resumed operation.

**Rationale:** Without interrupts, emergency signals queue behind routine processing. The organism cannot respond to threats or opportunities in real time.

---

## Law 17 — Signal Fusion

> No action is taken on a single weak signal; decisions require fused evidence from multiple independently-sourced signals.

A single signal carries noise, bias, and incomplete coverage. Before an
executive decision is made from scored evidence, the underlying signals MUST
pass through a fusion stage that:

- normalizes each signal to a comparable 0-1 scale,
- weights and composites the set into a ranked aggregate,
- flags structural risk (few factors, low liquidity, high volatility),
- bands the outcome (buy/watch/avoid style recommendation), and
- records the fusion run with its evidence identifiers for replay.

The fusion stage is deterministic and LLM-free in the default path. A
component that acts on a single signal without fusion — when multiple
weak signals are available — violates this law (Cortex Kernel / Integration
Kernel responsibility).

**Rationale:** Without fusion, the organism's decisions inherit the noise of
whichever signal arrived last. Weak signals are only robust in aggregate —
Law 7 (Triadic Validation) governs who validates; this law governs how
evidence is combined before validation.

---

## Law 18 — Governance Before Landing

> No change to the workspace lands without passing the governance gate.

Every code change, plan, or policy mutation MUST be reviewed against the
enacted constitution before it is committed:

- **Clean changes** pass (allow).
- **Moderate violations** are deferred to the judgment tier (review) — never
  auto-landed.
- **Hard violations** (a principle scoring below the constitutional floor)
  block the change outright.

The gate records evidence as principle ids + flags only — never change
content — and its verdicts are observable as governed events
(`governance:*` on the neural event bus). A bypass path may exist only as a
recorded override that still emits the denial event with the override noted
(Law 4: Evidence Over Assertion).

**Rationale:** Without a pre-landing gate, violations enter the workspace
after the fact and can only be repaired, never prevented. Governance is a
filter on the way in, not a cleanup on the way out.

---

## Law 19 — Cognition Ownership

> The organism owns every cognitive artifact it produces. No host, driver,
> package, or external client may claim ownership of the cognition it
> observed, translated, or augmented.

Cognition — episodes, traces, memories, decisions, lessons, and derived
knowledge — belongs to the organism, not to the channel that carried it.
An attached driver (Universal Cognitive Harness) holds:

- a time-limited **grant** to observe and translate within its scope,
- a **projection** of state filtered through that grant,
- **no ownership** of what it reads, and no right to copy, fork, export,
  or re-claim it beyond the grant.

This law is enforced at the trace boundary (the ledger records the emitter,
never the owner — `COGNITIVE-TRACE.md` §3), at the middleware image boundary
(images are per-grant projections, `COGNITIVE-MIDDLEWARE.md` §3), and at the
package gate (a package that attempts to claim cognition is malformed and its
install is vetoed — `COGNITIVE-PACKAGES.md` §4 rule 6). Constitutional
implementation: Article III §6 (Session Privacy / consolidation-only
visibility).

**Rationale:** Ownership is what makes cognition persistent across pilots
and platforms. If the adapter that observed cognition could own it, then
when the adapter is replaced the cognition leaves with it — the exact
failure this project exists to prevent (ADR-001, MANIFESTO §1).

---

## Dual Naming Convention

All organs and systems carry both an **engineering name** and a **biological metaphor**:

| Engineering Name | Biological Metaphor | Purpose |
|-----------------|-------------------|---------|
| Executive System | Prefrontal Cortex | Planning, decisions, inhibition |
| Memory System | Hippocampus | Episodic encoding, consolidation |
| Learning System | Neocortex | Pattern discovery, abstraction |
| Action Selection | Basal Ganglia | Routine selection, habits |
| Routing System | Nervous System | Signal delivery, prioritization |
| Integration Kernel | Cortex Kernel | Cross-modal synthesis |
| Persistence Engine | Aether | 24/7 continuous operation |
| Signal Priority | Thalamus | Attention gating |
| Homeostasis | Brainstem | Vital regulation |
| Reflex Engine | Spinal Cord | Zero-LLM fast paths |
| Threat Detection | Immune System | Anomaly monitoring |
| Modulation | Endocrine | Global parameter adjustment |
| Offline Processing | Sleep Cycle | Consolidation, pruning |
| Concept Store | Connectome | Relationship graph |
| Energy Budget | Metabolism | Resource allocation |
| Governance | Constitution | Rules, separation of powers |
| Productivity Kernel | Basal Ganglia (extended) | Goal-to-execution scheduling, MIT tracking |
| Signal Fusion Engine | Cortex Kernel (sub-organ) | Multi-signal ranked composite, risk controls |
| Code Governance Gate | Constitution (sub-organ) | Pre-landing Clean Code Covenant audit |

*Documentation must use the engineering name first, with the biological name in parentheses on first reference: "The Executive System (Prefrontal Cortex) formulates plans."*

---

## Enforcement

These laws are not aspirational. They are enforced by:
1. **Static analysis** — code review rejects violations of Laws 1, 8, 11
2. **Runtime auditing** — the Judiciary monitors for violations of Laws 2, 3, 4, 7, 14
3. **Economic auditing** — Metabolism monitors Law 14 compliance across all scheduled operations
4. **Information auditing** — the Nervous System monitors Law 15 compliance per signal
5. **Constitutional review** — new organ specifications are reviewed against all 19 laws before implementation begins
