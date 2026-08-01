---
track: cross-cutting
status: research-draft
version: 0.1.0
sources:
  - https://www.bcs.rochester.edu/people/robbie/jacobslab/elife-2014-geraertsa.pdf (Gershman, Horvitz & Tenenbaum 2015, computational rationality)
  - https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/resourcerational-analysis-understanding-human-cognition-as-the-optimal-use-of-limited-computational-resources (Lieder & Griffiths 2020, resource-rational analysis)
  - https://www.sciencedirect.com/science/article/abs/pii/S0004370200000534 (Russell & Wefald 1991, principles of metareasoning)
  - https://www.jstor.org/stable/1914185 (von Neumann & Morgenstern 1944, theory of games and economic behavior)
  - https://www.jstor.org/stable/2227370 (Savage 1954, foundations of statistics)
  - https://www.jstor.org/stable/2236523 (Lindley 1956, value of experimental information)
  - https://www.jstor.org/stable/2939040 (Kahneman & Tversky 1979, prospect theory)
  - https://www.jstor.org/stable/2975974 (Markowitz 1952, portfolio selection)
  - https://www.aaai.org/Papers/AIIDE/1988/AIIDE88-002.pdf (Dean & Boddy 1988, anytime algorithms)
---

# Theory of Intelligence — G1 evidence register (IDEA-0034)

Evidence register for the unified decision law proposed in
`rfc/ideas/IDEA-0034-theory-of-intelligence.md`: every cognitive action
carries Energy (E), Information Gain (IG), Risk (R), Confidence (C),
Novelty (N), Expected Utility (EU), Latency (L), Reversibility (V); every
decision selects the action maximizing

```text
λu·EU(a) + λi·IG(a) + λn·N(a) − λe·E(a) − λr·R(a) − λl·L(a)
```

with λ weights per context. The claim is not that this formula is the
discovery — it is a policy family that is (a) G1-grounded per term, and
(b) known in the literature to subsume planning, memory, learning,
reflection, scheduling, and verification as special cases. The corpus
already ships several of those special cases; the prototype derives them
from one objective instead of bespoke rules.

## 1. Expected Utility — `EU(a)`

| Evidence | Source |
| --- | --- |
| Under von Neumann–Morgenstern axioms, a rational agent's preferences over lotteries are representable as maximizing expected utility | von Neumann & Morgenstern (1944) |
| Subjective expected utility extends this to uncertain states with personal probabilities; axioms of coherence (Savage's sure-thing principle) | Savage (1954) |

**Corpus anchor:** Law 2 (Minimum Cognitive Energy) and the EI gate
economics (Tier V) already treat decisions as utility-optimizing; the
scheduler (ADR-004 virtual processors) selects cheapest healthy provider,
which is EU with cost-as-negative-utility.

## 2. Information Gain — `IG(a)`

| Evidence | Source |
| --- | --- |
| Entropy is the unique measure of uncertainty satisfying Shannon's axioms; KL divergence measures expected information gained by updating a belief | Shannon (1948) |
| The expected value of sample information is the KL gain of a proposed experiment, and optimal experiments maximize it (Bayesian experimental design) | Lindley (1956) |
| Rational metareasoning selects computation whose expected value of information exceeds its cost | Russell & Wefald (1991) |

**Corpus anchor:** `recallCompressed()`/retrieval fusion already scores
context by informativeness; the "value of information" term is the natural
parent of the verification gate (`verify iff IG(verify) > cost`).

## 3. Energy — `E(a)`

| Evidence | Source |
| --- | --- |
| Resource-rational analysis models cognition as optimal use of limited computational resources; effort is a cost term in the objective | Lieder & Griffiths (2020) |
| Computational rationality: an agent is a resource-limited optimal decision maker; metareasoning allocates computation where value exceeds cost | Gershman, Horvitz & Tenenbaum (2015); Russell & Wefald (1991) |
| Bounded rationality treats the cost of deliberation itself as a constraint on optimal choice | Simon (1955) |

**Corpus anchor:** Energy Manager budgets (`control-plane/budgets.ts`),
ADR-004 energy/cost routing, cognitive clock ticks, and the sleep cycle
(tokenReductionPct) are existing energy-cost machinery.

## 4. Risk — `R(a)`

| Evidence | Source |
| --- | --- |
| Mean-variance trade-off: risk is variance of outcomes; portfolios maximize return at fixed risk | Markowitz (1952) |
| Prospect theory: losses are weighted more heavily than gains (loss aversion), i.e., risk enters the objective nonlinearly | Kahneman & Tversky (1979) |
| Instability I(b) = confidence − evidenceMass (RFC-0005 Part 3) is a calibrated risk-of-failure signal with parity against rule vetoes | failure-physics prototype (this corpus, 103/103 EI tests) |

**Corpus anchor:** the RFC-0005 instability prototype IS the risk term of
this law. This is the strongest existing special case.

## 5. Latency — `L(a)`

| Evidence | Source |
| --- | --- |
| Anytime algorithms trade deliberation time against solution quality; rational agents stop deliberating when marginal value of more time falls below its cost | Dean & Boddy (1988) |
| Time pressure degrades decision quality; deadline-aware policies are optimal under time costs | Lieder & Griffiths (2020) review of time-pressure results |

**Corpus anchor:** ADR-004 dispatch fallback orders (preferred → cost →
latency), `avgResolutionMs` in the reflex fast-path router.

## 6. The unification claim

| Evidence | Source |
| --- | --- |
| Computational rationality is explicitly proposed as a *converging paradigm* — planning, learning, perception, and memory as instances of one resource-limited optimization | Gershman, Horvitz & Tenenbaum (2015) |
| Resource-rational analysis derives specific cognitive biases as optimal given resource costs, not as errors | Lieder & Griffiths (2020) |
| Metareasoning generalizes decision theory to *which computations to run*, subsuming verification, reflection, and scheduling | Russell & Wefald (1991) |

**Verdict:** the "one law" claim is G1-grounded — it is not a new
empirical discovery, it is the adoption of computational rationality as
the corpus's normative decision model, with each corpus subsystem mapped
to a term. The prototype's value is *derivation*: show that
reject/verify/proceed (governance), priority ordering (scheduling), and
store/evict (memory) each fall out of one scored objective, so future
capabilities do not add rules — they add term weights.

## Special-case mapping (prototype scope)

| Corpus policy | Special case |
| --- | --- |
| EI veto gate | `reject` wins when λr·R(a) dominates for all non-reject actions |
| Verification / step-critic | `verify` iff IG(verify) − λe·E − λl·L > 0 |
| Scheduler priority | rank actions by λu·EU + λi·IG − λl·L (energy constant within dispatch) |
| Memory store/evict | store iff IG(retrieval later) > storage cost; evict by recency·salience − λe·E |
| Reflex fast path | L-term dominates: resolve via prefix trie when λl·L(path) ≪ λl·L(LLM) |

## Non-goals (kept out of this wave)

- No claim that the weighted sum is *the* brain's objective (that is
  biology, not engineering); the law is the corpus's normative model.
- No rewrite of existing gates — the prototype derives, it does not
  rewire (SOP-08 Prototype discipline).
- Novelty (N) and Reversibility (V) terms are defined but unused in the
  v0.1 prototype; they are recorded for the CIR optimizer passes.
