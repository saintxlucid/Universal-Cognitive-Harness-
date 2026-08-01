# IDEA-0108 — Knowledge Genome (Per-Application Knowledge Extraction)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 abstraction-layer intake (round 15) — "instead
  of asking 'what files exist?', extract concepts, architecture,
  patterns, rules, conventions, goals, tasks, agents, commands,
  knowledge — UCH builds a Knowledge Genome for every application."
  The semantic twin of the runtime fingerprint (0102): the fingerprint
  enumerates _surfaces_; the genome extracts _meaning_.
- **Related:** IDEA-0102 (runtime fingerprint — surfaces; the genome's
  structural twin), src/workspace-graphs/workspace-dna.ts (per-
  workspace hash fingerprint — NOT the same claim), IDEA-0008 (genome
  evolution — Git for genomes), src/cognitive-plane/genome/ (species
  genome — behavior configuration, not extracted knowledge),
  IDEA-0031 (reality compiler — ingest→normalize→extract→integrate→
  emit pipeline precedent), IDEA-0050 (knowledge fabric — the genome's
  graph home), IDEA-0012 (digital twin — the genome's consumer),
  IDEA-0106 (Context IR — the genome's emitted artifact format),
  src/context/gatherer.ts (context collection), design/EXOSYMBIOSIS.md
  (capture rails)

## Motivation

The corpus extracts knowledge from _repositories_ (gatherer, knowledge
graph, WorkspaceDNA hash) and configures _behavior_ via the species
genome — but nothing extracts the knowledge model of an _application
instance_: what concepts it centers on, what architecture it encodes,
what patterns/rules/conventions its own artifacts carry (its
CLAUDE.md/AGENTS.md/rules/skills/subagents, its extension manifest,
its session content), what goals and tasks it tracks, what commands it
offers. The intake's claim: every connected application yields a
Knowledge Genome — a structured, versioned knowledge model that makes
the application _understood_ rather than merely _reachable_. The
fingerprint (0102) says what it exposes; the genome says what it
knows. The genome feeds the Context IR compiler (0106), the digital
twin (0012), the ecosystem twin (0107), and the memory manager —
knowledge extracted once, consumed everywhere.

## The corpus cannot cover it because

- WorkspaceDNA is a sha256 fingerprint of workspace state (identity,
  not meaning); the species genome is a config file (behavior, not
  extracted knowledge); neither extracts the knowledge model of an
  application's artifacts. IDEA-0031's pipeline is designed for
  world-model ingestion — application knowledge extraction has no
  owner.
- Capture rails (EXOSYMBIOSIS) collect events and transcripts; no
  pipeline distills them into concepts/patterns/conventions with
  provenance (which artifact yielded which fact).
- The knowledge graph (workspace-graphs) is workspace-scoped and
  build-event-fed; per-application genomes (concepts, rules,
  commands, goals) are a different, unowned surface.

## Proposal sketch

- **Genome document** `uch.knowledge-genome.v1`: `{application,
version, concepts (extracted vocabulary with evidence links),
architecture (from manifests/configs), patterns, rules,
conventions, goals, tasks, agents (subagents/commands), knowledge
(pointers into the fabric), provenance (per-fact artifact +
capture rail)}` — assembled by an extraction pipeline over the
  application's on-disk artifacts (configs, rules, session stores,
  extension manifests) and captured events.
- **Extraction pipeline** (IDEA-0031 shape): ingest (Green-zone
  artifacts per 0097) → normalize → extract (deterministic rules:
  config keys, rule-file headings, command tables, session goals;
  no hidden COT per L3) → integrate (into knowledge fabric) → emit
  (genome document + CX-IR feed per 0106).
- **Consumption**: Context IR frontends (0106) parse per-application
  genomes into repository context; the digital twin (0012) and
  ecosystem twin (0107) attach genomes to nodes; memory placement
  (IDEA-0049/0029) uses extracted concepts for warm starts.
- **Versioning**: genomes are versioned per application version and
  re-extracted on change (continuous understanding); genome deltas
  are first-class (what concepts appeared/disappeared across app
  updates).

## Risk assessment

- Extraction quality: deterministic extraction captures structure,
  not nuance — the genome must separate _verified structural facts_
  (with provenance) from _interpretive content_ (tagged as such,
  never silently mixed), and never claim semantic authority over
  hidden internals (Red zone per 0097).
- Drift: genomes must pin application versions and re-extract on
  fingerprint change (0102); a stale genome misleads the twin.
- Scope: the genome is extracted knowledge with provenance, not a
  claim of understanding — same honesty discipline as the
  fingerprint and the CRP descriptor (0105).

## Where it lands

- `src/context/genome/` (extraction pipeline + schema), knowledge
  fabric integration, CX-IR frontend (0106), CLI `uch genome
<app> extract|diff`.

## Code impact

- None until designed; seeds are gatherer, workspace-dna, IDEA-0031
  pipeline, capture rails, knowledge fabric.

## Next stage

- Prototype: extract the knowledge genome of one real application
  (OpenCode: config + rules + part-store sessions); assert each
  genome fact carries provenance to the artifact it came from.
