# Cognitive Execution Graph — Design

Status: **Draft** (idea → research → prototype; P1 implemented inside the
CVM prototype, `src/cognitive-plane/cvm/`). Source idea:
`rfc/ideas/IDEA-0117` (Research + Prototype). Relationship: the CVM
(IDEA-0045) interprets graph programs; the chain contract (IDEA-0081)
audits them; UER (IDEA-0047) records them; COM (IDEA-0056) is the object
model the nodes mutate.

## 1. Problem

Every executor today is a linear pipeline — the CIR optimizer runs 17
passes over an instruction list, the engineering chain (IDEA-0081) is a
linear artifact contract, the agentic loop is a repeat-until. Atomicity
is bolted on (WS-D) and causality is recorded afterwards (UER). Each
graph capability exists in isolation — sessions (pause), the WS-D
ledger (checkpoint/rollback), IDEA-0030 (branch), WS-I (merge),
ADR-002 (replay) — but no artifact binds them over a _running_
cognition: nothing can pause a cognition, fork it, merge the branches,
and replay the result as operations on one artifact.

## 2. Proposal

Execution is a graph. Nodes are operations over cognitive state
(deterministic CP ops, the opaque inference class, organ calls); edges
carry data, control, and causal flow; the graph is a first-class
artifact with:

| Operation      | Semantics                                                                   | Anchor                          |
| -------------- | --------------------------------------------------------------------------- | ------------------------------- |
| pause / resume | snapshot at a WS-D commit point; restore and continue from unexecuted nodes | `CVMGraphSnapshot` + `resume()` |
| checkpoint     | durable execution state, tick-addressable                                   | WS-D ledger, Lamport ticks      |
| branch         | fork an independent machine (speculation, parallel decomposition)           | `branch()`                      |
| merge          | join branches; conflict detection on divergence, never silent overwrite     | WS-I semantics, `merge()`       |
| replay         | deterministic subset re-execution; per-node divergence report               | `replay()`                      |
| optimize       | graph rewrite passes, CIR-optimizer style                                   | CIR 17-pass optimizer (future)  |

Determinism and replay become _structural properties of execution_, not
properties of the ledger: the same program + same inputs + same total
order reproduce the same committed state.

## 3. Relationship to the CVM

The CVM (IDEA-0045) is the machine that interprets graph programs: it
compiles the CIR stream into the graph (topological order, cycle
detection), executes nodes (deterministic eval / delegated device
dispatch), wraps each node in a WS-D transaction
(propose → verify → commit/rollback), and records the linearized trace
that makes replay and UER ingestion possible.

## 4. Prototype status (2026-08-01)

Implemented in `src/cognitive-plane/cvm/` (24 tests green):
`CognitiveExecutionGraph` (dependency order, snapshot/restore),
`CvmMachine.execute` (decode → graph → ticked node execution →
transactions → trace), `replay()` (determinism report), checkpoint/
resume via `fromSnapshot` + `onCheckpoint`, `branch()`/`merge()` with
certification conflict detection.

## 5. Phases

1. **P1 (implemented):** graph shape over the CVM prototype —
   pause/checkpoint/resume, branch/merge, replay on one artifact.
2. **P2:** CIR executor's run modeled as a graph; optimize passes.
3. **P3:** persisted execution artifacts; resume-across-crash; UER
   ancestry ingestion of graph checkpoints.
