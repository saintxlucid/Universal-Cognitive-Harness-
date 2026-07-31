# IDEA-0040 — Cognitive Jurisprudence

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "not just policies: case law.
  Case #421 — Architecture A — succeeded — future similar cases inherit
  precedent. Governance evolves through evidence"
- **Related:** spec/CONSTITUTION.md + LAWS (statutory law), decision
  journal (src/cognitive-plane decisions), IDEA-0022 (architecture
  review board), trace ledger (outcome evidence), engineering
  intelligence findings, sleep-cycle distillations

## Motivation

Laws are immutable statutes; the decision journal records decisions;
but nothing accumulates *case law* — records of "we faced X, chose Y,
outcome was Z" that future similar decisions inherit. The claim:
governance becomes evidence-driven when decisions accrue precedents
that later cases cite, distinguish, or overrule.

## The corpus cannot cover it because

The constitution changes only through the community process; the review
board (IDEA-0022) aggregates lenses without an evidence trail of
outcomes; the decision journal has no citation or precedent semantics.

## Proposal sketch

- Case record: context, decision, expected outcome, observed outcome
  (from trace ledger), verdict (succeeded/failed), parties (which
  organs/agents).
- Precedent matching: similarity over decision features; citations with
  weight; overrule requires evidence (a failed replication).
- The architecture review board becomes the court; precedent is
  advisory unless ratified into policy by the community process.

## Risk assessment

- Legalism: without an overrule path and evidence requirements,
  precedent ossifies into bureaucracy.

## Where it lands

- Design doc `design/COGNITIVE-JURISPRUDENCE.md`; extends decision
  journal + IDEA-0022.

## Code impact

- None until the case schema is designed over the decision journal and
  outcome telemetry.

## Next stage

Design the case record schema; prototype outcome capture for
architectural decisions (ADR outcomes as first cases).
