# UCH Extraction Map

Provenance record of the modules and portable skills built into UCH. The
patterns below were adapted from a set of public reference collections —
used purely as inspiration, never copied verbatim — and are rebranded as
native UCH components with UCH-specific naming and contracts.

## 1. Pattern → module map

| Reference pattern | UCH implementation | Portable skill |
| --- | --- | --- |
| SKILL.md pack scanning/installing; skill catalog + import with provenance | `src/skills/skillpack.ts`, `src/skills/skill-catalog.ts` | `plan`, `spike`, `deep-research`, `systematic-debugging`, `test-driven-development`, `requesting-code-review` |
| 3-layer progressive memory search (index → timeline → full observations) with private-tag stripping | `src/memory/progressive-search.ts` | `progressive-memory-search` |
| Four coding principles (think before coding, simplicity first, surgical changes, goal-driven execution) | `src/kernel/constitution/coding-principles.ts` | `coding-principles` |
| Synthesis + gap analysis (coverage, missing terms, staleness, contradictions); skill creator/optimizer lifecycle | `src/kernel/retrieval/gap-analysis.ts`, `src/skills/skill-creator.ts`, `src/skills/skill-optimizer.ts` | `synthesis-gap-analysis`, `skill-creator` |
| Workflow skills and skill authoring conventions | `src/skills/skill-creator.ts` (template sections) | `skill-creator` |
| Takes / calibration (gradeable claims with conviction, graded against reality; Brier scorecard, bias tags, cold-start branch) | `src/cognitive-plane/calibration/` (`takes.ts`, `calibration.ts`, `voice-gate.ts`, `store.ts`) | — |
| Synthesis-with-citations (every claim carries `[id]`/`[id#N]` markers; unresolved markers → warnings, unattributable claims → gaps) | `src/kernel/retrieval/synthesis.ts` | `synthesis-gap-analysis` |
| Recency decay (per-prefix half-life map, longest-prefix-match, multiplicative recency boost in fusion) | `src/kernel/retrieval/recency-decay.ts`, fused in `src/kernel/retrieval/fusion.ts` (`applyRecencyBoost`) | — |
| Brain filing rules (concept/episode/edge surfaces, notability gate, cross-linking iron law, citation provenance) | `docs/memory-filing-rules.md` | — |
| Karpathy coding guidelines + worked examples | `src/kernel/constitution/coding-principles.ts`, `skills/coding-principles/` (SKILL.md + EXAMPLES.md) | `coding-principles`, `karpathy-guidelines` |
| Session-scoped memory timeline + token-cost-aware retrieval | `src/memory/progressive-search.ts` (timeline windowing, token estimation) | — |

## 2. Module inventory

### Skill lifecycle (`src/skills/`)
| Module | File | Status |
| --- | --- | --- |
| `SkillPackScanner` / `SkillPackInstaller` | `skillpack.ts` | ✅ implemented, tested (`skillpack.test.ts`) |
| `SkillCatalogScanner` / `SkillImporter` + import index | `skill-catalog.ts` | ✅ implemented, tested |
| `SkillCreator` | `skill-creator.ts` | ✅ implemented, tested |
| `SkillOptimizer` | `skill-optimizer.ts` | ✅ implemented, tested |
| Barrel exports | `index.ts` | ✅ |

### Memory (`src/memory/`)
| Module | File | Status |
| --- | --- | --- |
| `ProgressiveMemorySearch` (layer 1 search / layer 2 timeline / layer 3 observations) | `progressive-search.ts` | ✅ implemented, tested (`__tests__/progressive-search.test.ts`) |
| `stripPrivate` (`<private>…</private>` handling) | `progressive-search.ts` | ✅ |

### Kernel (`src/kernel/`)
| Module | File | Status |
| --- | --- | --- |
| `CodingPrinciplesEngine` (4 principles, optional plan context as verification loop) | `constitution/coding-principles.ts` | ✅ implemented, tested (`__tests__/coding-principles.test.ts`) |
| `CodingGuidelines` system prompt + verification-plan tooling | `constitution/coding-guidelines.ts` | ✅ implemented |
| `GapAnalysisEngine` (citations, gaps, contradictions, staleness, confidence) | `retrieval/gap-analysis.ts` | ✅ implemented, tested (`__tests__/gap-analysis.test.ts`) |
| `SynthesisEngine` (grounded claims with citation markers, contradictions, confidence) | `retrieval/synthesis.ts` | ✅ implemented, tested (`__tests__/synthesis.test.ts`) |
| Recency decay (defaults, env overrides, longest-prefix lookup, hyperbolic boost) | `retrieval/recency-decay.ts` | ✅ implemented, tested (`__tests__/recency-decay.test.ts`); wired into `RetrievalFusion.search` |
| `RetrievalFusion` recency-decay stage (post-fusion multiplicative boost) | `retrieval/fusion.ts` (`applyRecencyBoost`) | ✅ implemented, tested |

### Cognitive plane (`src/cognitive-plane/calibration/`)
| Module | File | Status |
| --- | --- | --- |
| `TakeFence` (add / resolve / query gradeable claims; holder ≠ subject rules) | `takes.ts` | ✅ implemented, tested (`__tests__/calibration.test.ts`) |
| `computeCalibrationProfile` (Brier, scorecards, conviction buckets, bias tags) | `calibration.ts` | ✅ implemented, tested |
| `gateVoice` / `gateWithFallback` (friend-not-doctor guardrails) | `voice-gate.ts` | ✅ implemented, tested |
| `CalibrationStore` (JSON persistence, BOM-tolerant load) | `store.ts` | ✅ implemented, tested |

## 3. CLI wiring (`src/cli/index.ts`)

