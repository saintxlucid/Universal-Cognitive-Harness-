# IDEA-0030 — Cognitive Speculation (prediction, speculation, DMA)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "CPU-style latency elimination for
  cognition: prediction units (before the IDE asks, the runtime already
  knows likely intentions — open file → need architecture → need memory →
  need APIs → need tests), speculative execution (while Claude writes, the
  planner simulates the next five conversations), and cognitive DMA (memory
  streams into the context builder; the model never asks)"
- **Related:** src/kernel/retrieval (fusion, compressor), GAP-CLOSURE-PLAN
  Phase 2 (middleware memory injection), IDEA-0012 (twin simulation),
  IDEA-0029 (cache hierarchy)

## Motivation

Latency is the runtime's least-visible tax: every model round-trip waits on
retrieval, context, and planning. The claim: a family of CPU-style
mechanisms — predict the next cognitive need, preload it; speculatively
simulate cheap branches of reasoning and discard on mismatch; stream
knowledge directly into the context builder without a query — makes the
runtime act before the model asks. This is the "act-before-ask" family:
prediction units, speculation, DMA.

## The corpus cannot cover it because

Retrieval fusion and the context compressor answer queries; the middleware
pipeline (in construction) injects memory on a fixed schedule. Nothing
predicts intent, preloads by prediction, simulates speculative reasoning
branches, or streams memory into context outside the query path.

## Proposal sketch

- Prediction units: intent predictors over session signals (file opened →
  need set: architecture, APIs, tests, docs); preload into L1 (IDEA-0029).
- Speculation: cheap simulated branches of the next reasoning steps;
  commit only what matches observed continuation; energy-capped.
- DMA: push-based context streaming — memory arrives into the context
  builder on prediction, not demand; the model never asks.

## Risk assessment

- Prediction that misses is pure cost; preload and speculation budgets must
  be bounded and measured (hit rate, wasted tokens) — the same discipline as
  CPU branch predictors.

## Where it lands

- Design doc `design/SPECULATION.md`; pairs with the cache hierarchy and the
  middleware pipeline.

## Code impact

- None until hit-rate telemetry exists; first prototype is a prediction unit
  over session signals with a preload budget.

## Next stage

Instrument current retrieval/middleware for hit-rate and wasted work; then
prototype one prediction unit (file-open → need set) with a bounded budget.
