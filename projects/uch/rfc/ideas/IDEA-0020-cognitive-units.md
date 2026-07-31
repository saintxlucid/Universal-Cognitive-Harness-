# IDEA-0020 — Cognitive Units (COC)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "the biggest invention shouldn't be
  the brain, it should be a programming paradigm: Cognitive-Oriented
  Computing — the primitive is the Cognitive Unit"
- **Related:** IDEA-0006 (fields), IDEA-0007 (cells), design/ECS-SPIKE.md,
  spec/COGNITIVE_ONTOLOGY.md, MANIFESTO

## Motivation

OOP gave us objects, FP gave us functions, ECS gave us entities — a
cognitive substrate should give us its own primitive: the **Cognitive Unit**,
carrying identity, state, energy, knowledge, confidence, history, intent,
capabilities, lifecycle, and evolution. Everything in the runtime — organs,
cells, processes, agents — is a unit; the C-ISA operates on units; CIR
compiles to unit graphs. COC is the programming-model claim behind the
whole platform.

## The corpus cannot cover it because

The corpus has organs (MANIFESTO §6) and cells (IDEA-0007) as concepts, but
no primitive that unifies them with all ten intrinsic properties, and no
programming-model claim. ECS was explicitly not adopted wholesale
(ECS-SPIKE).

## Proposal sketch

- Define the Cognitive Unit: ten intrinsic properties, typed and measured.
- Show that existing constructs (process, organ, cell, agent, attach) are
  specializations of the unit — the paradigm earns itself by absorption.
- C-ISA instructions (spec/CP.md) gain unit operands; CIR graphs become unit
  graphs.

## Risk assessment

- The paradigm claim must be earned: a unit-based rewrite of one subsystem
  must demonstrably simplify it before the name "COC" is used publicly.
- Overlaps IDEA-0006/0007 — the unit is the *particle*, fields are the
  *medium*; the boundary must be explicit.

## Where it lands

- Design doc `design/COC.md`; possible C-ISA extension after the absorption
  test.

## Code impact

- None until the absorption study: map every organ/process onto the unit
  model and count what simplifies.

## Next stage

Absorption study over the existing corpus; if the unit model simplifies one
subsystem, prototype it; otherwise the primitive stays a naming proposal.
