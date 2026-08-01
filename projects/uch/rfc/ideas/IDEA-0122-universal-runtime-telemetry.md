# IDEA-0122 — Universal Runtime Telemetry (Cognitive Observability)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 cognitive-architecture intake (round 16,
  second half) — "Universal Runtime Telemetry: not logs. Everything:
  latency, context size, memory hits, prompt size, compression, tool
  calls, file reads, file writes, token budget, energy, cost,
  verification, confidence, failures. This creates Cognitive
  Observability."
- **Related:** IDEA-0071 (Cognitive SLO catalog — named observables
  with green/yellow/red bands; the runtime telemetry set is its
  runtime-level rows), IDEA-0014 (cognitive observatory — the
  viewer), IDEA-0035 (cognitive information theory — named
  quantities: knowledge entropy, truth density, context compression
  ratio; this set is the runtime's measured quantities), IDEA-0043
  (instruments — the lens taxonomy), IDEA-0018 (cognitive silicon —
  block-level latency/bandwidth/energy benchmarks), ADR-004
  (per-call energy/latency accounting), ADR-002 (trace ledger —
  where telemetry is recorded), IDEA-0118 (UCCD — the `telemetry`
  section declares what a runtime emits), IDEA-0012 (digital twin —
  the live view powered by telemetry), IDEA-0070 (health registry —
  liveness metrics)

## Motivation

The corpus has SLOs (0071), an observatory (0014), named quantities
(0035), and instruments (0043) — but no canonical _runtime telemetry
set_ that every harness must emit. The intake names 17 metrics
(latency, context size, memory hits, prompt size, compression, tool
calls, file reads, file writes, token budget, energy, cost,
verification, confidence, failures) and claims this is "Cognitive
Observability": cross-runtime comparison, budget enforcement, and
the twin's live view all need the same measured quantities from
every participant. Without a normative set, each harness emits its
own shape and cross-runtime comparison is impossible.

## The corpus cannot cover it because

- The SLO catalog (0071) defines bands over named observables but
  has no runtime-emission contract — no metric set that every
  participant must expose, and no units pinned per metric.
- The ledger (ADR-002) records events, not quantities; nothing
  defines a runtime-telemetry event (sampled quantities per
  session/slice) as a first-class record.
- Confidence and verification as telemetry (not journal entries)
  are unowned: the ledger has verification records, but the
  _quantity_ "verification pass rate per session" is not a named,
  comparable observable.

## Proposal sketch

- **Spec** `uch.runtime-telemetry.v1`: the 17 metrics with pinned
  units and emission points (per session, per slice, per tool call),
  declared per participant in UCCD's `telemetry` section (0118) —
  a runtime emits the subset it can measure; unsupported metrics
  are reported as absent, never fabricated.
- **Event form**: periodic telemetry events on the bus (sampled +
  aggregated per policy), recorded in the ledger (ADR-002) so
  telemetry is replayable and auditable.
- **Consumers**: budget enforcement (energy/cost/token via
  control-plane budgets), the observatory (0014) and twin (0012)
  views, SLO monitors (0071) over the set, silicon benchmarks (0018)
  across runtimes.
- **Privacy**: quantities only — no content, no prompts, no
  transcripts (the L3 observable-only rule); telemetry is metric
  shape, never payload.

## Risk assessment

- Definition drift: units and sampling must be pinned in spec (a
  "context size" that means tokens vs chars is not comparable).
- Volume: continuous emission needs sampling + aggregation policy
  per metric class (high-frequency like latency, low-frequency like
  verification).
- Gaming: self-reported confidence needs the verified-level rule
  (0105) — telemetry claims are certified via conformance (0098).

## Where it lands

- Spec section + `src/engineering-intelligence/slo/` rows (0071),
  telemetry rail in harness drivers, ledger event type via event-
  governance.

## Code impact

- None until designed; seeds are SloMonitor, trace ledger,
  control-plane budgets, ADR-004 energy accounting.

## Next stage

- Merge the 17-metric set into the SLO catalog (0071) as the
  runtime rows; prototype: emit the full set from one harness and
  assert unit-comparable, ledger-replayable records.
