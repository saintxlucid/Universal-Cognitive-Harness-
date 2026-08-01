# IDEA-0093 — Attention Algebra

- **Status:** Prototype (2026-08-01) - G1 register + design doc +
  reference module with tests; NOT wired into any gate (SOP-08
  Prototype discipline).
- **Origin:** 2026-08-01 computational-cognitive-science intake
  (round 12) — "Attention + Attention ≠ Double Attention. Attention
  becomes a conserved resource. It can split, merge, diffuse, focus,
  attenuate, amplify."
- **Related:** IDEA-0026 (cognitive mathematics — definitions,
  operators, proofs), IDEA-0035 (cognitive information theory — named
  quantities: Knowledge Entropy, Truth Density), src/cortex_kernel/
  attention-cortex.ts (bottleneck 7, importance sorting), mnemosyne
  activation (attentional weight, spreading + noise), SLO
  `attention.saturation` (src/engineering-intelligence/slo/
  cognitive-slos.ts — "attention budget consumed (IDEA-0063)"),
  budgets (control-plane energy economics), Law 17 (signal fusion —
  merging attention is lawful), Law 15 (information conservation —
  zero-gain absorbed at lowest layer), IDEA-0063 (resource allocator)

## Motivation

Attention is implemented as a bottleneck: the AttentionCortex sorts
signals by importance and admits the top N into consciousness. That is
a mechanism, not a mathematics. The intake's claim: attention should
be a _conserved quantity_ with algebraic laws — the sum of attention
over all signal sources cannot exceed the per-tick attention budget —
and named operators: focus (concentrate the budget on one source),
split (divide between sources), merge (fuse weak signals, Law 17),
diffuse (spread for vigilance), attenuate (novelty/habituation
decay), amplify (repetition/connectome strengthening). This gives
UCH the "Attention + Attention ≠ Double Attention" law that
conservation implies, and it binds the existing implementations —
bottleneck, SLO, budgets — into one formal system instead of three
ad-hoc numbers.

## The corpus cannot cover it because

The three attention implementations do not share a model: the
bottleneck admits by sorted importance (no conservation axiom stated),
the SLO measures "budget consumed" against a target (a budget exists
conceptually but no algebra defines its conservation), and mnemosyne
uses attentional weight as a retrieval factor (a different scale).
There is no operator set — focus/split/merge/attenuate/amplify have
no defined semantics, no invariants, and no tests. IDEA-0035 defines
quantities but not operations; IDEA-0026 defines the discipline but
not this calculus.

## Proposal sketch

- Axiom: per cognitive tick, Σ attention over all signal sources ≤
  attention budget (conservation); attention is a measure, not a
  score — it is allocated, spent, and restored by the tick.
- Operators with defined semantics: focus(c) concentrates the budget
  (attention window, IDEA-0084's noise gate consumes from it), split
  divides across sources, merge fuses (Law 17 — merged attention is
  _less_ than the sum, the conserved-resource law), attenuate decays
  (novelty → habituation, IDEA-0092), amplify strengthens by
  repetition (connectome weights).
- Bindings: the AttentionCortex bottleneck becomes one allocation
  strategy over the algebra (focus-weighted admission); the
  attention.saturation SLO measures the conserved budget; budgets
  (IDEA-0063) grant the per-tick allowance.
- Invariants are testable: conservation, idempotence of merge,
  focus+split round-trip.

## Risk assessment

- Over-formalization: the algebra must stay a thin formal layer over
  working mechanisms (bottleneck first, algebra second) — if the
  axiom contradicts the bottleneck's behavior, the axiom is
  re-verified, not the bottleneck forced.
- Quantity drift: attention budget must come from the same grant
  source as the allocator (IDEA-0063) or two budgets will fight.

## Where it lands

- `src/cortex_kernel/attention-algebra.ts` (or under IDEA-0035's
  quantity layer), wiring into AttentionCortex + SLO + budgets.

## Code impact

- None until the algebra is specified; AttentionCortex +
  attention.saturation SLO are the seed.

## Next stage

- Bind the AttentionCortex bottleneck and the attention.saturation
  SLO to the algebra; assert the conservation invariant under load.
