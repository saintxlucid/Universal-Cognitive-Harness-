# IDEA-0016 — Cognitive Economics

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "stop asking 'what answer should I
  give?' — ask 'what investment should I make?'; every action has ROI: memory,
  reasoning, simulation, documentation, testing, learning — capital
  allocation, like a CEO"
- **Related:** spec/FORMAL_FOUNDATIONS.md Part III (economics),
  src/control-plane/budgets, src/accelerators/scheduler.ts,
  src/sleep_cycle (distillation value), IDEA-0011 (physiology)

## Motivation

Current runtimes optimize for answering; a cognitive substrate should
optimize for *return on cognition*. Every action carries expected value,
cost, and risk; memory retention is an investment decision ("should I keep
this forever?" — the projected value is negative), not a storage decision.
Opportunity cost and compound value become first-class.

## The corpus cannot cover it because

Budgets cap energy consumption; the scheduler orders work by urgency and
value heuristics. Nothing computes expected value of an action, tracks an ROI
ledger, or treats retention/learning/testing as investments with
opportunity cost.

## Proposal sketch

- ROI ledger: every executed action records value realized vs. cost; decayed
  and queryable.
- Utility-weighted scheduling: order work by expected value per unit cost
  (extends the scheduler's existing utility model).
- Retention decisions: memory/skill retention computed from projected value
  curves, not size thresholds.
- Coarse utility functions first; the ledger makes the economics visible to
  humans before it steers anything.

## Risk assessment

- Expected-value estimation is hard; start visible, not authoritative:
  the ledger reports, humans and policy set the utility functions.

## Where it lands

- Design doc `design/COGNITIVE-ECONOMICS.md`; extends scheduler + sleep
  cycle + memory retention policy.

## Code impact

- None until the ledger exists as a read model over the trace ledger.

## Next stage

ROI ledger as a read model over existing trace data; then a utility-weighted
scheduler experiment against the current urgency-only behavior.
