# UCH — PROJECT INDEX

> Universal Cognitive Harness v0.2.0 — persistent cognitive runtime for any IDE/agent/AI runtime.
> Indexed 2026-07-31 at `e520a15` (18 commits, all 2026-07-30/31, single author). Next refresh: 2026-08-07. Drift: 144 dirty working-tree entries at index time.

## Quick Stats
- 504 TS files / 81,439 lines in `src/` · 134 test files / 2,152 tests (2 stable + ≤12 intermittent failures)
- Runtime deps: `openai ^7.2.0`, `@opentelemetry/api ^1.9.1` · dev: `typescript ^5.8`, `vitest ^3`, `eslint ^9`
- Token budget: src ≈ 1.2–1.6M tokens · docs corpus 66 files (design 16, docs 14, spec 7, research 16, planning 24)
- Docs/specs are box-drawing corrupted in source (UTF-8 mojibake in headers of `src/index.ts` etc.)

## Entry Points
| Entry | Role | Notes |
|---|---|---|
| `src/index.ts` | Library API | 146 re-exports, I=1.00 |
| `src/cli/index.ts` | `uch` CLI (33 cmds) | status, attach, manifest, ingest, session, skills, mem-search, organic-score, engineering-review, frameworks, productivity, fusion, governance |
| `src/cli/uccp.ts` | Legacy UCCP HTTP/SSE server | 38 imports |
| `src/mcp/stdio-server.ts` | MCP STDIO server | default `uch` invocation |
| `src/agent/boot.ts` + `plugin.ts` | Runtime auto-load (Codex/Claude/OpenCode) | plugin.ts = 16-dependency hub |

## Layer Map (organ architecture)
1. **Kernel** (`kernel/`, 47 files) — cognitive-kernel (32 in/14 out bottleneck), stores, retrieval, constitution, organic-score
2. **Exoskeleton** (`exoskeleton/` + `cognitive-core/`) — orchestrator (51 deps), immune/endocrine (recently relocated, staged rename)
3. **Cognitive Plane** (`cognitive-plane/`, 66 files) — trace-engine (OTel, ADR-002), replay, frameworks (10 families), constitution, integrity, sleep-cycle inputs
4. **Control Plane** (`control-plane/`, 19) — auth, secrets, budgets, telemetry, transports (SSE/MCP)
5. **Agentic** (`agentic/`, 43) — middleware, backends, tools, subagents, compaction, failover, fast-path router
6. **Brains** — executive-brain (14 in), workspace-brain (12 in/13 out), mnemosyne (memory supremacy), cortex_kernel (attention/executive/meta — **circular**)
7. **Drivers/Interface** — filesystem, git, ide, mcp, acp drivers; MCP + HTTP + SSE + Cognitive API
8. **Organs** — connectome, nervous-system, sleep_cycle, metabolism, productivity-kernel, signal-fusion, engineering-intelligence (150 concepts, 10 tiers)

## Dependency Findings
- **Bottlenecks**: `neural-event-bus.ts` (40 fan-in), `cognitive-kernel.ts` (32/14), `persistence-engine.ts` (25), `engineering-intelligence/types.ts` (20)
- **Circulars (4)**: `cortex_kernel/integrator.ts ↔ {attention-cortex, executive-cortex, meta-brain}` — genuine, high risk; 1 barrel-cycle via `engineering-intelligence/index.ts` — low risk
- **Instability**: barrel `index.ts` files I=1.00 by design; `exoskeleton.ts` I=0.86 (8 in/51 out) is the practical integration chokepoint

## Risk Flags
- `reflex-gate.test.ts:120` determinism test compares `duration_ms` (`Date.now()` diff) — structurally cannot pass; fix = exclude field or freeze clock
- `framework-journal.test.ts` calibration-merge flaky; suite shows order/timing sensitivity (2–14 failures per run)
- 26 of 51 src areas have zero co-located tests; 68 test files dumped in `src/__tests__/`
- Bus factor 1 (single author, 18/18 commits); churn analysis impossible until history accumulates

## Compressed Changelog ([Unreleased] per CHANGELOG.md)
- ADR-001 workspace attachment governance (manifest, grants, projections) · ADR-002 OTel trace engine (W3C ids, traceparent, OtelBridge)
- Phase-01 organ organs: workspace graphs (knowledge/decision/task/evolution/DNA)
- Agentic resilience suite · Mnemosyne (ECAN economy) · kernel physiology (organic score, calibration, compressor) · CP v1 protocol · Engineering Intelligence layers A–D (150 concepts, veto hookup)

## Environment Contract (.env.example)
`OPENAI_API_KEY` (required) · `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` · `CEREBRAS_API_KEY[_1..3]`, `CEREBRAS_MODEL` · `OPENAI_BASE_URL` · `UCH_LLM_PROVIDER` (openai|anthropic|google|auto) · `UCH_LLM_MODEL`

## Sensitive Data
Clean. Only match is test-fixture placeholder key at `src/coding/__tests__/coding-tools.test.ts:305`.

## Re-index Triggers
Commit of the 144 dirty entries · new ADR · test-count change ≥5% · >7 days · organ-architecture change (new src/ top-level dir).
