# IDEA-0072 — Universal Lifecycle Engine

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Everything has a lifecycle. Not only organs: Idea → Research →
  Prototype → Experiment → Production → Legacy → Archive → Extinct."
- **Related:** design/DIRECTIONS.md SOP-08 (13-stage RFC lifecycle:
  Idea → Research → RFC → Prototype → Benchmark → Architecture Review →
  Security Review → Constitution Check → Acceptance → Specification →
  Reference Implementation → Certification → Stable), IDEA-0056
  (cognitive object model — observe → propose → verify → commit →
  evolve → archive for every object class), IDEA-0039 (embryology —
  nine developmental stages), src/kernel/organism/ (WS-C versioned
  store — legacy/archive semantics), IDEA-0067 (organ design system —
  canonical organ lifecycle), IDEA-0069 (deprecation engine — active →
  deprecated → sunset → removed), IDEA-0010 (signal fabric — priority/
  decay), rfc/ (the corpus's own living lifecycle example)

## Motivation

The corpus already runs several lifecycles — the RFC pipeline (SOP-08)
for ideas, the object lifecycle (IDEA-0056) for cognitive objects, the
organ lifecycle (IDEA-0067), organism versioning (WS-C) — but each is
its own state machine with its own vocabulary and none of them include
the terminal states the intake demands: Legacy (still trusted,
frozen), Archive (readable, replayable, not loadable), Extinct (gone
except for lineage records). A belief, a skill, a law amendment, a
signal class, a memory type, a driver — everything should traverse one
uniform lifecycle, with stage transitions journaled.

## The corpus cannot cover it because

The lifecycles are disjoint: SOP-08 governs documents, IDEA-0056
governs cognitive objects, WS-C governs organism versions, IDEA-0067
governs organs. There is no shared state machine, no uniform stage
vocabulary (compare SOP-08's 'Stable' with 0056's 'Archive' with
WS-C's 'legacy'), no Extinct terminal state, no lifecycle registry
that can answer "what is everything's current stage", and no
transition policy (who may advance what, with what evidence — the
SOP-08 gates apply to RFCs only).

## Proposal sketch

- One canonical lifecycle state machine: Idea → Research → Prototype →
  Experiment → Production → Legacy → Archive → Extinct, with SOP-08's
  13 stages recognized as the *document* refinement of the same ladder
  (Idea = Research = RFC, Experiment = Benchmark + Reviews +
  Acceptance, etc.).
- A lifecycle registry: every object class declares which stages it may
  inhabit; every instance's stage is journaled in the trace ledger with
  the transition evidence (the SOP-08 gate evidence becomes the
  general transition rule).
- Terminal-state semantics: Legacy (frozen, warn on use), Archive
  (read-only, replayable via ADR-002, evictable via IDEA-0060), Extinct
  (lineage record only — IDEA-0076 keeps the "where did I come from"
  answer even after the object is gone).

## Risk assessment

- Bureaucracy: a universal lifecycle that demands gates for trivial
  objects will be ignored. Stages must be default-progressive (auto-
  advance with evidence, block only on configured gates), and the
  lifecycle registry must itself be small (the constitution's YAGNI
  law applies).

## Where it lands

- `design/LIFECYCLE.md` as the canonical state machine; SOP-08 and
  IDEA-0056 become instances of it.

## Code impact

- None until the state machine and registry schema are specified;
  SOP-08 and the decision journal become the first instances.

## Next stage

- State machine drafted; SOP-08's 13 stages mapped onto the 8-stage
  ladder as validation.
