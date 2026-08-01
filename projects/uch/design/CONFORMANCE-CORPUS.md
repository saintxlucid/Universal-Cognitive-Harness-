# CONFORMANCE-CORPUS — specification-to-suite inventory (WS-2)

- **Status:** Landed (2026-08-01) — the data layer of the
  conformance-as-moat program (IDEA-0127 / design/IRREPLACEABILITY.md)
- **Machine counterpart:** `src/protocol/certification-corpus.ts`
  (deterministic registry + coverage report + certification gate,
  12 tests green)
- **Origin:** IDEA-0127 "Next stage" — inventory spec sections vs
  conformance coverage (the ~3000-test → certification gap)

## 1. Purpose

The test suite (~3000 tests / 201 files, 2026-08-01) is raw material:
none of it is gated as a certification corpus, and none of it is
attributed to the normative documents it exercises. This inventory
binds each specification document to the conformance suites that
exercise it, assigns a coverage verdict, and defines the certification
gate that guards any compatibility claim.

## 2. Coverage inventory (10 normative documents)

| Spec document                     | Verdict | Coverage notes                                      |
| --------------------------------- | ------- | --------------------------------------------------- |
| spec/CP.md (ISA)                  | covered | 17-op ABI via CPServer, catalog, MCP bindings       |
| spec/CIR.md                       | covered | Certified on a 71-case corpus (RFC-0004)            |
| spec/CONSTITUTION.md              | covered | Enforced via vetoes, integrity checklist, safe-mode |
| spec/LAWS_OF_COGNITIVE_PHYSICS.md | partial | Law machinery tested; no per-law suite (G-1)        |
| spec/FORMAL_FOUNDATIONS.md        | partial | Physics certified; math foundations untested (G-2)  |
| spec/COGNITIVE_ONTOLOGY.md        | partial | Signal taxonomy covered; entities untested (G-3)    |
| spec/GENOME.md                    | covered | Provenance, versioned restore, expression           |
| spec/EXPRESSION.md                | covered | Gene catalog, mark ledger, benchmark                |
| spec/COGNITIVE_BIOLOGY.md         | partial | Organism covered; spec sections unmapped (G-4)      |
| spec/VERSION.md                   | covered | check:spec-version CI gate                          |

**Totals (gate-valid):** 10 documents — 6 covered, 4 partial, 0 gap,
coverage rate 0.6, zero blocking gaps. The certification gate passes:
every document names a suite, no document is uncovered, and all
kernel-ABI documents (CONSTITUTION, CP, CIR, VERSION) are fully
covered.

### 2.1 Suite mapping (source of truth: src/protocol/certification-corpus.ts)

- **spec/CP.md** — `protocol/__tests__/cp.test.ts`, `__tests__/instruction-catalog.test.ts`,
  `__tests__/mcp-cp.test.ts`, `__tests__/mcp-sse.test.ts`, `protocol/__tests__/spec-repository.test.ts`
- **spec/CIR.md** — `cognitive-compiler/cir.test.ts`, `frontend.test.ts`, `passes.test.ts`,
  `executor.test.ts`, `benchmark/runner.test.ts`
- **spec/CONSTITUTION.md** — `kernel/__tests__/organic-score.test.ts`,
  `kernel/__tests__/coding-principles.test.ts`, `kernel/__tests__/core.test.ts`,
  `__tests__/code-governance-gate.test.ts`, `__tests__/litmus.test.ts`,
  `__tests__/executive-framework-integration.test.ts`, `__tests__/implementation-blueprint.test.ts`,
  `cognitive-plane/__tests__/health-registry.test.ts`
- **spec/LAWS_OF_COGNITIVE_PHYSICS.md** — `engineering-intelligence/__tests__/laws.test.ts`,
  `engineering-intelligence/__tests__/decision-law.test.ts`
- **spec/FORMAL_FOUNDATIONS.md** — `engineering-intelligence/__tests__/failure-physics.test.ts`,
  `engineering-intelligence/__tests__/heldout.test.ts`,
  `engineering-intelligence/__tests__/decision-law.test.ts`, `__tests__/engineering-judgment.test.ts`
- **spec/COGNITIVE_ONTOLOGY.md** — `__tests__/signal-store.test.ts`, `__tests__/nervous-system.test.ts`,
  `nervous-system/__tests__/signal-lifecycle.test.ts`, `nervous-system/__tests__/flow-control.test.ts`,
  `__tests__/epistemic-foundation.test.ts`
- **spec/GENOME.md** — `__tests__/phase4b-provenance-genome.test.ts`,
  `__tests__/organism-versioning.test.ts`, `cognitive-plane/genome/__tests__/expression-engine.test.ts`
- **spec/EXPRESSION.md** — `cognitive-plane/genome/__tests__/expression-engine.test.ts`,
  `cognitive-plane/genome/__tests__/expression-benchmark.test.ts`
- **spec/COGNITIVE_BIOLOGY.md** — `__tests__/organism-features.test.ts`,
  `__tests__/organism-persistence.test.ts`, `__tests__/evolution-system.test.ts`
- **spec/VERSION.md** — `scripts/spec-version-check.mjs` (CI gate)

## 3. Certification gate semantics

`certificationGate(report)` in `src/protocol/certification-corpus.ts`
is green only when:

1. every document names at least one conformance suite;
2. no document carries a `gap` verdict;
3. every kernel-ABI document carries a `covered` verdict.

Partial coverage is acceptable while a suite is named — the partial
verdicts drive the migration list below, not the gate. A green gate
is the precondition for issuing any "UCH Compatible" brand claim
(IDEA-0098): nobody claims compatibility without passing the suite,
and the gate is what makes the claim machine-checkable.

## 4. The migration list (WS-3 — how partial becomes covered)

| Gap                          | What to build                                    | Evidence already in                  |
| ---------------------------- | ------------------------------------------------ | ------------------------------------ |
| G-1: no per-law suite        | Per-law suites for all 32 laws                   | organic-score.test.ts; laws.test.ts  |
| G-2: foundations Parts I-VII | Direct suites for math foundations               | core.test.ts; decision-law.test.ts   |
| G-3: ontology entities       | Suites for Thought/Memory/Evidence/Capability    | signal-store.test.ts; nervous-system |
| G-4: biology sections        | Suites mapping spec sections onto organism tests | organism-features.test.ts            |

Each gap closes with test suites over existing machinery — zero new
features (round-20 freeze discipline). Target: every spec section with
a conformance reference (IDEA-0048) and ≥ 3000 gated cases.

## 5. Path to certification

1. **Landed:** inventory + machine gate (this document + the module).
2. **WS-3:** close G-1..G-4; re-run the gate; the corpus grows to
   per-section coverage.
3. **WS-4/WS-5:** session corpus + profiler feed the corpus with
   real-session evidence (replay → compare → benchmark → optimize).
4. **Branding:** the gate becomes a release gate; certification
   evidence follows CONFORMANCE-AND-CERTIFICATION.md; brands per
   IDEA-0098.
