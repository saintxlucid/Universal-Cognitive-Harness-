# Knowledge Compiler

## Status

**Research specification v0.1.** The knowledge compiler is a proposed set of governed transformations from raw artifacts to inspectable knowledge objects. It does not infer truth from fluency, nor does it automatically create principles, policies, or autonomous actions.

## Purpose

Raw conversations, files, tool results, commits, tests, and user feedback are not directly suitable for durable recall. They carry conflicting scopes, duplicates, stale assertions, permissions, and ambiguous references. A knowledge compiler makes each transformation visible and reversible.

```text
artifact / observation
  -> normalized episode
  -> candidate claims
  -> entity + temporal resolution
  -> typed relations and evidence bundles
  -> concepts, patterns, procedures, and model proposals
```

The arrow means "a recorded derivation", not guaranteed correctness.

## Compilation stages

| Stage | Input | Output | Required diagnostic |
| --- | --- | --- | --- |
| Ingest | Artifact or event | Immutable source episode | provenance, access scope, content reference |
| Normalize | Episode | Canonical observation | parser/version, extraction uncertainty |
| Claim extraction | Observation | Candidate claims | source spans or structured fields, modality |
| Resolution | Claims | Linked entities and time intervals | ambiguity and alternative candidates |
| Relation synthesis | Resolved claims | Typed evidence bundle | supporting and contradicting evidence |
| Concept formation | Evidence bundles | Concept facets and examples | scope, counterexamples, confidence |
| Pattern formation | Repeated outcomes | Candidate procedure or mental model | sample size, context, failure cases |
| Model update | Validated patterns | Bounded-world-model proposal | evaluator and rollback path |

Each stage can abstain, defer, or emit multiple candidates. The system must never hide ambiguity by silently choosing the convenient interpretation.

## Concept Genome: minimum portable representation

The term **Concept Genome** is a research label for a portable concept record, not a claim of biological equivalence. A minimum record requires stable identity and aliases; typed facets, definitions, examples, and counterexamples; evidence bundles with provenance and contradiction links; temporal intervals and scope/access boundaries; relationships to entities, claims, tasks, procedures, and models; plus confidence, calibration history, lifecycle state, and derivation lineage.

The record supports multiple viewpoints without merging them into one authoritative narrative. A user preference, a codebase convention, and a measured fact can be related but must retain their types and authority.

## Compiler safeguards

1. Preserve source references, revisions, and deletion propagation.
2. Separate extraction confidence from claim confidence and source trust.
3. Detect correlated evidence so repeated copies do not inflate certainty.
4. Require scope compatibility before linking or recalling information.
5. Make every derived object inspectable, supersedable, and reversible.
6. Treat an unverified recurring pattern as a candidate, not a best practice.
7. Block promotion across permission boundaries without explicit policy.

## Evaluation hypotheses

| ID | Hypothesis | Falsification test |
| --- | --- | --- |
| KC-H1 | Lineage-preserving compilation reduces unsupported answers compared with flat summaries. | Score provenance completeness and factual correction after source changes. |
| KC-H2 | Typed preferences and facts reduce harmful personalization errors. | Measure cross-principal and cross-project contamination in controlled tasks. |
| KC-H3 | Counterexamples improve procedure reliability. | Compare success and regression rates with and without stored failure conditions. |

## Evidence connections

This proposal draws on structured and temporal-memory research while retaining the distinction between a source, a claim, and a validated fact. Its compiler model is an **inference** to be evaluated, not an adopted implementation.

Relevant sources: [A-MEM](https://arxiv.org/abs/2502.12110), [GraphRAG](https://github.com/microsoft/graphrag), and [CoALA](https://arxiv.org/abs/2309.02427).
