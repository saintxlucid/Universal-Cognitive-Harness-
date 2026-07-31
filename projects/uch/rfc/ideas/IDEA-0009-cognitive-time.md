# IDEA-0009 — Cognitive Time: the second clock

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "brains measure experience, not
  milliseconds"
- **Related:** spec/FORMAL_FOUNDATIONS.md §1.4,
  src/protocol/catalog.ts (cognitive clock), design/COGNITIVE-TRACE.md,
  design/ADR-006 (Cognitive Clock: partial)

## Motivation

FORMAL_FOUNDATIONS §1.4 models physical time τ and logical clocks λ, and the
catalog provides a monotonic cognitive tick. What is missing: **cognitive
time as a first-class second clock on every entity** — episode count, learning
cycle, reflection pass, architecture epoch. The vision's claim: "what did I
believe before the compiler rewrite?" should be answerable in cognitive
coordinates, not just dates.

## The corpus cannot cover it because

Entities carry `birth_τ`, `birth_λ`, `half_life`, `valid_window` — physical
and logical — but no episodic/cognitive coordinate. The Time Machine answers
in physical time; it cannot yet answer "beliefs at episode 28471".

## Proposal sketch

- A cognitive clock composed of monotonic counters: episode, learning cycle,
  reflection pass, epoch (incremented by explicit events, never wall-clock).
- Every entity gains `birth_κ` (cognitive birth) alongside `birth_τ`.
- Time Machine gains a `beliefsAtEpoch(n)` query via ledger reconstruction.

## Where it lands

- `spec/FORMAL_FOUNDATIONS.md` §1.4 extension (after RFC).
- `src/cognitive-plane/replay/` — cognitive-coordinate queries.

## Code impact

- Small, additive: counters exist in the ledger already (trace ordering);
  this adds the coordinate semantics and query surface.

## Next stage

RFC (small scope; candidate for fast-track under SOP-08 rules).
