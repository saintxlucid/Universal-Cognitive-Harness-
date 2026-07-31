# IDEA-0011 — Cognitive Physiology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "heart rate, blood pressure, stress,
  fatigue, curiosity, attention, confidence, entropy, learning rate, recovery,
  executive load — homeostasis becomes mathematical"
- **Related:** spec/FORMAL_FOUNDATIONS.md Part III (energy economics),
  src/control-plane/budgets, src/kernel/diagnostics (WS-E SMART metrics),
  src/sleep_cycle, IDEA-0014 (observatory)

## Motivation

The runtime should not "feel" overloaded; it should *measure* overload and
compensate. A single physiology state vector (load, energy, attention,
entropy, confidence, curiosity, learning rate, recovery, executive load) with
homeostatic setpoints makes regulation a control problem instead of a
collection of ad hoc heuristics.

## The corpus cannot cover it because

WS-E diagnostics expose 12 per-organ SMART metrics and budgets cap energy —
but there is no unified, time-varying physiology vector and no homeostasis
control loop that acts on it (shed work, sleep, compress, reallocate
attention).

## Proposal sketch

- Physiology vector updated on every cycle from existing signals (energy
  budgets, load, sleep metrics, retrieval entropy).
- Homeostatic setpoints per organ; control law: deviation from setpoint
  triggers compensation (reduce executive load → shed non-critical tasks;
  entropy high → compress context; confidence low → verify).
- Exposed as a CP-readable state + observatory feed.

## Risk assessment

- Metric zoo: every entry must bind to a decision it changes; unbound metrics
  are cut.
- Start by deriving the vector from what already exists (budgets + SMART
  metrics + sleep cycle) — no new instrumentation first.

## Where it lands

- Design doc `design/PHYSIOLOGY.md`; observatory panel.

## Code impact

- None initially; prototype is one control loop (energy homeostasis) over
  existing metrics.

## Next stage

Derive the state vector from existing metrics; prototype one compensation
loop; measure behavior change before generalizing.
