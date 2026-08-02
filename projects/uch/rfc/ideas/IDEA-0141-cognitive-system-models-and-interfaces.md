# IDEA-0141 — Cognitive System Models and Interface Engineering

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-22 intake, Volume III — "Don't define
  APIs. Define interfaces." and "Every subsystem should have four
  models: logical, behavioral, structural, temporal."
- **Related:** IDEA-0095 (ABI), driver compliance L0-L4, conformance,
  STACK.md, CIC envelope, IDEA-0072 (lifecycle), WS-E (health metrics),
  CVM (behavioral state), workspace-graphs (structural), cognitive
  clock + trace ledger (temporal), IDEA-0056 (object model), IDEA-0073
  (contracts registry).

## Motivation

Interface engineering: named cognitive interfaces (Memory, Knowledge,
Reasoning, Verification, Planning, Identity, Scheduler) as immutable
contracts — implementations change, interfaces do not. System models:
every subsystem or organ carries four views — logical (contracts,
capabilities), behavioral (events, states), structural (anatomy,
connections), temporal (tick-ordered lifecycle) — the MBSE (SysML)
discipline applied to cognition.

## The corpus cannot cover it because

Interfaces exist as runtime contracts (CP ops, ABI, contracts registry,
driver compliance) but no normative interface taxonomy carries the
"implementations change, interfaces don't" rule. Organs have
implementation docs but not four-view models as deliverables; the
temporal view in particular has no per-organ form (Lamport ticks and
the trace ledger exist; per-organ lifecycle models do not).

## Proposal sketch

- Interface taxonomy: the seven named interfaces as normative
  contracts; drivers and organs implement, never define.
- Four-view discipline: behavioral view = event/state model
  (neural-event-bus + CVM state machine); structural view = organism
  anatomy + workspace-graphs/connectome; temporal view = tick-ordered
  lifecycle model over the cognitive clock + trace ledger; logical view
  = contract + capability-registry entries.
- Views are refreshed from existing artifacts (generated, not parallel
  prose) and conformance-checkable.

## Risk assessment

- MBSE overhead: views must be derivable from src/docs, never
  maintained in parallel; four views as a per-organ conformance item.
- Duplication: the taxonomy must cite the ABI (IDEA-0095) and the
  contracts registry (IDEA-0073) as the single source of contract
  truth.

## Where it lands

Corpus governance (VISION sec 26); pilot on one organ (e.g., the
memory manager).

## Code impact

None (SOP-08 stage 1).

## Next stage

Interface taxonomy document; four-view pilot on one organ.
