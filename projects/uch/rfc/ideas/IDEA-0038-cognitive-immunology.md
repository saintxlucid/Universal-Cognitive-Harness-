# IDEA-0038 — Cognitive Immunology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "beyond security: detect
  conceptual infections — repeated hallucination → immune response;
  repeated bad abstraction → antibody; repeated architectural smell →
  future prevention. The organism develops immunity"
- **Related:** src/cognitive-core/immune.ts (+ endocrine), constitution
  (information integrity laws), `.agents/skills/ai-code-pitfalls`
  (36-pitfall catalog), mistake-db, organic-score vetoes,
  engineering-intelligence findings

## Motivation

An immune organ exists in the corpus (exoskeleton immune/endocrine
moved into cognitive-core). The claim: formalize its *semantics* —
conceptual infection as a recurring class of error (hallucination,
bad abstraction, architectural smell), exposure tracking via
mistake-db, antibody synthesis as a prevention rule promoted into a
constitution check or pitfall-catalog entry, immunity memory as
lasting behavioral change, and vaccines as benchmark corpus cases
(the EI benchmark corpus already exists).

## The corpus cannot cover it because

The immune organ's pattern-detection semantics are not formalized:
no infection-class taxonomy, no exposure/response/immunity lifecycle
at the concept level, no antibody registry with promotion rules.

## Proposal sketch

- Infection classes: hallucination, bad abstraction, architectural
  smell, masked error, and the other ai-code-pitfalls families.
- Lifecycle: exposure (mistake-db entries classified) → response
  (correction + prevention recorded) → antibody (prevention rule
  promoted to a check) → immunity (benchmark corpus asserts the rule).
- Antibodies must be overridable (a later case can dissolve one) to
  avoid ossification.

## Risk assessment

- False positives: antibodies must not block legitimate variation;
  every promotion needs evidence, mirroring constitution change
  governance.

## Where it lands

- Design doc `design/COGNITIVE-IMMUNOLOGY.md`; extends immune organ +
  mistake-db.

## Code impact

- None until the lifecycle is specified over existing stores.

## Next stage

Classify existing mistake-db entries into infection classes;
prototype one full antibody lifecycle end-to-end.
