# IDEA-0034 — Theory of Intelligence: Unified Decision Law

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "stop asking what capabilities
  it should have; ask what properties intelligence itself should have" —
  every cognitive action carries Energy, Information Gain, Risk,
  Confidence, Novelty, Expected Utility, Latency, Reversibility; every
  decision: maximize Expected Utility + Information Gain while minimizing
  Energy + Risk + Latency. Planning, memory, learning, reflection,
  scheduling, and verification all become consequences of one law.
- **Related:** RFC-0005 (cognitive physics), IDEA-0001 (units),
  ADR-004 (scheduler/fabric cost functions), control-plane/budgets,
  src/protocol/catalog.ts (per-op energy costs), sleep cycle (info-gain
  distillation), organic-score (multi-metric judgment)

## Motivation

Today scheduling, budgets, verification gates, and sleep-cycle selection
each carry bespoke heuristics. The claim: one normative decision
functional — `maximize(EU + IG) subject to Energy, Risk, Latency costs`
— from which every subsystem's policy is a special case: scheduler
frugality is the energy term; verification gates are the risk term; sleep
cycle and curiosity are the information-gain term; reflection is the
response when the functional's confidence falls below a threshold.

## The corpus cannot cover it because

No single law ties the subsystems together; each cost function is local
and non-comparable. The candidate quantities (Confidence, Novelty,
Reversibility) exist scattered across constitution, trace metadata, and
organic-score inputs without a shared calculus.

## Proposal sketch

- Formalize the decision functional with defined terms and units
  (extending RFC-0005 quantities).
- Show existing subsystems as instantiations (scheduler, budgets,
  verification gates, sleep cycle, reflection triggers).
- The law must *predict*: e.g., reflection fires when expected
  information gain of self-review exceeds its energy+risk cost.

## Risk assessment

- Slogan risk: the equation is vacuous unless it produces testable
  predictions against existing telemetry (budget decisions, scheduler
  choices, sleep-cycle metrics).

## Where it lands

- Extends RFC-0005 (physics); design doc `design/DECISION-LAW.md`.

## Code impact

- None until the functional is fitted to existing telemetry; a
  retrospective study first.

## Next stage

Fit the functional to recorded scheduler/budget/sleep decisions and test
whether it retroactively predicts observed behavior.
