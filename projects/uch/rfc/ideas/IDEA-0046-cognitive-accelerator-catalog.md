# IDEA-0046 — Cognitive Accelerator Catalog

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "not skills, not firmware, not
  organs: cognitive accelerators — optimized execution pipelines the
  Cognitive Scheduler invokes as specialized hardware for categories of
  engineering work" — twelve: Architecture, Refactoring, Simulation,
  Verification, Memory, Research, Creativity, Performance, Security,
  Debug, Collaboration, Learning
- **Related:** ADR-004 (virtual processors + fabric — the routing
  embryo), accelerators/scheduler.ts, FrameworkComposer (34 frameworks),
  engineering-intelligence evaluator, cognitive time machine, replay

## Motivation

ADR-004's virtual processors route work by profile; the claim adds a
*standardized catalog* of named accelerator pipelines — each with an
input contract, pipeline stages over existing organs, invariants, and a
success metric — so the scheduler dispatches engineering categories to
accelerators the way a GPU routes kernels to hardware. Refactoring
Accelerator: large-scale transformation with invariant checking
(behavior preservation); Simulation Accelerator: parallel evaluation of
alternative designs (needs IDEA-0012 substrate); Debug Accelerator:
root-cause analysis across logs, traces, and code.

## The corpus cannot cover it because

Virtual processors are routing abstractions (10 CPUs with affinity);
nothing standardizes named pipelines with stage structure, invariants,
and per-category benchmarks. "Accelerator" today means coprocessor
kinds (semantic, compression, reasoning, prediction...), not
engineering work categories.

## Proposal sketch

- Catalog schema: category, input contract, pipeline stages, virtual
  CPUs consumed, invariants (e.g., refactoring: behavior-preserving),
  output artifact, benchmark (extends IDEA-0018 silicon metrics).
- The scheduler's category dispatch (complexity/verification profile)
  routes to the matching accelerator.

## Risk assessment

- Renaming risk: each accelerator must add pipeline structure and
  invariants beyond the virtual processor it uses, or it is a rename.

## Where it lands

- Extends ADR-004; design doc `design/ACCELERATOR-CATALOG.md`.

## Code impact

- None until one accelerator's pipeline is specified; Verification
  Accelerator is the smallest candidate (gates already exist).

## Next stage

Specify one accelerator end-to-end (Verification or Debug) over
existing organs; benchmark its pipeline against the direct path.
