# IDEA-0007 — Cognitive Cells and Ecology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "organs are made of cells; organs compete"
- **Related:** MANIFESTO §6 (organ contracts), spec/FORMAL_FOUNDATIONS.md §3.4, design/ECS-SPIKE.md

## Motivation

Organs are monolithic classes with organ contracts. The vision's claim: every
organ should be composed of **reusable cognitive cells** — each knowing only
five operations (Receive, Think, Store, Signal, Sleep) — with cells clustering
into tissues and organs. Behavior emerges from composition, not from
hand-written organ logic. Ecology: organs compete for energy (partially
exists — FORMAL_FOUNDATIONS §3.4 has economic agents and a metabolism market).

## The corpus cannot cover it because

No composition hierarchy exists below the organ; there is no cell contract,
no tissue abstraction, and no benchmark for "does composition beat
monoliths". The metabolism market (§3.4) already implements competition for
budget, so the ecology half is mostly settled — the cell half is not.

## Proposal sketch

- Cell contract: `Receive → Think → Store → Signal → Sleep` (deterministic,
  energy-metered, law-governed).
- Organ = tissue of cells; organs keep their MANIFESTO contracts.
- Benchmark: a cell-composed memory organ vs the current one, on the same
  suite (recall, latency, energy).

## Where it lands

- MANIFESTO §6 amendment (organ anatomy section).
- `src/kernel/` — cells only after a prototype + benchmark pass.

## Code impact

- High if adopted wholesale — requires refactor of organ internals; gated by
  benchmark evidence, per ECS-SPIKE discipline.

## Next stage

Research + prototype benchmark (cell-composed tissue for one organ), then RFC.
