# RFC-0004 — Cognitive Intermediate Representation (CIR)

- **Status:** Accepted (2026-08-01) — three reviews passed (see §17);
  promoted to `spec/CIR.md`; reference implementation certified by the
  benchmark corpus (§14)
- **Author:** UCH platform corpus · **Date:** 2026-08-01
- **Depends on:** CP v1 (spec/CP.md), catalog.ts instruction metadata,
  ADR-002 trace ledger, ADR-006 microkernel boundary
- **Research:** research/foundations/08-cir-compiler.md

## 1. Summary

CIR is the intermediate representation of the Cognitive OS: the
instruction stream a client's intent becomes after frontend
compilation and before inference execution. The kernel never sees
English; every driver compiles its native expression to CIR; the
substrate validates, optimizes, schedules, executes, and verifies it.
This RFC promotes the design (design/CIR.md) to a normative
specification and defines the reference-implementation contract.

## 2. Motivation (condensed)

1. The runtime never sees English (frontend artifacts stop at the
   substrate boundary).
2. Optimization happens before inference, deterministically and
   law-governed — "prompt engineering" becomes compiler passes.
3. One semantics across every driver: cognition is comparable,
   replayable, portable (Law 32).
4. Energy accounting is mechanical: every instruction carries a
   metabolic cost (catalog.ts).

## 3. Normative requirements

A conforming CIR implementation MUST:

- **R1** Accept and validate CIR streams per §4–§5; reject
  non-conforming streams with a structured error (never silently
  coerce).
- **R2** Implement the pipeline stages of §6 in order; every stage
  MUST write its pass/execution report to the trace ledger
  (ADR-002) as an event.
- **R3** Keep Perceptual and Cognitive instruction execution
  deterministic per §7; Delegated execution MUST be isolated behind
  the delegation interface (§8) so determinism resumes after it.
- **R4** Enforce the verification gates of §9 before execution; a
  failed gate MUST prevent execution (Law 31).
- **R5** Version streams per §10 and reject streams whose
  `requires_cp` range is unsatisfied by the host CP version.
- **R6** Never import vendor SDKs or call inference engines inside
  kernel-owned modules (ADR-006 kernel boundary); delegation is an
  interface, not an import.

## 4. Instruction model

```text
CIR-I {
  id: string,                // stream-unique instruction id
  op: CPOp,                  // semantic operation (catalog.ts, 17 today)
  class: 'perceptual' | 'cognitive' | 'delegated',
  operands: Operand[],       // typed operands, not free text
  energy: number,            // metabolic cost (1-10, from catalog)
  verify: 'none' | 'structural' | 'constitutional',
  provenance: ProvenanceRef, // W3C span id linkage (ADR-002)
  scope: ScopeRef,           // grant/projection scope (ADR-001)
  deadline?: Tick,           // cognitive tick deadline
  depends?: string[]         // instruction ids this one needs first
}
```

Operand forms: `{ literal: unknown }`, `{ ref: storeKey }` (memory,
belief, knowledge-graph id), `{ query: string }` (retrieval intent),
`{ composite: CIR-I[] }` (sub-stream). Operands are typed; free text
is permitted ONLY inside `query` operands, and every `query` operand
MUST have a `policy` (scope + verification level).

## 5. Instruction classes

| Class | Ops (catalog set) | Executes on | Deterministic |
| --- | --- | --- | --- |
| Perceptual | observe, ingest, diff, scan | sensors / drivers | yes |
| Cognitive | recall, retrieve, verify, plan, simulate, reflect, consolidate, dream, merge, prune | kernel organs | yes |
| Delegated | infer, evaluate, critique, predict | inference fabric | no (opaque) |

Only Delegated instructions consume inference energy. A pathology in
the perceptual/cognitive classes is diagnosable without any model
call — the reflex fast path and the Observatory depend on this
property.

## 6. Pipeline (normative order)

```text
1. Frontend (driver-owned): native expression → Intent
2. CIR builder (substrate): Intent → CIR stream          [compile]
3. Optimizer: passes of §11 in fixed order                 [optimize]
4. Scheduler: accelerators/scheduler.ts → tier/provider      [schedule]
5. Execution: fabric + kernel organs                        [execute]
6. Verification: Law 31 gates (§9)                          [verify]
7. Learning: filing, consolidation, skill update            [learn]
```

Stage 2–6 are substrate-owned. Stage 1 is driver-owned; the substrate
validates its output (conformance) and MUST NOT parse English itself.

## 7. Determinism contract

- Perceptual + Cognitive: same stream + same store state ⇒
  byte-identical execution record.
- Delegated: the record captures (request, response, latency,
  confidence) as an opaque payload; the surrounding stream remains
  deterministic. Replay of a delegated instruction re-runs the same
  request through the same provider profile, or substitutes the
  recorded payload when replay fidelity is required (ADR-002 replay
  mode).
- Wall clock is banned from instruction semantics; ordering uses the
  cognitive tick (protocol/catalog.ts `nextCognitiveTick`).

## 8. Delegation interface

