# IDEA-0135 — Cognitive Primitive Library

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-21 intake — "instead of 'Use SWOT', the
  system thinks 'I need to compare.'" A named taxonomy of atomic
  cognitive operations — Observe, Compare, Classify, Separate, Combine,
  Abstract, Generalize, Specify, Predict, Explain, Infer, Deduce,
  Induce, Abduce, Estimate, Evaluate, Prioritize, Optimize, Generate,
  Verify, Simulate, Challenge, Summarize, Translate, Remember, Forget,
  Adapt — with the composition rule that every framework is made of
  them.
- **Related:** IDEA-0023 (elemental primitives — the 7-class element
  table), `src/protocol/catalog.ts` (CP 17-op catalog), RFC-0004 (CIR
  instruction classes), IDEA-0136 (framework DNA — frameworks declare
  their primitive composition), IDEA-0132 (engine stack — primitives
  are the engine dispatch language), IDEA-0045 (CVM — executes
  deterministic primitives)

## Motivation

Intelligence lives underneath the frameworks: SWOT = Observe →
Categorize → Evaluate → Compare → Prioritize; Five Whys = Observe →
Ask Why → Infer Cause → Repeat → Stop when stable; Design Thinking =
Observe → Empathize → Generate → Prototype → Evaluate → Iterate. The
claim: a small named set of atomic operations + a composition rule makes
frameworks interchangeable, decomposable, and composable — the actual
cognitive language the FrameworkComposer should compile.

## The corpus cannot cover it because

IDEA-0023 is a 7-class element table (Information / Control / Dynamics
/ Identity / Learning / Governance / Interaction — types, not
operations) with a composition rule for capabilities; the CP catalog
enumerates 17 syscall ops for the runtime ABI (evaluate / critique /
etc.); CIR classes are perceptual / cognitive / delegated. No operation
taxonomy (observe / compare / classify / abduce / ...) exists, and no
framework in the 34-framework library declares its primitive
decomposition.

## Proposal sketch

- A 26-op named taxonomy with definitions, I/O, and energy/latency cost
  (catalog-style, IDEA-0035 units) — the cognitive counterpart of CP
  ops: the language layer between user intent and frameworks.
- Composition rule: every framework (IDEA-0136 DNA) declares its
  primitive pipeline, exactly as the CIR optimizer's instruction
  programs; frameworks become named compositions of primitives.
- Relationship: primitives are what the FrameworkComposer composes;
  the CVM (IDEA-0045) executes the deterministic subset as
  instructions; the engine dispatcher (IDEA-0132) classifies intent
  into operations.

## Risk assessment

- Proliferation: a taxonomy of 100 ops is useless. Anchor: cap at the
  26 named ops; new operations go through RFC governance (IDEA-0023
  rule: a new element is a constitution-level event).
- Naming drift: ops must be defined by I/O contracts, not prose.

## Where it lands

Extension of `src/protocol/catalog.ts` + the IDEA-0023 table; the
frameworks library declares compositions (IDEA-0136).

## Code impact

None until the framework → primitive decomposition pass; the composer
is the natural first consumer.

## Next stage

Decompose the 34 frameworks into the 26 ops; validate coverage
(every framework decomposes without residue — IDEA-0023 validation
discipline); then prototype composition.
