# Repository Indexer — UCH Task Tracker

Generated: 2026-07-31 · Indexed commit: `e520a15f2e07a83cec9849088f45d069eb0d2996` · Tool: opencode repository-indexer

## RI-1 Freshness Detection
- [x] **RI-1.1** Check for existing `PROJECT_INDEX.md` / `.json` — **absent**, first indexing run
- [x] **RI-1.2** Record baseline commit `e520a15` (2026-07-31, "feat(uch): organ engines — productivity kernel, signal fusion, code governance gate + event wiring")
- [x] **RI-1.3** Count commits since inception — **18 commits**, all by single author `saintxlucid`, landed 2026-07-30/31
- [x] **RI-1.4** Detect structural drift — **144 changed/untracked entries** (`git status --porcelain`): 26 modified src files, staged renames `exoskeleton/immune.ts` + `endocrine.ts` → `cognitive-core/`, plus untracked Phase-03 wave tests. Working tree is ahead of HEAD — index is a snapshot with drift flag.
- [x] **RI-1.5** Staleness threshold: 7 days → next re-index due **2026-08-07**

## RI-2 Structure Scan
- [x] **RI-2.1** Count files: **504 TS files** (81,439 lines) in `src/` — 133 inline test files + 68 top-level `src/__tests__/` files
- [x] **RI-2.2** Top-level layout (13 dirs + root files): `src/` (504), `docs/` (14), `design/` (16), `spec/` (7), `research/` (16), `planning/` (24), `skills/`, `dist/`, `coverage/`, `.uccp/`, `.uccp-test/`, `.uch/`, `node_modules/`
- [x] **RI-2.3** Language detection: TypeScript ESM-only (`"type": "module"`), Node runtime; framework-free (no React/framework manifests)
- [x] **RI-2.4** Monorepo check: standalone package, NOT a monorepo (root workspace is the monorepo hub)
- [x] **RI-2.5** Config catalog: `package.json` (2 runtime deps), `tsconfig.json`, `vitest.config.ts`, `.env.example` (7 env vars), `.uch/uch.manifest.json`
- [x] **RI-2.6** Per-area counts: 51 top-level src dirs; largest: `cognitive-plane/` (66 src), `kernel/` (47), `agentic/` (43), `control-plane/` (19), `engineering-intelligence/` (19)
- [x] **RI-2.7** Test distribution: 3 test homes — inline `__tests__/` inside areas (agentic 19, kernel 8, engineering-intelligence 7), plus 68 files in mega-dir `src/__tests__/`; **26 of 51 areas have no inline tests** (covered only via `src/__tests__/` mega-dir)

## RI-3 Entry Points & Boundaries
- [x] **RI-3.1** `src/index.ts` — library entry, **146 re-exports** (I=1.00)
- [x] **RI-3.2** `src/cli/index.ts` — `uch` CLI (33 commands: status/attach/manifest/ingest/session/remember/recall/think/skills/mem-search/organic-score/engineering-review/frameworks/productivity/fusion/governance…)
- [x] **RI-3.3** `src/cli/uccp.ts` — legacy UCCP HTTP/SSE server (38 imports)
- [x] **RI-3.4** `src/mcp/stdio-server.ts` — MCP STDIO server (default `uch` entry)
- [x] **RI-3.5** `src/agent/boot.ts` + `src/agent/plugin.ts` — runtime auto-load bootstrap (Codex/Claude/OpenCode integration)
- [x] **RI-3.6** Service boundaries: organ-architecture layers — Kernel, Exoskeleton, Cognitive Plane, Control Plane, Drivers, Interface (see PROJECT_INDEX.md layer map)

## RI-4 Dependency & Risk Analysis
- [x] **RI-4.1** Internal graph: 370 files, **1,145 edges** (script: `uch-deps.mjs`, `.js`-suffixed TS imports resolved)
- [x] **RI-4.2** Bottlenecks (fan-in): `event-bus/neural-event-bus.ts` (40), `kernel/cognitive-kernel.ts` (32 in / 14 out), `cognitive-plane/persistence/persistence-engine.ts` (25), `engineering-intelligence/types.ts` (20), `agentic/types.ts` (19)
- [x] **RI-4.3** Hubs (fan-out): `index.ts` (146), `exoskeleton/exoskeleton.ts` (51), `cli/uccp.ts` (38), `cli/index.ts` (33), `mcp/stdio-server.ts` (31)
- [x] **RI-4.4** Circular dependencies: **4 cycles** —
  1. `agent/boot.ts → agent/plugin.ts → executive-brain → engineering-intelligence/index.ts → benchmark/runner.ts → index.ts` (barrel artifact, low risk)
  2-4. `cli/index.ts → exoskeleton.ts → cortex_kernel/integrator.ts ↔ {attention-cortex, executive-cortex, meta-brain}` (**genuine module cycles, high risk**)
