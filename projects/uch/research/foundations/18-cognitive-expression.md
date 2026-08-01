---
track: genome
status: research-draft
version: 0.1.0
sources:
  - https://www.nature.com/articles/227561a0 (Crick 1970, central dogma of molecular biology)
  - https://www.science.org/doi/10.1126/science.133.3457.670 (Jacob & Monod 1961, genetic regulatory mechanisms in the synthesis of proteins)
  - https://www.nature.com/articles/181662a0 (Waddington 1957, the strategy of the genes)
  - https://www.nature.com/articles/ng1103 (Waterland & Jirtle 2003, transposable elements: targets for early nutritional effects on epigenetic gene regulation)
  - https://www.science.org/doi/10.1126/science.1062836 (Evans & Wheeler 2001, expression profiles during honeybee caste determination)
  - https://www.cell.com/trends/genetics/fulltext/S0168-9525(10)00261-4 (Nilsen & Graveley 2010, expansion of the eukaryotic proteome by alternative splicing)
  - https://www.nature.com/articles/23382 (Driever & Nüsslein-Volhard 1988, the bicoid protein determines position in the Drosophila embryo)
  - https://www.sciencedirect.com/science/article/abs/pii/S0022519369800772 (Wolpert 1969, positional information and the spatial pattern of cellular differentiation)
  - https://www.cs.cmu.edu/~./scandal/nester/1979/331.pdf (Miller 1966/1979, capabilities)
---

# Cognitive Expression System — G1 evidence register (IDEA-0090)

Evidence register for the expression system proposed in
`rfc/ideas/IDEA-0090-cognitive-expression-system.md`: genes are not
configuration; genes are _expressed_ — genome + environment → proteins,
proteins produce behavior, and the same genome expresses differently
per environment (production conservative, development experimental)
through ledgered epigenetic marks, never through genome edits.

The claim has three parts, each G1-checked below: (1) the central
dogma — information flows gene → protein, never back; (2) expression
is environment-regulated — the operon model is literally "same genome,
different behavior by environment"; (3) epigenetics — persistent
phenotypic variation without genome change is a documented, heritable
biological phenomenon. The engineering contribution is not the biology
but the _runtime_: expression as a versioned, ledgered, observable
process over an immutable genome.

## 1. The central dogma — genes produce proteins, proteins do work

| Evidence                                                                                                                                                                            | Source                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Information flows DNA → RNA → protein; once transferred, it never flows back from protein to nucleic acid — the genome is the stable information store, proteins are the effectors  | Crick (1957 lecture; 1970)               |
| One gene routinely produces many functional protein variants via alternative splicing and post-translational modification — a single gene is a _family_ of behaviors, not one value | Nilsen & Graveley (2010)                 |
| Protein function is context-dependent: the same structural gene product behaves differently with different cofactors and environments                                               | Jacob & Monod (1961) regulatory analysis |

**Corpus anchor:** the genome today is read-only config
(`species-genome.ts` law sets, `workspace-genome.ts` key/value
sections) with no synthesis step; "gene → many behaviors" has no
corpus counterpart — a flag is binary, a gene is generative.

## 2. Environment-regulated expression — the operon model

| Evidence                                                                                                                                                                                          | Source                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| The lac operon: structural genes are constant; the regulator senses the environment (lactose) and controls whether the genes are expressed at all — the canonical model of conditional expression | Jacob & Monod (1961)                              |
| Regulons and transcription-factor networks scale conditional expression to hundreds of genes responding to state, not to configuration                                                            | Neidhardt (1987) regulatory networks              |
| Positional information makes _identical_ genomes take different developmental fates from a spatial environment — same genome, different expression, different organs                              | Wolpert (1969); Driever & Nüsslein-Volhard (1988) |

**Corpus anchor:** the intake's "Security Gene → Strict Verification
Protein → Runtime Behavior, not `strict=true`" is precisely the
operon claim: the gene is constant, the _expression_ is conditional on
the environment (production vs development), and the protein is a
runtime behavior unit rather than a config value. The corpus's feature
flags (IDEA-0069) are instantaneous toggles; expression is
environment-bound synthesis.

## 3. Epigenetics — persistent variation without genome change

| Evidence                                                                                                                                                                                         | Source                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Waddington's epigenetic landscape: the same genotype traverses different phenotypes under environmental influence; canalization keeps the genome stable while development varies                 | Waddington (1957)         |
| Isogenic mice with different maternal nutrition differ persistently in phenotype via DNA methylation — epigenetic marks, not sequence changes                                                    | Waterland & Jirtle (2003) |
| Honeybee queens and workers are genetically identical; differential gene expression from diet produces radically different organisms — the strongest "same genome, different expression" example | Evans & Wheeler (2001)    |

**Corpus anchor:** WS-C (organism versioning) treats the genome as the
versioned, restorable artifact — exactly the property that makes
epigenetic marks (environment × expression, ledgered, non-mutating)
the right divergence mechanism for production/dev: the genome is
identical and restorable; only expression differs, and the difference
is auditable history, not a fork.

## 4. The derivation claim (engineering novelty)

| Evidence                                                                                                                                                                                                   | Source                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Capability-based systems make authority an explicit, runtime-checked artifact — the protein model's ancestor for "behavior units with activation conditions"                                               | Miller (1966) capabilities          |
| Configuration-as-code literature treats environment as a first-class deployment dimension (12-factor config); UCH extends this to _cognition_: environment selects expression, expression selects behavior | 12-factor methodology (Heroku 2011) |

**Verdict:** the intake's claim is G1-grounded on the biology (central
dogma, operon regulation, epigenetics) and the engineering novelty is
a runtime process the corpus lacks: an _expression step_ between the
immutable genome and runtime behavior, with (a) declared environments,
(b) conservative fallback for undeclared environments, (c) ledgered
epigenetic marks (append-only, tick-ordered, replayable per Law 12),
and (d) proteins as observable behavior units whose parameters are
consumable by existing mechanisms (veto threshold θ from RFC-0005,
exploration bias from the decision law, sleep cadence).

## Special-case mapping (prototype scope)

| Corpus mechanism                   | Expression-system special case                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| RFC-0005 veto threshold θ          | `verification-strictness` gene: production protein sets θ = 0.5 (normative), development protein sets θ = 0.7 |
| Decision law λ weights (IDEA-0034) | `risk-profile` gene: exploration bias = λi/λe ratio per environment                                           |
| Sleep cycle cadence                | `sleep-cadence` gene: sleepEveryTicks per environment                                                         |
| Feature flags (IDEA-0069)          | Flags are instantaneous toggles; proteins are environment-bound synthesis with provenance                     |
| WS-C genome versioning             | Marks never mutate the genome; restore stays genome-level                                                     |

## Non-goals (kept out of this wave)

- No claim that the organism is literally biological; the biology is a
  _design source_, the engineering artifact is the expression runtime.
- No rewrite of genome storage — SpeciesGenome/WorkspaceGenome stay
  untouched; the prototype is a standalone module declaring the anchor.
- No protein-to-gate wiring — the prototype derives and exposes
  parameters; consuming organs wire them later (SOP-08 Prototype
  discipline).
- Epigenetic inheritance across sessions is specified but not
  implemented in v0.1.
