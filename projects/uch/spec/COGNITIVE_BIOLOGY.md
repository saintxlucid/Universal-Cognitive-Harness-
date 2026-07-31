# Cognitive Biology

**Level II — Physiology. Describes how the organism functions. Rarely changes.**

These are not invariant laws — they describe the operating physiology of a healthy cognitive organism. Violating biology causes dysfunction, not impossibility. The organism may temporarily operate outside these parameters, but it degrades.

---

## 1. Plasticity

> Connections strengthen or weaken through experience.

Every signal that passes through a neural pathway adjusts that pathway's weight:
- Frequent signals → pathway strengthens (lower latency, higher priority)
- Infrequent signals → pathway weakens (higher latency, lower priority)
- Correct predictions → positive reinforcement
- Incorrect predictions → negative reinforcement

Plasticity applies to:
- Connectome routing weights
- Memory retrieval rankings
- Skill proficiency scores
- Pattern recognition confidence
- Trust scores for sources

Without plasticity, the organism cannot adapt to changing conditions.

---

## 2. Homeostasis

> The organism continuously maintains internal equilibrium.

Homeostatic processes monitor and regulate:
- Metabolic energy levels — prevent starvation of any subsystem
- Memory pressure — trigger consolidation when buffer exceeds threshold
- Signal queue depth — prevent backpressure cascades
- Confidence stability — detect rapid oscillation as instability
- Error rate — trigger immune response when above baseline

Homeostasis is not a single organ. It is a distributed property: each tissue monitors its own state, and the Endocrine system broadcasts global condition signals.

When homeostasis detects significant deviation, it may trigger:
- Sleep cycle (offline maintenance)
- Immune response (threat containment)
- Metabolic reallocation (energy routing)
- Thalamic gating (signal filtering)

---

## 3. Metabolism

> Everything consumes finite resources.

Every operation has a metabolic cost measured in:
- **Computational energy** — CPU/GPU cycles
- **Memory** — RAM allocation
- **Token budget** — LLM inference cost
- **Latency** — time to completion
- **Storage** — disk I/O and capacity
- **Network** — bandwidth and round trips
- **Attention** — executive focus (scarce)

The Metabolism subsystem:
1. Maintains an energy ledger for every component
2. Allocates budgets per cycle
3. Monitors overspend and triggers throttling
4. Provides real-time cost visibility

Metabolic costs are **declared** by each component at registration, not measured after the fact. Components that consistently exceed declared budgets are flagged for review.

---

## 4. Development

> Everything grows through defined lifecycle stages.

Each component progresses through:

| Stage | Characteristics | Governance |
|-------|----------------|------------|
| **Embryonic** | Design approved, not yet built | Specification review |
| **Experimental** | Running in isolated environment | No production access |
| **Learning** | Observing, building confidence | Limited authority |
| **Stable** | Full operational capability | Standard governance |
| **Optimized** | Performance-tuned, hardened | May serve as reference |
| **Deprecated** | Replacement exists, still running | No new consumers |
| **Retired** | No longer operational | Archive state preserved |
| **Archived** | Source removed, specification retained | Historical reference |

A component may **mutate** (evolve without replacement) at any stage. Mutation bypasses the Embryonic and Experimental stages and enters directly at the current stage.

---

## 5. Healing

> Corruption is detected and repaired before replacement.

When a component exhibits anomalous behavior:
1. **Detection** — Judiciary, Immune system, or peer signals flag anomaly
2. **Isolation** — Nervous System reduces routing to affected component
3. **Diagnosis** — Root cause analysis via signal replay
4. **Repair** — State reconstruction from causal chain (Law 12)
5. **Verification** — Independent confirmation of repaired state
6. **Reintegration** — Normal routing restored

Healing is preferred over replacement. Replacement is preferred over degradation. Degradation is preferred over failure.

If a component cannot be healed, the developmental lifecycle terminates it cleanly (Retired → Archived) and the Connectome routes around the gap.

