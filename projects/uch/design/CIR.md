# Cognitive Intermediate Representation (CIR)

- **Status:** Superseded (2026-08-01) — promoted to `spec/CIR.md`
  (normative) at RFC-0004 Acceptance; kept as the historical design
  record (Law 12)
- **Related:** spec/CP.md (the ABI), src/protocol/catalog.ts (instruction metadata), design/COGNITIVE-TRACE.md, design/STACK.md
- **Date:** 2026-08-01

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

The kernel should never see English. English — like every driver's native
expression — is a *frontend* artifact. Everything compiles to CIR.

## 2. Why this is needed

1. **The runtime never sees English.** Prompts, tool calls, and session
   content are frontend formats. The kernel executes instructions.
2. **Optimization before inference.** Today's "prompt engineering" becomes
   compiler passes that run deterministically before a model is ever called —
   measurable, testable, and law-governed.
3. **A single semantics.** Every pilot compiles into the same instruction
   semantics, so cognition is comparable, replayable, and portable across
   pilots (Law 32).
4. **Energy accounting.** Every CIR instruction carries an energy cost
   (catalog.ts already assigns 1–10 per CP op), making metabolism (Law 2,
   Law 21) mechanical.

## 3. Instruction model

A CIR instruction is an encoding of a cognitive operation:

```text
CIR-I { op: CPOp;            // semantic operation (catalog.ts, 17 today)
        operands: Operand[]; // typed operands, not free text
        energy: number;      // metabolic cost (1-10)
        verify: VerifyReq;   // required verification level
        provenance: ProvenanceRef; // trace linkage (W3C span id)
        deadline?: Clock;    // cognitive tick deadline
        scope: ScopeRef;     // grant/projection scope
      }
```

Three instruction classes:

| Class | Examples | Executes on |
| --- | --- | --- |
| **Perceptual** | observe, ingest, diff, scan | Sensors / drivers |
| **Cognitive** | recall, retrieve, verify, plan, simulate, reflect, generalize, consolidate, dream, prune, merge | Kernel organs |
| **Delegated** | infer, evaluate, critique, predict | Inference fabric (models) — the only class that touches an LLM |

Only the Delegated class consumes inference energy. A system whose cognitive
pathology is all in the perceptual/cognitive classes can be diagnosed without
calling a model at all — this is what makes the reflex fast path and the
Observatory possible.

## 4. Pipeline

```text
Driver expression (English, JSON, tool call, ...)
    ↓  [frontend: per-driver compiler]
Intent (normalized semantic goal)
    ↓  [CIR builder: intent → instruction stream]
CIR
    ↓  [optimizer: passes below]
Optimized CIR
    ↓  [scheduler: accelerators/scheduler.ts]
Scheduled instructions (tier, provider, deadline)
    ↓  [execution: fabric + kernel organs]
Execution record
    ↓  [verification: Law 31 gates]
Verified record
    ↓  [learning: filing, consolidation, skill updates]
Memory + skills + trace
```

Every stage is deterministic except Delegated execution. Every stage writes
to the trace ledger (design/COGNITIVE-TRACE.md), so a CIR program is fully
replayable (Law 12).

## 5. Optimizer passes (cognitive compilation)

Analogous to LLVM passes — deterministic, testable, law-governed:

| Pass | Function | Law |
| --- | --- | --- |
| Normalize | Canonical instruction form, dedupe operands | 8 |
| Deduplicate | Merge identical instructions (memoization) | 2 |
| Inject Context | Attach verified memory per retrieval policy | 31 |
| **Memory Entropy Reduction** | Collapse redundant retrievals; prefer one strong source | 5 |
| **Contradiction Elimination** | Detect and quarantine conflicting beliefs before use | 4 |
| **Context Compression** | Pack instructions into the tightest window | 2 |
| **Knowledge Promotion** | Promote verified facts into instruction operands | 31 |
| **Evidence Verification** | Check evidence chains of every factual operand | 31 |
| **Hallucination Detection** | Flag instructions whose operands lack provenance | 3 |
| **Goal Simplification** | Reduce goals to primitives (task fusion) | 11 |
| **Architecture Validation** | Reject instructions outside the projection scope | 29 |
| **Task Fusion** | Merge sub-goals into composite instructions | 14 |
| **Skill Injection** | Bind proven skills to matching instructions | 22 |
| **Reasoning Depth Optimization** | Allocate depth by stake, not by habit | 24 |
| **Context Window Packing** | Minimize tokens per instruction (frugality) | 2 |
| **Energy Optimization** | Reorder for budget compliance | 21 |
| **Trust Reweighting** | Scale instruction authority by operand trust | 27 |

Passes run in a fixed order (peephole passes may iterate). Each pass is a pure
function: `CIR[] → CIR[]` with a pass report (what changed, why, energy delta).
Pass reports are trace events — the organism can explain its own compilation.

## 6. Relationship to the existing corpus

| Artifact | Role |
| --- | --- |
| spec/CP.md v1 + src/protocol/catalog.ts | The instruction vocabulary (ops, energy, verification) — CIR's op set is `CP_OPS`, extended additively |
| accelerators/scheduler.ts + virtual-processors.ts | The scheduling stage of the pipeline (already implemented) |
| reflex fast-path (src/agentic/fastpath/) | Zero-LLM resolution *before* CIR is needed — the front of the pipeline |
| cognitive-trace.ts | The execution record format — CIR programs compile into traces |
| context-compressor (src/kernel/retrieval/) | A prototype of the Context Compression pass |
| organic-score (src/kernel/constitution/) | The Architecture Validation pass's veto substrate |
| engineering-intelligence layer | A prototype of Architecture Validation + Hallucination Detection for code |

Several "passes" already exist as organs; CIR is the discipline that makes
them a compiler instead of a toolbox.

## 7. Open questions (RFC-0004 scope)

1. **Encoding:** text/JSON (debuggable, CP-compatible) vs binary (fast)? —
   recommendation: JSON v1, binary later behind the same semantics.
2. **Granularity:** instruction-per-op (CP-aligned) vs higher-level composite
   instructions (task fusion)? — recommendation: both, composites compiled
   down to primitives.
3. **Frontend contract:** who compiles driver expressions into CIR — the
   driver (per-ecosystem compiler) or the substrate (a generic parser)? —
   recommendation: drivers compile; the substrate validates (conformance).
4. **Verification gates:** which instructions require constitutional gates
   before execution (evaluate/critique already do in catalog.ts)?
5. **Iteration:** does CIR itself get a version, or does it inherit CP's
   version? — recommendation: CIR version = CP version + 1 minor (CIR v1.1
   tracks CP v1.0); independent only if the encoding diverges.

## 8. Gate check

G1 Scientific — pass (IR-based compilation is the proven core of LLVM/GCC;
optimizer passes are standard compiler architecture).
G2 Architectural — pass (all passes enforce Laws; none violate).
G3 Engineering — pass (pure functions, deterministic, benchmarkable; the
existing passes already have tests).
G4 Biological — pass (compilation = the organism's parsing of experience;
passes = reflexes that run before deep processing).
G5 Economic — pass (inference cost reduction is the measurable ROI; every
pass has a token/energy delta).

*Status: Draft. Proceed to RFC-0004 "CIR" under SOP-08.*
