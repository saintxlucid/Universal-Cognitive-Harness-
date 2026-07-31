# IDEA-0039 — Cognitive Embryology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "nothing starts complete: every
  workspace begins as an embryo. Developmental stages: Conception →
  Embryo → Neural Formation → Early Learning → Juvenile → Adult →
  Expert → Institution → Civilization; the runtime behaves differently
  at each stage"
- **Related:** IDEA-0032 (consciousness levels — the state ladder),
  src/workspace-graphs (WorkspaceEvolutionHistory cycle counters),
  ProjectionEngine (per-workspace state), project scaffolding
  (templates/project-starter), IDEA-0008 (genome inheritance)

## Motivation

Consciousness levels (IDEA-0032) describe the organism's *current state*
ladder; embryology describes a workspace's *developmental scale* over
time. The claim: nine stages from conception to civilization, where the
runtime activates different firmware at each stage — an embryo gathers
and learns (reality sync + context builder), an adult runs full
verification and economics, a civilization federates with other
organisms. The stage is derivable from maturity signals, not from a
calendar.

## The corpus cannot cover it because

Workspace evolution history tracks cycle counts; no developmental model
maps maturity signals to stage, and no stage-dependent activation policy
exists.

## Proposal sketch

- Define the nine stages with entry criteria (artifact counts, memory
  volume, decision counts, review history).
- Stage-dependent activation: firmware/organs enabled per stage;
  transitions governed by evidence (a workspace cannot reach Expert
  without a verification history).
- Institutions → Civilization is the federation boundary (CIC, merge,
  IDEA-0007 ecology).

## Risk assessment

- Developmental determinism: stages must be descriptive maturity bands,
  never prescriptive deadlines or shaming labels.

## Where it lands

- Design doc `design/COGNITIVE-EMBRYOLOGY.md`; extends workspace
  evolution history + complements IDEA-0032.

## Code impact

- None until stage detection is specified over existing signals.

## Next stage

Map existing workspace signals (graph node counts, memory size,
decision journal size) to the nine stages; prototype stage detection.
