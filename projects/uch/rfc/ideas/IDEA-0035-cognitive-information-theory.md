# IDEA-0035 — Cognitive Information Theory

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "Shannon invented information
  theory; nobody has invented one for cognition" — candidate quantities:
  Knowledge Entropy, Architectural Entropy, Understanding Density,
  Context Compression Ratio, Reasoning Bandwidth, Attention Bandwidth,
  Memory Temperature, Novelty Gradient, Truth Density, Decision Momentum
- **Related:** IDEA-0001 (physics equations/units), IDEA-0026 (cognitive
  mathematics), FORMAL_FOUNDATIONS Part I, src/kernel/retrieval
  (context compressor), connectome, trace ledger (evidence for truth
  density), IDEA-0043 (entropy spectrometer)

## Motivation

RFC-0005 defines units and conservation; the corpus measures energy and
latency, but not *information* about cognition. The claim: define a
family of named cognitive observables — each with a measurement
procedure computable from existing traces — so that properties like
"is the workspace knowledge growing or entropizing?" become numbers.

## The corpus cannot cover it because

No named quantities with definitions, domains, units, and measurement
procedures exist; metrics today are subsystem-local (test counts,
latency, SMART diagnostics) rather than information-theoretic.

## Proposal sketch

- Define each quantity operationally: Knowledge Entropy (uncertainty
  over the belief graph, measurable via confidence dispersion),
  Truth Density (evidence-to-claim ratio over the ledger), Context
  Compression Ratio (raw context tokens vs delivered),
  Reasoning/Attention Bandwidth (throughput of reasoning stages vs
  attention budget), Memory Temperature (write/consolidate rate vs
  recall rate), Novelty Gradient (novel-event fraction per window),
  Decision Momentum (decision velocity weighted by impact).
- Each quantity must be computable from the trace ledger or memory
  stores — numerology check.

## Risk assessment

- Numerology: any quantity without an actual measurement procedure
  against existing data is a label, not a theory.

## Where it lands

- Extends RFC-0005 / FORMAL_FOUNDATIONS Part VIII; instrumented via
  IDEA-0043 (Entropy Spectrometer).

## Code impact

- None until two quantities are defined over real traces.

## Next stage

Define Truth Density and Knowledge Entropy operationally over the trace
ledger; prototype one measurement on a real workspace history.
