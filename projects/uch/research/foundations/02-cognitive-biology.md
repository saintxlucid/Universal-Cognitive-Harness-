---
track: cross-cutting
status: research-draft
version: 0.1.0
---

# Cognitive Biology v0.1

## Design unit: the organ

An organ is a cohesive cognitive responsibility with a purpose, typed inputs and
outputs, internal state, signals, energy budget, plasticity rules, failure
modes, healing mechanisms, sleep behavior, development stages, and a public
contract. Services, classes, queues, models, and databases are implementation
details chosen later.

The organism is recursive rather than a linear pipeline:

```text
reality → perception → understanding → world model → prediction
    ↑          ↓              ↓              ↓             ↓
evidence ← memory/knowledge ← connectome ← executive ← decision/action
    ↑                                                              ↓
    └──── trust, critic, outcome evaluation, learning, evolution ──┘
```

No organ may directly mutate another organ's authoritative state. It publishes a
typed proposal or event through the Cognitive Bus; the receiving organ applies
its own policy and emits an auditable result.

## Organ systems

| System / organ | Purpose | Inputs / outputs | Failure and healing |
| --- | --- | --- | --- |
| Sensory system | Convert chat, code, filesystem, tool, web, image, audio, and API observations into canonical episodes. | Source artifacts → immutable observations. | Reject malformed/untrusted input; retain source reference and quarantine unsafe content. |
| Attention system | Allocate bounded cognitive energy using relevance, novelty, risk, urgency, user intent, and uncertainty. | Episodes/goals → activation requests and budgets. | Starvation or thrashing; use quotas, fairness, and backpressure. |
| Understanding system | Propose intents, entities, concepts, constraints, and candidate claims. | Observations + context → candidates with rationale/evidence. | Hallucinated extraction; candidates remain non-authoritative. |
| Knowledge compiler | Transform evidence into linked claims, concepts, patterns, principles, and model candidates. | Candidate graph → versioned derivations. | Over-compression; measure source coverage and reconstructability. |
| Episodic system | Preserve high-fidelity, time-indexed experiences and outcomes. | Observations → source episodes. | Storage growth; archive by policy, never silently erase evidence. |
| Semantic system | Maintain verified claims and structured concepts across time. | Evidence-backed claims → temporal semantic objects. | Staleness/contradiction; use bitemporal updates and retraction. |
| Connectome | Maintain typed links: causal, dependency, ownership, contradiction, similarity, and evidence. | Objects/events → scoped edges. | Spurious association; require relation type, source, confidence, and review. |
| World-model system | Build bounded predictive models of users, projects, tasks, environments, and tools. | Claims/episodes/outcomes → forecasts and assumptions. | Overgeneralization; require calibration and counterexamples. |
| Executive system | Select cognitive actions, tools, plans, and refusal/abstention paths. | Goals, evidence, budgets → proposed decisions. | Runaway planning; use authority gates and value-of-computation rules. |
| Critic and immune system | Detect unsupported claims, conflicts, poisoning, scope violations, and unsafe action paths. | All candidate effects → policy verdicts. | False confidence or denial loops; independent verifiers and audit review. |
| Learning system | Convert evaluated outcomes into calibrated skill, preference, and model updates. | Results + feedback → candidate learning updates. | Reward hacking/sycophancy; multi-objective scoring and holdout tests. |
| Evolution system | Test alternative algorithms, prompts, rules, and organ versions under controlled evaluation. | Candidate changes → shadow/canary/rollback evidence. | Self-modifying instability; no direct production mutation. |
| Metabolism | Allocate compute, storage, queue, and latency budgets; schedule offline work. | Demand signals → grants, denials, and backpressure. | Resource exhaustion; per-scope quotas and priority inheritance. |
| Sleep system | Perform budgeted replay, consolidation proposals, deduplication, drift detection, and insight generation. | Eligible evidence → candidate derivations/reports. | Destructive rewrite or endless work; append-only proposals and hard budgets. |
| Genome and identity system | Version mission, policies, capabilities, style preferences, and limits. | Approved governance changes → operating profile. | Identity drift; explicit versions and human approval. |

## The Cognitive Bus: nervous system, not a message dump

The Cognitive Bus is the only cross-organ communication path. It carries typed,
versioned, scoped, traceable events and commands. It provides causal ordering,
deduplication, backpressure, access control, budget propagation, and an audit
trail.

Example event chain:

```text
workspace.observed
  → understanding.candidates_proposed
  → project-model.change_detected
  → connectome.edges_proposed
  → executive.plan_staled
  → critic.replan_required
  → sleep.consolidation_scheduled
```

Each arrow is a policy-checked event, not an implicit function call. An organ may
subscribe only to event classes and scopes it is authorized to receive.

## Activation field: an auditable projection

The brief's activation-field idea is adopted with an important constraint. The
COS cannot use one opaque, global mutable activation state: that would erase
provenance, permissions, reproducibility, and correction history.

Instead, a **scoped activation field** is a transient materialized projection
over durable objects for a particular actor, purpose, and budget. It ranks
eligible evidence, concepts, goals, risks, and predictions. The field expires,
is reproducible from its inputs, and records why a high-impact item was active.
Activation is never confidence, truth, or authority.

## Development stages

1. **Embryonic** — schema, policy, fixtures, and read-only observations.
2. **Juvenile** — candidate generation and retrieval with human-reviewed
   promotion.
3. **Mature** — bounded background consolidation, calibrated models, and
   controlled multi-agent collaboration.
4. **Evolving** — shadow-tested organ variants, canaries, rollback, and
   measured improvement.

No stage can be skipped because a model appears capable in a demonstration.
