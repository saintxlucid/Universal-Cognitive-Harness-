# Changelog

All notable changes to UCH are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/) and
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Workspace attachment governance (ADR-001 criteria 1–4)** —
  `src/workspace-manifest/` (discover/negotiate/attach/detach, `uch.manifest.v1`),
  `GrantEngine` (`src/cognitive-runtime/grants.ts`), `EventGovernance` gate
  (`src/control-plane/event-governance.ts`), `ProjectionEngine`
  (`src/control-plane/projections.ts`).
- **OTel trace engine (ADR-002)** — `src/cognitive-plane/trace-engine/`:
  W3C 32-hex trace ids + 16-hex span ids, `traceparent` propagation,
  `OtelBridge` (mirrors ledger traces to OTel providers), `TraceRecorder`
  remote-parent continuation.
- **Cognitive Replay** (`src/cognitive-plane/replay/`) — `replayEvents`,
  `resumeContext` (continuation traceparent), `hydrate` (re-publishes traces
  with lineage metadata).
- **Phase 01 organism organs** (`src/workspace-graphs/`) — KnowledgeGraph,
  DecisionGraph, TaskGraph, EvolutionHistory, WorkspaceDNA; wired into
  `WorkspaceBrain` via 7 neural-event-bus subscriptions; persisted under
  `.uccp/persist/`.
- **Agentic resilience suite** (`src/agentic/`) — middleware pipeline,
  backends + permissions, tool-call-repair, compaction-engine, credential
  pool, failover chain, lane-queue, subagent + async registries,
  prompt-assembly profiles, TTL availability probes, fast-path router.
- **Mnemosyne** (`src/mnemosyne/`) — memory supremacy brain: sensory +
  retrieval cortices, context compiler, economy, sleep cycle.
- **Kernel physiology** — `OrganicScoreEngine` (15 metrics, constitutional
  vetoes), integrity checklist, calibration (Brier scorecards, takes),
  context-compressor, synthesis-with-citations, recency-decay, gap-analysis,
  evidence, graph/vector stores, world-model, concept-genome, memory-evolution.
- **CP v1 protocol** (`src/protocol/`) — versioned cognitive contract +
  conformance runner; WebSocket transport; driver registry.
- **Planning corpus** — Phase 02 (Digital Twin + Cognitive Observatory) and
  Phase 03 (Engineering Physiology) contexts/research/validation.

### Fixed

- Skill frontmatter parsing now strips UTF-8 BOMs (skills written by
  Windows tooling import cleanly).
- `.import-index.json` reads are BOM-tolerant (previously a BOM written
  by PowerShell broke `JSON.parse`).
- `CalibrationStore.load()` is BOM-tolerant.
- 3 pre-existing test failures (`e2e-server-flow`, `neural-fs`) resolved —
  suite at 100 files / 1,738 tests green.
- `package-lock.json` re-synced with 0.2.0 dependency set.
- Security audit wave 2026-07-31: 8/8 findings fixed (command injection,
  path traversal, denylist bypass, tool containment) — see BUG-REPORT.md.

### Added

- **Engineering Intelligence layer (ADR-003, waves A–D)** — 150-concept
  tiered catalog, deterministic evaluator with constitutional vetoes
  (SPOF / unrecovered failure / pathological complexity), labeled
  benchmark corpus, enrichment wiring (`engineering:reviewed`), MCP
  `engineering-review`, CLI `engineering-review` / `engineering-benchmark`.
- **Cognitive Frameworks Library (Phases 1–4)** — 10 families / 34
  frameworks, selection + journal + calibration analytics, `uch solve`,
  MCP `framework-run`/`framework-stats`, trace consumption.
- **Cognitive Compute Fabric (ADR-004 Level 4)** — 10-CPU virtual-processor
  namespace, tier routing, cheapest-healthy provider selection with
  verification failover, energy budgets.
- **Universal Cognitive Protocol (ADR-005)** — substrate + driver
  architecture; driver compliance certification
  (`src/drivers/compliance.ts`).
- **Cognitive Microkernel (ADR-006, phases A–F)** — cognitive process
  model (PID namespace, attach-joins-PID), vmem paging (Hot→Archive),
  organism versioning, transactional cognition (propose→verify→commit),
  SMART self-diagnosis, FS mounts, cognitive merge (trivial slice),
  signed cognitive packages, spec versioning (VERSION.md + CI gate).
- **Platform Zero (specification-first, 2026-08-01)** — Five-Book Canon
  (Genesis / Constitution / Blueprint / Standards / Ascension), 32 Laws
  of Cognitive Physics in five families (was 19), Constitution Articles
  IX–XI (Cognitive Rights, Responsibilities, Immutability of the Core),
  Specification Governance System (RFC-0000 lifecycle + Five Gates),
  RFC-0001 Identity / RFC-0002 Signals / RFC-0003 Memory, CIR design
  (RFC-0004 proposed), Genesis PRD (ch. 1–3).
- **Platform packaging** — README as platform landing page,
  GETTING-STARTED, ROADMAP (five Epochs), SECURITY policy, contributing
  RFC governance.

## [0.2.0] — 2026-07-31

### Added

- Full UCH source tree: 215+ modules, CLI, MCP, persistence.
- CI job: UCH build/test in workspace GitHub Actions.

## [0.1.0] — 2026-07

### Added

- Persist/load methods on 15 cognitive-plane store classes.
- Contextual memory observation preservation.
- Initial cognitive kernel, event bus, workspace brain, executive brain,
  harness API, session manager, git ingester.

---

Changelog entries before the UCH source commit are derived from the
workspace git history and may be incomplete.
