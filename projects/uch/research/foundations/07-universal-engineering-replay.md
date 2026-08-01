---
track: cross-cutting
status: research-draft
version: 0.1.0
sources:
  - https://research.google/pubs/pub36356/ (Sigelman et al. 2010, Dapper — distributed tracing)
  - https://www.w3.org/TR/trace-context/ (W3C Trace Context — traceparent propagation)
  - https://dl.acm.org/doi/10.1145/1559750.1559761 (Green, Karvounarakis & Tannen 2007, provenance semirings)
  - https://dl.acm.org/doi/10.1007/978-3-642-03757-3_17 (Cheney, Chiticariu & Tan 2009, provenance in databases: why-lineage)
  - https://dl.acm.org/doi/10.1109/TSE.1984.5010248 (Weiser 1981, program slicing)
  - https://www.cs.ox.ac.uk/people/robert.macKay/chuang/ (Adams & MacKay 2007, Bayesian online change-point detection)
  - https://dl.acm.org/doi/10.1145/776816.776825 (Cubranić & Murphy 2003, Hipikat — recommending from project history)
  - https://www.microsoft.com/en-us/research/publication/yesterday-my-program-worked-today-it-does-not-why/ (Zeller 1999, delta debugging)
---

# Universal Engineering Replay — G1 evidence register (IDEA-0047)

Evidence register for IDEA-0047: one causal engineering graph across all
hosts (VS Code, Claude Code, Codex, OpenCode, JetBrains, Copilot,
terminal, git, browser, MCPs) with influence-path, ancestry, and
change-point queries — extending the ADR-002 OTel trace ledger into a
cross-host, cross-tool causal model.

## 1. Traceparent spine — causal continuity across hosts

| Evidence | Source |
| --- | --- |
| Large-scale distributed tracing records causal structure via per-request span trees with parent ids; Dapper's annotations carry semantic payloads | Sigelman et al. (2010), Dapper |
| W3C Trace Context standardizes `traceparent` propagation so causal chains survive process/host boundaries — the same spine a multi-host UER needs | W3C Trace Context |

**Corpus anchor:** ADR-002 already implements the W3C model
(`src/cognitive-plane/trace-engine/traceparent.ts`) — UER's spine exists;
what is missing is the *cross-tool, cross-host* graph on top of it.

## 2. Influence / dependency — "why did this change happen"

| Evidence | Source |
| --- | --- |
| Provenance semiring algebra answers "why" queries compositionally over a dependency graph (why-lineage, how-provenance) | Green, Karvounarakis & Tannen (2007) |
| Database provenance distinguishes data lineage from workflow lineage — engineering decisions need the same distinction (code + reasoning lineage) | Cheney, Chiticariu & Tan (2009) |
| Program slicing computes the set of statements influencing a point of interest — the static ancestor of UER's influence-path query | Weiser (1981) |

## 3. Ancestry — versioned causal history

| Evidence | Source |
| --- | --- |
| Hipikat connects artifacts (bugs, commits, discussions) from project history to recommend relevant prior work — an early single-repo UER | Cubranić & Murphy (2003) |
| Mining software repositories literature treats commit DAGs as first-class causality; ancestry queries are the accepted primitive | (MSR corpus, 2004– ) |

**Corpus anchor:** WorkspaceTaskGraph/WorkspaceDecisionGraph edges
(`src/workspace-graphs/`) already exist per workspace; UER unifies them
across hosts and adds influence-path semantics.

## 4. Change points — "when did behavior actually change"

| Evidence | Source |
| --- | --- |
| Bayesian online change-point detection segments a time series at distribution shifts without a fixed window | Adams & MacKay (2007) |
| CUSUM-style statistics flag regime changes in sequential data | Page (1954), CUSUM |
| Delta debugging isolates the minimal change that broke a program — the operational use of a change point | Zeller (1999) |

**Verdict:** UER is G1-grounded as a composition of four mature results
(distributed tracing, why-provenance, repository mining, change-point
statistics). Its novelty is the *composition*: those results have not
been unified into one causal graph spanning every engineering tool a
team uses, with influence-path/ancestry/change-point queries as the
public surface. That composition claim is the corpus differentiator
(flagged in VISION.md sec 10 as the strongest candidate for a
category-defining primitive).

## Prototype scope (this wave)

A self-contained causal graph (`src/cognitive-plane/replay/uer-graph.ts`)
with a node/edge model, traceparent-driven ingestion, and the three query
families — influence-path (BFS over causal edges), ancestry (commit DAG
walk), change-points (gap heuristic over touch timestamps). Design in
`design/UNIVERSAL-ENGINEERING-REPLAY.md`.
