# IDEA-0042 — Cognitive Archaeology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "nothing is deleted; everything
  becomes history. You can answer 'why did we choose PostgreSQL 18
  months ago?' — not from logs, from preserved reasoning and evidence"
- **Related:** ADR-002 (OTel trace ledger), cognitive time machine
  (beliefsAt(t)), cognitive replay, version-store (neural-fs), decision
  journal, IDEA-0047 (UER — the causal graph this excavates)

## Motivation

The ledger preserves events; the time machine reconstructs beliefs; the
decision journal records decisions. The claim: an excavation layer that
answers *rationale* queries — why was X chosen, what evidence chain
supported it, when and why did it change — by requiring decisions to
capture reasoning (rationale + evidence references) at commit time and
by providing archaeology queries over the replay substrate.

## The corpus cannot cover it because

Time machine answers "what did we believe"; it does not answer "why did
we choose" — rationale capture at decision time and excavation queries
over preserved reasoning do not exist. Beliefs are reconstructed;
reasons are not yet preserved.

## Proposal sketch

- Extend the decision journal schema: rationale (structured reasoning),
  evidence references (trace ids), alternatives considered.
- Archaeology API over replay: why(decision), evidence-chain(decision),
  change-point(reasoning) — using the ledger's provenance.
- Archive discipline: excavation value must exceed storage cost;
  reuse the vmem Archive tier pattern — archaeology does not require
  infinite retention of everything.

## Risk assessment

- Hoarding: retaining rationale for everything is storage theater;
  tiered retention with archival for excavated-at-decision-time
  reasoning only.

## Where it lands

- Extends ADR-002 + time machine; design doc `design/COGNITIVE-ARCHAEOLOGY.md`.

## Code impact

- None until the journal schema change is specified.

## Next stage

Extend the decision journal schema with rationale; prototype the
"why X" query over replay on a synthetic history.
