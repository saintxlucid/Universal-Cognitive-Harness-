# Cognitive Intermediate Representation (CIR) — Specification

- **Status:** Specification (normative) — RFC-0004 Accepted 2026-08-01
- **Version:** 1.0.0 (tracks `CIR_VERSION`, `src/cognitive-compiler/cir.ts`)
- **Governing RFC:** rfc/RFC-0004-cognitive-intermediate-representation.md
  (normative requirements R1–R6, benchmark contract §14, conformance §13)
- **Related:** spec/CP.md (the ABI), src/protocol/catalog.ts (instruction
  metadata), design/COGNITIVE-TRACE.md, design/STACK.md
- **Research:** research/foundations/08-cir-compiler.md
- **Supersedes:** design/CIR.md (historical design record)

## 1. Thesis

CP (spec/CP.md) is the **syscall ABI** of the Cognitive OS: the stable
surface between the substrate and its clients. CIR is the **intermediate
representation** of the same substrate: the instruction stream the kernel
executes *after* a client's intent has been compiled and *before* any
inference engine runs.

The analogy is exact:

| LLVM | UCH |
| --- | --- |
| Source language frontend | Pilot drivers (Claude, Codex, Cursor, VS Code, ...) |
| LLVM IR | **CIR** |
| Optimizer passes | Cognitive passes |
| Code generator | Scheduler → inference fabric |
| Object file | Verified, traced execution record |

The kernel never sees English. English — like every driver's native
expression — is a *frontend* artifact. Everything compiles to CIR.

## 2. Instruction model

A CIR instruction is an encoding of a cognitive operation:

```text
CIR-I { op: CPOp;            // semantic operation (catalog.ts, 17 today)
        operands: Operand[]; // typed operands, not free text
        energy: number;      // metabolic cost (1-10)
        verify: VerifyReq;   // required verification level
        provenance: ProvenanceRef; // trace linkage (W3C span id)
        deadline?: Tick;     // cognitive tick deadline
        scope: ScopeRef;     // grant/projection scope
        depends?: string[];  // instruction ids this one needs first
      }
```

Operand forms: `{ literal: unknown }`, `{ ref: storeKey }` (memory,
belief, knowledge-graph id), `{ query: string }` (retrieval intent;
must carry a `policy` of scope + verification level), `{ composite:
CIR-I[] }` (sub-stream; nesting capped at 32 levels, RFC-0004 §17).
Operands are typed; free text is permitted ONLY inside `query` operands.

## 3. Instruction classes

| Class | Ops (catalog set) | Executes on | Deterministic |
| --- | --- | --- | --- |
| Perceptual | observe, ingest, diff, scan | sensors / drivers | yes |
| Cognitive | recall, retrieve, verify, plan, simulate, reflect, consolidate, dream, merge, prune | kernel organs | yes |
| Delegated | infer, evaluate, critique, predict | inference fabric | no (opaque) |

Only Delegated instructions consume inference energy. A pathology in
the perceptual/cognitive classes is diagnosable without any model
call — the reflex fast path and the Observatory depend on this
property.

## 4. Pipeline (normative order)

```text
1. Frontend (driver-owned): native expression → Intent
2. CIR builder (substrate): Intent → CIR stream          [compile]
3. Optimizer: passes of §6 in fixed order                 [optimize]
4. Scheduler: accelerators/scheduler.ts → tier/provider      [schedule]
5. Execution: fabric + kernel organs                        [execute]
6. Verification: Law 31 gates                                [verify]
7. Learning: filing, consolidation, skill update            [learn]
```

Stage 2–6 are substrate-owned. Stage 1 is driver-owned; the substrate
validates its output (conformance) and MUST NOT parse English itself.

## 5. Determinism and delegation

- Perceptual + Cognitive: same stream + same store state ⇒
  byte-identical execution record (RFC-0004 §7).
- Delegated: the record captures (request, response, latency,
  confidence) as an opaque payload; replay of a delegated instruction
  substitutes the recorded payload (ADR-002 replay mode) so the
  surrounding stream stays deterministic.
- Wall clock is banned from instruction semantics; ordering uses the
  cognitive tick (protocol/catalog.ts `nextCognitiveTick`).
- A system with zero delegators executes all Perceptual/Cognitive
  streams — a fully diagnosable, deterministic organism subset (CVM
  deterministic subset, IDEA-0045).

## 6. Optimizer passes (normative set, fixed order)

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
identical reports (the benchmark corpus asserts this).

## 7. Verification gates (Law 31)

| verify level | Requirement |
| --- | --- |
| none | no gate |
| structural | operands resolve, scope satisfies projection, energy within budget |
| constitutional | structural + integrity checklist + organic-score veto (kernel/constitution) |

- evaluate, critique, predict MUST default to `constitutional`
  (catalog.ts verification requirement).
- A failed gate aborts the stream with a structured verdict; the
  verdict is ledgered as a trace event.

## 8. Versioning

- CIR version: semantic, starts at `1.0.0`; minor = additive (new
  optional operand fields only); any semantic change to existing
  instructions bumps major.
- Every stream header: `{ cir: "1.0.0", requires_cp: "^1.0",
  compiled_by: <driver id>, compiled_at_tick: <tick> }`.
- Hosts reject streams whose `requires_cp` range excludes the host CP
  version (CP major gate, spec/CP.md §3).

## 9. Trace contract

- `cir:compiled` (stream header, instruction count, energy estimate)
- `cir:pass` (PassReport per pass)
- `cir:gate` (verification verdict per gate level)
- `cir:executed` (per instruction: op, class, duration ticks,
  energy, outcome)
- `cir:delegated` (delegation request/response payloads)
- `cir:rejected` (stream rejection with reason)

Every event carries the stream's traceparent (ADR-002). A CIR program
is therefore fully replayable (Law 12).

## 10. Conformance and reference implementation

- Conformance levels and the benchmark corpus contract: RFC-0004 §13–§14.
- Reference implementation: `src/cognitive-compiler/` (cir, frontend,
  passes, executor, benchmark). Conformance is asserted by
  `src/cognitive-compiler/benchmark/runner.ts`; CLI surface:
  `uch cir <compile|optimize|execute|benchmark>`.
- Certification of the reference implementation against the corpus at
  its claimed CIR level is a precondition for CIR-level driver
  certification (src/drivers/compliance.ts).

*Status: Specification (normative). Promoted from design/CIR.md at
RFC-0004 Acceptance; corpus 0.3.0 → 0.4.0 (minor, additive).*
