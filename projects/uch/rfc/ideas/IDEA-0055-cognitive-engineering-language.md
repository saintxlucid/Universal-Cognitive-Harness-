# IDEA-0055 — Cognitive Engineering Language (CEL)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (final foundation) — "not
  Python, not TypeScript, not YAML: a language specifically for
  cognition. Example: `mission "Refactor Auth" requires Architecture
  requires Security requires Benchmarks; simulate; verify; execute;
  learn; commit`. Everything in UCH compiles from CEL → Cognitive IR →
  Cognitive VM → execution. That would make UCH not just an
  implementation but a programmable cognitive platform — the next six
  months of work"
- **Related:** RFC-0004 (CIR — the IR target), IDEA-0045 (CVM — the
  VM target), spec/CP.md (the op surface), IDEA-0052 (skill DSL — a
  sibling at skill granularity), FrameworkComposer, GSD plan
  language, CIC

## Motivation

Today the platform is *configurable* — skills, frameworks, plans — not
*programmable*. The claim: a user-facing cognitive language whose
missions (unit of work with requirements, simulation, verification,
execution, learning, and commit semantics) compile through CIR to the
CVM, making models execution backends of a program written in CEL.
CEL is to the CVM what C is to LLVM: the programmable surface above an
infrastructure.

## The corpus cannot cover it because

CIR is an internal IR design; CP is an instruction list; frameworks
are runtime selection. Nothing lets a user or a third party *write*
cognition as a program with type-checked requirements and lifecycle
semantics (simulate → verify → execute → learn → commit).

## Proposal sketch

- CEL grammar: mission blocks with `requires` clauses (architecture,
  security, benchmarks...), directives (`simulate`, `verify`,
  `execute`, `learn`, `commit`), energy/budget annotations, and
  provenance binding.
- Compiler: CEL → CIR with type checking of requirements against
  available capabilities (a mission requiring Benchmarks with no
  benchmark corpus is a compile error).
- Runtime: CVM (IDEA-0045) executes the lowered program; learn/commit
  semantics map to transactional cognition and the ledger.

## Risk assessment

- Language vanity: CEL must compile to semantics the CVM executes; one
  working vertical slice (mission → CIR → execution) precedes any
  breadth, or it is syntax.

## Where it lands

- Design doc `design/CEL.md`; extends RFC-0004 (CIR) + IDEA-0045
  (CVM).

## Code impact

- None until the grammar and the CIR lowering are specified.

## Next stage

Define the mission grammar; prototype compiling one mission
("Refactor Auth") end-to-end to CIR and through a simulated CVM
execution.
