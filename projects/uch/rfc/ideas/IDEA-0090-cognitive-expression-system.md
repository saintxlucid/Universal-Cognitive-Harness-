# IDEA-0090 — Cognitive Expression System (Proteins + Epigenetics)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 cognitive-microarchitecture intake (round 12) —
  "Engineering DNA Expression: Genes shouldn't be configuration. Genes
  express proteins. Proteins produce behaviors. Security Gene → Strict
  Verification Protein → Runtime Behavior. Not strict=true. Cognitive
  Epigenetics: Genes don't change. Expression does. Production →
  Conservative. Development → Experimental. Same genome. Different
  expression."
- **Related:** spec/GENOME.md + src/cognitive-plane/genome/
  species-genome.ts (law sets) + workspace-genome.ts (preferences —
  read as static config), src/kernel/organism/ (WS-C versioned
  organism + restore), IDEA-0008 (genome evolution), IDEA-0033
  (cognitive firmware — capability hierarchy Laws → Kernel → Firmware →
  Organs → Skills), src/cognitive-plane/protocol/feature-flags.ts
  (flag semantics — versioned enablement), budgets (energy economics),
  IDEA-0069 (feature flags + versioned cognition), ADR-006 (genome as
  kernel primitive)

## Motivation

The genome is a config file read at boot: species-genome selects law
sets, workspace-genome carries preferences. Biology does not work that
way — genes are _expressed_: a gene produces proteins, proteins do the
work, and the environment regulates which genes are expressed at all.
The intake's claim is that UCH's genome needs the same two steps it is
missing: an _expression_ step (genome + environment → proteins) and
_runtime proteins_ (behavior units, not configuration values). And
epigenetics: the same genome expresses differently in production
(conservative) vs development (experimental) — divergence becomes an
expression profile, not a fork of the genome. This is the round's
strongest missing primitive: it turns the genome from static
configuration into a developmental runtime, and it makes
environment-dependent behavior explicit, versioned, and
non-destructive.

## The corpus cannot cover it because

The genome is read, never expressed: nothing synthesizes runtime
behavior from genes; there is no protein concept anywhere (grep-proven
absence); environment-dependence is handled by feature flags
(IDEA-0069) — binary toggles — not by an expression system. Workspace
DNA fingerprints mutations, WS-C versioning restores genomes, but
neither produces behavior. Production/dev divergence today means
editing config; epigenetics would make it a ledgered expression
choice under the same genome.

## Proposal sketch

- Genes declare expression rules: `(environment, state) → protein
synthesis`, where a protein is a runtime behavior unit — a policy
  bundle with activation conditions (e.g., verification strictness,
  risk profile, sleep cadence), materially richer than a `strict=true`
  flag because proteins compose and respond to state.
- Expression profiles per environment: production → conservative
  profile, development → experimental profile, same genome object;
  profile switches are ledgered epigenetic marks — the genome file
  never changes, the expression does (WS-C restore stays genome-level).
- Proteins are observable: each protein reports to the health registry
  (IDEA-0070) and its synthesis is traceable (which gene, which
  environment, which tick) — expression becomes auditable, making the
  genome a developmental substrate rather than a config dump.
- Epigenetic marks are inheritable across sessions but never mutate
  the genome; mutations stay the genome-evolution path (IDEA-0008).

## Risk assessment

- Expression explosion: unconstrained synthesis is unmaintainable —
  proteins are limited to a small catalog (firmware tier, IDEA-0033)
  with synthesis governed by budgets; every protein must answer "what
  gene, why now".
- Profile drift: environments must be declared, not inferred — an
  undeclared environment falls back to the conservative profile and
  logs the ambiguity.

## Where it lands

- `src/cognitive-plane/genome/` (expression engine + protein catalog),
  `src/kernel/organism/` (epigenetic marks), health registry (protein
  reporting).

## Code impact

- None until the expression contract is specified; species-genome +
  workspace-genome + feature flags are the seed.

## Next stage

- Prototype: express two genes (verification strictness, risk profile)
  across production/dev profiles; assert same genome, different
  proteins, ledgered switch.
