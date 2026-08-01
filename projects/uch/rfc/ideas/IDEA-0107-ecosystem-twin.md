# IDEA-0107 — Ecosystem Twin

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 abstraction-layer intake (round 15) — "instead
  of digital twins for machines, UCH builds one for the AI ecosystem:
  OpenAI, Claude, Cursor, Copilot, Gemini, VS Code, JetBrains, GitHub,
  Docker, Kubernetes, Git, Filesystem, Cloud — every node knows
  relationships, versions, capabilities, limitations, protocols. Not a
  connection; a living map." The aggregation twin of the per-application
  capability graphs.
- **Related:** IDEA-0099 (per-application capability graph — the
  twin's leaf data), IDEA-0102 (runtime fingerprints — the twin's
  version/capability rows), IDEA-0098 (UCM claims — the twin's
  certification edge), IDEA-0012 (digital twin for repositories — the
  per-workspace precedent), design/integrations/COMPATIBILITY-MATRIX.md
  v1.0 (evidence layer — 23 apps / 9 IDEs / 24 providers / 14 SDKs /
  6 protocols), IDEA-0050 (knowledge fabric — cross-domain graph
  machinery), UER (IDEA-0047 — causal edges between hosts), ADR-005
  (UCP), src/workspace-graphs/ (graph store patterns)

## Motivation

UCH's twin today is per-workspace (IDEA-0012) or per-application
(IDEA-0099's capability graph). The intake's claim: the _ecosystem_
itself is a system — tools, providers, IDEs, protocols, storage,
platforms — with relationships (which app uses which protocol, which
IDE embeds which agent, which provider feeds which fabric), versions,
capabilities, and limitations; a living map of that topology is what
makes compatibility decisions (UCM scoring, adapter choice, provider
routing) _computable_ rather than researched. The Ecosystem Twin is
the knowledge graph the corpus's ecosystem evidence (COMPATIBILITY-
MATRIX) becomes when it is machine-readable and continuously updated:
not a survey, a model.

## The corpus cannot cover it because

- COMPATIBILITY-MATRIX.md is a dated human survey; nothing stores its
  content as traversable graph data with version edges and
  provenance. IDEA-0099 graphs are per-application; no aggregation
  layer spans applications (app → protocol → provider → platform
  edges).
- UCM claims (0098) will exist as machine-readable certificates; the
  twin is the graph they populate — the claim-to-graph ingestion has
  no home.
- The intake's node list (providers, IDEs, agents, GitHub, Docker,
  Kubernetes, Git, filesystem, cloud) crosses domains the workspace
  graphs never touch (VCS, CI/CD, containers, clouds — the Tier 5-8
  surfaces of IDEA-0096).

## Proposal sketch

- **Twin schema**: nodes = applications, providers, IDEs, protocols,
  platforms, storage backends; edges = uses/exposes/embeds/
  certifies/routes-to/replaces, each with version + provenance +
  evidence link (to the matrix row, the UCM claim, or the
  fingerprint). The twin is a _view family_ over existing stores,
  not new state.
- **Ingestion**: fingerprints (0102) populate application nodes;
  UCM claims (0098) populate certification edges; adapter compiler
  (0104) input/output recorded as edges; matrix evidence (dated
  research) becomes the bootstrap corpus with provenance.
- **Consumption**: topology queries ("who speaks MCP at L2+?",
  "which provider routes to which fabric tier?", "what does Cursor
  depend on?"), UCM re-scoring triggers on edge changes, planning
  input for adapter waves (IDEA-0096 tiers 5-8 become nodes, not
  prose).
- **Honesty rule**: the twin shows _recorded claims with evidence
  links_, never inferred capability — same discipline as driver
  compliance (served at verified level, never assumed).

## Risk assessment

- Maintenance burden: a living map that goes stale is a liability —
  ingestion must be automatic (fingerprints, UCM claims) with manual
  evidence edits explicitly provenance-tagged.
- Scale: ecosystem graphs can grow large — the twin should be
  derived views over stores (workspace-graphs pattern), not a new
  database, and queries must be bounded.
- Scope: the twin is a model of _compatibility facts_, not a
  forecast — limitations must be represented as data (declared
  level per surface), not judgment.

## Where it lands

- `src/ecosystem-twin/` (schema + ingestion + queries), bootstrap
  corpus from COMPATIBILITY-MATRIX, UCM claim feed, CLI
  `uch ecosystem <query>`.

## Code impact

- None until designed; seeds are workspace-graphs, fingerprint
  (0102), UCM claims (0098), matrix evidence, IDEA-0050.

## Next stage

- Prototype: ingest the COMPATIBILITY-MATRIX rows as bootstrap nodes
  and edges; assert topology queries ("all MCP-capable apps", "all
  providers routed by the fabric") return the matrix's own answers.
