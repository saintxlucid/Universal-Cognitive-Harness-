# IDEA-0140 — Executable Requirements Engineering

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-22 intake, Volume II — "Requirements
  Engineering. Not user stories. Requirements become executable.":
  DO-178C / ISO 26262 / IEC 61508 rigor adapted to cognitive software.
- **Related:** SOP-08 (RFC lifecycle), conformance corpus (WS-3),
  IDEA-0073 (contracts registry), IDEA-0048 (consolidated spec),
  IDEA-0127 (five-spec canon), engineering-constitution, organic-score
  gates, IDEA-0081 (deterministic engineering chain).

## Motivation

Every requirement becomes a first-class artifact carrying owner,
rationale, assumptions, risks, acceptance criteria, formal invariant,
verification strategy, and traceability, chained as Constitution to
Requirement to Constraint to Verification Rule to Implementation to
Evidence to Validation. The chain is executable: requirements compile
to verification rules that the conformance gates actually run.

## The corpus cannot cover it because

SOP-08 governs proposals (RFCs) and the constitution governs laws; the
conformance corpus maps spec sections to test suites (WS-3, coverage
0.6); but no artifact class is a _requirement_ — with acceptance
criteria, formal invariant, and verification strategy as fields — and no
bidirectional traceability links requirement to implementation to
evidence. RFCs carry prose statuses, not executable chains; user
stories are explicitly rejected by the intake.

## Proposal sketch

- Requirement artifact schema: the nine fields above; the formal
  invariant uses the FORMAL_FOUNDATIONS / IDEA-0026 notation where
  expressible.
- Compilation: requirement + constraint to verification rule(s) to
  conformance-suite entry; the conformance corpus becomes the
  requirement's executable tail.
- Traceability: bidirectional (requirement to implementation to
  evidence), machine-checked; a requirement without evidence is a gap,
  not a TODO.
- Pilot: one spec section (CP v1 ops) with a full chain.

## Risk assessment

- Bureaucracy: requirements must compile to gates, not prose; bound the
  count by what conformance enforces.
- Over-engineering: DO-178C-class formality only where the formal
  invariant is expressible; rationale stays prose.

## Where it lands

Corpus governance plus the conformance corpus (WS-3); the schema
mirrors IDEA-0073 contracts.

## Code impact

None until the schema and pilot (SOP-08 stage 1).

## Next stage

Requirement artifact schema; pilot the chain on one spec section.