- [x] **RI-4.5** External deps: `openai ^7.2.0`, `@opentelemetry/api ^1.9.1` (runtime); `typescript ^5.8`, `vitest ^3.0`, `eslint ^9`, `@vitest/coverage-v8` (dev). **npm audit not run** (offline) — pending RI-6.4
- [x] **RI-4.6** High-risk files: `cortex_kernel/integrator.ts` (circular, untested), `reflex/gate.ts` (flaky test), `exoskeleton/exoskeleton.ts` (51-dependency hub, zero inline tests)
- [x] **RI-4.7** Test health: **2,152 tests / 134 files; 2 stable failures + intermittent 12** (flaky suite) — see RI-4.8/4.9
- [x] **RI-4.8** Stable failure #1: `reflex-gate.test.ts:120` "is deterministic across repeated evaluations" — `gate.ts:92` returns `duration_ms: Date.now() - start`, so full-object `toEqual` can never be deterministic. **Test bug**, reproducible in isolation
- [x] **RI-4.9** Stable failure #2: `framework-journal.test.ts` "merges journal takes into the calibration profile" — merge fails intermittently; **12 additional failures** (reflex-interception, neural-fs backslash) appear on some runs — suite is order/timing-sensitive
- [x] **RI-4.10** Knowledge silo: single-author repo (18/18 commits) — bus factor 1; history too shallow for churn/hotspot analysis (whole tree landed in 2 days)

## RI-5 Index Generation
- [x] **RI-5.1** `projects/uch/PROJECT_INDEX.md` — written (human-readable, headings, token-budgeted)
- [x] **RI-5.2** `projects/uch/PROJECT_INDEX.json` — written (schema-compliant machine index)
- [x] **RI-5.3** Token estimates recorded: src ≈ 1.2–1.6M tokens (81,439 lines × ~60 chars ÷ 4 chars/token); docs corpus ≈ 66 files
- [x] **RI-5.4** Compressed changelog: [Unreleased] section covers ADR-001/002, Phase-01 organs, agentic resilience, Mnemosyne, kernel physiology, CP v1 (see PROJECT_INDEX.md)
- [x] **RI-5.5** Metadata recorded: timestamp, commit hash, staleness threshold (7d), drift flag (144 dirty entries)

## RI-6 Validation & Publish
- [x] **RI-6.1** All file paths in index verified to exist (glob + Test-Path spot checks)
- [x] **RI-6.2** JSON validated (parsed; schema below)
- [x] **RI-6.3** Secret scan: only match is a **test fixture placeholder** `sk-abcdefghijklmnopqrstuvwxyz123456` in `coding-tools.test.ts:305` — not a real credential. No `BEGIN PRIVATE KEY`, no `ghp_`, no `AIza` hits
- [ ] **RI-6.4** `npm audit` — pending (offline environment)
- [ ] **RI-6.5** Commit or export indexes — **not committed** (per workspace rule: no commits unless requested; 144 dirty entries include another agent's in-progress wave)

## Red Flags
- [x] **RF-1** Circular deps in `cortex_kernel/` (integrator ↔ cortex modules) — genuine, unfixed
- [x] **RF-2** Flaky test suite — 2 stable + up to 12 intermittent failures; determinism test is structurally broken (compares `duration_ms`)
- [x] **RF-3** Single-author history — no churn/knowledge-silo signal possible yet
- [x] **RF-4** `exoskeleton/exoskeleton.ts` (51 deps) + `index.ts` (146 re-exports) are integration bottlenecks with zero inline tests
- [x] **RF-5** Test sprawl: 68 test files in `src/__tests__/` mega-dir, 26 organs without co-located tests
- [x] **RF-6** Working tree drift (144 entries) invalidates hot-spot/co-change claims until committed

## Commands
```powershell
# Re-index freshness check
git -C projects/uch log -1 --format="%H %ad" --date=short
git -C projects/uch status --porcelain | Measure-Object -Line
# Full test suite
npx vitest run
# Type/lint gates
npx tsc --noEmit; npx eslint src/
# Dependency graph re-run (script kept at X:\DAIRA\.tmp\opencode\uch-deps.mjs)
node "X:\DAIRA\.tmp\opencode\uch-deps.mjs" projects/uch/src
```
