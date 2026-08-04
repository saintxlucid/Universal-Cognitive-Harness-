# UCH — PROJECT INDEX

> Universal Cognitive Harness v0.3.0 — persistent cognitive runtime for any IDE/agent/AI runtime.
> Indexed 2026-08-01 at `b6229ec` (40 commits, single author `saintxlucid`). Next refresh: 2026-08-08. Working tree clean (0 dirty entries in `projects/uch`).

## Quick Stats

- 579 TS files / 91,364 lines in `src/` (+75 files / +9,925 since last index) · 161 test files / 2,518 tests (2 known failures)
- Runtime deps: `openai ^7.2.0`, `@opentelemetry/api ^1.9.1`, `glob ^11.1.0` · dev: `typescript ^5.8`, `vitest ^4.1.10`, `eslint ^10.8.0`, `@vitest/coverage-v8 ^4.1.10`
- Token budget: src ≈ 1.3–1.7M tokens (91,364 lines × ~60 chars ÷ 4) · docs corpus 177 md files (docs 19, design 37, spec 8, research 20, planning 30, rfc 63)
- Spec version 0.5.1 (`spec/VERSION.md`); `package.json` version 0.3.0; npm audit clean as of fix `26f6e2b`
- Mojibake corruption flagged at last index: not reproducible in sampled files (`src/index.ts`, `MANIFESTO.md`)

## Entry Points

