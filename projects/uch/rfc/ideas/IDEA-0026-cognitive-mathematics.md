# IDEA-0026 — Cognitive Mathematics

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "formalize an entire hierarchy:
  Cognitive Mathematics — formal definitions, functions, operators, proofs —
  above Physics; every higher discipline derives from it"
- **Related:** spec/FORMAL_FOUNDATIONS.md Part I (mathematical substrate),
  RFC-0005 (physics), rfc/ideas/IDEA-0001/0005 (equations, calculus)

## Motivation

Physics needs mathematics beneath it. The claim: before equations there must
be formal definitions, operators, and proofs — a Cognitive Mathematics layer
that the rest of the hierarchy (physics, chemistry, biology, ecology,
economics, sociology, civilization) compiles against. Proofs, not prose:
properties of memory, signals, and governance become theorems over defined
primitives.

## The corpus cannot cover it because

FORMAL_FOUNDATIONS Part I provides the mathematical substrate (set theory,
functions, graphs, temporal logic) and Part VIII drafts physics. What does
not exist: the *claim* that mathematics is a first-class discipline of the
stack, a defined operator algebra over cognitive objects, or any theorem/
proof discipline (properties stated as theorems to be proved).

## Proposal sketch

- Define cognitive operators (merge, decay, bind, revise, project) with
  formal signatures over the ontology.
- Statement discipline: invariants of the kernel (e.g., transactional
  all-or-nothing, projection containment) written as theorems with proofs
  or proof sketches.
- Theorems become the certification surface: a conformance test proves a
  theorem instance.

## Risk assessment

- Proof theater: a theorem that gates nothing is decoration; each theorem
  must bind to a conformance test or a design decision.

## Where it lands

- Extension of spec/FORMAL_FOUNDATIONS.md (new Part) or new
  spec/COGNITIVE-MATHEMATICS.md.

## Code impact

- None initially; a first theorem (e.g., cognitive-merge disjoint union
  soundness) formalizing an existing property.

## Next stage

Pick three existing kernel properties, state them as theorems with proofs,
and tie each to a conformance test — prove the discipline earns its keep.
