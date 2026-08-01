# IDEA-0078 — Cognitive UX Charter

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Not UI. The feeling. How predictable is it? How interruptible? How
  explainable? How trustworthy? How calm? How transparent? Users often
  judge systems by these qualities more than raw capability."
- **Related:** IDEA-0014 (cognitive observatory — the visibility
  surface), IDEA-0043 (astronomy + instruments — lenses), ADR-002
  (trace ledger — explainability substrate), IDEA-0057 (CQL — user
  questions as queries), src/cognitive-plane/replay (time machine,
  replay — "why" answers), IDEA-0071 (cognitive SLOs — calm =
  no SLO misses), IDEA-0070 (health — trust = honest health states),
  IDEA-0077 (human factors — communication style)

## Motivation

Users forgive capability gaps and forgive bugs; they abandon systems
that are unpredictable, un-interruptible, unexplainable, untrustworthy,
or stressful. UX for a cognitive organism is not a UI layer — it is a
set of *felt properties*: predictability (the organism behaves
consistently), interruptibility (the user can stop it), explainability
(it can answer why), trustworthiness (it admits uncertainty and
failure), calm (it doesn't panic or nag), transparency (it shows its
work). These are measurable and contractible, not aesthetic.

## The corpus cannot cover it because

Nothing in the corpus names, measures, or contracts the felt
properties. The trace ledger can *support* explainability, the
observatory can *display* state, replay can *answer* why — but there
is no charter defining the six qualities, no measurement of them, and
no guarantee (e.g., "every action is explainable within N steps of
ledger queries" as a Cognitive SLO under IDEA-0071). Interruptibility
has no contract at all (can a user stop a reasoning run? the
scheduler has preemption semantics but no user-facing interrupt
protocol).

## Proposal sketch

- A six-quality charter (predictability, interruptibility,
  explainability, trustworthiness, calm, transparency), each with a
  definition, a measurement, and a minimum guarantee.
- Contractual hooks: explainability = every decision has a ledger
  path (ADR-002 + replay) and a CQL answer (IDEA-0057);
  interruptibility = a user interrupt op on the signal bus (priority
  inversion: user interrupts outrank internal signals — IDEA-0010
  fabric); calm = SLO miss rate (IDEA-0071) and alarm hygiene;
  trust = honest health states (IDEA-0070) and uncertainty disclosure
  (decision law confidence).
- UX regressions tracked like bugs: a change that makes the organism
  less predictable is a defect with a measurement attached.

## Risk assessment

- Aesthetic theater: a charter with no measurements becomes a poster.
  Each quality must bind to an existing mechanism (ledger, bus,
  scheduler, SLOs) or it is cut from the charter.

## Where it lands

- `design/COGNITIVE-UX.md`; cross-references observatory + SLOs +
  health; user-facing behaviors are its compliance surface.

## Code impact

- None until the six guarantees are specified against existing
  mechanisms.

## Next stage

- Six definitions drafted, each mapped to the mechanism that will
  measure it.
