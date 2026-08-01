# IDEA-0045 — Cognitive Virtual Machine (CVM)

- **Status:** Research + Prototype (SOP-08 stages 2/4; P1 implemented
  `src/cognitive-plane/cvm/` 2026-08-01)
- **Origin:** Vision intake 2026-08-01 — "the biggest invention isn't
  UCH itself but something underneath it: a CVM like the JVM/CLR that
  executes cognitive bytecode. Every model becomes one execution
  backend. The CVM handles scheduling, memory, transactions,
  simulation, verification, rollback, governance, identity, and
  deterministic execution where possible"
- **Related:** RFC-0004 (CIR — the cognitive IR), ADR-006 (cognitive
  microkernel — process model WS-A, vmem WS-B, transactions WS-D),
  ADR-004 (virtual processors + inference fabric), spec/CP.md (17-op
  ABI), CIC (instruction envelope), src/kernel/transactional

## Motivation

CIR is the design of the IR; CP is the ABI; kernel services exist as
facilities; the fabric treats models as providers. The claim: unify
them as an execution machine — a CVM that interprets CIR programs
(compiled to CP ops) with the kernel as its runtime facilities
(scheduling via the process table, memory via vmem, transactions via
WS-D, verification via gates, rollback via reversibility Law 12), so
OpenAI/Anthropic/Gemini/local models are interchangeable _cognitive
processors_ behind one instruction surface.

## The corpus cannot cover it because

CIR is a design document; CP is an op list with catalog metadata; no
bytecode envelope, no interpreter semantics (deterministic subset vs
inference-as-instruction), and no CVM-facing runtime facilities
binding exists.

## Proposal sketch

- Bytecode envelope over CP ops with operand types and verification
  requirements (catalog.ts already carries energy/verification
  metadata — the embryo of an instruction table).
- Deterministic subset (pure ops: memory, graphs, arithmetic on
  cognitive state) executes with replay-verifiable semantics; inference
  is an opaque instruction class dispatched to the fabric.
- CVM facilities map 1:1 onto kernel primitives; transactional
  cognition (WS-D) is the commit/rollback mechanism.

## Risk assessment

- Overbuild: start from the deterministic subset and treat inference as
  opaque; a full VM before CIR lands is speculative theater.

## Where it lands

- Extends RFC-0004; design doc `design/COGNITIVE-VIRTUAL-MACHINE.md`.

## Code impact

- Prototype landed: `src/cognitive-plane/cvm/` — bytecode envelope
  (`bytecode.ts`, decode-time verification), device interface
  (`device.ts`, certification), machine (`machine.ts`: deterministic
  eval, delegated dispatch, WS-D propose→verify→commit/rollback,
  tick-ordered trace, replay determinism, checkpoint/resume,
  branch/merge). 24 tests green 2026-08-01.

## Next stage

Wire the CIR frontend (P2: compile CIR programs to CVM bytecode), then
device registry + provider routing (P3, ADR-004) and the P4 conformance
suite (golden bytecode programs, replay determinism checks, rollback
drills).
