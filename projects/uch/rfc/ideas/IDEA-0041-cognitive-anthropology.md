# IDEA-0041 — Cognitive Anthropology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "UCH should study its own
  users — not personal data, but behavior: patterns, engineering
  culture, decision styles, communication styles — developing a model
  of how teams work, respecting privacy and explicit governance"
- **Related:** IDEA-0027 (cognitive sociology — inter-organism
  trust/reputation), session sensor, context gatherer, CIC episodes,
  ProjectionEngine (per-agent state), VISION.md §3 (marketplace/users)

## Motivation

Sociology (IDEA-0027) covers organisms among organisms; nothing covers
the humans the organism serves. The claim: an observational model of
team behavior — decision cadence, context needs, feedback patterns,
communication style — tunes collaboration strategy (how much
verification to run, how much context to deliver, when to summarize)
while remaining provably de-identified and governance-visible.

## The corpus cannot cover it because

Sensors capture workspace events, not user-facing behavioral models;
no collaboration-tuning layer exists, and no explicit privacy boundary
documented for behavioral observation.

## Proposal sketch

- Observation schema over de-identified interaction patterns
  (no personal data, no message content retention beyond episodes).
- Behavioral model: cadence, context appetite, verification tolerance,
  feedback loops → collaboration strategy adjustments.
- Privacy governance: opt-in, user-visible model, right to reset —
  mirroring constitution cognitive rights (erasure).

## Risk assessment

- Surveillance optics: the model must be demonstrably aggregate and
  de-identified; a visible privacy contract is a precondition.

## Where it lands

- Design doc `design/COGNITIVE-ANTHROPOLOGY.md`; extends IDEA-0027.

## Code impact

- None until the observation schema and privacy constraints are
  specified.

## Next stage

Define the observation schema with the privacy boundary; prototype
decision-cadence tuning (summary frequency vs session length).
