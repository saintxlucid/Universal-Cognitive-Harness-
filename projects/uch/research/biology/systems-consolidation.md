---
track: T01
status: exploratory
sources:
  - https://www.nature.com/articles/s41586-025-08993-1
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC4526749/
---

# Systems Consolidation: A Careful Computational Analogy

## Question

What can a persistent cognitive system learn from the relationship between
high-fidelity experiences and later generalization without falsely claiming to
implement a brain?

## Direct evidence

Memory-consolidation research describes time-dependent reorganization of memory
representations. The 2025 engram study reports a shift from precise event memory
toward event-linked gist/generalization in a mouse model. Reviews of systems
consolidation describe an interaction between hippocampal and cortical systems,
while also recording theoretical disagreement and limitations.

## Computational inferences

1. Store **episodes** as source fidelity: immutable observations, tool results,
   artifacts, and their timestamps.
2. Build **abstractions** separately: claims, patterns, procedures, and world
   models that can change as evidence accumulates.
3. Link each abstraction to its episode set and quantify its evidence coverage,
   precision loss, and useful generalization.
4. Treat a "sleep cycle" as a budgeted offline job that proposes consolidation,
   detects conflicts, and requests review; it must not silently rewrite truth.
5. Let activation decay govern recall priority while retention, privacy, and
   safety rules govern preservation or deletion.

## What not to infer

- There is no evidence that naming a software module `hippocampus` recreates
  biological function.
- Human or animal mechanisms do not justify autonomous self-modification.
- Generalization is not automatically better: it can erase rare constraints and
  create misleading similarity.

## Falsifiable hypotheses

- H1: Versioned abstractions linked to immutable episodes answer both detailed
  historical questions and generalized planning questions more accurately than
  a single summary store.
- H2: A consolidation job with a mandatory evidence-retention policy produces
  lower contradiction and stale-context rates than destructive summarization.
- H3: Activation decay plus protected retention classes lowers retrieval cost
  without losing safety-critical, legally required, or user-pinned information.

## Evaluation fixtures required

- A project whose architecture changes over time, including superseded but
  historically important decisions.
- A user preference deliberately revised after repeated earlier confirmations.
- Rare, high-risk constraints that must survive low access frequency.
- A false consolidation proposal that must remain a candidate and be rejected.
