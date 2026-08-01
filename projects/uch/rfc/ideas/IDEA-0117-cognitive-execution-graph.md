# IDEA-0117 — Cognitive Execution Graph

- **Status:** Research + Prototype (SOP-08 stages 2/4; P1 implemented
  inside the CVM prototype `src/cognitive-plane/cvm/` 2026-08-01)
- **Origin:** 2026-08-01 platform-effects intake (round 17) — "the
  next improvements are no longer adding capabilities; the
  differentiator is platform effects, determinism, and engineering
  infrastructure." Proposal Ω-2: "Not chains. Not workflows.
  Everything becomes a graph: observe → research → verification →
  simulation → planning → execution → reflection → learning. The
  graph can pause, checkpoint, resume, branch, merge, replay,
  optimize."
- **Related:** IDEA-0045 (CVM — the graph is the program the VM
  interprets), RFC-0004 (CIR — linear instruction programs; the
  graph is their execution semantics), IDEA-0081 (deterministic
  engineering chain — the audit contract over actions), WS-D
  (transactional cognition — commit/rollback is the graph's
  atomicity), IDEA-0088 (cognitive locking — savepoints, nesting,
  optimistic concurrency), IDEA-0030 (cognitive speculation —
  branch-ahead execution), WS-I (cognitive merge — join semantics),
  ADR-002 (trace ledger — replay substrate), IDEA-0047 (UER — the
  post-hoc causal record of executed graphs), IDEA-0056 (COM — the
  object model the nodes mutate), IDEA-0072 (universal lifecycle
  engine)

## Motivation

Every executor today is a linear pipeline — the CIR optimizer runs
17 passes over an instruction list, the engineering chain (IDEA-0081)
is a linear artifact contract, the agentic loop is a repeat-until —
with atomicity bolted on (WS-D) and causality recorded afterwards
(UER). The claim: execution itself is a graph. Nodes are operations
over cognitive state (deterministic CP ops, the opaque inference
class, organ calls); edges carry data, control, and causal flow;
the graph is a first-class artifact with pause/checkpoint/resume
(persisted execution state), branch/merge (parallel, speculative,
and decomposed cognition), replay (deterministic subset
re-execution), and optimization (graph rewrite passes). Determinism
and replay then become structural properties of execution, not
properties of the ledger.

## The corpus cannot cover it because

WS-D gives atomicity but no graph structure; IDEA-0081 is a linear
evidence chain (an artifact contract, not an execution shape); CIR
executes linear instruction lists; IDEA-0088 governs concurrency of
transactions; UER records what happened, it does not execute. Each
graph capability exists in isolation — sessions (pause), the WS-D
ledger (checkpoint/rollback), IDEA-0030 (branch), WS-I (merge),
ADR-002 (replay) — but no artifact binds them over a running
cognition: nothing can pause a cognition, fork it, merge the
branches, and replay the result as operations on one artifact.

## Proposal sketch

- Execution graph as the runtime artifact: nodes = operations
  (deterministic CP subset | opaque inference | organ calls), edges
  = data/control/causal; every executed graph leaves a persisted,
  versioned artifact with checkpoints at WS-D commit points.
- Operations: pause/checkpoint/resume (state snapshot per WS-D
  semantics), branch (fork for speculation IDEA-0030 or parallel
  decomposition), merge (join with WS-I conflict detection; failed
  merges revert to the checkpoint), replay (deterministic
  re-execution; the replay record feeds UER), optimize (graph
  rewrites, CIR-optimizer style).
- Relationship: the CVM (IDEA-0045) interprets graph programs; the
  chain contract (IDEA-0081) audits them; UER (IDEA-0047) records
  them; COM (IDEA-0056) is the object model the nodes mutate.

## Risk assessment

- Graph theater: without a killer capability (resume-across-crash,
  speculative branch merge, checkpointed replay), the graph is a
  flowchart. Anchor: WS-D commit points are the natural checkpoints;
  the replayable deterministic subset is the first target.
- Overlap: must not re-skin IDEA-0081 or the CIR executor — the
  delta is graph structure over existing execution, not a new
  execution engine.

## Where it lands

- Extends IDEA-0045 + RFC-0004; design doc `design/EXECUTION-GRAPH.md`.

## Code impact

- Prototype landed with the CVM wave: `CognitiveExecutionGraph`
  (dependency order, snapshot/restore) + `CvmMachine` checkpoint/resume
  (`fromSnapshot`/`onCheckpoint`), `branch()`/`merge()` with
  certification conflict detection, `replay()` determinism reports.
  24 tests green 2026-08-01.

## Next stage

Model the CIR executor's run as a graph (P2: optimize passes over the
execution graph); persist execution artifacts for resume-across-crash
and UER ancestry ingestion (P3).
