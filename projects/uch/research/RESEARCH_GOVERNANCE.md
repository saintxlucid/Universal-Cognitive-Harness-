# Research Governance and Cognitive Constitution Preconditions

## Thesis

The COS should be investigated as **artificial cognitive infrastructure**: a
modular, inspectable system that helps agents form useful, evidence-bounded
models of users, projects, tasks, and environments across time. Memory is an
organ in that system, not its purpose.

The system's purpose is not unconstrained autonomy, a fictional inner life, or
automatic self-modification. It is to improve decisions while preserving human
authority, privacy, provenance, and reversibility.

## Non-negotiable boundaries

1. **No hidden chain-of-thought archive.** Persist concise decision provenance:
   goal, inputs, evidence identifiers, alternatives, selected action, outcome,
   verification, and postmortem. Raw private reasoning is neither reliable
   knowledge nor necessary for cross-agent learning.
2. **No unsupported fact promotion.** Agent extraction produces a candidate;
   provenance, corroboration, or deterministic verification are required before
   a fact becomes verified.
3. **No implicit authority.** Recalled memory cannot authorize external writes,
   deployments, credential use, deletion, or material commitments.
4. **No identity deception.** An Identity Model is a versioned operating
   profile—mission, policies, capabilities, limits, and interaction standards—
   not evidence of consciousness or a claim to personhood.
5. **No satisfaction-only reward.** Feedback is one signal among correctness,
   safety, groundedness, task outcome, maintainability, cost, and user intent.
6. **No irreversible autonomous consolidation.** Consolidation may create
   candidates and derived summaries; it must retain links to source episodes,
   be auditable, and respect retention/deletion policies.

## Reframing the proposed cognitive laws

| Proposed law | COS research interpretation |
| --- | --- |
| Conservation | Preserve evidentiary lineage where permitted; support legal/privacy deletion and explicit tombstones rather than pretending all knowledge is permanent. |
| Energy | Every retrieval, model call, consolidation job, and graph traversal has a declared compute/token/latency budget. |
| Entropy | Decay activation and retrieval priority, not source evidence. Archive or quarantine rather than silently erase. |
| Plasticity | Increase confidence only after independent confirmation or a verified outcome; repetition alone is not truth. |
| Association | Create typed, source-linked relationships with confidence and scope—not unconstrained graph edges. |
| Prediction | Measure decision utility, including rare but high-risk facts; do not delete information merely because it is infrequently predictive. |
| Compression | Prefer reversible summaries that cite source episodes; evaluate information loss and rebuildability. |

## Definition work required before kernel design

The following are unresolved research objects, not settled words:

- **Observation**: an immutable record of input or measured tool outcome.
- **Evidence**: a source that can support, refute, or contextualize a claim.
- **Claim**: a scoped proposition with a truth status, temporal validity, and
  confidence calibrated against evidence.
- **Fact**: a claim confirmed against an appropriate source within a scope and
  validity window; facts can later become superseded or retracted.
- **Belief / model**: a predictive abstraction derived from multiple claims;
  never a replacement for cited evidence.
- **Concept Genome**: a proposed versioned object schema describing a concept's
  identifiers, facets, relations, exemplars, evidence, lifecycle, and access
  constraints. It is a research hypothesis, not biological DNA.
- **World model**: a bounded, task-relevant predictive model with stated
  assumptions, uncertainty, and update history.
- **Skill**: a procedure with preconditions, actions, expected outcomes,
  verification method, failure modes, and measured history.

## Research-note template

```markdown
---
track: T00
status: exploratory | reviewed | replicated | decision-ready
claims: []
sources: []
---

# Title

## Question
## Direct evidence
## Inferences for COS
## Counterevidence and failure modes
## Falsifiable hypotheses
## Evaluation design
## Open questions
```

## Design gates

No production runtime, database choice, language choice, protocol, or
autonomous module may be approved until these gates are met:

1. **Ontology gate** — the Constitutional vocabulary and scope model have
   examples, counterexamples, versioning, and conflict rules.
2. **Truth gate** — source episodes, claim provenance, temporal validity,
   contradiction handling, correction, and deletion can be represented.
3. **Safety gate** — threat model covers poisoning, prompt injection through
   memory, cross-tenant leakage, consent, retention, and action authorization.
4. **Evaluation gate** — each mechanism has a baseline, fixture set, metrics,
   negative tests, and a rollback criterion.
5. **Interoperability gate** — a minimal provider-neutral contract works across
   two models and two agent runtimes without leaking hidden state.
6. **Operations gate** — concurrency, audit, backup, recovery, cost, latency,
   and observability are specified before a persistent service is built.

## Initial research questions

1. When should an event remain a raw episode, become a claim, update a model,
   become a procedure, or be forgotten?
2. How can a temporal claim be corrected without corrupting historical state?
3. Which retrieval packet maximizes evidence coverage per token under a fixed
   budget?
4. Which learning signals improve future task outcomes without producing
   sycophancy, privacy leakage, or self-confirming beliefs?
5. What minimum object model supports project isolation, user control, and
   cross-runtime handoff?
6. Which biological analogies yield testable algorithms, and which are merely
   evocative names that should be discarded?
