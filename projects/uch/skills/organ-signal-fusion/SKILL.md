---
name: organ-signal-fusion
description: "Signal Fusion Engine (Cortex Kernel): fuse many weak, weakly-correlated signals into a robust ranked composite with risk controls (normalize → weight → fuse → rank → risk). Use when no single signal is decisive but many together are robust."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [signals, fusion, organ, cortex-kernel, ranking, risk, composite]
  related_skills: [frameworks-signals, frameworks-overview, organ-productivity, organ-code-governance]
---

# Signal Fusion Engine (Cortex Kernel)

Stateful organ engine: fuses many weak signals into a ranked composite.
Delegates the fusion math to the signal-fusion framework engine and adds the
organ state: run history, recommendation bands, risk-flag and
decision-separation benchmarks, and event-driven workflow wiring.

## When to Use

- Ranking candidates when no single criterion is decisive
- Multi-factor scoring with structural risk controls
- Combining ranked signals from multiple organs before executive decisions

## Engine Workflow

1. **Factorize** — define factors per candidate (momentum, quality,
   liquidity, volatility, fundamentals, microstructure, custom).
2. **Fuse** — `engine.fuse(candidates)` normalizes, weights, and composites
   each candidate (equal weights by default).
3. **Rank** — sorted composite with coverage; risk flags surface structural
   risk (few factors, low liquidity, high volatility).
4. **Band** — recommendation: `buy` (top-N, composite ≥ 0.5, zero risk
   flags), `watch` (≥ 0.5 with flags), `avoid` (< 0.5).
5. **Record** — run history + benchmarks; emits `signal:fused` when wired.

## Benchmarks

- Decision separation (buy/watch/avoid banding quality)
- Risk-flag rate (signals carrying structural risk)
- Average factor coverage per fused candidate

## Event Wiring

When constructed via `createWiredSignalFusionEngine(bus)` (organ-wiring.ts),
every fuse run becomes a `signal:fused` bus event.

## Capability Registration

Registered in the standard capability registry (`attach.ts` →
`createStandardCapabilityRegistry`) as `signal-fusion` with authority
operations `retrieve`, `evaluate`, `simulate`. Capability absent from a
grant → engine activity is outside the client's projection (default deny).

## Verify

`uch fusion` prints the engine status (runs, bands, risk-flag rate).