```text
Delegator {
  dispatch(instr: DelegatedInstr, profile: ProviderProfile): Promise<DelegatedResult>
  // DelegatedResult { payload, confidence, latencyMs, traceparent }
}
```

The reference implementation provides a no-op default (throws
`not_configured`) and a pluggable registry. A system with zero
delegators executes all Perceptual/Cognitive streams — a fully
diagnosable, deterministic organism subset (CVM deterministic subset,
IDEA-0045).

## 9. Verification gates (Law 31)

| verify level | Requirement |
| --- | --- |
| none | no gate |
| structural | operands resolve, scope satisfies projection, energy within budget |
| constitutional | structural + integrity checklist + organic-score veto (kernel/constitution) |

- evaluate, critique, predict MUST default to `constitutional`
  (catalog.ts verification requirement).
- A failed gate aborts the stream with a structured verdict; the
  verdict is ledgered as a trace event.

## 10. Versioning

- CIR version: semantic, starts at `1.0.0`; minor = additive
  (new optional operand fields only); any semantic change to
  existing instructions bumps major.
- Every stream header: `{ cir: "1.0.0", requires_cp: "^1.0",
  compiled_by: <driver id>, compiled_at_tick: <tick> }`.
- Hosts reject streams whose `requires_cp` range excludes the host CP
  version (CP major gate, spec/CP.md §3).

## 11. Optimizer passes (normative set, fixed order)

Each pass is a pure function `CIR[] → { stream: CIR[], report:
PassReport }`. PassReport = `{ pass, changed, rationale, energyDelta,
tokenDelta }`; reports are trace events. Peephole passes may iterate
until fixpoint (max 4 iterations, then report `no_fixpoint` and stop —
never loop).

| # | Pass | Function | Law |
| --- | --- | --- | --- |
| P1 | Normalize | canonical operand form, dedupe operands | 8 |
| P2 | Deduplicate | merge identical instructions (memoization) | 2 |
| P3 | Inject Context | attach verified memory per retrieval policy | 31 |
| P4 | Memory Entropy Reduction | collapse redundant retrievals; one strong source | 5 |
| P5 | Contradiction Elimination | quarantine conflicting beliefs before use | 4 |
| P6 | Context Compression | pack instructions into tightest window | 2 |
| P7 | Knowledge Promotion | promote verified facts into operands | 31 |
| P8 | Evidence Verification | check evidence chains of factual operands | 31 |
| P9 | Hallucination Detection | flag operands lacking provenance | 3 |
| P10 | Goal Simplification | reduce goals to primitives (task fusion) | 11 |
| P11 | Architecture Validation | reject out-of-projection instructions | 29 |
| P12 | Task Fusion | merge sub-goals into composites | 14 |
| P13 | Skill Injection | bind proven skills to matching instructions | 22 |
| P14 | Reasoning Depth | allocate depth by stake, not habit | 24 |
| P15 | Context Window Packing | minimize tokens per instruction | 2 |
| P16 | Energy Optimization | reorder within budget compliance | 21 |
| P17 | Trust Reweighting | scale authority by operand trust | 27 |

Determinism requirement: identical input ⇒ identical output and
identical reports (the benchmark corpus asserts this, §13).

## 12. Trace contract

- `cir:compiled` (stream header, instruction count, energy estimate)
- `cir:pass` (PassReport per pass)
- `cir:gate` (verification verdict per gate level)
- `cir:executed` (per instruction: op, class, duration ticks,
  energy, outcome)
- `cir:delegated` (delegation request/response payloads)
- `cir:rejected` (stream rejection with reason)

Every event carries the stream's traceparent (ADR-002). A CIR program
is therefore fully replayable (Law 12).

## 13. Conformance and certification

- **CIR-L1 validate**: accepts/rejects streams per §4–§5, version
  gate per §10.
- **CIR-L2 compile**: Intent → CIR builder per §6 stage 2.
- **CIR-L3 optimize**: all 17 passes with reports.
- **CIR-L4 verify**: full pipeline incl. gates + trace contract.

The reference implementation MUST pass the benchmark corpus (§14) at
its claimed level; conformance is asserted by
`src/cognitive-compiler/benchmark/runner.ts`.

## 14. Benchmark corpus (contract)

The corpus (deterministic, no model calls) MUST show:

1. **Determinism**: identical trace records across 3 runs of every
   case.
2. **Pass effects**: for each pass ≥ 2 cases where the pass changes
   the stream and 1 where it does not; changed cases assert the
   specific transformation (e.g., P6 reduces token estimate).
3. **Energy accounting**: every executed stream reports energy ≤
   budget when P16 runs; energy totals equal the sum of instruction
   costs.
4. **Gate enforcement**: constitutional-gate cases are rejected with
   structured verdicts; `verify: 'none'` cases never hit gates.
5. **Version gate**: streams with unsatisfied `requires_cp` are
   rejected (R5).
6. **Negative controls**: streams that should NOT be transformed are
   left unchanged (byte-identical after optimize when no pass fires).

## 15. Open items (post-Acceptance)

