# IDEA-0031 — Reality Compiler

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "compilers compile code; UCH should
  compile reality: inputs — git, filesystem, IDE, database, APIs, humans,
  issues, PRs, Slack, docs — produce a World Model; everything the organism
  believes comes from Reality Compilation"
- **Related:** src/context/gatherer.ts, src/drivers/sensors (change-only
  emission), src/workspace-graphs, IDEA-0017 (reality synchronization),
  docs/GENESIS.md (Reality engine)

## Motivation

Beliefs should be compiled, not collected. The claim: a single pipeline —
the Reality Compiler — ingests every observable (git, filesystem, IDE,
databases, APIs, humans, issues, PRs, Slack, docs) and emits the World
Model: the compiled, versioned picture of reality the organism believes.
This is distinct from synchronization: sync reconciles the model with
reality; the compiler *builds* the model from reality.

## The corpus cannot cover it because

The context gatherer samples workspace context; sensors emit change events;
workspace graphs record artifacts and decisions. Nothing is a compilation
pipeline with staged transforms (raw reality → normalized observations →
facts → model) producing a versioned World Model as its artifact.

## Proposal sketch

- Compilation stages: ingest (sensors) → normalize (schemas) → extract
  (facts with provenance) → integrate (graphs) → emit (World Model version).
- Recompilation is incremental (change-only, per sensor design) and
  versioned; a World Model commit is a belief-commit (rollbackable).
- The twin (IDEA-0012) and prediction units (IDEA-0030) consume the model;
  sync (IDEA-0017) guards it against drift.

## Risk assessment

- Garbage-in: every fact must carry provenance and confidence or the model
  compounds noise; the compiler must be able to say "unknown" loudly.

## Where it lands

- Design doc `design/REALITY-COMPILER.md`; extends gatherer + sensors +
  workspace graphs.

## Code impact

- None until the stage pipeline is defined over existing sensors; first
  prototype compiles git + filesystem observations into a versioned model.

## Next stage

Prototype a minimal Reality Compiler over GitSensor + SessionSensor data;
verify the emitted World Model reproduces known workspace facts with
provenance.
