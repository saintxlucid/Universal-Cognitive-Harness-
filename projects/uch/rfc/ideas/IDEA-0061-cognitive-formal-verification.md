# IDEA-0061 — Cognitive Formal Verification

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "Instead of
  verifying only code, verify the reasoning graph itself. Can this
  execution path violate the Constitution? Is there a contradiction in
  the evidence graph? Can this workflow produce an unverifiable claim?
  Does every state transition preserve provenance?"
- **Related:** spec/CONSTITUTION.md + 32 Laws, `constitution.ts`
  (integrity/covenant checks), spec/FORMAL_FOUNDATIONS.md (Part I set
  theory / graphs / temporal logic; Part VIII normative), conformance
  (`conformance.ts`, driver compliance), EI benchmark corpus +
  `benchmark/runner.ts`, IDEA-0053 (constitution engine — execute-time
  enforcement), IDEA-0026 (cognitive mathematics), IDEA-0022 (review
  board)

## Motivation

Today the Constitution is enforced at evaluation points (constitution
checks, integrity gates, organic-score vetoes) — i.e., at runtime, one
decision at a time. Formal methods transformed safety-critical
software because they prove *all* paths, not the ones that happened to
run. The same leap applies here: model-check the reasoning graph itself
before it executes. UCH is unusually well-positioned — it already has a
bounded op set (CP v1, 17 ops), a deterministic subset (CVM design), a
typed provenance model, and a constitutional law set that is
declarative enough to compile into invariants.

## The corpus cannot cover it because

`constitution-check` is a runtime gate on concrete states; nothing
proves properties over the *graph of possible executions*: path
reachability to a Law violation, contradiction detection in the
evidence graph (contradiction checks are per-decision, not global),
provenance-preservation over state transitions, or dead-end
reachability (workflows that can only produce unverifiable claims).
IDEA-0053 centralizes enforcement but is still execute-time.

## Proposal sketch

- Model: reasoning graph → transition system (CP ops as transitions,
  beliefs/evidence as state, Laws as safety invariants,
  provenance fields as frame conditions).
- Queries: reachability of `integrity:`/`covenant:` violations; global
  contradiction detection over the evidence graph (two evidential paths
  to ¬p and p); provenance preservation (no transition loses
  provenance without ledger record); liveness (every plan branch can
  terminate or verify).
- Verdicts: proved / counterexample-trace (rendered as a replayable
  ledger trace — the counterexample becomes input to the kernel
  debugger, IDEA-0059).
- Cost guard: full model-checking is exponential; the practical surface
  is the deterministic subset (CVM) + abstraction to the op-graph level;
  EI benchmark corpus extends with verification-grade cases.

## Risk assessment

- False negatives (proving safety of an abstraction that doesn't
  capture a real path) are the classic failure; abstraction must be
  conformance-tied. Scope discipline: verification is a *gate input*,
  never a replacement for runtime checks — both layers stay.

## Where it lands

- Design doc `design/FORMAL-VERIFICATION.md`; prototype over the CVM
  deterministic subset once RFC-0004 reaches Specification.

## Code impact

- None until CIR/CVM lands (IDEA-0045 is blocked on RFC-0004);
  meanwhile: property catalog drafted against the 32 Laws.

## Next stage

- Encode 3 Laws as model-checker invariants on paper; property catalog;
  then a bounded reachability prototype over the CP op graph.
