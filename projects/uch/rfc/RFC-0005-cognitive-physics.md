# RFC-0005 — Cognitive Physics: quantities, conservation, and failure

- **Status:** Draft — proposed (SOP-08 stages 1-2: idea + research; not yet accepted)
- **Family:** Physics (1, 2, 3, 5, 15, 16, 17, 32)
- **Related:** spec/FORMAL_FOUNDATIONS.md, spec/LAWS_OF_COGNITIVE_PHYSICS.md, design/ENGINEERING-INTELLIGENCE.md, rfc/ideas/IDEA-0001/0003/0004/0005
- **Date:** 2026-08-01

## Summary

Give the Cognitive Universe its mathematics: a unit system of measured
quantities (Part 1), a conservation regime stating what can never disappear
(Part 2), a failure physics treating hallucination, drift, and contradiction
as measurable instabilities (Part 3), and closed-form cognitive calculus for
confidence, trust, decay, and learning (Part 4). The runtime computes; it
does not guess.

## Problem

The Laws state what is impossible; FORMAL_FOUNDATIONS defines entropy, IG,
novelty, and KD. Yet every derived number in the runtime is hand-tuned:
organic-score thresholds, decay half-lives, veto gates, forgetting
parameters. There is no unit system, no conservation invariant audited
across transform pathways (sleep cycle, archive, prune), no instability
quantity behind "hallucination", and no closed form for confidence or trust.

## Proposal (four parts — see FORMAL_FOUNDATIONS Part VIII draft)

1. **Quantities and units** — signal momentum, knowledge velocity, memory
   half-life, trust gradient, attention density, learning rate, evidence
   mass, cognitive pressure, uncertainty field — defined over the existing
   primitives, typed like `EnergyUnit`/`Entropy` (FORMAL_FOUNDATIONS §6.2).
2. **Conservation laws C1-C4** — experience is never destroyed (only
   transformed: compress/forget/archive/generalize, each recorded); every
   decision keeps a provenance chain; knowledge requires evidence; signal
   information is conserved under lawful transformation. Forgotten means a
   recorded transition, never a silent deletion.
3. **Failure physics** — instability `I(b) = confidence(b) − evidenceMass(b)`;
   contradiction as potential energy; verification as stabilization; veto
   gates become stability conditions.
4. **Cognitive calculus** — candidate closed forms (Bayesian-style confidence
   update, Law-5 exponential trust decay, power-law learning convergence,
   spacing-based memory strength) — to be researched and benchmarked, not
   enacted on speculation.

## Prototype results (instability-veto parity benchmark)

Implementation: `src/engineering-intelligence/failure-physics/instability.ts`
(new module, not wired into any gate — SOP-08 Prototype stage), benchmarked
against the 17-case EI corpus (`benchmark/corpus.ts`).

| Metric | Result |
| --- | --- |
| Rule-based veto recall (existing evaluator) | 5/5 (1.0) |
| Instability-based veto recall | 5/5 (1.0) |
| Negative-control pass rate | 5/5 (1.0) |
| Advisory non-veto rate | 7/7 (1.0) |
| Separability (min veto I > max non-veto I) | yes — 0.7 > 0.25 |
| Calibrated threshold range | (0.25, 0.7]; θ = 0.5 |

Two findings from the prototype that the physics framing caught:

1. **Negation bug in naive defense counting**: "no standby" counted as
   defense evidence mass; stated absence of a mitigation is evidence FOR the
   failure claim. Fixed via negated-marker stripping.
2. **Instability is signed**: a stable belief has negative instability
   (evidence mass exceeding signal), which the max-function must preserve
   to expose the stability margin.

Baseline fix recorded during the gate run: `src/kernel/process/process-table.ts`
was missing the `ProcessStatus` type import (committed baseline typecheck
error, tracked file, owned by no wave) — added.

## Five Gates verdict (provisional — declared for RFC stage)

| Gate | Verdict |
| --- | --- |
| G1 Scientific | Pass — direct analogs in belief-revision (AGM), forgetting models (Ebbinghaus), control stability |
| G2 Architectural | Pass — derives from Laws 2/3/4/5/12; strengthens them; no new law required |
| G3 Engineering | Pass — units extend the branded-type pattern; transforms auditable; EI-corpus benchmarkable |
| G4 Biological | Pass — conservation mirrors metabolism accounting; decay mirrors forgetting physiology |
| G5 Economic | Pass — derived gates replace hand-tuning; audit trails reduce maintenance cost |

