# IDEA-0008 — Genome Evolution: Git for genomes

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "Git for genomes: diff, merge, branch, fork, rollback"
- **Related:** spec/GENOME.md, design/ADR-006 Phase C (organism versioning), src/kernel/organism/

## Motivation

GENOME.md defines three genome layers (species — immutable, workspace,
adaptive) and ADR-006 Phase C delivered VersionedStore with validator-gated
restore. What does not exist: **evolution** — mutations from project
feedback, genome diff/merge/branch/fork/rollback, and genome benchmarking.
The vision's claim: the genome is the organism's most valuable asset and
needs version control semantics of its own, with evolution never bypassing
governance.

## The corpus cannot cover it because

VersionedStore versions *organisms*; it does not diff *genomes* or propose
mutations. Adaptive-genome learning exists only as scattered updates
(connectome weights, skill registry), never as an auditable evolution
pipeline.

## Proposal sketch

```text
Observe → detect recurring friction → mutation proposal →
simulate → benchmark → constitution check → security review →
human approval → deploy → observe
```

- Genome diff: structural diff of genome documents (traits, policies,
  preferences).
- Mutation: a proposed, reversible delta to the adaptive genome only — the
  species genome stays immutable (GENOME.md rule 4).
- Governance: the pipeline above is mandatory; evolution is a kernel service
  with the same gates as any organ change.

## Where it lands

- `spec/GENOME.md` — evolution section (after RFC).
- `src/kernel/organism/` — evolution organ beside VersionedStore.

## Code impact

- Moderate, additive: VersionedStore is the substrate; genome diff is a new
  module; the sleep cycle can emit mutation candidates (it already distills
  patterns).

## Next stage

Research (precedents: genetic algorithms in architecture search, safe
self-modification literature), then RFC.
