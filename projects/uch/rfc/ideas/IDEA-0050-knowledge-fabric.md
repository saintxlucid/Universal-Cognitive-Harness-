# IDEA-0050 — Knowledge Fabric + Engineering Intelligence Graph

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Foundations 4 and 14) —
  "memory remembers; the Knowledge Fabric connects:
  conversation → architecture → issue → commit → PR → benchmark →
  decision → documentation → experiment → reasoning → memory →
  simulation — everything connected, not indexed"; and "not
  file → class → function but intent → requirement → decision →
  architecture → implementation → verification → deployment →
  learning → history → evolution"
- **Related:** IDEA-0047 (UER — the causal layer), ADR-002 (trace
  spine), src/workspace-graphs, src/connectome,
  engineering-intelligence concept stores, decision journal,
  IDEA-0014 (observatory — the view), IDEA-0051 (engineering
  database — the store)

## Motivation

The corpus has per-domain graphs: workspace graphs (artifacts,
decisions, tasks), the connectome (concepts), engineering-intelligence
tiers (knowledge), and the trace ledger (events). The claim: one
*shared* knowledge fabric where artifact-typed nodes
(conversation, issue, commit, PR, benchmark, decision, doc,
experiment, reasoning, memory, simulation) connect with typed edges
(influences, satisfies, verifies, informed_by, implements, evolves)
across domains — and the richer engineering lineage
(intent → requirement → decision → architecture → implementation →
verification → deployment → learning → history → evolution) replaces
the file/class/function view.

## The corpus cannot cover it because

Each graph is closed inside its domain; no artifact-kind taxonomy and
no cross-domain edge types exist; queries cannot answer
"which benchmark influenced this API decision" without manual tracing.

## Proposal sketch

- Unified fabric: typed artifact nodes + typed edges; each domain
  organ registers its nodes into the shared fabric (workspace graphs,
  connectome, EI, journal, traces).
- UER (IDEA-0047) supplies the causal layer over the same spine; the
  observatory (IDEA-0014) renders it; the engineering database
  (IDEA-0051) stores the non-graph payloads.
- The fabric earns its keep only via cross-domain queries single
  graphs cannot answer.

## Risk assessment

- Big-graph syndrome: without a killer cross-domain query, the fabric
  is a join table with ambitions.

## Where it lands

- Design doc `design/KNOWLEDGE-FABRIC.md`; extends workspace graphs +
  connectome + ledger.

## Code impact

- None until the artifact-kind + edge-type taxonomy is defined.

## Next stage

Define the artifact-kind taxonomy and edge types; prototype one
cross-domain query (commit → decision → benchmark) over existing
stores.
