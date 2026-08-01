---
track: reliability
status: research-draft
version: 0.1.0
sources:
  - https://sre.google/sre-book/service-level-objectives/ (Google SRE book — SLIs, SLOs, error budgets)
  - https://sre.google/workbook/implementing-slos/ (Google SRE workbook — implementing SLOs)
  - https://arxiv.org/abs/2503.01738 (hallucination rate measurement — calibration and overconfidence in LLMs)
  - https://doi.org/10.48550/arXiv.2402.04357 (contradiction detection in reasoning chains — evidence for the contradiction-rate SLI)
---

# Cognitive SLOs — G1 evidence register (IDEA-0071)

Evidence register for `rfc/ideas/IDEA-0071-cognitive-slos.md`: named,
measured cognitive observables with contractual targets, error budgets,
and escalation — SRE for reasoning. The catalog doubles as the named
quantities of IDEA-0035.

## 1. SLI / SLO / error budget

| Evidence | Source |
| --- | --- |
| An SLO is a target percentage of good events over a window; an error budget is the tolerated bad fraction (1 − target); burning the budget triggers action (release gating, on-call, redesign) | Google SRE book, "Service Level Objectives" |
| SLOs are agreed, reviewed contracts — not metrics dumps; each SLO must have an owner and an action | SRE workbook, "Implementing SLOs" |
| Measurement precedes target: an SLI is defined by its measurement point (count good/total events, latency distribution, etc.) | SRE book, SLI definitions |

**Corpus anchor:** the corpus measures a great deal in scattered
places — energy budgets (`src/control-plane/budgets`), WS-E SMART
metrics, ADR-003 benchmark latency, ADR-004 virtual-processor
profiles, the round-10 profiler (IDEA-0066). Grep confirms zero SLO
semantics in `src/`. The prototype unifies them into a catalog with
units and targets.

## 2. Cognitive failure rates are measurable observables

| Evidence | Source |
| --- | --- |
| LLM overconfidence is systematically miscalibrated; calibration measurement (confidence vs accuracy) is a well-defined ratio | arXiv:2503.01738 (calibration) |
| Contradiction detection in reasoning chains is implementable and measurable (pairwise entailment checks), giving a contradiction-rate SLI | arXiv:2402.04357 |
| Hallucination rate = evidence-failure rate: claims without backing evidence, classified per the failure taxonomy (IDEA-0074) | RFC-0005 failure physics (corpus anchor) |

**Corpus anchor:** RFC-0005's instability measure I(b) = confidence −
evidence mass is literally the truth-accuracy SLI's numerator;
integrity checks and the EI benchmark runner give measurement points.
The prototype names the quantities; the corpus already has the meters.

## 3. Escalation must bind to action

| Evidence | Source |
| --- | --- |
| An error budget without an action is decoration; escalation bands (green/yellow/red) map to concrete responses | SRE book (on-call page on budget burn) |
| Budget burn rate (not instantaneous rates) drives alerting — a 2% budget burning at 5× rate needs paging | SRE workbook, burn-rate alerting |

**Corpus anchor:** IDEA-0070's health registry is the natural
consumer — red band → organ `degraded`; the observatory (IDEA-0014)
is the display surface. The prototype exposes `bandToHealth` for
exactly this binding.

## Prototype claims

- A catalog of the 15 named observables with units, measurement
  points, and higher/lower-is-better orientation.
- Windowed compliance computation (tick-based sliding window,
  deterministic).
- Error-budget accounting with green/yellow/red bands mapped to
  health states.
- Value-threshold SLIs (latency p95) and ratio SLIs (hit rates,
  failure rates) in one monitor.
