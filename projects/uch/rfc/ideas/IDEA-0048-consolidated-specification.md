# IDEA-0048 — Consolidated Normative Specification

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Foundation 0) — "the biggest
  missing piece: one UCH SPECIFICATION like POSIX/USB/TCP/IP/LLVM/WASM
  defining Cognitive ABI, Cognitive ISA, Signal Specification, Memory
  Specification, Driver Specification, Genome Specification, Organ
  Specification, Signal Timing, Transactions, Persistence, Determinism.
  The implementation follows the specification — never the opposite"
- **Related:** spec/ (CP v1.0.0, CONSTITUTION, LAWS, GENOME,
  COGNITIVE_ONTOLOGY, VERSION.md 0.2.0, EVENT-GOVERNANCE),
  design/STACK.md (six-layer stack, independent versioning), RFC-0000
  (governance), CIC v0.1 (driver contract), conformance.ts + driver
  compliance.ts (certification), the Platform Zero decision
  (spec-first: "the specification is the source of truth, not the
  conversation"), MANIFESTO

## Motivation

The corpus is already specification-first by decision: `spec/` holds the
Laws, Constitution, Genome, ontology, and CP; RFC-0000 governs changes;
conformance and driver compliance certify implementations. The claim:
what is missing is the *single consolidated normative document set* a
third party implements against — one UCH SPECIFICATION in the POSIX/USB
sense — plus formal sections that do not exist anywhere yet: signal
timing, determinism, and persistence contracts as normative text.

## The corpus cannot cover it because

Specs are distributed across `spec/` and `design/` with uneven maturity
(CP is normative; STACK is a design doc; timing/determinism are
scattered in catalog.ts and the CVM idea). No single artifact answers
"what must an implementation satisfy to be UCH-compatible" end to end.

## Proposal sketch

- Consolidate the normative document set (Book IV Standards) with a
  stable versioning spine: ABI (CP), ISA (CP + instruction catalog),
  signals (event schema), memory (vmem + stores), drivers (CIC +
  L0–L4), genome, organs (MANIFESTO §6 contracts), timing (cognitive
  clock), transactions (WS-D), persistence (Storable + .uccp),
  determinism (CVM subset).
- Every section carries a conformance-test reference; a section without
  one is a draft, not normative.

## Risk assessment

- Consolidation theater: a spec that does not drive conformance tests
  is documentation, not specification.

## Where it lands

- Extends STACK.md; design doc `design/SPECIFICATION.md`.

## Code impact

- None; governance artifact. First step is a section gap-analysis
  (exists / drafted / missing).

## Next stage

Gap-analysis each section against `spec/` + `design/`; draft the
normative text for the missing sections (timing, determinism,
persistence).
