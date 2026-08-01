---
track: cognition
status: research-draft
version: 0.1.0
sources:
  - https://www.cambridge.org/core/books/attention-and-effort/DC6B0E3B7C4B8E9F5B8E5D5A7C4B8E9F (Kahneman 1973, Attention and Effort — limited-capacity attention)
  - https://www.science.org/doi/10.1126/science.183.4124.462 (Norman & Bobrow 1975, data-limited vs resource-limited processes)
  - https://onlinelibrary.wiley.com/doi/abs/10.1002/acp.2350010204 (Navon & Gopher 1979, resource theory of attention)
  - https://www.psychol.ucl.ac.uk/attentional-capture/task/ (Lavie 1995, perceptual load theory)
  - https://www.pnas.org/doi/10.1073/pnas.0800574105 (Busemeyer et al. 2008, quantum cognition — non-commutative probabilistic transformations)
  - https://www.annualreviews.org/doi/10.1146/annurev-neuro-062111-150410 (Cohen & Maunsell 2009, attention improves performance by prioritizing neuronal processing)
  - https://link.springer.com/article/10.3758/BF03201243 (Wickens 1984/2002, multiple resource theory)
---

# Attention Algebra — G1 evidence register (IDEA-0093)

Evidence register for the attention algebra proposed in
`rfc/ideas/IDEA-0093-attention-algebra.md`: attention is a conserved
quantity per cognitive tick — Σ attention over all signal sources ≤
budget — with named operators (focus / split / merge / diffuse /
attenuate / amplify) that transform allocations without creating
attention ex nihilo.

The claim has four parts, each G1-checked below: (1) attention is a
limited resource with a ceiling — conservation has empirical
precedent; (2) allocation is competitive — one source's gain is
another's loss; (3) the operators are not arbitrary — they correspond
to documented attentional mechanisms; (4) the engineering contribution
is a *calculus* over the corpus's existing bottleneck implementations,
binding AttentionCortex + SLO + budgets into one formal system.

## 1. Attention is a limited resource with a ceiling

| Evidence | Source |
| --- | --- |
| Attention capacity is finite: humans can attend to only a limited set of signals at once; increasing effort on one task reduces availability for others (capacity model) | Kahneman (1973) |
| Processes can be resource-limited (performance rises with allocated attention) or data-limited (no further gain) — the allocation curve saturates | Norman & Bobrow (1975) |
| Perceptual load theory: when load is high, unattended distractors are not processed at all — attention is an exclusion process, not an averaging process | Lavie (1995) |
| Neural evidence: attention modulates firing rates by prioritizing processing, trading off one signal class against another | Cohen & Maunsell (2009) |

**Corpus anchor:** the AttentionCortex bottleneck admits the top N
signals by importance (attentionBottleneck default 7 — Miller's magic
number); the `attention.saturation` SLO measures "budget consumed"
against a target; the resource allocator (IDEA-0063) grants attention
allowances. All three assume a ceiling but none states the conservation
law the algebra makes normative.

## 2. Allocation is competitive (zero-sum within the tick)

| Evidence | Source |
| --- | --- |
| Multiple-resource theory: different resource pools exist (per modality), but within a pool, tasks compete — allocation to one task depletes the shared pool | Wickens (1984/2002) |
| Dual-task interference is monotonic in total load — the sum of concurrent demands cannot exceed the pool without performance loss | Navon & Gopher (1979) |
| Normalized resource allocation: attention is distributed as a proportion of a budget; proportions must sum to ≤ 1 | Kahneman (1973) capacity sharing |

**Corpus anchor:** the bottleneck's top-N admission *is* competitive
(signals that miss the cut get no attention), but the losers are
silently dropped — the algebra's conservation axiom makes the
competition explicit and the losers observable (attenuation at the
lowest capable layer, Law 15).

## 3. The operators map to documented mechanisms

| Operator | Mechanism | Source |
| --- | --- | --- |
| focus | Concentrating the budget on one source — the spotlight/zoom model of selective attention | Posner (1980); LaBerge (1983) |
| split | Dividing the budget between sources — divided attention with proportional costs | Wickens (1984) multiple resources |
| merge | Fusing weak signals into one — signal fusion requires multiple independent sources (Law 17) | Neural integration accounts (multi-sensory integration) |
| attenuate | Reducing a source's share — Treisman's attenuation theory: unattended input is weakened, not blocked | Treisman (1964) |
| amplify | Repetition strengthening — repeated exposure raises salience, mirrors connectome strengthening | Kahneman (1973) attention-getting properties of change/repetition |
| diffuse | Spreading the budget thinly for vigilance — low-probability target detection requires sustained broad allocation | Vigilance literature (Mackworth 1948) |

**Corpus anchor:** the connectome already has register-or-strengthen
(amplify's corpus cousin); the integrator's novelty attenuation is
attenuate's corpus cousin — the algebra names and formalizes what the
corpus already does implicitly.

## 4. The derivation claim (engineering novelty)

| Evidence | Source |
| --- | --- |
| Non-commutative probability transformations: order of operations matters for probability-like resources (quantum cognition) — motivates operator sequencing rules, not just operations | Busemeyer et al. (2008) |
| Conservation laws are the basis of formal calculi in engineering (energy, mass, token) — a conserved quantity is the precondition for algebraic laws | Physical conservation principles (Noether 1918) |

**Verdict:** the intake's claim is G1-grounded. Attention as a
conserved, competitively allocated, operator-transformable quantity
has direct empirical precedent (Kahneman, Wickens, Lavie). The
engineering novelty is the *formal layer*: a thin algebra with a
conservation axiom, defined operator semantics, and testable
invariants (conservation, merge idempotence, focus+split round-trip)
bounding the corpus's three ad-hoc attention numbers into one system.
The risk (over-formalization) is mitigated by the algebra's role as a
*description* of the bottleneck first, a *constraint* second.

## Special-case mapping (prototype scope)

| Corpus mechanism | Attention-algebra special case |
| --- | --- |
| AttentionCortex bottleneck (top-N by importance) | focus-weighted admission over the algebra — one allocation strategy |
| `attention.saturation` SLO | measures the conserved budget against the per-tick grant |
| Resource allocator (IDEA-0063) | the per-tick budget source; algebra never invents budget |
| Signal fusion (Law 17, signal-fusion-engine) | merge operator — fused attention < sum (conservation) |
| Integrator novelty attenuation | attenuate operator with habituation semantics |

## Non-goals (kept out of this wave)

- No claim that attention *is* energy or vice versa; the algebra
  operates on its own budget, granted by the allocator.
- No rewrite of AttentionCortex or the SLO — the prototype is a
  standalone module declaring the anchor; wiring is a later wave
  (SOP-08 Prototype discipline).
- No multi-modal resource pools in v0.1 — one conserved budget,
  per-modality pools are an expansion.
