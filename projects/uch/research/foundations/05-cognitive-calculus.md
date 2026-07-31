---
track: cross-cutting
status: research-draft
version: 0.1.0
sources:
  - https://www.sciencedirect.com/science/article/abs/pii/S0364021305000752 (AGM belief revision, Gardenfors & Rott)
  - https://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2012/12/345nat_1999_b.pdf (ACT-R rational analysis of memory)
  - https://psycnet.apa.org/record/1981-22546-001 (Newell & Rosenbloom, power law of practice)
  - https://www.jonker.org/TRUST/ (Jonker & Treur, trust dynamics)
  - https://super-memory.com/english/ol/sm2.htm (SM-2 spaced repetition algorithm)
---

# Cognitive Calculus — G1 evidence register (RFC-0005 Part 4)

Evidence register for the closed forms proposed in RFC-0005 and
`spec/FORMAL_FOUNDATIONS.md` Part VIII §8.4. Companion to
`research/foundations/03-cognitive-physics.md` (activation, confidence,
value-of-cognition hypotheses) — this note covers the four candidate
closed forms plus the G1 arguments for conservation and failure physics.

## 1. Confidence update — `p' = p + α·(m(b) − p)`

| Evidence | Source |
| --- | --- |
| Probability as extended logic; Bayes' rule is the unique consistent update rule under Cox's axioms | Cox (1946); Jaynes (2003), *Probability Theory: The Logic of Science* |
| Linear approximation of a Bayes update when evidence credibility α is small; log-odds form is exactly the confidence hypothesis in 03-cognitive-physics.md §"Claim confidence hypothesis" | ACT-R (Anderson & Schooler 1991), log-odds activation |
| Revision must incorporate new evidence (success postulate) and change minimally (minimality postulate) | Alchourrón, Gärdenfors, Makinson (1985); Gärdenfors & Rott (1995) |

**Alternatives considered:** full posterior Bayes update per evidence item
(requires a likelihood model — heavier, no corpus evidence of better gate
parity); Dempster–Shafer belief functions (models ignorance explicitly but
adds a second algebra). **Chosen for prototyping:** the linear form, because
it is the smallest change to the existing EI gates and reduces to the
log-odds hypothesis as α → 1.

**Handling of contradiction:** the linear form only applies when new
evidence concerns the same claim. Contradictory evidence must create a
dispute state (03-cognitive-physics.md: "Contradictory evidence creates an
explicit dispute state; it does not get averaged away") — the reaction
semantics belong to Cognitive Chemistry (IDEA-0002), not to this formula.

## 2. Trust decay — `t(τ) = t₀·2^(−τ/t½)`

| Evidence | Source |
| --- | --- |
| Law 5 (Universal Decay) already mandates half-life decay for all entities including trust | spec/LAWS_OF_COGNITIVE_PHYSICS.md |
| Trust declines over time without interaction; dynamic trust models represent decay as a time-dependent decline toward a floor | Jonker & Treur (1999), "Analysis of the Dynamics of Reasoning About Trust" |

**Alternative:** ACT-R base-level activation decays as a **power law**
(`log odds ∝ log(1/t)`), not exponentially (Anderson & Schooler 1991).
**Decision:** keep exponential with half-life for trust — it is the
Law-5-consistent form and the corpus has no benchmark requiring the
power-law alternative. The power law is retained for memory strength (§4),
where ACT-R evidence is strongest.

## 3. Learning convergence — `PE(n) = PE₀·n^(−β)`

| Evidence | Source |
| --- | --- |
| Power law of practice: time/error decrease as a power of practice trials; β ≈ 0.4 across many task types (range 0.1–0.8) | Newell & Rosenbloom (1981), "Mechanisms of skill acquisition and the law of practice" |

**Alternative:** exponential learning curves fit some motor-learning data;
power law fits perceptual/cognitive tasks better and is the standard model
of skill acquisition. **Chosen:** power law; β per skill family is a
calibration parameter, not a constant.

## 4. Memory strength — spacing-based retention

| Evidence | Source |
| --- | --- |
| Forgetting curve: retention declines sharply then levels off | Ebbinghaus (1885) |
| Repetition with expanding intervals yields durable retention; SM-2 uses an easiness-factor (EF) with interval growth | Wozniak (1987), SuperMemo SM-2 |
| Rational analysis: log odds that a memory is needed ∝ recency and frequency (power-law retention) | Anderson & Schooler (1991) |

**Relationship to the corpus:** `FORMAL_FOUNDATIONS` §2.5 already defines a
forgetting score `F(entity)` with access-frequency and compression terms;
the closed form must be consistent with it — the ACT-R log-odds form is the
recommended anchor. **Alternative:** exponential retention (Ebbinghaus-style
without EF) — simpler but ignores repetition structure.

## 5. Conservation laws — G1 argument

| Law | Evidence |
| --- | --- |
| C1 experience never destroyed, only transformed | Landauer (1961): information erasure has an energy cost — erasure is a *transformation* with a physical price, never free. The ledger transform table is the accounting counterpart |
| C2 provenance chain | Fundamental causality; already Law 3 with ledger enforcement |
| C3 knowledge requires evidence | Foundationalist epistemology; already Law 4 |
| C4 signal information conserved under lawful transformation | Reversibility (Law 12) + the trace ledger; replay is the operational statement |

Conservation is the accounting invariant of the ledger: the transform table
is what makes "nothing disappears" verifiable rather than aspirational.

## 6. Failure physics — G1 argument

| Concept | Evidence |
| --- | --- |
| Instability `I(b) = confidence − evidence mass` | Control-theory stability (Lyapunov: a system is stable iff an energy-like function decreases); overconfidence literature — calibration studies show claims with confidence in excess of evidence are systematically wrong (Lichtenstein et al. 1982; modern LLM calibration surveys) |
| Contradiction as potential energy | AGM: a belief set containing p and ¬p is classically trivial — tension must be resolved by revision; the tension is measurable (number/weight of conflicting pairs) |
| Verification as stabilization | Bayesian sequential evidence; the EI veto corpus gives the empirical test: instability threshold θ must separate planted vetoes from mitigations |

The prototype in `src/engineering-intelligence/failure-physics/instability.ts`
implements the narrow slice: a single scalar instability per failure family,
one calibrated threshold, parity against the existing rule-based vetoes on
the 17-case EI benchmark corpus.

## Open questions

1. Calibration: θ = 0.5 is bootstrap-calibrated on the corpus; an
   independent held-out set is required before Acceptance.
2. Power-law vs exponential for memory retention: needs a corpus-backed
   benchmark, not a modeling preference.
3. Whether advisory findings should ever contribute to instability (they do
   not in the prototype — only the four veto families).
