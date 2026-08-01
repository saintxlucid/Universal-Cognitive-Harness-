# IDEA-0067 — Cognitive Organ Design System

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "Every
  software platform has a UI design system. UCH needs a cognitive
  design system: how organs behave, how signals behave, naming,
  patterns, interactions, life cycles, interfaces, behavior."
- **Related:** MANIFESTO §6 (organ contracts), spec/COGNITIVE_ONTOLOGY.md
  (shared vocabulary — "deviations cause semantic drift"),
  spec/CONSTITUTION.md (clean-code covenant laws: SOC/DRY/KISS/DYC/
  YAGNI), DIRECTIONS.md (SOP-03 TDD waves, SOP-07 docs), IDEA-0019
  (cognitive operating contracts), IDEA-0053 (constitution engine),
  IDEA-0028 (motherboard — composition rules)

## Motivation

Every durable platform standardized how its components *look and
behave* (POSIX for programs, PCIe for devices, Material for UI). UCH's
organs are contractually defined in MANIFESTO §6 and share a
vocabulary (COGNITIVE_ONTOLOGY) — but there is no *design system*:
no canonical organ lifecycle (the intake's observe → propose → verify →
commit → evolve → archive), no signal naming/typing conventions beyond
the ontology, no interaction patterns (which organs may touch which
stores, how organs publish vs subscribe), no behavioral invariants for
third-party organs. Every new organ re-invents its shape; the review
board (IDEA-0022) re-litigates the same questions.

## The corpus cannot cover it because

The ontology defines *terms*; MANIFESTO §6 defines *contracts*; neither
defines *patterns*: lifecycle state machines, signal design rules
(naming, payload shape, priority, decay), interaction archetypes
(pub/sub vs request vs observe), store access patterns, error and
degradation behavior, and the acceptance criteria a new organ must
meet. IDEA-0019 certifies contracts but assumes the design is already
sound; the constitution's covenant laws are principles, not a pattern
library.

## Proposal sketch

- One canonical organ lifecycle (observe → propose → verify → commit →
  evolve → archive) mirroring IDEA-0056's object lifecycle — organs are
  objects too.
- Pattern library: signal archetypes (event/command/query/notification
  with naming + payload + priority + decay rules), store access
  patterns (read-mostly / append-only / transactional), degradation
  patterns (fail-closed vs fail-open by signal class, per 0062),
  state machines per organ family.
- Design tokens: naming conventions, log/ledger conventions, error
  taxonomy, test-convention mapping (each pattern prescribes its test
  template — closes the "26 organs without tests" gap structurally).
- Governance: a new organ is *designed* against the system before it is
  coded; the review board (0022) checks conformance; violations are
  advisory (design debt) until 0053 makes them enforceable.

## Risk assessment

- A design system that ossifies kills experimentation — patterns must
  be graded (recommended / permitted-with-review / legacy), and the
  constitution's YAGNI law applies to the pattern library itself.

## Where it lands

- `design/ORGAN-DESIGN-SYSTEM.md` as the canonical reference; skeleton
  appended to MANIFESTO §6; test-template patterns into DIRECTIONS.

## Code impact

- None directly; new organs (0060, 0062, 0063, 0066) become the first
  pattern-conformant citizens.

## Next stage

- Lifecycle + signal archetypes drafted; audit of 3 existing organs
  against them as validation.
