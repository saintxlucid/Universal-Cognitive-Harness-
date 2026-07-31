# UCH Gap Analysis — hermes-agent, OpenClaw, Deep Agents (2026-07-31)

Comparative analysis of three agent frameworks against UCH's current
implementation, identifying capability gaps and what to extract as
*inspired patterns* (never verbatim code). All three sources are MIT
licensed; UCH re-implements patterns with native naming and contracts.

| Source | Version | Stack | License |
| --- | --- | --- | --- |
| `hermes-agent-main` (Nous Research) | 0.13.0 | Python 3.11+, monolith + plugin surface | MIT |
| `openclaw-main` (steipete) | 2026.3.30 | TypeScript ESM, Node ≥ 22, pi-mono embedded | MIT |
| `deepagents-main` (LangChain) | ~0.5.x | Python, LangGraph runtime, middleware | MIT |

> Note: the local `openclaw-main` archive is a partial snapshot (3 of ~90
> `src/` dirs present; gateway/CLI/config/plugin-runtime absent). Its
> agent-runtime subsystems are fully present and were analyzed as-is;
> absent subsystems were reconstructed from visible import contracts.

## 1. UCH current state (baseline)

- **240+ source modules**: 10-layer cortex, memory organ, retrieval fusion
  (RRF + recency decay + MMR), synthesis-with-citations, calibration,
  takes, coding principles, 15 cognitive-plane stores, skill system, CLI +
  MCP STDIO (23 tools), agent boot module, session manager, workspace
  brain, executive brain, neural event bus, state virtualization,
  accelerators, aether, mnemosyne, neural-fs (scaffold), connectome
  (scaffold), sleep cycle (scaffold).
- **Agentic runtime** (`src/agentic/`): `queryLoop` (turns, auto-compact,
  token budget, stop hooks), tool registry + 12 built-in tools (Bash,
  Read, Write, Edit, Glob, Grep, WebFetch, TodoWrite, Memory,
  AskUserQuestion, Sleep, Subagent), permission rules, session state
  store, tasks, skills, history, prompt builder.
- **Verified**: 67 test files / 1278 passing (3 pre-existing failures in
  e2e-server-flow and neural-fs, unrelated to this analysis).

## 2. Capability matrix

| Capability | UCH | hermes | openclaw | deepagents |
| --- | --- | --- | --- | --- |
| Agent loop (turn engine) | ✅ `queryLoop` | ✅ AIAgent | ✅ pi-embedded runner | ✅ LangGraph |
| Context compaction | ⚠️ basic | ✅ layered | ✅ engineered | ✅ summarization MW |
| Tool registry | ✅ | ✅ AST self-register | ✅ catalog | ✅ langchain |
| Tool availability probes | ⚠️ `isEnabled` only | ✅ TTL-cached | ✅ | — |
| Tool-call arg repair | ❌ | ✅ tool-aware repair | ✅ normalization | ✅ PatchToolCalls |
| Deterministic call IDs / dedup | ❌ | ✅ | ✅ | — |
| Parallel batch conflict detection | ❌ | ✅ path-overlap | — | — |
| Credential rotation / exhaustion | ❌ single key | ✅ CredentialPool | ✅ auth-profiles | — |
| Error classification + failover | ❌ | ✅ ClassifiedError | ✅ failover loop | — |
| Session/global lane serialization | ❌ | — | ✅ lane queues | — |
| Subagent lifecycle registry | ⚠️ tool only | ✅ delegate tool | ✅ registry + orphans | ✅ SubAgent MW |
| Async / background subagents | ❌ | ✅ background forks | ✅ announce queues | ✅ AsyncSubAgent |
| Declarative subagent specs | ❌ | ⚠️ | ⚠️ | ✅ TypedDict specs |
| Middleware pipeline | ❌ | ⚠️ hooks | ⚠️ policies | ✅ AgentMiddleware |
| Pluggable backends (fs/sandbox) | ⚠️ drivers | ✅ envs | ✅ sandbox backends | ✅ BackendProtocol |
| Filesystem permission rules | ⚠️ tool-level | ✅ approval | ✅ tool policy | ✅ first-match-wins |
| Prompt assembly invariants | ⚠️ builder | ✅ 7-layer | ✅ system-prompt | ✅ USER→BASE→SUFFIX |
| Model-specific profiles | ❌ | ✅ ProviderProfile | ✅ model-catalog | ✅ HarnessProfile |
| Memory files → system prompt | ❌ | ✅ memory blocks | ✅ AGENTS.md | ✅ MemoryMiddleware |
| Skills runtime injection | ⚠️ catalog | ✅ user-msg inject | ✅ skills-runtime | ✅ SkillsMiddleware |
| Skill readiness gates | ⚠️ | ✅ env checks | ✅ anyBins | — |
| Checkpoints / state snapshots | ✅ persistence | ✅ git checkpoints | — | ✅ checkpointers |
| Session store with search | ⚠️ JSON | ✅ FTS5 + lineage | ✅ SQLite | ✅ langgraph |
| Structured stream translation | ⚠️ events | ✅ | ✅ block machine | ✅ |
| Observability / usage tracking | ⚠️ health | ✅ insights | ✅ usage accumulator | ✅ |

