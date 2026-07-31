# Changelog

All notable changes to UCH are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/) and
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Takes / Calibration system** (`src/cognitive-plane/calibration/`) —
  gradeable claims with conviction (`takes.ts`), Brier scorecards and
  bias tags (`calibration.ts`), voice guardrails (`voice-gate.ts`),
  JSON persistence (`store.ts`). CLI: `uch takes add|resolve|list`,
  `uch calibration`.
- **Synthesis engine with citations** (`src/kernel/retrieval/synthesis.ts`) —
  every claim carries a resolvable `[id]`/`[id#N]` marker; unresolved
  markers become warnings, unattributable claims become gaps. CLI:
  `uch synthesize`.
- **Recency decay** (`src/kernel/retrieval/recency-decay.ts`) — per-prefix
  half-life map (evergreen concepts vs decaying episodes), env-var and
  per-call overrides, composed multiplicatively into `RetrievalFusion`
  as a post-fusion boost stage.
- **Memory filing rules** (`docs/memory-filing-rules.md`) — mandatory
  filing protocol (concept/episode/edge surfaces, notability gate,
  cross-linking iron law, citation provenance, takes attribution).
- **Skill catalog + importer** (`src/skills/skill-catalog.ts`) — catalog
  external skill repos, import with provenance index
  (`.import-index.json`), BOM-tolerant parsing. CLI: `uch skill catalog`,
  `uch skill import`, `uch skill provenance`.
- **Imported skill library** — 17 skills from the portable skill
  library plus `karpathy-guidelines` (with `EXAMPLES.md` reference)
  from the andrej-karpathy-skills collection.
- **Coding principles with plan verification** — `CodingPrinciplesInput`
  accepts an optional `context.plan`; steps containing
  verify/test/check markers satisfy the goal-driven-execution check.
- **MCP tools** — `principles-check` and `gap-analysis` registered on
  the MCP STDIO server.
- **Documentation suite** — docs hub, CLI reference, MCP reference,
  skill system guide, changelog, contributing guide.

### Fixed

- Skill frontmatter parsing now strips UTF-8 BOMs (skills written by
  Windows tooling import cleanly).
- `.import-index.json` reads are BOM-tolerant (previously a BOM written
  by PowerShell broke `JSON.parse`).
- `CalibrationStore.load()` is BOM-tolerant.

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
