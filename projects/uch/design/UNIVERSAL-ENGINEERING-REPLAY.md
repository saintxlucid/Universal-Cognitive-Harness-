# Universal Engineering Replay (UER) — Design

Status: **Draft** (RFC stage: Idea → Research → RFC; this is the design
doc for the RFC proposal). Source idea: `rfc/ideas/IDEA-0047`.
G1 evidence: `research/foundations/07-universal-engineering-replay.md`.
Prototype: `src/cognitive-plane/replay/uer-graph.ts`.

## 1. Problem

Engineering causality is fragmented: a decision made in a Claude Code
session references a commit pushed from a VS Code agent, which triggered
a benchmark whose results changed an architecture choice in Codex. Today
each tool keeps its own log; nobody can answer:

- "What chain of reasoning led to PostgreSQL?"
- "What else was influenced by commit X?"
- "When did this module's behavior regime actually change?"

## 2. Proposal

One causal graph — the **Universal Engineering Replay (UER)** — spanning
every host, tool, and store an engineering team touches, built on the
ADR-002 W3C traceparent spine. Every engineering event (session, commit,
artifact edit, decision, benchmark, review, ticket) is a node; causality
is an edge. Three query families form the public surface:

| Query | Semantics |
| --- | --- |
| `influencePath(from, to)` | shortest causal chain connecting two entities (why-lineage) |
| `ancestry(id)` | versioned causal history of an entity (commit DAG walk) |
| `changePoints(artifact)` | timestamps where an artifact's change behavior shifted regime |

## 3. Entity model

| Node kind | Identity | Example |
| --- | --- | --- |
| `host` | host id (machine + tool) | `vscode@laptop-7` |
| `session` | agent session id | `opencode-session-42` |
| `artifact` | canonical file/object path | `src/engine/scheduler.ts` |
| `commit` | git commit sha | `7bb8246` |
| `decision` | decision record id (decision journal) | `ADR-003` |
| `trace` | W3C trace id | `4bf92f3577b34da6a3ce929d0e0e4736` |

## 4. Edge model

| Edge kind | From → To | Meaning |
| --- | --- | --- |
| `parent_of` | span/trace → trace | causal parent (traceparent spine) |
| `touches` | commit/session → artifact | modified artifact |
| `ancestor_of` | commit → commit | git DAG lineage |
| `informed_by` | decision/commit → session/trace | reasoning that informed it |
| `references` | decision/commit → artifact/decision | semantic reference |

All edges carry a timestamp where available. Undirected reachability
over `parent_of`/`informed_by`/`ancestor_of`/`references` defines the
influence graph; `touches` defines artifact-change history.

## 5. Ingestion contract

Every host already produces the spine:

- **Traces:** `traceparent` headers (ADR-002) — parse and link `parent_of`.
- **Git:** `git log`/hooks — `ancestor_of` + `touches` from diffs.
- **Sessions:** harness session records — `session` nodes with
  `informed_by` edges to their traces.
- **Decisions:** decision journal + ADR records — `references` edges.

A UER exchange format (prototype scope: in-memory JSON) lets hosts ship
their subgraphs; the shared fabric (IDEA-0050) is the union.

## 6. Query semantics

- **influencePath**: BFS over the influence edge set (undirected for
  reachability, directed for why-lineage); returns the hop list.
- **ancestry**: walk `ancestor_of` from a commit to root, in order.
- **changePoints**: collect `touches` timestamps for an artifact; a touch
  is a change point when its gap to the previous touch exceeds twice the
  mean gap (deterministic first cut; Adams–MacKay Bayesian detection is
  the upgrade path, G1 evidence §4).

## 7. Boundaries (non-goals)

- UER records *what happened and why it is linked* — it does not store
  artifact content (the artifact store does).
- No access to personal data: hosts/commits are pseudonymous ids;
  privacy governance is the same as ADR-002 (no secrets, no PII).
- Prototype is in-memory; persistence follows the `Storable` pattern
  when the RFC is accepted.

## 8. Deployment

1. **P1 (this wave):** in-memory `UerGraph` + three queries (prototype).
2. **P2:** ingest real ADR-002 ledger traces + git history into the graph.
3. **P3:** cross-host exchange format; UER as a service (IDEA-0014
   Observatory view over it; IDEA-0047 §flag as category-defining).
