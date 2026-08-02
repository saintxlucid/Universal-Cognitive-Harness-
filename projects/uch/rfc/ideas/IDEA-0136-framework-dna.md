# IDEA-0136 — Framework DNA

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-21 intake — "UCH doesn't search by name,
  it searches by DNA": Name, Purpose, Input, Output, Assumptions,
  Limitations, Required Evidence, Complexity, Confidence, Speed,
  Accuracy, Failure Modes, Compatible Frameworks, Conflicting
  Frameworks, Primitive Operations. Example: high uncertainty + high
  urgency + multiple stakeholders + incomplete information →
  Cynefin + OODA + Decision Matrix + Delphi + Monte Carlo.
- **Related:** `src/cognitive-plane/frameworks/` (FrameworkDefinition
  metadata + registry.select), IDEA-0135 (primitive operations — the
  DNA composition field), FrameworkComposer (`uch solve`), IDEA-0050
  (knowledge fabric — compatibility edges), IDEA-0074 (failure
  taxonomy — failure-mode vocabulary), IDEA-0023 (element composition
  rule)

## Motivation

Framework selection today is the registry's `select` — context flags
(dataRich, timeCritical, groupNeeded, rootCauseNeeded, humanCentered,
continuousImprovement, speedAdaptability, comprehensiveRigor) over 34
frameworks. The claim: a richer DNA record plus a compatibility /
conflict graph turns selection into a search over metadata and
composition into a graph walk — "find me the best framework" becomes a
structured query, not keyword matching.

## The corpus cannot cover it because

FrameworkDefinition has id / family / name / purpose / bestFor /
whenNotToUse / stages / selection / source — missing: input/output
contracts, assumptions, required evidence, confidence, speed,
accuracy, failure modes, compatible/conflicting framework edges, and
primitive composition (IDEA-0135). No compatibility or conflict graph
exists — whenNotToUse is prose, not edges — and selection is flag-based,
not DNA-search.

## Proposal sketch

- DNA fields extension: input/output, assumptions, requiredEvidence,
  complexity / confidence / speed / accuracy (catalog-style, IDEA-0035
  units), failureModes (vocabulary from IDEA-0074), primitives
  (IDEA-0135 composition).
- Compatibility / conflict graph: edges between frameworks
  (complements / conflicts / subsumes) — the graph the composer walks
  when assembling multi-framework workflows. The FrameworkComposer
  exists; the graph makes its composition principled instead of
  assembled by hand.
- DNA-vector selection: query by problem properties (uncertainty,
  urgency, stakeholders, information completeness) → ranked framework
  sets; complements, not replaces, registry.select.

## Risk assessment

- Metadata rot: DNA fields must be derivable from the framework's own
  tests and benchmarks, or they will lie. Anchor: confidence / speed /
  accuracy from the framework bench harness; failure modes from
  IDEA-0074.
- Overlap with registry.select: DNA search is a superset query surface;
  keep select as the fast path.

## Where it lands

`src/cognitive-plane/frameworks/` registry extension + fabric
compatibility edges (IDEA-0050).

## Code impact

None until the metadata extension + compatibility graph over the 34
frameworks; the composer is the consumer.

## Next stage

Extend the registry metadata; build the compatibility graph; wire DNA
search into the composer's selection.
