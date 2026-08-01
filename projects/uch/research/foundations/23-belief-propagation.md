---
track: cognition
status: research-draft
version: 0.1.0
sources:
  - https://www.mitpress.mit.edu/9780262161121/probabilistic-reasoning-in-intelligent-systems/ (Pearl 1988, Probabilistic Reasoning in Intelligent Systems — belief propagation on polytrees)
  - https://www.cs.princeton.edu/~arora/pubs/loopy.pdf (Murphy, Weiss & Jordan 1999, loopy belief propagation on general graphs)
  - https://www.cs.umd.edu/~bonnie/courses/hipc/papers/weiss.pdf (Weiss 2000, correctness of loopy BP — fixed points)
  - https://www.sciencedirect.com/science/article/pii/0004370279900174 (Doyle 1979, truth maintenance systems — justifications, contradictions)
  - https://www.sciencedirect.com/science/article/pii/0004370286900810 (de Kleer 1986, assumption-based TMS — environments, ATMS)
  - https://www.cs.rice.edu/~dwallach/pub/crosby-trustdc2001.pdf (Crosby & Wallach 2003/2009, trust propagation in distributed systems)
  - https://www.aaai.org/Papers/AAAI/2003/AAAI03-110.pdf (Golbeck & Hendler 2003, inferring trust relationships — TidalTrust)
  - https://en.wikipedia.org/wiki/Dempster%E2%80%93Shafer_theory (Shafer 1976, A Mathematical Theory of Evidence)
---

# Belief Propagation Engine — G1 evidence register (IDEA-0086)

Evidence register for the belief propagation engine proposed in
`rfc/ideas/IDEA-0086-belief-propagation-engine.md`: a graph over
memories/concepts with support and attack edges, so that confidence,
trust, and contradiction update automatically along those edges — the
belief-semantic layer over the UER causal graph.

The claim has four parts: (1) belief propagation is a mature,
formalized computation; (2) contradiction handling has a documented
engineering heritage (truth maintenance); (3) trust propagation through
relationships is an established model; (4) direct evidence must
outrank inference (Law 4) — the prototype's binding constraint.

## 1. Belief propagation is a formalized computation

| Evidence | Source |
| --- | --- |
| Pearl's belief propagation: messages along graph edges update a node's belief exactly on polytrees — the canonical algorithm for belief structure | Pearl (1988) |
| Loopy belief propagation converges to fixed points on general graphs in practice (though not guaranteed) — the graph generality the engine needs | Murphy, Weiss & Jordan (1999); Weiss (2000) |
| Dempster–Shafer theory formalizes evidence combination with explicit conflict — the mathematical home of support/attack fusion | Shafer (1976) |

**Corpus anchor:** the connectome propagates *activation* (BFS with
per-hop decay); the activation field multiplies confidence by 0.9 per
hop — mechanical spreading, not semantic recomputation. No engine
recomputes a target's confidence from its evidence mass. The belief
graph is the missing semantic layer.

## 2. Contradiction handling: truth maintenance heritage

| Evidence | Source |
| --- | --- |
| TMS (Doyle): justifications connect beliefs; a contradiction in the justification set triggers dependency-directed backtracking — *affected-set computation is the core operation* | Doyle (1979) |
| ATMS (de Kleer): each belief carries its set of assumptions (environment); a contradiction invalidates exactly the environments that support it — precision of invalidation | de Kleer (1986) |
| Dependency-directed backtracking re-evaluates only the dependent beliefs, not the whole network — the ripple is bounded by the affected set | Doyle (1979) |

**Corpus anchor:** contradiction detection exists (CIR pass,
scientific-memory 'contradicted') but there is no *ripple* — no
affected-set computation, no dependent-belief invalidation, no
resolution. The engine's contradiction ripple is ATMS-style
invalidation without the full ATMS formalism.

## 3. Trust propagation through relationships

| Evidence | Source |
| --- | --- |
| Trust in distributed systems propagates along relationships; direct trust outranks inferred trust — transitivity with decay | Crosby & Wallach (2003/2009) |
| TidalTrust: path trust is computed from direct trust ratings along paths, with a bounded-length constraint — shortest/longest path tradeoffs | Golbeck & Hendler (2003) |
| Law 5 (trust decay): UCH already declares trust decays — the engine gives the law an operation: trust flows along edges with per-hop decay | UCH Laws corpus |

**Corpus anchor:** plugin trust scoring (IDEA-0080) is independent
scorecards — nothing composes trust along chains. The engine adds
chain composition with Law-5 decay.

## 4. Direct evidence outranks inference (the binding constraint)

| Evidence | Source |
| --- | --- |
| Law 4 (evidence over assertion): direct observation always outranks inference — "prevents hallucination propagation" | UCH Laws corpus |
| In belief networks, evidence nodes are *observed* (their values are fixed by data), while non-evidence nodes are inferred — the same asymmetry is structural, not optional | Pearl (1988) |
| TMS distinguishes premise nodes (ground truths) from derived nodes — a contradiction can never overturn a premise, only derived beliefs | Doyle (1979) |

**Corpus anchor:** scientific-memory's certainty states already
distinguish observed from inferred; the engine's rule — propagated
values never overwrite direct evidence — is the operational form of
this corpus distinction.

## Verdict

G1-grounded: belief propagation (Pearl, Murphy-Weiss-Jordan), TMS/ATMS
contradiction handling (Doyle, de Kleer), trust propagation
(Crosby-Wallach, Golbeck-Hendler), evidence-over-inference (Law 4,
Pearl's observed nodes). The engineering novelty is the composition:
a belief-semantic layer over the existing causal graph (UER) and
activation substrate (connectome), with ATMS-style affected-set
contradiction ripples, Law-5 trust decay along chains, and the
Law-4 direct-evidence priority — all ledgered and versioned.

## Special-case mapping (prototype scope)

| Corpus mechanism | Belief-engine special case |
| --- | --- |
| Connectome edges (activation weights) | become support/attack edges with confidence semantics |
| Activation-field confidence × 0.9 per hop | replaced by belief-algebra recomputation along support edges |
| scientific-memory 'contradicted' | the ripple's trigger and destination state |
| UER influence-path queries | the graph the belief layer reads; belief edges ride the same causal spine |
| Decision law (IDEA-0034) | consumes propagated confidence as a tie input (prototype: report only) |
| RFC-0005 instability | vetoes reuse I(b) = confidence − evidenceMass in the ripple |

## Non-goals (kept out of this wave)

- No loopy-BP convergence machinery in v0.1 — propagation is
  bounded by hop limit and energy per tick (per the idea's risk
  section), not by fixed-point iteration.
- No rewrite of the connectome or activation field — the engine reads
  their edges as seeds into its own belief graph.
- No belief persistence in v0.1 — the ledger of belief:changed events
  is in-memory; replay integration is a later wave.
