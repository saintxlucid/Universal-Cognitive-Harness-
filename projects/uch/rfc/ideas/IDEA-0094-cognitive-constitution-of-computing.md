# IDEA-0094 — The Cognitive Constitution of Computing

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 intake (round 12) — "One foundational
  specification defining the physics, mathematics, ontology,
  instruction set, transaction model, memory model, temporal model,
  governance model, economics, evolution model, and interoperability
  contracts of cognition. Everything else — TypeScript, Rust, IDE
  integrations, Codex, Claude Code, Copilot, Cursor, OpenCode —
  becomes an implementation of that constitution. That mirrors the
  role POSIX played for Unix, LLVM IR for compilers."
- **Related:** spec/CONSTITUTION.md (Articles I-XI, Immutability of the
  Core), MANIFESTO.md (mission + organism architecture), spec/LAWS_OF_
  COGNITIVE_PHYSICS.md (32 laws), spec/CP.md (17-op ISA),
  src/protocol/catalog.ts (instruction metadata), spec/COGNITIVE_
  ONTOLOGY.md, spec/GENOME.md, spec/FORMAL_FOUNDATIONS.md (Parts I-VIII,
  RFC-0005 Part VIII normative), rfc/RFC-0000 (governance spec), CIC
  (transport contract) + conformance + driver compliance, spec/
  VERSION.md (version gate), Platform Zero decision ("the specification
  is the source of truth, not the conversation"), IDEA-0048
  (consolidated normative specification — the POSIX-style doc set),
  IDEA-0083 (specification repository — machine-readable generation),
  ADR-006 (cognitive microkernel — 12 kernel primitives)

## Motivation

The intake's closing claim is a framing claim: the corpus has every
ingredient of a foundational specification — constitution, 32 laws,
17-op ISA, ontology, genome, trace model, governance — but as a
distributed corpus of documents, no single artifact plays the
POSIX/LLVM-IR role. POSIX was one document that defined the contract
so that dozens of Unix implementations could exist; LLVM IR is one
format so that compilers and targets are interchangeable. UCH's
specs are read together, not as one canonical thing; versioning is
per-file; "what must every implementation conform to" is answered by
a reading list, not by one document. The claim: before the next
subsystem, assemble the **Cognitive Constitution of Computing** —
one normative document covering physics, mathematics, ontology,
instruction set, transaction model, memory model, temporal model,
governance, economics, evolution, and interoperability — so that
every future implementation (TypeScript reference runtime, Rust
daemon, IDE drivers, external agent integrations) implements _that_,
and the corpus becomes its exposition.

## The corpus cannot cover it because

The components exist but the canonical artifact does not:
CONSTITUTION.md governs _the organism's_ cognition (rights,
responsibilities, immutable core), not _computing contracts_ for
external implementers; the 32 laws are organism laws; CP.md is the
syscall ABI; nothing assembles these into one implementable contract
set with a single version and a single conformance answer. IDEA-0048
proposes the consolidated normative _document set_; IDEA-0083 the
machine-readable _repository_; this proposal is the _canonical
founding document_ they both reference — the cover contract with the
POSIX role. The relationship (one document vs doc set vs repository)
is itself the first decision the proposal must make.

## Proposal sketch

- One normative document, "The Cognitive Constitution of Computing",
  with eleven sections: physics (RFC-0005 Part VIII and the 32 laws),
  mathematics (IDEA-0093 attention algebra + IDEA-0026 + IDEA-0035
  quantities), ontology (COGNITIVE_ONTOLOGY), instruction set (CP.md +
  catalog), transaction model (WS-D + IDEA-0088), memory model (vmem,
  IDEA-0087 locality), temporal model (cognitive tick + trace
  model), governance (RFC-0000 + SOP-08), economics (IDEA-0016 +
  decision law), evolution (IDEA-0008 + WS-C), interoperability (CIC,
  conformance, driver compliance).
- Role: every implementation references this one document; conformance
  certifies against its sections (each section carries its
  conformance-test reference — the IDEA-0083 repository generates the
  checks); the corpus documents become the exposition of the
  constitution, not parallel authorities.
- Versioning: the constitution is the version gate (spec/VERSION.md
  extends to it); amendments follow RFC-0000 (Laws are immutable —
  the constitution's core is, by definition, never amended, only
  extended).
- Relationship to existing proposals: likely the _cover document_
  that IDEA-0048 structures and IDEA-0083 makes machine-readable —
  one document, one doc set, one repository, one story.

## Risk assessment

- Doc calcification: a canonical document can ossify faster than
  implementations — mitigation: the constitution is a pointer
  structure over the corpus (sections cite, they do not duplicate),
  and the RFC lifecycle governs every amendment.
- Duplication with IDEA-0048: scope collision must be resolved before
  writing — the proposal's first deliverable is the boundary decision
  (constitution = contracts + conformance anchors; 0048 = full
  exposition; 0083 = machine-readable form).

## Where it lands

- `spec/CONSTITUTION-OF-COMPUTING.md` (or as the canonical section
  set of the consolidated specification, per the boundary decision).

## Code impact

- None — document-only; the first implementation impact is the
  conformance gate referencing the constitution's sections.

## Next stage

- Boundary decision vs IDEA-0048/0083, then a section inventory
  mapping every existing spec onto the eleven sections, then the
  document.
