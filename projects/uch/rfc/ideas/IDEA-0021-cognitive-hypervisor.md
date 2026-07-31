# IDEA-0021 — Cognitive Hypervisor

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "instead of virtual machines, virtual
  intelligences: research brain, coding brain, architecture brain — each
  isolated, versioned, checkpointed, benchmarked, synchronized; then compose
  them"
- **Related:** src/kernel/process (WS-A process model, attach-joins-PID),
  src/workspace-manifest (projections), spec/GENOME.md (species),
  src/kernel/organism (VersionedStore)

## Motivation

One kernel, many intelligences. A hypervisor layer turns brains into virtual
intelligences (VIs) that are isolated, versioned, checkpointed, benchmarked,
and synchronized — and that can be composed into committees, hierarchies, or
pipelines without entangling their state.

## The corpus cannot cover it because

The process model isolates agents by PID namespace; projections scope
capability grants; organism versioning versions genome state. There is no
VI abstraction: no checkpoint/restore contract, no per-VI benchmark, no
composition rules between intelligences.

## Proposal sketch

- VI = process + genome + grant scope + checkpoint contract + benchmark
  contract + sync policy.
- Checkpoint/restore: the workspace-brain and genome stores are already
  Storable — a natural seed.
- Composition: attach joins a VI; committee = multiple VIs with a shared
  governance context (ties to Civilization engine and cognitive merge).

## Risk assessment

- Overlaps the process model and species; the VI must be defined as the
  *composition boundary*, not another name for a process.

## Where it lands

- Design doc `design/COGNITIVE-HYPERVISOR.md`; extends WS-A.

## Code impact

- None until checkpoint/restore for an existing process is prototyped.

## Next stage

Prototype checkpoint/restore over the existing Storable process state; then
define VI composition semantics.
