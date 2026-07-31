# IDEA-0023 — Elemental Cognitive Primitives

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "the real architecture is no longer a
  tree, it's a periodic table; define elemental cognitive primitives — when
  someone invents a capability five years from now they ask 'which cognitive
  elements does this compose?'"
- **Related:** spec/COGNITIVE_ONTOLOGY.md, IDEA-0002 (molecules, reactions),
  MANIFESTO, design/CONNECTOME.md

## Motivation

Modules accumulate; elements compose. If the substrate defines a small set
of elemental cognitive primitives — Information (signal, memory, evidence,
belief), Control (goal, policy, constraint), Dynamics (attention, energy,
time), Identity (genome, personality, capability), Learning (experience,
pattern, skill), Governance (authority, constitution, trust), Interaction
(tool, agent, workspace) — then every new capability is a compound over the
table, and "where do I put this?" becomes "which elements compose?".

## The corpus cannot cover it because

The ontology (COGNITIVE_ONTOLOGY.md) enumerates types; chemistry
(IDEA-0002) proposes reactions. Nothing classifies primitives into
elements vs. compounds, and no composition rule says a capability must
declare its elements.

## Proposal sketch

- Normative table: 7 classes × ~4 elements, each mapped onto existing
  corpus types.
- Compounds = reaction products (IDEA-0002): a capability is valid only if
  it declares its element composition.
- New capabilities must pass through the table; a capability that needs a
  new element goes through RFC governance, not a type addition.

## Risk assessment

- Taxonomy drift: descriptive taxonomies rot; the table must be normative
  and small — if an element can't be mapped to a corpus type, it's cut.

## Where it lands

- Extension of spec/COGNITIVE_ONTOLOGY.md or new spec/COGNITIVE-ELEMENTS.md;
  RFC proposal after the table is validated against the corpus.

## Code impact

- None until the table passes the validation: every organ and type in the
  corpus decomposes into the table without residue.

## Next stage

Draft the 28-element table; validate that every existing corpus type
decomposes cleanly; then promote via RFC.
