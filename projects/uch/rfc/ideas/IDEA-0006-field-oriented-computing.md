# IDEA-0006 — Field-Oriented Computing

- **Status:** Idea (SOP-08 stage 1; no code — flagged most speculative)
- **Origin:** Vision intake 2026-08-01 — "everything is a field"
- **Related:** design/CONNECTOME.md, design/ECS-SPIKE.md, design/RETRIEVAL-SCALING.md

## Motivation

Current architecture is object/message-based: organs own state, communicate
via signals, activation propagates over the connectome graph. The vision's
claim: model cognition as **fields** — knowledge field, trust field,
attention field, goal field, risk field, novelty field — where signals
perturb the field and behavior emerges from gradients, with no object needing
to know the whole state.

## The corpus cannot cover it because

The connectome is a weighted graph, not a field; activation is BFS with
decay, not a gradient. No document defines field semantics, superposition, or
gradient-based routing. This is the only vision item with **no ancestor**
anywhere in the corpus.

## Proposal sketch

- A field is a function over a concept/region space with per-point values.
- Signals add impulses; behavior = steepest-descent on the field.
- Attention field raises planner/verifier responsiveness without direct
  message routing (emergence, not orchestration).

## Risk assessment

- Highest conceptual risk of the intake; benefit is not yet demonstrated.
- Precedent: ECS-SPIKE — the earlier spike verdict was "adopt only the one
  idea the evidence supports" (typed, tag-based, cross-type iteration).
  Field-oriented computing deserves the same spike discipline.

## Where it lands

- `design/` spike document (mirroring ECS-SPIKE methodology).
- Observatory visualization if the spike justifies it.

## Code impact

- None until a spike produces measurable evidence; explicitly not a
  candidate for near-term kernel work.

## Next stage

Spike research note (problem statement, minimal field simulation, comparison
against connectome activation), then a verdict — adopt, hybrid, or reject.