- Binary encoding (JSON v1 is normative; binary is a later encoding
  of the same semantics).
- Skill Injection and Knowledge Promotion need organ bindings
  (skills registry, verified-fact store) — the reference
  implementation ships deterministic fallbacks until binding lands.
- Learning stage (pipeline stage 7) is specified as a hook; the
  sleep-cycle organ is the first consumer.

## 16. Gate check (SOP-09)

G1 Scientific — pass (evidence in research register). G2 Architectural
— pass (kernel boundary R6; existing scheduler/fabric reused). G3
Engineering — pass (pure passes, deterministic, benchmark contract).
G4 Biological — pass (compilation = parsing experience). G5 Economic —
pass (each pass carries token/energy delta; inference cost reduction is
measurable).

## 17. Reviews (2026-08-01)

### Architecture review — PASS

- **Additive:** `src/cognitive-compiler/` is a new module (`cir.ts` —
  types/encoding/validation/versioning, `frontend.ts` — Intent→CIR
  builder, `passes.ts` — 17-pass optimizer, `executor.ts` — dispatch +
  gates + trace contract, `benchmark/` — corpus + runner). Exports were
  appended to `src/index.ts`; the CLI gained a `cir` subcommand
  (`compile`/`optimize`/`execute`/`benchmark`). No existing module
  behavior changed.
- **Kernel boundary (R6):** the module imports only `protocol/cp.js`
  (the CP vocabulary) and `protocol/catalog.js` (instruction metadata)
  plus internal modules — zero vendor SDKs, zero new runtime
  dependencies (ADR-006). Delegation is an interface, not an import.
- **Deterministic subset (§7):** FNV-1a stream ids and traceparents,
  cognitive-tick ordering (wall clock banned), `stableStringify`
  canonical encoding, pure passes with reports; Delegated execution is
  isolated behind the `Delegator` interface or ADR-002 replay
  substitution (`replayPayloads`) so determinism resumes after it.
- **Pipeline §6 stages 2–6:** frontend compiles a *normalized Intent*
  (structured goal; the substrate never parses English — stage 1 stays
  driver-owned per research register §4), optimizer runs the 17 passes
  in fixed order, executor enforces gates and writes the trace
  contract; energy comes from catalog.ts metadata via `energyCostOf`.
- **Reuse:** scope fields mirror ADR-001 projections; the constitutional
  gate is pluggable (`constitutionalGate` option) — the organic-score /
  IDEA-0053 hookup point.

### Security review — PASS (one hardening landed)

- **No exec surface:** the module performs pure computation over
  in-memory streams — no command construction, no path handling, no
  external calls, no new dependencies (no supply-chain surface). The
  only I/O is JSON parsing of stream text.
- **Strict validation (R1):** `validateStream`/`decodeStream` reject
  non-conforming streams with structured errors: ops checked against
  `CIR_OPS`, verify levels enumerated, operand kinds enumerated, query
  policies required, duplicate ids and dangling `depends` rejected
  (id universe resolved across the whole stream incl. nested
  composites).
- **Finding (fixed before acceptance):** composite operands had
  unbounded recursion — an adversarial deeply-nested stream could
  overflow the stack (uncaught `RangeError`) instead of producing a
  structured rejection. Fixed with `MAX_COMPOSITE_DEPTH = 32`,
  guarding both the id-universe collector and the operand walk;
  regression test added in `cir.test.ts`.
- **Delegation surface:** `Delegator` is an interface with a
  `not_configured` default — no configured delegator means rejection,
  never a model call. Energy budgets are plain numbers and enforced as
  a hard gate; there is no configuration-injection surface.

### Constitution check — PASS

- **Law 31 (no unverified execution):** gates run before every
  instruction; a failed gate aborts the stream with a structured
  verdict (never execution); `verify: 'none'` never hits a gate.
- **Law 3 (no unproven claims):** the default constitutional gate
  rejects delegated instructions lacking provenance; P9
  (Hallucination Detection) flags provenance-less delegated ops.
- **Law 21 (energy):** per-stream budget is a hard gate and energy
  accounting is exact (`energySpent` = sum of instruction costs —
  asserted by the corpus).
- **Law 12 (traceable):** every event carries the stream traceparent;
  `cir:compiled`/`cir:pass`/`cir:gate`/`cir:executed`/`cir:delegated`/
  `cir:rejected` are all ledgered — a CIR program is replayable.
- **Law 8 (no needless complexity):** pure functions, fixed pass order,
  small surface; peephole iteration capped at 4 with an explicit
  `no_fixpoint` report.
- **Laws 2/4/5/27** are implemented as passes (deduplicate,
  contradiction-elimination, memory-entropy-reduction, trust-
  reweighting); **Law 32** (portability) is the stream discipline
  itself — one semantics across drivers, identified by `compiled_by`.

*Status: Accepted. Prototype → Benchmark → Reviews → Acceptance complete;
promoted to `spec/CIR.md` (corpus 0.3.0 → 0.4.0, minor: additive
normative spec). Post-Acceptance open items in §15 remain open.*
