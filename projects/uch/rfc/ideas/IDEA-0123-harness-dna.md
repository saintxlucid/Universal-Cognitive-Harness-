# IDEA-0123 — Harness DNA (expressed adapters, not written ones)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 cognitive-architecture intake (round 16,
  second half) — "The idea I think is the most original: don't build
  adapters. Build Harness DNA. Every integration is described
  genetically: Genome → Capabilities → Proteins → Integration
  Behavior → Synchronization → Optimization. The adapter isn't
  written. It's expressed."
- **Related:** IDEA-0090 (Cognitive Expression System — EXECUTED:
  expression engine, genes → proteins → behavior, RFC-0006; this
  idea extends expression from configuration behavior to integration
  behavior), RFC-0006 (expression RFC), src/cognitive-plane/genome/
  expression/ (expression-engine.ts + benchmark), IDEA-0104
  (universal adapter compiler — compile-from-manifest codegen;
  harness DNA is express-from-genome: a runtime interprets proteins
  instead of generating code), IDEA-0118 (UCCD — the descriptor the
  expression must satisfy), IDEA-0102 (runtime fingerprint — the
  environment the expression adapts to), IDEA-0096 (UCCL — the
  ten-method contract the adapter proteins implement), IDEA-0010
  (signal fabric — the expressed behavior's event vocabulary),
  IDEA-0109 (AHP — a concrete adapter target for an expressed
  protein), IDEA-0008 (genome evolution — Git for genomes)

## Motivation

Adapters are the largest bespoke surface in the corpus's integration
layer: every platform needs its own driver, hand-written, reviewable,
and maintenance-prone. The intake's claim: express integration
behavior from a genome — a declarative protein program ("connect via
AHP, authenticate via OAuth, emit session deltas as UCP events,
checkpoint on suspend") interpreted by a generic adapter runtime.
The corpus already proved expression works for _configuration_
behavior (0090: verification-strictness, risk profile, sleep
cadence — executed with 23 tests); harness DNA applies the same
mechanism to _integration_ behavior, where the delta-over-generated-
floor discipline of 0104 still applies (expressed floor + bespoke
delta hooks for platforms the proteins cannot reach).

## The corpus cannot cover it because

- IDEA-0090's protein catalog covers organism behavior (theta, risk,
  cadence); no protein vocabulary exists for adapter behavior
  (protocol dialect, session semantics, event mapping, handshake
  sequencing).
- IDEA-0104 compiles adapters from a manifest (deterministic
  codegen); harness DNA _interprets_ a genome at runtime — the two
  are complementary (codegen for static surfaces, expression for
  behavioral surfaces) but 0104 has no runtime-interpreted
  counterpart.
- Every driver in src/drivers/ is hand-written; the corpus has no
  mechanism that would let a new platform's adapter be _expressed_
  from a genome + verified proteins rather than authored.

## Proposal sketch

- **Adapter protein catalog** over the UCCL ten-method contract
  (0096): discover / connect / authenticate / capabilities / observe
  / execute / synchronize / heartbeat / checkpoint / disconnect —
  each protein declared with its behavioral contract (0073) and
  verification benchmark against the platform.
- **Expression**: the existing expression engine (0090) gains an
  integration-protein vocabulary; a harness genome declares
  "capabilities → proteins → integration behavior → synchronization
  → optimization"; the engine interprets it into a live adapter.
- **Epigenetics** (0090): environment switches behavior — production
  conservative / dev experimental — applied to integration behavior
  (e.g., a dev environment may emit richer telemetry).
- **Hybrid floor**: platforms beyond the protein vocabulary keep
  bespoke delta hooks; the expressed floor is always the default,
  deltas are the exception (0104's deltas-over-generated-floor
  rule).

## Risk assessment

- Expressiveness ceiling: some platform quirks resist declarative
  expression — the hybrid rule (expressed floor + delta hooks) is
  mandatory, not optional.
- Verification: every protein must be benchmarked against the real
  platform (expression-benchmark pattern); an unverified protein
  must not serve at verified level (0105 honesty rule).
- Genome drift: harness genomes version with platforms; fingerprints
  (0102) trigger re-expression on change.

## Where it lands

- Extends `src/cognitive-plane/genome/expression/` with the
  integration-protein vocabulary; adapter runtime in `src/drivers/`;
  RFC-0006 amendment for the protein catalog.

## Code impact

- None until designed; seeds are expression-engine.ts, UCCL contract
  (0096), driver compliance (compliance.ts), contracts registry
  (0073).

## Next stage

- Prototype: express ONE adapter from a genome (the AHP client per
  0109 is the natural target) — assert the interpreted adapter
  passes the same conformance checks as a hand-written one.
