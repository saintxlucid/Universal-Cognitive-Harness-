# IDEA-0071 — Cognitive SLOs

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Reasoning latency, reasoning throughput, thoughts/second, memory hit
  rate, knowledge freshness, truth accuracy, hallucination rate,
  contradiction rate, reflection efficiency, context utilization,
  reasoning reuse, learning efficiency, decision quality, signal
  congestion, attention saturation, token ROI. Engineering
  organizations already measure software reliability with SRE metrics;
  UCH should define analogous Cognitive SLOs."
- **Related:** src/control-plane/budgets (energy economics),
  src/kernel/diagnostics/ (WS-E SMART metrics — 12 metrics, band
  logic), src/engineering-intelligence/benchmark/ (runner — recall,
  latency, negative controls), ADR-004 (virtual processors — latency/
  energy profiles), IDEA-0014 (cognitive observatory), IDEA-0066
  (cognitive reasoning profiler — round 10), IDEA-0034 (decision law —
  decision quality), RFC-0005 (failure physics — truth/evidence
  measures), src/kernel/retrieval (fusion, compressor — hit-rate
  telemetry surface), IDEA-0035 (cognitive information theory — named
  quantities)

## Motivation

SRE made reliability *contractual*: measurable objectives with budgets
and error budgets, reviewed like code. Cognitive systems have the same
failure surface — slow reasoning, saturated attention, hallucinated
evidence, contradicting beliefs, wasted tokens — but no agreed set of
named, measured quantities with targets. The corpus measures a great
deal (energy budgets, SMART metrics, benchmark latency, profiler runs)
in scattered places; it has no *catalog of cognitive observables with
contractual targets*.

## The corpus cannot cover it because

Grep confirms zero SLO/service-level semantics in src/. Metrics exist
per-subsystem (budgets, diagnostics, benchmarks, IDEA-0066 profiler)
but are not unified into a named quantity catalog (IDEA-0035 is the
naming layer, unbuilt) nor attached to targets with error budgets and
escalation. Nobody can answer "is the organism healthy *as a
reasoning system* this week" — only per-subsystem health (IDEA-0070).

## Proposal sketch

- A Cognitive SLO catalog: each observable (reasoning latency p95,
  thoughts/second, memory hit rate, knowledge freshness, hallucination
  rate, contradiction rate, reflection efficiency, context utilization,
  reasoning reuse, learning efficiency, decision quality, signal
  congestion, attention saturation, token ROI) defined with units,
  measurement point, and derivation — the quantity definitions double
  as IDEA-0035 named quantities.
- Error budgets per SLO with escalation bands (green/yellow/red)
  feeding IDEA-0070 health and the observatory (IDEA-0014).
- SLO targets versioned in the spec repository (IDEA-0083) so they are
  reviewable and diffable; benchmarks (ADR-003) become SLO compliance
  runs.

## Risk assessment

- Metric theater: an SLO nobody can act on is decoration. Each SLO must
  map to a controller (a budget, a gate, an alert) or it is dropped;
  targets must start evidence-derived (benchmark baselines), not
  aspirational.

## Where it lands

- `design/COGNITIVE-SLOS.md`; catalog entries feed the observatory and
  the spec repository.

## Code impact

- None until the catalog and measurement points are specified; the
  benchmark runner becomes the first SLO harness.

## Next stage

- Five highest-value observables (reasoning latency, memory hit rate,
  hallucination rate, contradiction rate, token ROI) drafted against
  existing measurement points.
