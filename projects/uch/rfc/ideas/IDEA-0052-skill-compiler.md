# IDEA-0052 — Skill Compiler

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Foundation 11) — "instead of
  writing workflows, compile skills: Skill DSL → compiler → Skill IR →
  optimizer → runtime"
- **Related:** .agents/skills (SKILL.md prose instruction sets),
  IDEA-0033 (firmware — permanent behaviors), FrameworkComposer (34
  frameworks, SolveProfile), RFC-0004 (CIR — the IR precedent),
  organic-code 6-gate pipeline, GSD workflow files

## Motivation

Skills today are prose instruction sets interpreted by agents at run
time — no type safety, no dead-step elimination, no caching, no
composition guarantees. The claim: a declarative Skill DSL
(steps, gates, inputs/outputs, energy, verification requirements)
compiled to a typed Skill IR, passed through an optimizer
(reachability, fusion, caching, parallelism), and executed by a skill
runtime over organs and frameworks — turning skills from documents into
compiled programs.

## The corpus cannot cover it because

Skills are markdown; frameworks are a runtime selection mechanism; CIR
targets cognitive IR, not skill workflows. No DSL, no compiler, no IR
exists between the prose and the runtime.

## Proposal sketch

- Skill DSL: declarative step graph with typed inputs/outputs, gates
  (constitutional, verification, organic-score), energy budgets.
- Compiler: DSL → Skill IR (typed DAG) with validation (unreachable
  steps are errors, not warnings); optimizer: dead-step elimination,
  step fusion, cache annotations, parallelizable subgraphs.
- Runtime: executor over organs; a compiled skill is inspectable and
  benchmarkable like any other artifact.

## Risk assessment

- YAML-soup: the DSL must lower to executable semantics that
  measurably differ from prose interpretation, or it is markup with a
  compiler attached.

## Where it lands

- Design doc `design/SKILL-COMPILER.md`; extends .agents/skills + CIR.

## Code impact

- None until the DSL grammar is defined; a sibling of CEL (IDEA-0055).

## Next stage

Pick one existing skill (code-review); define its DSL lowering and
check the compiled IR preserves the prose semantics.
