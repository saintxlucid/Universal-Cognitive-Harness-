# IDEA-0057 — Cognitive Query Language (CQL)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Phase Ω platform infrastructure) —
  "SQL for cognition: FIND knowledge WHERE confidence > 0.95 AND
  architecture = authentication ORDER BY importance; FIND decisions
  CAUSED BY Requirement-204"
- **Related:** IDEA-0056 (COM — the object space CQL queries), IDEA-0050
  (knowledge fabric), IDEA-0049 (storage contract ops), IDEA-0047 (UER —
  causality), ADR-002 (trace ledger), decision journal, connectome,
  retrieval fusion + context compressor

## Motivation

Cognitive data lives in heterogeneous stores: ledger events, graph
nodes, key-value memories, journal entries, connectome concepts. Each
has its own access API. The claim: one declarative language with
cognitive predicates — confidence, importance, recency, provenance —
and causal operators (CAUSED BY, INFLUENCED BY) over the unified object
space of IDEA-0056. "Which benchmark influenced this API decision?" or
"all high-confidence knowledge about authentication" become one
expression, not a manual trace.

## The corpus cannot cover it because

IDEA-0050 proposes the fabric but no language; IDEA-0049 defines
put/get/query ops, not a query surface; UER exposes influence-path
queries as API functions; retrieval fusion is scoring, not querying. No
language over cognitive objects exists anywhere in the corpus.

## Proposal sketch

- Grammar: FIND <kind> WHERE <predicate> (confidence, importance,
  temporal, provenance) ORDER BY <score>; causal operators compile to
  UER paths + fabric edge traversal; one parser, backends via the
  IDEA-0049 storage contract.
- Queries are versioned and audit-logged like every cognitive action.

## Risk assessment

- Language sprawl: CQL must compile to existing retrieval (fusion,
  fabric traversal, ledger replay) and prove one vertical query
  end-to-end before breadth, or it is syntax.

## Where it lands

- Design doc `design/CQL.md`; extends IDEA-0050 + IDEA-0049 + IDEA-0056.

## Code impact

- None until the grammar and backend compilation are specified.

## Next stage

- Grammar draft; one end-to-end query ("decisions CAUSED BY
  Requirement-204") against ledger + fabric + journal.