| Entry                                  | Role                                      | Notes                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`                         | Library API                               | 147 re-exports, I=1.00                                                                                                                                       |
| `src/cli/index.ts`                     | `uch` CLI (30 cmds)                       | status, attach, manifest, ingest, session, skills, organic-score, engineering-review, frameworks, solve, productivity, fusion, governance, **package** (new) |
| `src/cli/uccp.ts`                      | Legacy UCCP HTTP/SSE server               | 38 imports, I=0.95                                                                                                                                           |
| `src/mcp/stdio-server.ts`              | MCP STDIO server                          | default `uch` invocation, 34 imports                                                                                                                         |
| `src/agent/boot.ts` + `plugin.ts`      | Runtime auto-load (Codex/Claude/OpenCode) | plugin.ts = 18-dep hub; adds cognitive-continuity, cognitive-wearable                                                                                        |
| `src/cognitive-core/cognitive-core.ts` | Immune/endocrine orchestrator             | relocated from exoskeleton/, 24 imports                                                                                                                      |

## Governance & foundation posture

- [governance/README.md](governance/README.md) — foundation governance model, stewardship roles, and decision lifecycle
- [governance/CONFORMANCE-AND-CERTIFICATION.md](governance/CONFORMANCE-AND-CERTIFICATION.md) — evidence-driven conformance and certification model
- [governance/LICENSING-AND-USE.md](governance/LICENSING-AND-USE.md) — adoption and licensing guidance for ecosystem use
- [governance/ORGANIZATION-AND-STEWARDSHIP.md](governance/ORGANIZATION-AND-STEWARDSHIP.md) — the Foundation, Research Institute, and Labs model for long-term stewardship
- [design/ECOSYSTEM-COMPATIBILITY.md](design/ECOSYSTEM-COMPATIBILITY.md) — compatibility matrix across IDEs, agents, providers, and MCP surfaces

## Layer Map (organ architecture)

1. **Kernel** (`kernel/`) — cognitive-kernel (32 in/14 out), stores, retrieval, constitution, organic-score; **new**: process model (WS-A), vmem paging (WS-B), organism versioning (WS-C), transactional cognition (WS-D), self-diagnosis (WS-E), packages (WS-P), cognitive merge (WS-I)
2. **Exoskeleton** (`exoskeleton/` + `cognitive-core/`) — orchestrator (8 in/51 out), immune/endocrine relocated to `cognitive-core/`
3. **Cognitive Plane** (`cognitive-plane/`) — trace-engine (OTel, ADR-002), replay (+ **cognitive-time-machine**, **uer-graph**), frameworks (10 families, 34 frameworks), integrity
4. **Control Plane** (`control-plane/`) — auth, secrets, budgets, telemetry, transports; **new**: `packages/` (package gate, grants, semver)
5. **Agentic** (`agentic/`) — middleware, tools, subagents, compaction, failover, fast-path router
6. **Brains** — executive-brain (14 in), workspace-brain (12 in/13 out), mnemosyne, cortex_kernel (attention/executive/meta — **circular**)
7. **Engineering Intelligence** (`engineering-intelligence/`) — 150 concepts / 10 tiers; **new**: failure-physics (instability), decision-law (IDEA-0034), held-out corpus, enrichment, organic hookup
8. **Drivers/Interface** — filesystem, git, ide, mcp, acp; **new**: sensors/effectors decomposition, driver compliance (L0–L4)
9. **Organs** — connectome, sleep_cycle, metabolism, productivity-kernel, signal-fusion, workspace-graphs; **new**: aether/consciousness (12 fan-in), etiology, frontier-mapper

## Dependency Findings

- Graph: **417 files / 1,251 edges** (was 370 / 1,145). Script: `node X:\DAIRA\.tmp\opencode\uch-deps.mjs projects/uch/src`
- **Bottlenecks**: `neural-event-bus.ts` (43 fan-in, +3), `persistence-engine.ts` (32, +7), `cognitive-kernel.ts` (32/14), `engineering-intelligence/types.ts` (24, +4), `agentic/types.ts` (19), `trace-engine/cognitive-trace.ts` (14)
- **Circulars (5, was 4)**: 3 genuine module cycles `cortex_kernel/integrator.ts ↔ {attention-cortex, executive-cortex, meta-brain}` (high risk, unfixed); 2 barrel cycles (EI benchmark runner, **new** `kernel/process/index.ts ↔ join.ts`) — low risk
- **Instability**: barrel `index.ts` I=1.00 by design (14 of them); `exoskeleton.ts` I=0.86 is the practical integration chokepoint; `cli/index.ts` now I=1.00 (37 out, no fan-in)

## Risk Flags

- **RF-1** `cortex_kernel/integrator.ts` genuine circular deps — still unfixed
- **RF-2** 2 committed known failures in `agent-integration.test.ts` (middleware 'Genome' stage + `adapter.wear`) — wearable/middleware wave landed incomplete; **regression since last index**: prior stable failures (reflex-gate determinism, framework-journal) are now green
- **RF-3** Bus factor 1: 40/40 commits single author; churn analysis limited
- **RF-4** `exoskeleton.ts` 51-dep hub + `index.ts` 147 re-exports, zero inline tests
- **RF-5** Test sprawl: 87 files in `src/__tests__/` mega-dir (was 68); 26 areas still lack co-located tests
- **RF-6** New `aether/consciousness.ts` (12 fan-in) is the fastest-growing coupling point
- **RF-7** Ingester flake (resource contention on `os.tmpdir()`, 3 tests) observed under full parallel load — passes alone; documented, do not chase

## Compressed Changelog (since last index `e520a15`, 22 commits)

- **ADR-006 kernel shipping wave**: process model (PID namespace, threads, attach-joins-PID), cognitive vmem (Hot→Warm→Cold→Archive), organism versioning, transactional cognition (propose→verify→commit/rollback), self-diagnosis (12 SMART metrics), FS mounts, cognitive merge, packages (sha256 + quarantine)
- **RFC-0005 Cognitive Physics**: failure-physics instability prototype (I = confidence − evidenceMass, θ=0.5), held-out corpus (6 veto / 5 negative / 5 advisory), Acceptance passed (architecture/security/constitution), Part VIII promoted to normative, spec 0.2.0→0.3.0
- **IDEA-0034/0047/0045**: unified decision law prototype (λu·EU + λi·IG − λe·E − λr·R − λl·L), UER causal graph (traceparent ingestion, change points), CVM design (blocked on RFC-0004)
- **Frameworks Phases 3–4**: 34 frameworks, composer + `uch solve`, decision journal, MCP framework tools
- **Security audit wave**: 8/8 bugs fixed (shell injection ×3, denylist bypass, FS traversal, containment); eslint 10/vitest 4 upgrade cleared 8 high audit findings
- **Vision corpus**: 58 idea notes (IDEA-0001..0058), VISION.md sec 8–12, GENESIS ch 3, rfc/ governance series (RFC-0000..0005)
- **Other**: sensors/effectors + driver compliance, CP instruction catalog, spec-version gate, cognitive time machine (7 tests)

## Environment Contract (.env.example)

`OPENAI_API_KEY` (required) · `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` · `CEREBRAS_API_KEY[_1..3]`, `CEREBRAS_MODEL` · `OPENAI_BASE_URL` · `UCH_LLM_PROVIDER` (openai|anthropic|google|auto) · `UCH_LLM_MODEL`

## Sensitive Data

Clean. Only match is test-fixture placeholder key at `src/coding/__tests__/coding-tools.test.ts:305` (not a real credential).

## Re-index Triggers

> 7 days (due 2026-08-08) · test-count change ≥5% · new src/ top-level dir · new ADR/RFC acceptance · commit of >20 commits in a day
