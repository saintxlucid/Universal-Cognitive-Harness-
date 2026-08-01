# IDEA-0066 — Cognitive Reasoning Profiler

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "CPU
  profiler → reasoning profiler. Measure token flow, reasoning depth,
  attention, memory hits, knowledge misses, verification cost, latency,
  energy."
- **Related:** IDEA-0018 (cognitive silicon — block-level benchmarks),
  ADR-002 trace ledger + OtelBridge, `protocol/catalog.ts` per-op
  latency/energy metadata, EI benchmark runner (latency/recall
  metrics), IDEA-0014 (observatory), IDEA-0063 (allocator — starvation
  detection), control-plane telemetry

## Motivation

UCH measures *operations* (per-op cost metadata, benchmark latency)
but nothing profiles a *reasoning run* end to end: where tokens went,
how deep the reasoning graph got, what retrieval actually hit vs
missed, what verification cost, where energy and latency accumulated.
Profiling is what made performance engineering possible on CPUs; the
reasoning equivalent is what makes cognitive performance engineering
possible — the input to every optimization decision (compiler passes,
allocator policy, GC tuning).

## The corpus cannot cover it because

`catalog.ts` has per-op cost *constants*; the ledger has per-event
timing; the EI runner has per-case latency; none of these are
composed into a per-run profile: token flow per stage (CIR stages when
they exist, else think/retrieve/evaluate), reasoning depth (graph
nodes per decision), retrieval hit/miss rates (fusion rerank results
exist but are not aggregated), verification cost (verifyWithCode /
evaluate spend), and energy per subsystem. `cache_breakpoint` exists
only as a prompt artifact in system-context.ts.

## Proposal sketch

- Profile unit = one ledger trace (ADR-002 is already the natural
  transaction boundary): profile = composition of catalog constants ×
  observed counts + telemetry deltas, rendered per stage and per
  resource class (tokens/energy/latency/depth/hit-rate).
- Flame-graph-style rendering for reasoning (organs on the call path,
  evidence retrievals as leaves) — the observatory (0014) consumes it;
  per-case profiles attach to EI benchmark results.
- Standing aggregations: hot reasoning paths (co-occurring op
  sequences), retrieval miss rate per store, verification cost share —
  feeding compiler passes (CIR §5), allocator policy (0063), and GC
  tuning (0060).

## Risk assessment

- Profiling must not distort the run (observer effect): counters ride
  existing ledger events, never add instrumentation calls on hot
  paths; profiles are derived views, not new write paths.

## Where it lands

- `src/cognitive-plane/profiling/` over the ledger; design doc
  `design/REASONING-PROFILER.md`; CLI `uch profile <trace-id>`.

## Code impact

- New derived-view module; zero changes to the ledger or catalog.

## Next stage

- Composition spec (catalog × counts); one derived profile over a
  real think-trace; hit/miss aggregation on retrieve traces.
