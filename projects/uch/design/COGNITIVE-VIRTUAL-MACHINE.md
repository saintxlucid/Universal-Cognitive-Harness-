# Cognitive Virtual Machine (CVM) — Design

Status: **Prototype** (idea → research → design → prototype; P1
implemented 2026-08-01 at `src/cognitive-plane/cvm/`). Source idea:
`rfc/ideas/IDEA-0045` (Research + Prototype). Relationship: CIR
(`rfc/RFC-0004`, Accepted) is the LLVM-IR of cognition; the CVM is its
JVM/CLR — the execution engine that runs cognitive programs on any
model, as if models were interchangeable processors.

## 1. Problem

Cognition today is written as bespoke code per capability: a scheduler
here, a verifier there, each hardwired to its model calls. There is no
portable cognitive program — nothing you can compile once and run on any
backend, with scheduling, memory, transactions, and governance provided
by the platform instead of by each capability.

## 2. Proposal

A **Cognitive Virtual Machine**: executes **Cognitive Bytecode** — the
compiled form of CIR (RFC-0004) over the CP 17-op ISA (`spec/CP.md`).
Every model (OpenAI, Anthropic, Gemini, DeepSeek, local, future) becomes
one execution backend behind a device interface. The CVM owns what the
CP server already names as its ABI, plus what ADR-006 assigns to the
kernel:

| Concern               | Provided by                                                       |
| --------------------- | ----------------------------------------------------------------- |
| Scheduling            | ADR-004 fabric + virtual processors (dispatch = device selection) |
| Memory                | WS-B cognitive vmem (Hot→Warm→Cold→Archive)                       |
| Transactions          | WS-D propose→verify→commit/rollback                               |
| Verification          | Constitution gate + step-critic as a CIR pass                     |
| Identity / governance | CIC envelope + grant containment (ProjectionEngine)               |
| Determinism           | deterministic CP-op subset vs opaque inference class              |

## 3. Instruction model

Three instruction classes (inherited from CIR, RFC-0004):

| Class        | Ops                                                    | Determinism                                                                   |
| ------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `perceptual` | ingest, normalize, extract (reality pipeline)          | deterministic                                                                 |
| `cognitive`  | recall, compress, transform, merge, evaluate, critique | deterministic (CP ops)                                                        |
| `delegated`  | inference, generation, planning-to-text                | opaque — a single op with declared energy/latency, executed by a model device |

The `delegated` class is the boundary: the CVM treats a model call like
an I/O instruction — schedule it, budget it, verify its result, and roll
back on failed verdict. Models never touch kernel state directly; they
emit artifacts into a transaction.

## 4. Execution model

1. **Decode**: bytecode → CP ops (+ delegated ops for model work).
2. **Schedule**: ops → cognitive clock ticks (catalog.ts), energy
   budget check (Energy Manager); delegated ops → provider selection
   (cheapest healthy device for the declared tier).
3. **Execute**: perceptual/cognitive ops run deterministically in the
   vmem-addressed space; delegated ops run on the chosen model device.
4. **Verify**: result passes the constitution gate (integrity laws +
   covenant laws + organic score) — WS-D `propose` → `verify` → `commit`
   or `rollback` to the last committed cognitive state.
5. **Commit**: trace ledger records the op (OTel span), the decision
   journal records the outcome; the Connectome absorbs the result.

Deterministic subset = replayable: the same bytecode + same inputs + same
device logs must reproduce the same committed state (ADR-002 replay is
the audit trail; UER ingests the traceparent spine).

## 5. Device interface (models as processors)

```text
interface ModelDevice {
  id: string;
  tier: 'tiny' | 'standard' | 'deep';       // ADR-004 required tier
  invoke(op: DelegatedOp, context: CicEnvelope): ModelArtifact;
  energyPerCall: number; latencyProfile: { p50: number; p95: number };
  capabilities: CP_VERBS[];                  // driver compliance, L0–L4
}
```

Registration in the ADR-004 provider registry with conformance
certification (driver compliance `certificateLine()`): a device that
cannot honor an op's declared energy/latency budget is not scheduled for
that op. This is the "interchangeable cognitive processors" claim made
operational.

## 6. Governance

- Laws are enforced at **decode and commit points** — not inside
  capability code (IDEA-0053 Constitution Engine is the CVM's hookup).
- The constitution gate already exists as a check prefix on
  evaluate/critique ops (CP catalog verification requirement).
- Immutability: the kernel ABI list (CP v1, trace model, manifest
  schema, CIC envelope) is exactly the set the CVM must not rewrite.

## 7. Dependencies and boundaries

- **Blocked on:** RFC-0004 CIR reaching Specification — the bytecode
  format must not freeze before the IR it compiles from. **Unblocked
  2026-08-01**: RFC-0004 Accepted with reference implementation
  (`11f5670`); P1 prototype landed (`src/cognitive-plane/cvm/`).
- **Non-goals:** the CVM does not implement the Laws; it enforces them.
  It does not provide cognition; it executes cognitive programs.
- **Non-dependency:** the CVM does not require any specific model — the
  device interface is the only contract with inference.

## 8. Phases

1. **P1 (implemented 2026-08-01):** CP-op interpreter over the existing
   CP server surface (17 ops, catalog metadata) — deterministic subset
   first. Prototype: `src/cognitive-plane/cvm/` — bytecode envelope
   (`bytecode.ts`, decode-time verification), device interface
   (`device.ts`, certification), machine (`machine.ts`):
   deterministic eval of perceptual/cognitive ops, delegated dispatch
   to certified `ModelDevice`s, WS-D propose→verify→commit/rollback per
   node, tick-ordered trace, `replay()` determinism reports,
   checkpoint/resume, branch/merge. 24 tests green.
2. **P2 (next):** CIR frontend compiling to bytecode (RFC-0004 landed).
3. **P3:** device registry + provider routing (ADR-004 integration).
4. **P4:** conformance suite: golden bytecode programs, replay
   determinism checks, transaction rollback drills.