Legend: ✅ implemented · ⚠️ partial · ❌ missing.

## 3. What to extract from each repo (patterns, not code)

### 3.1 From hermes-agent — production agent-loop engineering

| Pattern | UCH gap | Recreated as |
| --- | --- | --- |
| Tool registry with TTL-cached availability probes | `isEnabled` has no caching/cooldown | `agentic/tools/availability.ts` |
| Tool-aware argument repair, deterministic call IDs, dedup, path-overlap batch guard | no repair/dedup layer | `agentic/query/tool-call-repair.ts` |
| Credential pool: multi-key rotation, exhaustion TTL, priority | single-key `LLMClient` | `llm/credential-pool.ts` |
| Error classification → failover chain | no failover | `agentic/query/failover.ts` |
| Layered context compression (protect first/last turns, prune tool results, boundary alignment) | single-pass compaction | `agentic/query/compaction-engine.ts` |
| Background self-improvement forks | meta-tools exist; no turn-triggered fork | (deferred — covered by sleep cycle) |
| Single-source command registry | CLI has per-command wiring | (low priority — deferred) |

### 3.2 From openclaw — orchestration & resilience engineering

| Pattern | UCH gap | Recreated as |
| --- | --- | --- |
| Lane-queue serialization (session lane + global lane, single-flight) | no run queue | `agentic/query/lane-queue.ts` |
| Subagent registry: persistence, orphan reconciliation, expiry, depth limits | `Subagent` tool only | `agentic/subagents/registry.ts` |
| Compaction engineering: chunked summarization, safety margin, identifier preservation, retry | basic compaction | folded into `compaction-engine.ts` |
| Auth-profile rotation with cooldown | single key | folded into `credential-pool.ts` |
| Context-window guard + tool-result truncation | `maxResultSizeChars` only | folded into `compaction-engine.ts` |
| Tool policy pipeline (composable per-scope) | flat permission rules | folded into `agentic/middleware/` |
| Session integrity tooling (write locks, transcript repair) | — | (deferred) |

### 3.3 From deepagents — composable architecture

| Pattern | UCH gap | Recreated as |
| --- | --- | --- |
| Middleware stack (TodoList, Filesystem, Summarization, Memory, Skills, HITL) | loop is monolithic | `agentic/middleware/pipeline.ts` + built-ins |
| Pluggable `BackendProtocol` (ls/read/grep/glob/write/edit/upload/download) + `SandboxBackendProtocol` | drivers only | `agentic/backends/protocol.ts`, `state-backend.ts`, `filesystem-backend.ts` |
| Filesystem permissions (first-match-wins, inherited by subagents) | tool-level checks | `agentic/backends/permissions.ts` |
| Declarative subagent specs with inheritance | no spec type | folded into `subagents/registry.ts` |
| Harness profiles (per-model prompt tuning, excluded middleware/tools) | — | `agentic/context/prompt-assembly.ts` (`PromptProfile`) |
| Prompt assembly invariants (USER → BASE → SUFFIX) | ad-hoc builder | `agentic/context/prompt-assembly.ts` |
| Summarization middleware (trigger thresholds, chunked) | basic compaction | folded into `compaction-engine.ts` |
| Memory middleware (AGENTS.md sources → prompt) | no memory-file injection | `agentic/middleware/memory.ts` |
| Skills middleware (sources, last-one-wins) | catalog only | `agentic/middleware/skills.ts` |
| Async subagents (launch/check/update/cancel/list) | no async delegation | `agentic/subagents/async-registry.ts` |

## 4. Prioritization

**P0 — implement now (high value, clean seams):**
1. `agentic/backends/` — BackendProtocol + StateBackend + FilesystemBackend + permissions
2. `agentic/middleware/` — pipeline + TodoList/Filesystem/Summarization/Memory/Skills
3. `agentic/query/tool-call-repair.ts` — repair, dedup, deterministic IDs
4. `agentic/query/compaction-engine.ts` — layered compression
5. `llm/credential-pool.ts` — key rotation + exhaustion TTL
6. `agentic/query/failover.ts` — error classification + fallback chain
7. `agentic/context/prompt-assembly.ts` — USER→BASE→SUFFIX + PromptProfile
8. `agentic/tools/availability.ts` — TTL-cached readiness probes
9. `agentic/query/lane-queue.ts` — session/global single-flight lanes
10. `agentic/subagents/registry.ts` — lifecycle, persistence, orphans, expiry
11. `agentic/subagents/async-registry.ts` — background task lifecycle

**P1 — deferred (larger scope, overlaps existing subsystems):**
- Checkpoint manager (persistence engine exists)
- FTS5 session store (session manager exists; add search later)
- Block-streaming tag machine (streaming is handled by callers)
- Command registry consolidation
- Sandbox backends (Docker/SSH) — revisit when driver layer matures

## 5. Verification plan

- One test file per new module, following `src/agentic/__tests__/*.test.ts`
  conventions (vitest, `describe`/`it`/`expect`, factory helpers).
- `npm run typecheck`, `npm run build`, `npm test` — must keep the
  3 pre-existing failures unchanged (no regressions).
- Update `docs/extraction-map.md` provenance with every new module.
