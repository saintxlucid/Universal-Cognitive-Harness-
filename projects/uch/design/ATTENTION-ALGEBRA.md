# Attention Algebra — design contract (IDEA-0093)

- **Status:** Prototype design (2026-08-01)
- **Idea note:** `rfc/ideas/IDEA-0093-attention-algebra.md`
- **G1 register:** `research/foundations/20-attention-algebra.md`
- **Prototype:** `src/cortex_kernel/attention-algebra.ts`
- **Seed anchors:** AttentionCortex bottleneck (top-N by importance),
  `attention.saturation` SLO, resource allocator grants (IDEA-0063),
  signal fusion (Law 17), integrator novelty attenuation.

## 1. Purpose

Bind the corpus's three ad-hoc attention numbers — the bottleneck's
top-N cut, the SLO's "budget consumed", the allocator's allowance —
into one formal system: a conserved quantity with named operators and
testable invariants. Attention is a measure, not a score: allocated,
spent, and restored by the tick.

## 2. Axioms

- **Conservation:** per cognitive tick, Σ attention over all signal
  sources ≤ budget. No operation may create attention ex nihilo.
- **Boundedness:** allocations are in [0, 1]; the budget is a positive
  real.
- **Observability:** every allocation decision is a record (source,
  amount, operator, tick) — nothing is silent.

## 3. Operators

| Operator | Signature | Semantics |
| --- | --- | --- |
| focus | `(budget, source, share) → Allocation` | concentrate `share` of the budget on one source; the rest is reserved (unallocated), never reassigned |
| split | `(budget, sources, weights) → Allocation[]` | divide the budget across sources by weights; Σ shares ≤ 1 (enforced) |
| merge | `(budget, sources) → Allocation` | fuse weak signals; the fused share is **less** than the sum of the parts (conservation — "Attention + Attention ≠ Double Attention") |
| diffuse | `(budget, n) → Allocation[]` | spread thinly for vigilance; each share = budget/n capped at a ceiling |
| attenuate | `(allocation, factor) → Allocation` | reduce a source's share; the removed amount is returned to the pool (released), not destroyed or reassigned |
| amplify | `(allocation, boost, max)` | increase by repetition, bounded by `max` and by the available pool — amplification draws from the pool, never exceeds conservation |

## 4. Invariants (testable)

1. **Conservation:** for any sequence of operations on one tick,
   Σ(final allocations) ≤ budget.
2. **Merge is subadditive:** `merge(a, b) ≤ a + b`; equal-strength
   fusion returns a strict subset of the sum.
3. **Focus+split round-trip:** `split(focus(budget, s, 0.5), {s: 1})`
   returns exactly the focused allocation.
4. **Attenuate is reversible into the pool:** the released amount is
   available for reallocation in the same tick.
5. **Amplify is bounded:** amplified allocation never exceeds the
   per-source max nor the remaining pool.

## 5. Prototype scope

- Pure module: no wiring into AttentionCortex, SLO, or budgets
  (SOP-08 Prototype discipline). The algebra *declares* the binding;
  consuming organs wire it later.
- One conserved budget; per-modality pools are an expansion.
- The allocation ledger is in-memory and tick-scoped.

## 6. Risk notes

- Over-formalization: the algebra is a thin layer over the working
  bottleneck; if the axiom ever contradicts the bottleneck's
  behavior, the axiom is re-verified, not the bottleneck forced.
- Quantity drift: the budget must come from the same grant source as
  the allocator — the prototype takes the budget as a parameter, so
  there is exactly one budget per tick by construction.
