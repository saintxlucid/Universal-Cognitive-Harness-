# IDEA-0106 — Context IR (Repository-Artifact Intermediate Representation)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 abstraction-layer intake (round 15) — "the
  ecosystem is accidentally standardizing around repository-level
  artifacts (AGENTS.md, CLAUDE.md, skills, subagents, hooks, MCP
  servers, IDE bridges, llms.txt) — the beginnings of an operating
  system interface for AI development. Don't create another isolated
  format: define one intermediate representation. Context IR →
  Compiler → Cursor Rules / CLAUDE.md / AGENTS.md / Gemini / Codex /
  Copilot / OpenCode — exactly like LLVM IR: one IR, many frontends
  and backends. The Universal Context Compiler might be the biggest
  opportunity."
- **Related:** IDEA-0096 (UCCL "UCH Context Specification" — the
  one-source context _generation_ proposal this refines into a full
  compiler), RFC-0004 CIR + spec/CIR.md (the _instruction_ IR — the
  naming collision this note must disambiguate against), IDEA-0052
  (skill compiler — prose→skill IR precedent), IDEA-0104 (adapter
  compiler — the sibling compiler for integration code), llms.txt
  (ecosystem machine-readable documentation convention), workspace
  manifest + genome (source facts the IR is compiled from),
  src/context/gatherer.ts (context collection), design/CIR.md
  (instruction IR design history)

## Motivation

Repository artifacts are the de facto OS interface of the AI
ecosystem: every serious coding agent reads AGENTS.md/CLAUDE.md/
rules files/skills/subagents and exposes hooks and MCP servers. But
each ecosystem has its own dialect, and the same facts (goals,
architecture, conventions, risks, ownership) are re-authored in each
dialect and drift apart. The intake's claim: treat those facts as a
single language (Context IR) and every ecosystem's artifact format as
a compiler backend — LLVM's move applied to repository context. The
IR is bidirectional: frontends parse each ecosystem's artifacts into
it (so existing CLAUDE.md/AGENTS.md content is _absorbed_, not
discarded), and backends emit each format from it (so one source
serves every agent). This is a deeper claim than generation: it makes
repository context a _compiled artifact_ with a canonical source and
round-trip conformance (parse → emit → parse must be stable).

## The corpus cannot cover it because

- IDEA-0096 proposes one-source generation (a UCH Context
  Specification compiled outward) but not the IR architecture:
  no frontends absorbing existing per-ecosystem artifacts, no
  canonical IR schema, no round-trip conformance between dialects.
  Generation without absorption would orphan every existing
  CLAUDE.md/AGENTS.md/rules file.
- **Naming collision**: RFC-0004 CIR owns "Cognitive Intermediate
  Representation" for _instructions_ (the cognitive bytecode). The
  intake's CIR is a _context/knowledge_ language — the front-end
  language of the compiler, not the instruction IR. The collision
  must be resolved as a governance decision (proposed: keep CIR =
  instruction IR; name this **CX-IR — Context Intermediate
  Representation**).
- No schema exists that unifies the fact families (goals,
  architecture, conventions, policies, risks, ownership, tasks)
  with per-ecosystem dialect mappings; gatherer collects context but
  has no IR target.

## Proposal sketch

- **CX-IR v1**: a stable, versioned fact model for repository context
  — `{goals, architecture, conventions, policies, risks, ownership,
tasks, commands, knowledge-pointers}` — compiled from the workspace
  manifest + genome + decision/architecture graphs; frontends parse
  AGENTS.md / CLAUDE.md / Cursor rules / skills / llms.txt into the
  IR; backends emit each dialect; round-trip conformance (IR → dialect
  → IR is identity up to formatting) is the certification gate.
- **Drift control**: IR is the source of truth; per-ecosystem files
  are generated artifacts with provenance headers ("generated from
  CX-IR v1 by uch context compile"), and hand edits are absorbed on
  the next frontend pass rather than overwritten.
- **Sibling of CIR**: CX-IR is the compiler _front-end language_
  (what context means); RFC-0004 CIR is the _backend bytecode_ (what
  cognition executes); the pipeline is CX-IR → (compiler) → CIR →
  (runtime). The two names are distinct by governance decision.
- **Ecosystem fit**: llms.txt and skills/subagents are additional
  backends/frontends of the same IR, not new formats.

## Risk assessment

- IR bloat: the fact model must stay a floor — dialect-specific
  richness lives in extension blocks, never in the core.
- Lossy round-trips: dialects that cannot express IR facts must
  degrade explicitly (a documented omission map per backend), never
  silently drop facts.
- Adoption: frontends matter as much as backends — absorption of
  existing artifacts is the adoption path; generation-only would be
  rejected by the ecosystem.

## Where it lands

- `spec/` (CX-IR schema + dialect map, RFC-0008 candidate),
  `src/context/` (frontends + backends + round-trip suite),
  CLI `uch context compile|parse|diff`.

## Code impact

- None until specified; seeds are gatherer, workspace manifest,
  genome, architecture/decision graphs, IDEA-0096 context
  specification, IDEA-0052.

## Next stage

- Prototype: parse an existing CLAUDE.md + AGENTS.md pair into CX-IR,
  assert fact equality, emit both dialects back, assert round-trip
  stability.
