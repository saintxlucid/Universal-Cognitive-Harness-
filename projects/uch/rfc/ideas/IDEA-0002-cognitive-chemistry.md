# IDEA-0002 — Cognitive Chemistry: reaction rules

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "brains are built from interactions"
- **Related:** spec/FORMAL_FOUNDATIONS.md §2.4, spec/COGNITIVE_BIOLOGY.md, design/ENGINEERING-INTELLIGENCE.md

## Motivation

The corpus models cognition as **storage** (memory stores entities) and
**pipelines** (Knowledge Compiler: events → facts → knowledge → wisdom). It
does not model cognition as **reactions between entities**. The vision's
examples:

```text
Knowledge + Evidence   → Knowledge (strengthened)
Belief   + Contradiction → Revision (belief revision, trust update, rewrite)
Experience + Reflection → Wisdom
Idea      + Simulation  → Hypothesis
```

Belief revision is currently a named process with no deterministic rule set.
Reaction semantics would make revision table-driven and law-governed.

## The corpus cannot cover it because

No document defines reactants, products, conditions, or energy balance for
cognitive transformations. §2.4's compression table is lossy storage, not
reaction chemistry.

## Proposal sketch

A reaction table: `(reactants, catalyst, conditions, products, energy_delta)`
with deterministic rewrite semantics. Rules:

- Every reaction records the source signals (Law 3 causality).
- A reaction may only reduce contradiction (Law 4 directionality).
- No reaction destroys evidence; it transforms it (see IDEA-0003).

## Where it lands

- `spec/COGNITIVE_BIOLOGY.md` — reaction table as normative section.
- `src/cognitive-plane/` — belief-revision and memory-rewrite become
  table-driven if a prototype justifies it.

## Code impact

- Belief revision in cognitive-core becomes deterministic and auditable.
- Organic-score "evidence-backed" checks map to reaction preconditions.
- No code before Research + RFC.

## Next stage

Research (evidence for reaction-style models in belief-revision theory and
connectionist accounts), then RFC.
