# IDEA-0022 — Architecture Review Board

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "not one critic: a structured review
  pipeline — performance, security, maintainability, API, concurrency,
  reliability, UX, cost, future-compatibility — each produces evidence, not
  opinions; only then the executive decides"
- **Related:** design/ENGINEERING-INTELLIGENCE.md (ADR-003), src/cognitive-plane
  (ExecutiveBrain evaluateChange), src/kernel/constitution (vetoes),
  .agents/skills organic-review

## Motivation

Single-critic review has blind spots and taste. A review board is a
registry of lenses, each producing evidence for the change; a composition
rule turns per-lens evidence into a verdict the executive can act on —
with vetoes that no aggregate can override.

## The corpus cannot cover it because

The EI layer evaluates one domain at a time (advisory or veto); organic
scoring and the constitution gate veto individually; the executive escalates
on engineering vetoes. There is no multi-lens board with per-lens evidence
records, no composition rule across lenses, and no verdict line recorded in
the ledger.

## Proposal sketch

- Lens registry: each lens declares its evidence format and its gate
  (advisory / required / veto).
- Board run: collect evidence per lens → compose (veto aggregation +
  weighted verdict) → record in the trace ledger → executive acts.
- Composition rule must be explicit and reviewable — no silent weighting.

## Risk assessment

- Review theater: a lens with no evidence is a checkbox; "no lens, no
  verdict" is the discipline.

## Where it lands

- Design doc `design/REVIEW-BOARD.md`; composes the existing lenses
  (engineering-intelligence, organic-score, constitution) first.

## Code impact

- None until the composition of existing lenses into a board with a verdict
  line is prototyped.

## Next stage

Compose the three existing lenses into a board; measure verdict agreement
against human reviews on real changes.
