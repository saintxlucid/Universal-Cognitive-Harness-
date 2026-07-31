# IDEA-0001 — Cognitive Physics: measured quantities and equations

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "Cognitive Physics Engine" framing
- **Related:** spec/FORMAL_FOUNDATIONS.md, spec/LAWS_OF_COGNITIVE_PHYSICS.md, design/CIR.md, RFC-0005

## Motivation

The Laws state what is impossible, and FORMAL_FOUNDATIONS defines entropy,
information gain, novelty, and knowledge density — but the runtime still
hand-tunes derived quantities (organic-score thresholds, decay parameters,
signal priorities). The vision's claim: cognition should have **measurable
quantities with units**, so organs compute rather than guess.

## The corpus cannot cover it because

FORMAL_FOUNDATIONS §2 defines information metrics but no unit system and no
derived quantities. There is no definition of "signal momentum", "knowledge
velocity", "trust gradient", "attention density", "learning rate", or
"cognitive pressure" anywhere in the corpus.

## Proposal sketch

A unit system over the existing primitives, e.g.:

| Quantity | Definition | Unit basis |
| --- | --- | --- |
| Signal momentum | `IG(s) × salience(s)` | entropy × priority |
| Knowledge velocity | belief-revision rate per episode | Δconfidence / episode |
| Memory half-life | decay parameter (exists as Law 5 param) | time |
| Trust gradient | Δtrust over interaction distance | trust / hop |
| Attention density | signals reaching cortex per tick | signal / tick |
| Learning rate | convergence speed of prediction error | ΔPE / episode |
| Evidence mass | verified evidence weight of a belief | evidence × verification |
| Cognitive pressure | demand / available energy | energy-demand / energy-budget |
| Uncertainty field | confidence dispersion over a region | std(confidence) |

## Where it lands

- `spec/FORMAL_FOUNDATIONS.md` — new normative Part (units + equations).
- `src/protocol/catalog.ts` + branded types (FORMAL_FOUNDATIONS §6.2 already
  brands `EnergyUnit`/`Entropy` — extend the pattern).

## Code impact

- Organic-score and veto gates become derived from law-defined quantities
  instead of hand-picked thresholds.
- Observatory metrics become unit-typed.
- No behavioral change until RFC acceptance.

## Next stage

RFC-0005 (Cognitive Physics) — already proposed; this idea is its Part 1.
