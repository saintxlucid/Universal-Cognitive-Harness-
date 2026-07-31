---
track: cross-cutting
status: research-draft
version: 0.1.0
sources:
  - https://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2012/12/345nat_1999_b.pdf
  - https://arxiv.org/abs/1911.08265
  - https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/
---

# Cognitive Physics v0.1

## Purpose

The COS needs quantitative, inspectable models for activation, trust, utility,
uncertainty, prediction, resource allocation, compression, and adaptation.
These equations are research hypotheses and telemetry definitions, not claims
that intelligence is reducible to one score.

ACT-R demonstrates that activation can combine base-level recency/frequency and
contextual signals; its equations are useful inspiration, not a drop-in COS
truth model. Learned-model planning such as MuZero motivates explicit prediction
and planning models, while constrained evolutionary systems such as AlphaEvolve
motivate evaluator-driven search rather than uncontrolled rewriting.

## Quantities must stay separate

| Quantity | Meaning | Must not be used as |
| --- | --- | --- |
| Truth status | Candidate, verified, disputed, superseded, retracted, or simulated. | A relevance score. |
| Confidence | Calibrated belief in a claim under defined evidence. | Permission or importance. |
| Trust | Reliability estimate for a source, actor, or method in a context. | Blanket truth. |
| Activation | Temporary priority for a scope, query, and budget. | Durable memory strength. |
| Utility | Expected contribution to a stated goal. | A measure of human worth or user value. |
| Risk | Expected harm or policy sensitivity of an error/action. | A reason to bypass review. |
| Cost | Compute, token, latency, storage, and operational spend. | A reason to hide evidence. |

## Activation hypothesis

For an eligible object `o`, task/query `q`, scope `s`, and time `t`, define a
bounded activation score:

```text
A(o, q, s, t) = sigmoid(
  wr·R + wf·F + we·E + wq·Q + wu·U + wn·N + wc·C + ws·S
  - wx·X - wk·K
)
```

Where `R` is temporal relevance, `F` use frequency, `E` evidence quality,
`Q` task relevance, `U` expected utility, `N` novelty, `C` connection support,
`S` declared salience/risk, `X` contradiction or staleness penalty, and `K`
estimated retrieval/verification cost. Weights are scope-aware and require
offline calibration; they must not be self-adjusted from a single agent's prose.

The field is computed only after authorization and temporal eligibility checks.
The score and contributing signals are logged for high-impact retrievals.

## Claim confidence hypothesis

Confidence is evidence-specific, not an average of mentions. A starting
representation is log-odds updated by independent, reliability-weighted evidence:

```text
logit P(claim | evidence) = prior + Σ independence(ei) · reliability(ei) · support(ei)
```

Correlated sources must not be counted as independent confirmation. Contradictory
evidence creates an explicit dispute state; it does not get averaged away.
Calibration is evaluated with held-out outcomes using Brier score, reliability
curves, and abstention quality.

## Value of cognition hypothesis

Before expensive retrieval, planning, reflection, or simulation, the executive
estimates whether more cognition is worthwhile:

```text
VoC(action) = Expected improvement in decision quality - expected total cost - expected risk
```

Run the action only when `VoC > threshold` and the scope still has budget.
Thresholds depend on risk: a low-risk formatting task gets shallow cognition;
an irreversible change can justify more verification despite higher cost.

## Knowledge quality and entropy

There is no single valid “knowledge entropy” number. The COS will instead
measure a vector of independently actionable disorders:

- duplicate-claim rate;
- unresolved contradiction rate;
- orphan-concept rate;
- missing-provenance rate;
- temporal-staleness rate;
- unsupported-edge rate;
- retrieval miss and evidence-coverage rates;
- scope-policy denial and leakage rates.

Compression quality requires more than a ratio:

```text
compression quality = coverage × reconstructability × verified utility / distortion
```

Source coverage measures whether a derivation cites its supporting episodes;
reconstructability measures whether the original evidence can be recovered;
distortion is measured against queries the abstraction must still answer.

## Prediction and world-model metrics

A world model is evaluated per named domain, not as an unbounded personality
judgment. It must expose assumptions, prediction horizon, evidence set,
uncertainty, calibration, observed outcome, and update event. Useful measures
include accuracy, calibration, regret, abstention, surprise, and counterfactual
error where a ground truth exists.

The example “a systems-oriented user may enjoy Zig” is a low-confidence,
user-model prediction—not a fact, recommendation, or action. It requires an
explicit context and should be revised by feedback.

## Governed evolution

For an organ candidate `m`, utility is multi-objective:

```text
fitness(m) = quality + groundedness + safety + calibration + efficiency
             - regressions - policy violations - operational cost
```

The evolution lifecycle is fixed:

```text
propose → static validation → sandbox evaluation → shadow mode → canary
→ monitored approval → release | rollback
```

No algorithm, ontology rule, retrieval model, or policy can self-promote to
production without declared evaluators, regression fixtures, audit, and a
rollback path. This keeps the useful evaluator-driven insight of evolutionary
systems while preventing recursive self-corruption.
