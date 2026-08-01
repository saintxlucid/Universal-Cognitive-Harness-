# IDEA-0075 — Intent Objects

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Not prompts. Intent. An intent object contains Goal, Constraints,
  Success, Failure, Priority, Deadline, Stakeholders, Risk, Evidence.
  Everything downstream compiles from that."
- **Related:** RFC-0004 CIR (rfc/RFC-0004-cognitive-intermediate-
  representation.md — intent → CIR → optimizer → scheduler → fabric →
  verification → learning pipeline), IDEA-0055 (CEL — missions
  compiled through CIR to the CVM), IDEA-0034 (decision law — EU + IG
  under energy/risk/latency costs), spec/CP.md (17 ops — the execution
  substrate), GSD tasks/plans (structured task objects), IDEA-0057
  (CQL — queryable intent), IDEA-0072 (lifecycle — intent as an object
  class), IDEA-0083 (spec repository — intent envelope schema)

## Motivation

Today a request is a prompt — unstructured text with implicit success
criteria. An intent object is the structured request: goal, constraints,
success predicate, failure predicate, priority, deadline, stakeholders,
risk appetite, evidence requirements. Everything downstream — planning,
execution, verification, learning, memory — *compiles from it*: the
success predicate becomes the verification gate, the deadline feeds the
scheduler, the risk appetite feeds the decision law, the evidence
requirement feeds the evidence chain. This matches the intent → IR →
runtime pattern the intake cites, and the corpus already has the IR
half (CIR draft, CEL) — it lacks the intent *envelope* that compiles
into it.

## The corpus cannot cover it because

CIR (RFC-0004) is a compiler design; it assumes intent exists but
specifies no intent format. CEL (IDEA-0055) is a language, not an
object contract. Task objects exist (GSD plans, scheduler tasks) but
carry execution fields, not the full intent envelope (success/failure
predicates, stakeholders, risk, evidence). The decision law (IDEA-0034)
consumes utility, risk, and latency — but there is no object that
*declares* them for a given mission; they are inferred or defaulted.

## Proposal sketch

- An intent envelope (goal, constraints, success, failure, priority,
  deadline, stakeholders, risk, evidence) as a first-class cognitive
  object class (IDEA-0056 lifecycle), versioned per IDEA-0069 and
  journaled in the ledger (ADR-002).
- Compile path: intent → CIR frontend (RFC-0004) → scheduler
  (deadline/priority → decision-law parameters) → verification
  (success predicate → gate) → memory (evidence requirement →
  provenance expectations).
- Queryable intents (IDEA-0057: FIND intent WHERE deadline < now AND
  status = in_progress) for the observatory and SLOs.

## Risk assessment

- Envelope inflation: a mandatory 9-field intent will be filled with
  garbage. Fields must be defaultable (risk = organism default, success
  = "as specified"), and the envelope must degrade gracefully to a
  prompt-shaped intent when under-specified.

## Where it lands

- `design/INTENT-OBJECTS.md`; feeds RFC-0004 (CIR) as its frontend
  input contract.

## Code impact

- None until the envelope schema is specified; RFC-0004's promotion is
  the dependency (round-10 headline).

## Next stage

- Envelope schema drafted against the decision-law parameters as
  validation; CIR frontend contract alignment.
