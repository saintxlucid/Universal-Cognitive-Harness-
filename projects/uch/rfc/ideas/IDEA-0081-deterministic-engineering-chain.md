# IDEA-0081 — Deterministic Engineering Chain

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Every engineering action should produce Plan, Simulation,
  Verification, Execution, Validation, Evidence, Replay. Not 'hope.'"
- **Related:** src/kernel/constitution/organic-score.ts (OrganicScore
  Engine — 15-metric rubric, constitutional vetoes), .agents/skills/
  organic-code (6-gate pipeline), design/DIRECTIONS.md (DOE — TDD
  waves, verification gate, independent verification), GSD (plan/
  execute phases, atomic commits), IDEA-0012 (digital twin —
  what-if simulation), IDEA-0013 (cognitive manufacturing — station
  contracts with gates), ADR-003 (engineering intelligence — benchmark
  corpus + runner), ADR-002 (trace ledger — replay substrate), UER
  (IDEA-0047 — causal replay graph), IDEA-0075 (intent objects —
  success predicates), IDEA-0076 (lineage)

## Motivation

Engineering is the difference between acting and hoping: every action
produces a plan, a simulation of the plan, verification that the
simulation is valid, execution of the verified plan, validation that
execution matched the plan, evidence for every step, and replay when
something fails. The corpus has this discipline *as workflow* — the
organic-code 6-gate pipeline, DOE SOPs, GSD phases, benchmark-driven
review — but the chain is enforced by process conventions, not by a
contract: nothing guarantees that an engineering action leaves a
complete evidence trail (plan → simulation → verification → execution →
validation → evidence → replay) journaled in the ledger.

## The corpus cannot cover it because

The gates exist as methodology (organic-code, DOE, GSD) and the
substrates exist (ledger for replay, twin for simulation, benchmark for
verification, UER for causality) — but there is no *chain contract*:
an action can skip simulation (no twin run), skip validation (no
post-execution check), or skip evidence (no ledger entry) without a
structural violation. The evidence chain is recomposed by hand per
wave; nothing verifies chain completeness before a change is accepted.

## Proposal sketch

- A chain contract for engineering actions: each stage (plan,
  simulation, verification, execution, validation, evidence, replay)
  has a mandatory ledger artifact type; acceptance of any change
  requires the chain's artifacts to exist and link (lineage via
  IDEA-0076).
- Stage automation: simulation defaults to the twin (IDEA-0012) where
  available, verification to the organic-score/benchmark machinery,
  replay to UER (IDEA-0047) — the chain binds existing organs rather
  than adding new ones.
- Chain completeness becomes an engineering-intelligence gate (ADR-003
  evaluator) and a review-board (IDEA-0022) lens.

## Risk assessment

- Chain theater: mandatory artifacts will be produced minimally unless
  they are *consumed*. Every artifact must have a downstream consumer
  (a gate that reads it, a lens that scores it), or the stage is
  dropped from the contract.

## Where it lands

- `design/ENGINEERING-CHAIN.md`; extends DOE SOPs + organic-code
  gates; consumes twin, benchmark, ledger, UER.

## Code impact

- None until the artifact types and completeness gate are specified;
  the organic-score engine becomes the first consumer.

## Next stage

- Seven artifact types drafted; map the current organic-code pipeline
  onto the chain to find the missing stage.
