# IDEA-0044 — Cognitive Physics 2.0: Candidate Law Expansion

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "the laws shouldn't stop at ten;
  aim for 50–100 immutable laws" — named candidates: Conservation of
  Context, Minimum Cognitive Energy, Bounded Attention, Provenance
  Invariance, Temporal Causality, Identity Continuity, Knowledge
  Supersession, Semantic Locality, Reflection Completeness, Reversible
  Reasoning, Architectural Least Action, Evidence Dominance, Uncertainty
  Propagation, Entropy Minimization, Memory Locality
- **Related:** spec/LAWS_OF_COGNITIVE_PHYSICS.md (32 laws, five
  families), RFC-0000 (governance), Constitution Article XI (kernel ABI
  immutability: 32 laws listed), FORMAL_FOUNDATIONS, VISION.md §7

## Motivation

The Laws are the physics of the runtime; law numbers are permanent and
expansion is governed by the community process, not by fiat. The claim:
a candidate-law register — each proposed law stated as an impossibility
statement, mapped to its family, with overlap analysis against the
existing 32 (Evidence Dominance ≈ Law 14/19; Reversible Reasoning ≈ Law
12; Provenance Invariance ≈ Law 9; Bounded Attention ≈ Law 5; Memory
Locality ≈ Law 11/16) — as the *input* to the RFC-0000 process.

## The corpus cannot cover it because

No register exists for proposed laws; the 32-law corpus has no
candidate pipeline between idea note and community ratification.

## Proposal sketch

- Register schema: candidate name, family, impossibility statement,
  motivation, overlap analysis vs existing laws, acceptance path
  (RFC-0000).
- The register is explicitly NOT an enactment: the Constitution's
  immutability list changes only through the community process.

## Risk assessment

- Law inflation: each law must forbid something (an impossibility
  statement), or it is a policy renamed a law; the overlap analysis is
  the anti-inflation gate.

## Where it lands

- Design doc `design/CANDIDATE-LAWS.md`; input to RFC-0000 governance.

## Code impact

- None; governance artifact only.

## Next stage

Draft the register with the 15 candidates, each mapped to family +
overlap analysis; publish for community review.
