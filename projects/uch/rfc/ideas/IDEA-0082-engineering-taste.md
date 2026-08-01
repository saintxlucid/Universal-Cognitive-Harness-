# IDEA-0082 — Engineering Taste

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Teach the organism Elegant, Simple, Composable, Minimal, Readable,
  Maintainable, Beautiful. Taste becomes measurable."
- **Related:** src/kernel/constitution/organic-score.ts (15-metric
  Organic Score rubric — elegance/simplicity/composability/minimality/
  readability/maintainability are already scored; gate ≥ 90),
  .agents/skills/organic-code + organic-review (rubric + senior review),
  engineering constitution (14 laws — SOC/DRY/KISS/DYC/YAGNI), design/
  DIRECTIONS.md (quality gates), IDEA-0073 (contracts registry —
  taste as a contract dimension), IDEA-0077 (human factors — review
  style), IDEA-0067 (organ design system — design tokens)

## Motivation

Taste is the one thing almost nobody formalizes — yet it is what
separates code that ages well from code that gets rewritten. The
intake's claim: elegance, simplicity, composability, minimality,
readability, maintainability, beauty can be *taught* and *measured*.
The corpus has already done most of this: the Organic Score rubric
scores six of the seven qualities on a 15-metric rubric with a
constitutional gate — taste is already measurable for *changes*.

## The corpus cannot cover it because

The score exists at evaluation time but not as a *trait*: it is not
accumulated per author/organ, not versioned as a standard (the rubric
itself is code, not a spec — IDEA-0083), not applied to non-code
artifacts (designs, plans, docs), and 'beautiful' is only implicit
(the rubric's aesthetic dimension is weak). Taste is measured for a
diff; it is not *cultivated* — nothing learns from taste verdicts
(skills that reliably produce ≥ 90 scores could be reinforced per
IDEA-0033 firmware).

## Proposal sketch

- Taste as a spec: the rubric's metrics promoted to a versioned
  standard in the specification repository (IDEA-0083) so taste
  criteria are reviewable and diffable — and the organic score engine
  becomes the reference implementation of the spec.
- Taste accumulation: per-author and per-skill taste history (from the
  engineering database IDEA-0051) so the organism can route work to
  what reliably produces elegant results, and can *teach* (feedback
  loops into skill firmware).
- Taste extends beyond code: design docs, plans, and contracts
  (IDEA-0073) get taste dimensions (clarity, minimality,
  composability).

## Risk assessment

- Taste orthodoxy: a frozen rubric becomes a style cage. The spec must
  version and the rubric must accept amendments via the RFC process
  (SOP-08) — taste standards evolve like language standards.

## Where it lands

- Rubric promotion to `spec/TASTE.md` + `design/TASTE.md`; the
  organic-score engine keeps its role as the implementation.

## Code impact

- None until the rubric is promoted to spec form; the engine's metric
  set is unchanged.

## Next stage

- Rubric drafted as a spec (metric definitions + weights + gate);
  'beautiful' dimension strengthened with a measurable proxy.