---

## 6. Sleep

> Idle time is used for maintenance and consolidation.

The sleep cycle activates when:
- Metabolic energy is above baseline (idle cycles available)
- Homeostasis detects consolidation pressure
- No active executive sessions are in progress
- A scheduled maintenance window opens

During sleep, the organism performs:
- **Memory consolidation** — buffer → long-term transfer
- **Pattern extraction** — residue → neocortical patterns
- **Skill benchmarking** — proficiency measurement
- **Knowledge graph maintenance** — link pruning, decay application
- **Index regeneration** — search optimization
- **Confidence recalibration** — evidence re-evaluation
- **Garbage collection** — decayed entity archival
- **Proactive insights** — generate documentation, proposals, refactoring suggestions

Sleep produces a report consumed by the executive on wake.

---

## 7. Evolution

> Capabilities improve without losing identity.

Evolution operates at multiple timescales:
- **Micro-evolution** — per-cycle plasticity (continuous)
- **Meso-evolution** — sleep-cycle optimizations (minutes to hours)
- **Macro-evolution** — component mutation and replacement (days to weeks)

Evolution is guided by:
- Benchmark results (objective performance)
- Residue analysis (lessons from experience)
- User satisfaction signals (external feedback)
- Self-reflection (internal assessment)

The Evolution Engine proposes mutations. The Judiciary reviews them. The Executive approves them. The component mutates. The Genome records the change.

---

## 8. Immune Response

> Threats are identified, contained, and eliminated.

The Immune System monitors:
- Signal anomalies — unexpected patterns
- Policy violations — authorization failures
- Confidence collapse — rapid degradation
- Resource exhaustion — energy budget overspend
- Provenance gaps — uncaused state changes
- Ontology violations — malformed signals

When a threat is detected:
1. **Containment** — affected component is quarantined (receives signals, cannot emit)
2. **Analysis** — causal chain is traced
3. **Remediation** — policy update, component repair, or constitutional review
4. **Memorization** — threat signature is stored (prevents recurrence)

---

## 9. Endocrine Regulation

> Global signals modulate all subsystems simultaneously.

The Endocrine system maintains a set of slow-changing global signals that influence all components:
- **Urgency** — overall priority level (0.0–1.0)
- **Confidence** — system-wide certainty in its own state
- **Uncertainty** — measure of unknowns
- **Resource Pressure** — energy scarcity indicator
- **Risk Level** — assessed threat environment
- **Cognitive Load** — executive saturation
- **Technical Debt** — accumulated maintenance burden

These signals differ from Nervous System signals in three ways:
1. **Slow-changing** — minutes, not milliseconds
2. **Global** — all components receive them
3. **Modulatory** — they adjust behavior, they don't command it

A component under high resource pressure may prioritize differently. A component under high uncertainty may request verification. The same component under normal conditions would act autonomously.

---

## 10. Thalamic Gating

> Not every signal reaches the cortex.

The Thalamus (signal prioritization layer) determines what passes to higher layers:

| Signal Type | Default Layer | Condition for Escalation |
|-------------|---------------|-------------------------|
| File changed | Peripheral | If file matches active attention focus |
| Git commit | Peripheral | If author is current agent |
| Test failure | Spinal | If test is related to current task |
| Build break | Spinal | Always escalate |
| Policy violation | Spinal | Always escalate |
| Confidence drop | Brainstem | If drop exceeds threshold |
| Anomaly pattern | Thalamus | If pattern is novel |
| User message | Thalamus | Always escalate |
| Executive request | Thalamus | Always escalate |

This implements Law 13 (Minimal Consciousness) in physiology.

---

## Integrity

These biological processes are not enforced by static analysis. They are enforced by:
1. **Health checks** — each component reports its biological state
2. **Homeostatic monitors** — detect deviations and trigger corrective action
3. **Sleep reports** — verify consolidation and maintenance completion
4. **Evolution audits** — review mutation impact on organism coherence
