# IDEA-0128 — Cognitive Profiler

- **Status:** Idea (SOP-08 stage 1 — no code)
- **Origin:** 2026-08-01 reimplementation-objective intake (round 19) —
  "Like Intel VTune. Except for thinking." Example metrics: Memory
  Hits, Reasoning Cost, Verification Time, Research Latency, Planning
  Cost, Context Growth, Knowledge Reuse, Decision Entropy, Simulation
  Cost, Token Efficiency. "This becomes performance engineering for
  cognition."
- **Related:** IDEA-0035 (Cognitive Information Theory — the named
  quantities Knowledge Entropy/Truth Density/Context Compression
  Ratio/Memory Temperature), IDEA-0071 (Cognitive SLOs — named
  reasoning observables + error budgets), IDEA-0018 (Cognitive
  Silicon — block-level latency/bandwidth/energy benchmarks over
  ADR-004), IDEA-0122 (Universal Runtime Telemetry — 17 named
  metrics with pinned units), WS-E (12 SMART metrics, band logic),
  IDEA-0014 (Observatory — the visualization layer), IDEA-0043
  (instruments taxonomy: Architecture MRI, Seismograph, Refactoring
  Particle Accelerator — the profiler is the missing instrument),
  IDEA-0034 (decision law — latency/cost terms), ADR-002 (trace
  ledger — the attribution substrate)

## Motivation

The corpus measures cognition at three levels that do not connect:
quantities (0035), SLOs (0071), and block-level hardware-style
benchmarks (0018). Nothing attributes _cost to a reasoning stage_ the
way VTune attributes CPU time to a function: given a session, which
inference calls consumed the budget? How much verification time did
a change require vs planning? Where did context grow fastest? What
was reused vs re-derived? The profiler is the instrument that turns
the trace ledger from an event record into an attribution report —
the difference between a flight recorder and a performance engineer.

## The corpus cannot cover it because

IDEA-0035 names quantities but defines no attribution model; 0071
defines SLOs but no per-session attribution; 0018 benchmarks
processors, not sessions; 0122 is runtime-wide telemetry, not
per-inference attribution; WS-E is self-diagnosis, not profiling.
No existing component answers "this architecture decision cost 14%
of the session budget in research latency" — that question requires
a profiler over the ADR-002 ledger that attributes each named metric
to the inference stages that produced it.

## Proposal sketch

- **Profiler over the trace ledger:** per-session attribution pass
  that maps ledger events to the 10 named metrics (Memory Hits =
  recall hits vs re-derivation; Reasoning Cost = inference energy per
  stage; Verification Time = evaluate/critique spans; Research
  Latency = retrieval-to-decision gap; Planning Cost = plan spans;
  Context Growth = context compressor deltas; Knowledge Reuse =
  recall/lineage hits; Decision Entropy = decision-law entropy term;
  Simulation Cost = simulate spans; Token Efficiency = output/input
  ratio per outcome).
- **Artifacts:** per-session profiler report (stage attribution,
  hotspots, bottlenecks), cross-session aggregations feeding
  IDEA-0071 error budgets and IDEA-0018 benchmarks, and the
  instrumentation surface for the Observatory (IDEA-0014).
- **Relationship:** quantities (0035) are the units, the ledger
  (ADR-002) is the input, the Observatory (0014) is the view, the
  session-benchmark corpus (IDEA-0129) is the consumer.

## Risk assessment

- Attribution is hard: span-level data (ADR-002) must map to
  stage-level meaning; start with coarse stage attribution over the
  recorder's existing events before adding new events.
- Metric inflation: 10 metrics must be defined against 0035's units,
  not invented ad hoc — the profiler consumes, it does not legislate.

## Where it lands

- Design doc `design/PROFILER.md`; prototype over the replay index
  (time machine + ledger) — no new transport, no new events.

## Code impact

- None at SOP-08 stage 1. Later: attribution pass in
  `src/cognitive-plane/replay/`, CLI `uch profile <session>`.

## Next stage

Define the 10 metrics against IDEA-0035 units; prototype coarse
stage attribution over the trace ledger.
