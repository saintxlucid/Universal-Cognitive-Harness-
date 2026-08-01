# Cognitive Expression System (IDEA-0090)

- **Status:** Draft design for the IDEA-0090 prototype wave (SOP-08
  Prototype stage; reference implementation: `src/cognitive-plane/
genome/expression/expression-engine.ts`)
- **G1 evidence:** `research/foundations/18-cognitive-expression.md`
- **Related:** spec/GENOME.md, src/cognitive-plane/genome/ (species,
  workspace, adaptive), RFC-0005 (θ), IDEA-0034 (decision law),
  IDEA-0069 (feature flags), WS-C (organism versioning), IDEA-0091
  (morphogenesis), ADR-002 (replay), Law 12 (Reversibility)

## Claim

Genes are not configuration. The genome is the stable information
store; an _expression step_ synthesizes runtime behavior units —
proteins — from genes conditioned on the environment; the same genome
expresses differently in production (conservative) vs development
(experimental); expression changes are ledgered epigenetic marks,
never genome edits.

## Model

```
Genome (immutable) ── express(environment) ──► Proteins ──► Behavior
     ▲                                                    │
     └────────── genome edits (evolution path, IDEA-0008) ◄┘
```

- **Gene** — a genome trait that can be expressed (e.g.,
  `verification-strictness`, `risk-profile`, `sleep-cadence`).
- **Expression rule** — `(gene, environment) → protein`; every gene
  has a `default` rule (the conservative fallback) plus per-environment
  overrides. `production` and `development` are the built-in declared
  environments.
- **Protein** — an observable behavior unit: id, gene, name, behavior
  description, and typed parameters that existing mechanisms can
  consume (veto threshold, exploration bias, cadence).
- **Epigenetic mark** — an append-only, tick-ordered ledger entry
  recording an expression event: gene, environment, protein, tick,
  reason (declared switch or conservative fallback). Marks are
  replayable (Law 12) and never mutate the genome (WS-C restore stays
  genome-level).

## Design decisions

1. **Undeclared environment → conservative fallback.** An environment
   with no declared rules expresses every gene's `default` (most
   conservative) protein and _reports the ambiguity_ (`fallbacks`),
   instead of inventing a profile. Mirrors the intake: "an undeclared
   environment falls back to the conservative profile and logs the
   ambiguity."
2. **Marks on change, not on every call.** A mark is recorded when a
   gene's expressed protein differs from its last recorded mark
   (a switch) or when a fallback occurs — re-expressing the same
   environment is idempotent and does not spam the ledger.
3. **Proteins carry parameters, behaviors carry descriptions.** The
   derived value is that consuming organs read _parameters_ (θ = 0.5
   in production, 0.7 in development) — the runtime behavior is the
   description; the params are the contract. Not wired into any gate
   (SOP-08 Prototype discipline).
4. **Genome untouched.** The prototype is a standalone module anchored
   to SpeciesGenome/WorkspaceGenome by declaration; the corpus's
   genome objects are not modified.

## Corpus mapping

| Mechanism                              | Role                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `verification-strictness` gene → θ     | RFC-0005 veto threshold (production: normative 0.5; development: 0.7)                                           |
| `risk-profile` gene → exploration bias | Decision-law λi/λe ratio per environment (IDEA-0034)                                                            |
| `sleep-cadence` gene → sleepEveryTicks | Sleep cycle cadence                                                                                             |
| Feature flags (IDEA-0069)              | Instantaneous toggles; expression is environment-bound synthesis with provenance — complementary, not competing |
| WS-C versioning                        | Marks ledgered, genome restorable                                                                               |
| IDEA-0091 morphogenesis                | Expression is the genome side of development; morphogenesis is the organ side                                   |

## Open questions

- Protein catalog authority: who may add a gene/rule? (Candidate:
  the same RFC lifecycle as Laws; a protein must answer "what gene,
  why now.")
- Epigenetic inheritance across sessions: marks persist (yes) but
  their half-life (Law 5 decay) is unspecified — v0.1 keeps marks
  indefinitely.
- Relationship to workspace DNA mutation tracking: mutations are
  evolution (IDEA-0008); marks are expression — the boundary is
  explicit in the model above.

## Acceptance criteria (prototype)

- Same genome, different environments → different proteins (the
  honeybee test).
- Undeclared environment → conservative proteins + reported
  fallbacks.
- Ledger: append-only, tick-ordered, idempotent re-expression, switch
  detection.
- Deterministic: same input → same output, no randomness.
- Params consumable: effective veto threshold derives per environment.
