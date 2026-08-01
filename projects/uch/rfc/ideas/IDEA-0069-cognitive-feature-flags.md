# IDEA-0069 — Cognitive Feature Flags, Versioned Cognition & Deprecation

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "feature.memory.semantic=true, feature.dreaming.experimental=false,
  feature.verification.strict=true" — every organ, neuron, skill, and
  accelerator individually enabled, with progressive rollout; "Every
  skill, every genome, every law, every belief, every reasoning
  strategy must have semantic versioning. Not just code. Cognition.";
  "Brains evolve. Old reasoning must retire gracefully."
- **Related:** spec/VERSION.md (spec semantic versioning + gate),
  src/kernel/organism/ (WS-C VersionedStore — genome/organs versioned,
  validator-gated restore), spec/GENOME.md, IDEA-0008 (genome
  evolution), spec/LAWS_OF_COGNITIVE_PHYSICS.md (law number =
  identity, never renumbered), src/cognitive-plane/protocol/
  capability-protocol.ts ('deprecated' lifecycle state),
  src/workspace-brain/genome.ts (deprecation_warnings),
  src/control-plane/budgets + policy engine (runtime knobs today),
  IDEA-0068 (capability negotiation)

## Motivation

Enterprise platforms ship feature flags, semantic versioning, and
deprecation policies because capabilities evolve and must be rolled
out, rolled back, and retired *without retraining the whole system*.
Cognition is the same problem at a higher altitude: a new genome
version, a stricter verification strategy, an experimental dreaming
stage, or a retired reasoning family should be individually
enabled/disabled, versioned, and retired with grace. Today the
organism's runtime knobs are budgets and policy checks — but there is
no flag namespace, no progressive-rollout mechanism, and no deprecation
schedule for cognitive capabilities.

## The corpus cannot cover it because

Grep confirms zero feature-flag semantics in src/. Versioning exists
for specs (VERSION.md), genomes (WS-C VersionedStore), and laws
(numbers immutable) but not for skills, beliefs, reasoning strategies,
or memory schemas; capability-protocol.ts has a 'deprecated' *state*
and genome.ts counts deprecation *warnings*, but nothing executes a
deprecation policy (announce → warn → migrate → remove) or keeps a
retired capability replayable.

## Proposal sketch

- A unified feature-flag registry: `feature.<organ>.<capability> =
  <on|off|percent>` with per-agent evaluation (grants intersect flags),
  inherited defaults, and an audit trail in the trace ledger.
- Semantic versioning law extended to cognition: every genome, skill,
  belief, memory schema, and reasoning strategy carries a version; a
  belief's version is part of its lineage (IDEA-0076).
- A deprecation engine: capabilities declare a lifecycle (active →
  deprecated → sunset → removed) with warning windows, migration
  guidance, and automatic fallback to the previous version (ties into
  IDEA-0068 dialect fallback).

## Risk assessment

- Flag sprawl and version fatigue: flags must be discoverable,
  default-on for stable capabilities, and the registry itself must be
  versioned; a deprecation that forces migrations too fast will be
  ignored — windows must be evidence-driven (usage telemetry).

## Where it lands

- `design/FEATURE-FLAGS.md` + `design/DEPRECATION.md`; the flag
  registry lives beside the capability registry (IDEA-0068).

## Code impact

- None until the registry schema and lifecycle state machine are
  specified.

## Next stage

- Flag schema + versioning rule drafted against genome versioning
  (WS-C) as the first citizen.
