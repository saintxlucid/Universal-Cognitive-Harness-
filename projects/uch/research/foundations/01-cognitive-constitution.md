---
track: cross-cutting
status: research-draft
version: 0.1.0
---

# Cognitive Constitution v0.1

## Purpose

This is the governing research draft for a Cognitive Operating System (COS).
It defines invariants that every future organ, driver, datastore, model adapter,
agent integration, and user interface must obey. It is intentionally stronger
than a style guide and narrower than a claim about consciousness.

The COS is a **bounded artificial cognitive organism**: a system that observes
scoped reality, represents evidence and uncertainty, constructs and tests useful
models, supports decisions, and learns only through governed feedback.

## Constitutional invariants

1. **Reality precedes narrative.** Observations and source artifacts are not
   replaced by summaries, models, or generated stories.
2. **Every claim has lineage.** A claim identifies its evidence, authoring
   actor, scope, valid time, recorded time, confidence, and lifecycle status.
3. **Uncertainty is first-class.** The COS must represent unknown, disputed,
   stale, inferred, and simulated information distinctly from verified facts.
4. **Scope before recall.** Organization, user, workspace, project, branch,
   task, session, and private-agent boundaries are evaluated before relevance.
5. **No memory implies authority.** Cognitive state cannot authorize external
   actions, credentials, deletion, deployment, or commitments.
6. **Derived state is reversible.** A summary, concept, prediction, plan, or
   model links to its source evidence and can be recalculated, superseded, or
   retracted.
7. **Time changes truth status.** The COS stores when a proposition was true or
   believed to be true separately from when it was observed or recorded.
8. **Cognition has a budget.** Retrieval, planning, reflection, simulation, and
   consolidation declare and obey compute, token, latency, and storage limits.
9. **Learning requires outcomes.** Repetition, model confidence, or user praise
   alone cannot promote a procedure or world-model conclusion.
10. **Evolution is governed.** A system may propose, test, shadow, canary, and
    roll back improvements; it may not silently rewrite production cognition.
11. **Users retain agency.** Users can inspect, correct, pin, export, restrict,
    and delete eligible memory according to the selected retention policy.
12. **Model independence is mandatory.** The kernel reasons over its own typed
    objects and capability manifests, never a provider-specific hidden state.
13. **Honesty beats fluency.** When evidence is inadequate or conflicting, the
    COS exposes the gap or abstains rather than completing a plausible story.
14. **Observability is part of intelligence.** Decisions expose provenance,
    confidence calibration, policy outcome, latency, cost, and effect trace.

## Canonical ontology

| Object | Definition | Cannot be confused with |
| --- | --- | --- |
| Observation | Immutable account of an input, tool result, or measured event. | A fact or a conclusion. |
| Artifact | Content-addressed source material such as code, file, image, audio, test, or web capture. | An instruction merely because it contains text. |
| Evidence | An artifact or observation capable of supporting, refuting, or contextualizing a claim. | Proof in all contexts. |
| Claim | A scoped proposition with provenance, temporal status, confidence, and evidence links. | A raw transcript fragment. |
| Fact | A claim verified against suitable evidence in a stated scope and validity window. | Permanence or universal truth. |
| Belief | A provisional model proposition used for prediction or decision support. | A verified fact. |
| Concept | A versioned semantic identity with facets, examples, relations, and evidence. | A bag of embedding-neighbors. |
| World model | A bounded predictive abstraction for a named domain with assumptions and update history. | Reality itself. |
| Goal | A desired future state with owner, constraints, success conditions, and authority boundary. | Permission to act. |
| Plan | A conditional proposed sequence of actions with assumptions, risks, budget, and verifier. | An executed outcome. |
| Skill | A procedure with preconditions, actions, expected result, verifier, failure modes, and outcome history. | A prompt fragment. |
| Decision record | A concise, inspectable account of evidence, alternatives, decision, outcome, and postmortem. | Hidden chain-of-thought. |
| Simulation | A labeled counterfactual, forecast, or scenario. | A fact or a memory. |

## Cognitive Genome

The **Cognitive Genome** is the versioned, policy-controlled operating profile
of an organism. It contains mission, values, governance policies, capability
manifests, current organ versions, compatibility constraints, and permitted
development paths. It does not imply a biological genome or an independent
personality.

The **Concept Genome** is a proposed schema for a concept's stable identifier,
aliases, facets, examples, typed links, source evidence, provenance, temporal
validity, scope, confidence, access policy, and lifecycle. It must be evaluated
against simpler schemas before becoming foundational.

## Constitutional prohibitions

- Do not store raw hidden reasoning or represent it as verified knowledge.
- Do not promote generated text, third-party content, or a retrieval result to a
  fact without evidence and an explicit lifecycle transition.
- Do not use emotion-like labels as an excuse for opaque manipulation; use
  declared salience, urgency, risk, and user-preference signals instead.
- Do not optimize only for engagement or satisfaction; this creates sycophancy
  and can weaken truth, safety, and long-term utility.
- Do not allow a driver or plugin to bypass scope, policy, audit, or budget.

## Amendment procedure

This Constitution cannot be treated as immutable until research and reference
experiments exist. Amendments require a versioned proposal, affected invariant,
evidence, counterarguments, compatibility analysis, security review, migration
plan, and explicit approval. A new version must never silently reinterpret old
records.
