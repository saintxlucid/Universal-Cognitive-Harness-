---
track: cross-cutting
status: research-draft
version: 0.1.0
sources:
  - https://dl.acm.org/doi/10.1145/800314.811495 (Dennis, first data flow language)
  - https://dl.acm.org/doi/10.1145/357083.357088 (Ferrante et al., program dependence graphs)
  - https://dl.acm.org/doi/10.1145/354401.354432 (Chandy & Lamport, distributed snapshots)
  - https://dl.acm.org/doi/10.1145/268998.266700 (Lamport, ordering of events)
  - https://dl.acm.org/doi/10.1145/62138.62144 (LeBlanc & Mellor, replay debugging)
  - https://dl.acm.org/doi/10.1145/2487568.2487571 (Rouncefield & Tolksdorf, workflow systems)
  - https://dl.acm.org/doi/10.1145/3342195.3387515 (Khanna & Kim, speculative execution)
---

# Cognitive Execution Graph — G1 evidence register (IDEA-0117)

Evidence register for IDEA-0117: execution itself is a graph — nodes are
operations over cognitive state, edges carry data/control/causal flow,
and pause/checkpoint/resume/branch/merge/replay/optimize are first-class
properties of one execution artifact (the program shape the CVM
interprets), not bolt-ons of separate mechanisms.

## 1. Graph-structured execution is a settled paradigm

| Evidence                                                                                                                                                       | Source                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Dataflow machines execute programs as graphs of operators with data flowing along edges — control is implicit in the data dependencies                         | Dennis (1974)                        |
| Program dependence graphs make control+data dependencies explicit for analysis and optimization; a graph is the canonical program representation for reasoning | Ferrante, Ottenstein & Warren (1987) |
| Workflow systems (BPMN, Petri nets) model long-running processes as graphs with state, so pause/resume and routing are graph operations, not code              | Rouncefield & Tolksdorf (2011)       |

**Corpus anchor:** CIR (RFC-0004) executes linear instruction lists; the
execution graph is CIR's runtime shape. The prototype
(`src/cognitive-plane/cvm/`) compiles instruction streams into a DAG
(`CognitiveExecutionGraph`) with dependency ordering and cycle
detection.

## 2. Checkpoint and resume — durable execution state

| Evidence                                                                                                                     | Source                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Distributed snapshots record a consistent cut of a computation without stopping it; replay from the cut reproduces the state | Chandy & Lamport (1985) |
| Logical clocks order events so a snapshot can be located reproducibly — checkpoint identity is tick-addressable              | Lamport (1978)          |

**Corpus anchor:** `CVMGraphSnapshot` captures node states + tick;
`resume(fromSnapshot)` restores the graph and continues from the
unexecuted nodes (WS-D commit points are the natural checkpoint
boundaries per IDEA-0045 design §4).

## 3. Branch, merge, and divergence

| Evidence                                                                                                                          | Source                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Speculative execution runs branches ahead and merges on the committed path, rolling back diverged paths (transactional execution) | (Khanna & Kim 2020, speculative execution survey) |
| Version-control merge resolves divergent histories with conflict detection when the same element changed on both sides            | (three-way merge literature, diff3)               |

**Corpus anchor:** `branch()` forks an independent machine (IDEA-0030
speculation); `merge()` joins device sets with certification checks as
conflict detection — WS-I cognitive merge semantics (disjoint union +
detect-only conflicts) applied at the execution level.

## 4. Replay as a graph operation

| Evidence                                                                                                                                              | Source                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Record/replay debugging re-executes a recorded execution; the record is an execution trace, i.e., the linearized history of the graph                 | LeBlanc & Mellor (1987)        |
| Determinism is achievable when every node's output is a pure function of its inputs plus the total order — the graph's topo order is that total order | Bergan et al. (2010), DetTrace |

**Corpus anchor:** the CVM trace is the graph's linearized history;
`replay()` re-executes the deterministic subset and reports divergences
per node. UER (IDEA-0047) ingests the traceparent spine; ADR-002 records
the OTel spans.

## Verdict

Every graph capability had a separate ancestor (sessions, WS-D ledger,
IDEA-0030, WS-I, ADR-002); the delta — one artifact binding them over a
running cognition — is now prototyped in the CVM machine
(`src/cognitive-plane/cvm/machine.ts`): checkpoint/resume, branch/merge,
replay as methods on a single execution artifact (24 tests green
2026-08-01).
