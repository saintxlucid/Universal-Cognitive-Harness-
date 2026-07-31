# IDEA-0037 — Cognitive Thermodynamics

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "brains don't have infinite
  energy; every subsystem has heat, load, fatigue, cooling, recovery,
  efficiency, waste, entropy — if reasoning overheats, reflection
  increases; if memory overheats, compression starts; homeostasis
  emerges naturally"
- **Related:** IDEA-0011 (cognitive physiology), control-plane/budgets,
  WS-E diagnostics (12 SMART metrics), sleep cycle (cooling/recovery),
  src/protocol/catalog.ts (per-op energy costs), ADR-006 (energy
  manager primitive)

## Motivation

Budgets enforce limits; physiology tracks a state vector; diagnostics
measure SMART metrics. The claim: add a thermodynamic state model —
load converts to heat, heat degrades throughput, thresholds trigger the
corrective mechanisms that already exist (reflection for reasoning,
compression for memory, sleep for global recovery), with cooling curves
and fatigue accumulation between sessions.

## The corpus cannot cover it because

No subsystem has a state model where load → heat → degradation →
corrective trigger is a continuous loop; recovery and fatigue are
implicit in the sleep cycle, not first-class state.

## Proposal sketch

- Per-subsystem thermal model: load (ops) → energy → heat; heat raises
  latency/error rate; thresholds activate corrective mechanisms;
  cooling after corrections; fatigue accumulates when heat persists.
- Homeostasis: corrective mechanisms become predictable consequences
  of the model rather than scheduled pipelines.
- Maps onto IDEA-0011's physiology vector and WS-E metrics as the
  measurement surface.

## Risk assessment

- Anthropomorphism: every mechanism must map to a real control loop
  with telemetry; otherwise it is metaphor.

## Where it lands

- Extends IDEA-0011; design doc `design/COGNITIVE-THERMODYNAMICS.md`.

## Code impact

- None until the model is retrofitted over budget + diagnostics
  telemetry.

## Next stage

Fit the thermal model to existing budget/diagnostics data; find the
observed thresholds where degradation begins.