| Command | Module |
| --- | --- |
| `uch skill scan <dir>` | `SkillPackInstaller.installFromDir` |
| `uch skill catalog <dir>` | `SkillCatalogScanner.scanDir` |
| `uch skill import <dir> <name…> [--force]` | `SkillImporter.importFromDir` |
| `uch skill create <name> "<desc>"` | `SkillCreator.writeToDir` |
| `uch skill optimize` | `SkillOptimizer.analyzeAll` |
| `uch skill provenance` | `loadImportIndex` |
| `uch mem-search <query>` | `ProgressiveMemorySearch.search` |
| `uch mem-timeline <id>` | `ProgressiveMemorySearch.timeline` |
| `uch mem-get <id…>` | `ProgressiveMemorySearch.getObservations` |
| `uch gap-analysis <query>` | `GapAnalysisEngine.analyze` |
| `uch synthesize <query>` | `SynthesisEngine.synthesize` (sources from recent episodes) |
| `uch takes add <claim> <cv>` / `resolve <id> <quality>` / `list [--open\|--resolved]` | `CalibrationStore` (`takes.ts` fence) |
| `uch calibration` | `CalibrationStore.profile` |
| `uch principles-check <intent [:: change]>` | `CodingPrinciplesEngine.evaluate` |
| `uch organic-score <change [:: intent] [:: files: ...] [:: tests: ...]>` | `OrganicScoreEngine.evaluate` |
| MCP `principles-check` / `gap-analysis` tools (STDIO + SSE) | `MCPStdioServer.registerTools` |

## 4. Portable skills (`skills/`)

Ten native UCH skills written to `projects/uch/skills/`:

`deep-research`, `coding-principles`, `plan`, `progressive-memory-search`,
`requesting-code-review`, `skill-creator`, `spike`, `synthesis-gap-analysis`,
`systematic-debugging`, `test-driven-development`

Each is a standalone `SKILL.md` with frontmatter (`name`, `description`,
`author: UCH`, `license: MIT`) and reference-free content, so they can be
copied into any agent runtime (Claude Code, Codex, OpenCode, VS Code Copilot)
unchanged. The imported skill library (17 portable-library skills +
`karpathy-guidelines` with `EXAMPLES.md` reference) is tracked via
`.import-index.json` with neutral provenance (`portable-skill-library` /
`andrej-karpathy-skills-main`).

## 5. Verification status

- `npm run typecheck` — pass
- `npm run build` — pass
- `npm test` — 79 files / 1447 tests pass, including tests covering the
  ported modules (skillpack 5, skill-lifecycle 5, progressive-search 8,
  coding-principles 7, gap-analysis 6, synthesis 11, recency-decay 7,
  calibration 12)

## 6. Agentic resilience provenance (2026-07-31)

Patterns derived from hermes-agent, OpenClaw, and Deep Agents (MIT; patterns
only, all code original). See `docs/gap-analysis-2026-07-31.md` for the
source analysis and `docs/implementation-plan-agentic-resilience.md` for the
design. No new dependencies; Node built-ins only.

| Reference pattern | UCH implementation | Tests |
| --- | --- | --- |
| Backend abstraction (Claude Code `Backend` / sandbox protocol) | `src/agentic/backends/protocol.ts` (`BackendProtocol`, `SandboxBackendProtocol`), `state-backend.ts`, `filesystem-backend.ts` (safe-path resolution, first-match-wins `FilesystemPermission`) | `backends.test.ts` |
| Deep Agents middleware lifecycle (`systemPrompt`, `beforeModelCall`, tool injection, exclusion, protected core) | `src/agentic/middleware/` — `types.ts`, `pipeline.ts` (assemble/merge/exclude, `PROTECTED_MIDDLEWARE`), `todo-list.ts`, `filesystem.ts`, `summarization.ts`, `memory.ts`, `skills.ts` (last-one-wins dedup) | `middleware.test.ts` |
| OpenClaw tool-call normalization (`PatchToolCalls`) | `src/agentic/query/tool-call-repair.ts` — arg coercion, JSON-parse, default fill, enum matching, deterministic IDs, dedup, path-overlap guard | `tool-call-repair.test.ts` |
| Hermes compaction engineering (layered compression, chunked summarization, safety margin, boundary alignment, retry with backoff) | `src/agentic/query/compaction-engine.ts` | `compaction-engine.test.ts` |
| OpenClaw `ClassifiedError` + failover loop | `src/agentic/query/failover.ts` — error classification table, `FailoverChain` with backoff, probe-before-use, cooldown | `failover.test.ts` |
| OpenClaw credential pool / auth-profile rotation with cooldown | `src/llm/credential-pool.ts` — round-robin or priority rotation, exhaustion TTL, permanent-auth disable | `credential-pool.test.ts` |
| Deep Agents prompt profiles (base/suffix, per-model matching, tool/middleware exclusion) | `src/agentic/context/prompt-assembly.ts` — `PromptProfile`, USER → BASE → SUFFIX invariant, `assembleSystemMessage` | `prompt-assembly.test.ts` |
| Hermes availability probes with TTL caching | `src/agentic/tools/availability.ts` — `AvailabilityRegistry`, generation-based invalidation, in-flight coalescing | `availability.test.ts` |
| OpenClaw session/global lane serialization | `src/agentic/query/lane-queue.ts` — single-flight per lane, exclusive global lane, priority, capacity limits, abort | `lane-queue.test.ts` |
| OpenClaw subagent registry (orphans, expiry, persistence) + Deep Agents `AsyncSubAgent` | `src/agentic/subagents/registry.ts` — depth limits, JSON persistence, orphan reconciliation, expiry, announce/retry queues; `async-registry.ts` — launch/check/progress/cancel/list | `subagents.test.ts` |

All modules exported from `src/agentic/index.ts` and `src/llm/index.ts`.
