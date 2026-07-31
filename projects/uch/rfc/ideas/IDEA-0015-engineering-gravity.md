# IDEA-0015 — Engineering Gravity

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "every engineering decision generates
  a force; a bad abstraction produces architectural gravity — everything
  orbits it, coupling increases, maintenance cost rises; architecture has
  mass; technical debt is a measurable field"
- **Related:** design/ENGINEERING-INTELLIGENCE.md (coupling gate, ADR-003),
  src/kernel/constitution/organic-score.ts, design/DIRECTIONS.md (debt
  register)

## Motivation

Technical debt as a measurable field, not a metaphor. A bad abstraction has
mass; modules are attracted to it; maintenance cost is the integral of that
attraction over time. UCH measures the field, so the runtime can predict
where the next maintenance sink will form.

## The corpus cannot cover it because

The EI coupling gate is advisory and threshold-based (filesTouched,
externalImports); the debt register is a list; organic scoring is per-change.
Nothing models mass/attraction or predicts future maintenance cost from
current structure.

## Proposal sketch

- Mass of an abstraction ≈ fan-in × coupling × change churn.
- Attraction ≈ rate at which new modules bind to it; cost ≈ integral of
  attraction × churn over time.
- Exposed as an EI tier + observatory field (IDEA-0014); the twin (IDEA-0012)
  propagates mass under simulated refactors.

## Risk assessment

- Metric astrology: the model must be validated against real history before
  any decision trusts it (does fan-in × churn predict observed maintenance
  cost in this repo's git history?).

## Where it lands

- Extension of design/ENGINEERING-INTELLIGENCE.md; new EI evaluator field.

## Code impact

- None until the validation study passes.

## Next stage

Historical validation study on this repo: correlate fan-in × churn with
subsequent change cost; adopt the field model only if the correlation holds.