## Open items

1. Research evidence register for each closed form (AGM belief revision,
   Ebbinghaus/spaced repetition, power-law skill acquisition).
2. Benchmark plan: organic-score vetoes re-derived from `I(b)` vs current
   thresholds — parity or improvement required.
3. Transform-audit of existing pathways (sleep cycle, vmem archive) before
   C1 can be enforced.

## Milestones

- [x] Idea notes (IDEA-0001/0003/0004/0005) — done
- [x] Draft text in FORMAL_FOUNDATIONS.md Part VIII — done (non-normative)
- [x] Research register — done (research/foundations/05-cognitive-calculus.md)
- [x] Prototype: instability-based veto parity benchmark — done
      (failure-physics/instability.ts; 13 tests; parity 1.0 on 17 cases)
- [x] Independent held-out corpus for θ calibration — done
      (failure-physics/held-out.ts: 16 cases, new wording; θ = 0.5
      generalizes — held-out veto recall 6/6, negatives 5/5 clean,
      separability (0.25, 0.6], θ_heldout cross-applies to train;
      heldout-calibration.ts + 10 tests)
- [x] Architecture review → security review → constitution check — done
      (see "Reviews" below; 2026-08-01)
- [x] Acceptance → promotion to `spec/` + VERSION.md bump — done
      (FORMAL_FOUNDATIONS.md Part VIII now normative; corpus 0.2.0 → 0.3.0)

## Reviews (2026-08-01)

### Architecture review — PASS

- Additive: `failure-physics/` is a new module; `calibrateThreshold`
  widened to the structural `{group, target}` shape only (behavior-
  preserving — parity tests untouched).
- Deterministic and dependency-free: pure string matching + arithmetic;
  no I/O, no exec, no new runtime dependencies.
- The instability veto is a special case of the unified decision law
  (IDEA-0034 prototype): risk term = maxInstability; gate regions derive
  from the objective, and parity holds on the same corpus (veto 5/5
  reject). Prototype discipline kept both unwired (SOP-08).
- Open item "organic-score vetoes re-derived from I(b)": satisfied by
  the EI Wave C hookup — EngineeringEvaluator findings (incl. the same
  failure families) feed OrganicScoreEngine with a hard-veto gate, and
  the corpus parity (rule 1.0 = instability 1.0) holds on 17 cases +
  16 held-out.

### Security review — PASS (no findings)

- The module never executes target text: substring matching against
  constant marker lists only; no command construction, no path handling,
  no external calls. Targets are already an accepted evaluator input
  surface (diffs/prose).
- Thresholds, weights, and marker lists are compile-time constants;
  there is no configuration-injection surface.
- Negation stripping ("no standby" ≠ defense) is the only transformation
  and operates on a local lowercase copy.

### Constitution check — PASS

- **Law 7 (no security smells in shipped code):** the module *detects*
  failure claims; it ships no security smell itself. Veto threshold
  rejects rather than silently accepting unstable beliefs.
- **Law 8 (no error-masking):** signed instability preserves the
  stability margin; a negative I(b) is visible evidence, not an
  averaged-away failure.
- **Integrity laws (Objectivity / Qualified Source / No Prejudice /
  Whole Truth):** beliefs are evidence-mass-accounted with negation
  awareness; calibration is corpus- and held-out-validated, not tuned
  by hand.
- **Covenant laws (SOC / DRY / KISS / DYC / YAGNI):** one threshold θ
  shared with the decision law; reuses the existing evaluator and
  corpus; no duplicated gate logic; no speculative terms (novelty/
  reversibility are recorded but unused).

### Acceptance — APPROVED (2026-08-01)

Part VIII of `spec/FORMAL_FOUNDATIONS.md` is promoted from DRAFT to
normative per SOP-08 stage 10 (Specification). The corpus version bump
0.2.0 → 0.3.0 is declared in `spec/VERSION.md` with changelog entry.
Reference implementation remains the prototype module; the
constitution-engine hookup (IDEA-0053) is tracked separately.
