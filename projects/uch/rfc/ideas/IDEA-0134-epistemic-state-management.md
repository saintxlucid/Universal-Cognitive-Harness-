# IDEA-0134 — Epistemic State Management

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-21 intake — the user's stated missing
  capability: "every conclusion should have a state — Observed →
  Hypothesized → Supported → Strongly Supported → Validated → Accepted
  → Deprecated → Refuted. Instead of storing facts, UCH stores beliefs
  with evidence, confidence, provenance, and revision history." The
  round's headline.
- **Related:** IDEA-0072 (universal lifecycle engine — the artifact-side
  twin; this is the belief side), IDEA-0034 (decision law — confidence),
  RFC-0005 (evidence mass — the support quantity), scientific-memory
  ('contradicted' state), IDEA-0079 (memory hygiene), cognitive time
  machine (beliefsAt / diffBeliefs), IDEA-0086 (belief propagation),
  structuredFacts, mnemosyne (parahippocampal gate)

## Motivation

Artifacts have a lifecycle (IDEA-0072); beliefs do not. Confidence
numbers exist — decision-law confidence, RFC-0005 evidence mass,
structuredFacts confidence — but no state machine governs what happens
to a belief as evidence accumulates, contradicts, or decays: no
transition rule says when Hypothesized → Supported → Validated, or when
Supported → Deprecated. Stale or weak conclusions get treated as
permanent truth because nothing demotes them.

## The corpus cannot cover it because

IDEA-0072's ladder (Idea → Research → … → Extinct) governs artifacts;
scientific-memory has a 'contradicted' flag but no ladder; RFC-0005's
instability is a number, not a state; the time machine reads belief
values at t but nothing enforces a belief-state sequence; memory hygiene
deletes and compresses but does not re-state beliefs.

## Proposal sketch

- Normative belief-state ladder: Observed → Hypothesized → Supported →
  Strongly Supported → Validated → Accepted → Deprecated → Refuted,
  each with transition gates on evidence (SOP-08-style evidence
  requirements per transition).
- Beliefs as first-class records: {statement, state, confidence,
  evidence[], contradictions[], provenance, revisionHistory[]} — never
  stored as bare facts.
- Semantics: Deprecated ≠ Refuted — Deprecated = weakened or
  unmaintained (not refuted, no longer evidence-backed), Refuted =
  confirmed contradiction (Law-5 trust decay + RFC-0005 evidence mass
  inversion). Transitions are event-driven (evidence added,
  contradiction found, decay tick) and journaled in the trace ledger
  (ADR-002) — revision history is replayable and feeds the time machine
  and the truth engine.

## Risk assessment

- Bureaucracy: beliefs stuck in Held/Uncertain limbo. Anchor:
  transitions are event-driven, never review-gated except Validated /
  Accepted (which follow the SOP-08 gate pattern).
- Conflation with IDEA-0072: artifact lifecycle vs belief lifecycle must
  stay separate vocabularies — one governs things, the other governs
  claims about things.

## Where it lands

New `src/cognitive-plane/epistemic/` (or extension of memory +
scientific-memory); ledger-backed; memory hygiene (IDEA-0079) and
belief propagation (IDEA-0086) are the natural integrators.

## Code impact

None until a prototype over the knowledge-base + scientific memory;
decay → state demotion is the first wiring (Law 5).

## Next stage

Prototype the ladder over the existing knowledge-base; wire RFC-0005
instability to state transitions; feed the time machine's beliefsAt.
