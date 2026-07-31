# IDEA-0003 — Conservation laws: what can never disappear

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "experience cannot be destroyed"
- **Related:** Laws 2, 3, 4, 12; spec/FORMAL_FOUNDATIONS.md; design/COGNITIVE-TRACE.md

## Motivation

Physics has conservation laws. The vision's claim: cognition needs them too —
not as policy, but as the axiomatic statement of what transformations are
legal. Today the properties exist scattered across Laws (energy Law 2,
causality Law 3, evidence Law 4, reversibility Law 12) but there is no single
conservation regime, so "forgotten" experiences can vanish without a recorded
transform.

## The corpus cannot cover it because

No document declares conservation invariants or a legal-transform table. The
sleep cycle, archival, and pruning pathways are not audited against a
"nothing is destroyed, only transformed" invariant.

## Proposal sketch

Four conservation laws, each with a transform table:

| Law | Statement | Legal transforms |
| --- | --- | --- |
| C1 | Experience is never destroyed | compress, forget, archive, generalize |
| C2 | Every decision keeps a provenance chain | trace linkage, never severed (Law 3) |
| C3 | Knowledge requires evidence | confidence decays but evidence is retained (Law 4) |
| C4 | Signal information is conserved under lawful transformation | replayable ledger (Law 12) |

"Forgotten" means: a recorded transition into a lower-fidelity form with a
trace entry — never a silent deletion.

## Where it lands

- `spec/CONSTITUTION.md` — conservation regime section (after RFC).
- `src/sleep_cycle/` + `src/kernel/memory/vmem/` — transform auditing.

## Code impact

- Archival/forgetting paths gain a transform record (small, additive).
- Replay and Time Machine can prove conservation retrospectively.

## Next stage

Folded into RFC-0005 (Cognitive Physics) as its conservation part.
