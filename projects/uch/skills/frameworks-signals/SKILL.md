---
name: frameworks-signals
description: "Composite signal fusion: combine many weak, weakly-correlated signals (momentum, quality, liquidity, volatility, fundamentals, microstructure) into a ranked composite with risk controls — quant-style multi-factor scoring. Use when one signal is unreliable but many together are robust."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [signals, signal-fusion, multi-factor, ranking, quant, composite]
  related_skills: [frameworks-overview, frameworks-decisions, data-science]
---

# Composite Signal Fusion

Edge rarely comes from a single brilliant signal. The real power emerges when
you combine diverse, weakly-correlated signals, control risk rigorously, and
apply the process consistently.

## When to Use

- Ranking candidates when no single criterion is decisive
- Multi-factor scoring (projects, vendors, investments, hypotheses)
- Portfolio-style allocation with risk controls

## Engine Workflow (MCP `compose-signals`)

`fuseSignals` pipeline:

1. **Factorize** — define factors per candidate: momentum, quality, liquidity,
   volatility, fundamentals, microstructure (any subset)
2. **Normalize** — each factor score is 0-1; factors with coverage below 2
   are flagged as single-signal risk
3. **Fuse** — weighted composite per candidate (equal weights by default)
4. **Rank** — sorted composite with normalized percentages
5. **Risk** — risk controls: diversification, max allocation, top-N cut

The output includes `riskControls`, `recommendation`, and `insight`.

## Factor Regime Notes

| Factor | Excels when | Struggles when |
|---|---|---|
| Momentum | strong trends | choppy markets |
| Quality | long horizons | short-term trading |
| Liquidity | inefficient assets | efficient assets |
| Volatility | regime changes | stable markets |
| Fundamentals | long-term investing | short-term trading |
| Microstructure | high-frequency | long horizons |

No single factor dominates across all conditions.

## Verify

`uch frameworks select "Rank these candidates by multiple signals" --family
signals` returns the signals family.
