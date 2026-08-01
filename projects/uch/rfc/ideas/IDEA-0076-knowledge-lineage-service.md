# IDEA-0076 — Knowledge Lineage Service

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Every idea should answer: Where did I come from? Who created me?
  What changed me? Why? Who verified me? What depends on me? Not logs.
  Lineage."
- **Related:** ADR-002 (OTel trace ledger — provenance metadata,
  replay_of, W3C traceparent), src/cognitive-plane/replay/uer-graph.ts
  (IDEA-0047 — causal graph, influence-path/ancestry/change-point
  queries), src/cognitive-plane/replay/cognitive-time-machine.ts
  (beliefsAt/diffBeliefs), decision journal (frameworks), IDEA-0042
  (cognitive archaeology — rationale capture + why() queries),
  IDEA-0057 (CQL — FIND ... CAUSED BY), IDEA-0051 (engineering
  database — provenance-attached records), neural-event metadata
  (provenance field), IDEA-0072 (lifecycle — extinct objects keep
  lineage records)

## Motivation

Logs answer "what happened when". Lineage answers "who is responsible
for this belief, what changed it, why, who verified it, and what now
depends on it". A belief that can name its creator, its changelog, its
verifiers, and its dependents is auditable, correctable, and safe to
trust; one that cannot is a rumor. The corpus records provenance at
many points (ledger metadata, UER causal edges, decision journal
entries, event provenance) but there is no *uniform service* that
answers all five lineage questions for any object in one call.

## The corpus cannot cover it because

Provenance is fragmented: the ledger knows *events*, UER knows
*causal structure* (currently in-memory prototype), the journal knows
*decisions*, the time machine knows *belief states* — no query surface
spans them. "Who verified me" has no canonical answer (verification
verdicts live in benchmark runs, organic scores, and review records);
"what depends on me" exists only inside UER's prototype graph.
IDEA-0042 proposes the why() queries but is stage-1.

## Proposal sketch

- A lineage service exposing one interface over the existing stores:
  origin (creator + creation event), changelog (who/what/why per
  change), verification (which verdicts, which runs), and dependents
  (reverse causal edges) — UER becomes the causal spine, the ledger
  the event spine.
- Lineage as a lifecycle obligation (IDEA-0072): every object class
  declares its lineage fields; extinct objects retain a lineage stub
  ("where did I come from" survives death).
- CQL operators (IDEA-0057) over lineage: FIND belief WHERE
  verified_by = `<certificate>`; dependencies report for the
  observatory (IDEA-0014).

## Risk assessment

- Lineage theater: recording provenance nobody queries is cost without
  value. Every stored field must have a query it answers; the service
  must be read-mostly and cheap (read-model over the ledger, per
  Law-12 read model discipline).

## Where it lands

- `design/LINEAGE.md`; composes UER (IDEA-0047) + ledger + journal;
  CQL (IDEA-0057) gains lineage operators.

## Code impact

- None until the service interface is specified; the UER graph is the
  first implementation target (its P2 phase).

## Next stage

- Five-question interface drafted; map existing provenance fields onto
  it to find gaps.
