# IDEA-0004 — Failure Physics: failure as observable phenomena

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "hallucination is a measurable instability"
- **Related:** design/ENGINEERING-INTELLIGENCE.md, src/kernel/constitution/organic-score.ts, design/FAILURE-RETRY.md

## Motivation

The corpus treats failure as **errors to handle** (FAILURE-RETRY) or
**patterns to detect** (Engineering Intelligence, organic-score vetoes). The
vision's claim: failure should be treated as **physics** — measurable
instabilities with energy terms, so prevention becomes computation, not
heuristics.

| Failure | Physical framing |
| --- | --- |
| Hallucination | Instability: claim whose confidence exceeds its evidence mass |
| Knowledge drift | Entropy: beliefs drifting from evidence without a recorded cause |
| Contradiction | Potential energy: stored tension between beliefs |
| Dead memory | Mass: storage with zero access and zero predictive value |
| Verification | Stabilization: energy invested to reduce instability |

## The corpus cannot cover it because

Engineering Intelligence detects empirically (tiers, gates, vetoes) and
organic-score vetoes reject statically. Neither defines instability as a
quantity, so there is no predictive equation — e.g. no "when does a belief
become hallucination-prone" function.

## Proposal sketch

- Define instability `I(b) = confidence(b) − evidenceMass(b)` per belief.
- Veto gates become stability conditions (`I(b) ≤ θ`).
- Contradiction potential energy enters budget/trust computations.

## Where it lands

- `spec/FORMAL_FOUNDATIONS.md` — failure-physics section (drafted in Part VIII).
- `src/engineering-intelligence/` — instability terms feed evaluator.

## Code impact

- Organic-score vetoes acquire a physical justification (derived, not tuned).
- Observatory gains an instability metric.
- No code before RFC acceptance.

## Next stage

Research (formal argument from belief-revision theory), then RFC (candidate
RFC-0005 Part 3).
