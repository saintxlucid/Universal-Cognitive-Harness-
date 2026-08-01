# IDEA-0131 — Cognitive Architecture Decision Records (CADRs)

- **Status:** Idea (SOP-08 stage 1 — no code)
- **Origin:** 2026-08-01 inflection intake (round 20) — "every major
  cognitive decision becomes an immutable, queryable record... the
  runtime consults these records instead of relying on inferred
  history." Software ADRs evolved into the cognitive domain: each
  CADR carries Problem, Context, Alternatives considered, Evidence,
  Decision, Trade-offs, Expected outcomes, Runtime metrics,
  Validation status, Superseded by, Related decisions.
- **Related:** UCH ADR-001..006 (human-authored architecture
  decisions), FrameworkDecisionJournal (`src/cognitive-plane/
frameworks/journal/decision-journal.ts` — framework verdict claims,
  mutable, 8 fields), IDEA-0040 (cognitive jurisprudence: precedent/
  citation/overrule over the decision journal), IDEA-0042 (cognitive
  archaeology: rationale capture + why() queries), IDEA-0022
  (architecture review board: lens registry with evidence + veto
  aggregation), IDEA-0073 (contracts registry: behavioral contracts),
  IDEA-0051 (engineering database: tradeoffs/meetings/successes/
  experiments as versioned records), IDEA-0034 (decision law —
  policies consulted at decision time), WS-D (transactional
  cognition: propose → verify → commit/rollback)

## Motivation

UCH makes thousands of runtime decisions (governance verdicts,
engineering reviews, framework selections, memory evictions, schedule
priorities, constitution checks). Today those decisions are recorded
in heterogeneous places with different shapes: the framework journal
(engine → verdict → quality), the decision journal/calibration
takes, trace ledger spans, EI findings, ADR markdown files. None of
them is (a) immutable, (b) uniformly queryable, or (c) consulted by
the runtime at decision time as a _precedent_ — the way software
ADRs are consulted by engineers. The runtime reconstructs "why did
we decide this" from inferred history (traces, journals) rather than
reading the record of the decision itself.

## The corpus cannot cover it because

- The FrameworkDecisionJournal is mutable (`resolve()` mutates in
  place), scoped to framework verdicts, and has none of: alternatives
  considered, trade-offs, expected outcomes, runtime metrics,
  validation status, superseded-by, related decisions.
- UCH's own ADRs (001-006) are markdown, human-authored, and not
  machine-queryable at runtime — they document the project, not the
  organism's cognition.
- IDEA-0040 jurisprudence is case law _over_ verdicts (precedent,
  citation, overrule) but presupposes a decision record type to
  cite; the record type is the missing substrate.
- IDEA-0042 archaeology asks why() over the ledger after the fact —
  capture, not a consulted-at-decision-time record.
- No existing type pairs _evidence_ with _expected outcomes_ and
  closes the loop with _runtime metrics_ + _validation status_ — the
  calibration loop (IDEA-0034) needs exactly this pairing to
  reweight policies when outcomes diverge from expectations.

## Proposal sketch

- **CADR as a kernel-adjacent record type** (service, per ADR-006 —
  never kernel-required): immutable append-only records, eleven
  fields as listed above, stored in the ledger lineage
  (traceparent-linked), queryable via the lineage/archaeology
  surface.
- **Runtime consultation:** decision points (governance gate,
  engineering evaluator, framework selection, memory policy,
  scheduler priority) consult relevant CADRs as precedent before
  deciding — "decide like the last validated decision on this
  problem class" with explicit citation (IDEA-0040's case law).
- **Outcome closure:** each CADR's expected outcomes are checked
  against runtime metrics at validation time; validation status
  transitions proposed → validated / contradicted; superseded-by
  chains give the runtime a decision ancestry instead of inferred
  history.
- **Boundary rule:** the record format and consultation protocol are
  normative; which decision classes require a CADR and how many
  precedents are consulted stays policy (IDEA-0069 feature flags /
  IDEA-0016 economics).

## Risk assessment

- Bureaucracy of cognition: CADRs must be cheap (auto-drafted from
  the decision law + EI findings + evidence) or the runtime will
  skip them; the format is the contract, the drafting is
  mechanical.
- Overcitationality: consulting too many precedents slows decisions
  and can entrench stale verdicts; consultation depth is a policy
  knob, and contradicted records must rank below validated ones.

## Where it lands

- `design/COGNITIVE-DECISION-RECORDS.md`; record type in
  `src/cognitive-plane/decisions/`; consultation hooks at the
  governance gate + engineering evaluator + framework selection;
  validation sweeps over ADR-002 ledger metrics; `uch decisions`
  CLI + MCP tool.

## Code impact

- None at SOP-08 stage 1. Later: immutable record store over the
  trace-persistence write path (W-01), precedent-consultation hook
  (decision law), outcome-validation sweep.

## Next stage

Define the normative eleven-field schema (with conformance test per
IDEA-0048), then prototype consultation at one decision point
(governance gate) with a small precedent corpus.
