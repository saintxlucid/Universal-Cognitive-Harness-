# IDEA-0005 — Cognitive Calculus: closed-form functions

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "functions, not heuristics"
- **Related:** Law 5 (Universal Decay), spec/FORMAL_FOUNDATIONS.md §2.5, design/RETRIEVAL-SCALING.md

## Motivation

Decay, confidence, trust, and learning are currently parameterized
half-lives and hand-tuned thresholds. The vision's claim: how confidence
changes, how trust decays, and how learning converges should be **functions
with defined semantics** — testable, benchmarkable, and law-grounded.

## The corpus cannot cover it because

Law 5 states that everything decays with a half-life; §2.5 defines a
forgetting score. There is no closed form for:

- Confidence update on new evidence (Bayesian-style posterior).
- Trust decay over interaction distance or time.
- Learning convergence (prediction-error decay per episode).
- Memory strengthening under repetition.

## Proposal sketch

Candidate closed forms to be researched and benchmarked:

| Quantity | Candidate form |
| --- | --- |
| Confidence update | `p' = p + α · (evidenceMass − p)` per verification |
| Trust decay | `t(τ) = t₀ · 2^(−τ/half_life)` (Law 5) |
| Learning convergence | `PE(n) = PE₀ · n^(−β)` |
| Memory strength | Ebbinghaus-style spacing function |

Every form must be deterministic, monotonic where law-required, and
benchmarkable against the EI benchmark corpus.

## Where it lands

- `spec/FORMAL_FOUNDATIONS.md` — normative calculus section (drafted in
  Part VIII §8.5 as candidates).
- `src/kernel/` — implementations only after acceptance.

## Code impact

- Trust/confidence computations in cognitive-core become closed-form.
- Decay parameters in `vmem` paging derive from the same functions.

## Next stage

Research (literature: Bayesian belief revision, Ebbinghaus forgetting,
spaced repetition), then RFC-0005 companion or amendment.
