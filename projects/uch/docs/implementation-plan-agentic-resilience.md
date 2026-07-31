# UCH Agentic Resilience — Implementation Plan

Enhance UCH's `src/agentic/` runtime with resilience and composability
patterns derived from hermes-agent, OpenClaw, and Deep Agents (MIT,
patterns only — all code is original UCH implementation). See
`docs/gap-analysis-2026-07-31.md` for the source analysis.

## Design principles

1. **Native contracts** — new modules use UCH types (`Message`, `Tool`,
   `ToolCall`, `ToolUseContext`); no foreign type names.
2. **Pure functions where possible** — testability without IO.
3. **Progressive wiring** — modules are standalone and exported via
   `agentic/index.ts`; the existing `queryLoop` keeps working unchanged.
4. **No new dependencies** — Node built-ins only (fs, path, crypto,
   timers, worker-free).

## Module map

```
src/agentic/
├── backends/
│   ├── protocol.ts          # BackendProtocol + SandboxBackendProtocol (ABC)
│   ├── state-backend.ts     # in-memory StateBackend (UCCP-friendly)
│   ├── filesystem-backend.ts# disk-backed FilesystemBackend with path safety
│   ├── permissions.ts       # FilesystemPermission rules (first-match-wins)
│   └── index.ts
├── middleware/
│   ├── types.ts             # AgentMiddleware interface + MiddlewareContext
│   ├── pipeline.ts          # assemble/filter/validate middleware stacks
│   ├── todo-list.ts         # write_todos tool + progress tracking
│   ├── filesystem.ts        # read/write/edit/glob/grep/ls tools over backend
│   ├── summarization.ts     # auto-compact trigger + summary tool
│   ├── memory.ts            # AGENTS.md sources → system prompt
│   ├── skills.ts            # skill source loading (last-one-wins)
│   └── index.ts
├── query/
│   ├── tool-call-repair.ts  # arg repair, deterministic IDs, dedup, overlap guard
│   ├── compaction-engine.ts # layered compression (protect/prune/chunk/summarize)
│   ├── failover.ts          # ClassifiedError + fallback chain policy
│   └── lane-queue.ts        # session lane + global lane single-flight queue
├── subagents/
│   ├── registry.ts          # lifecycle: spawn/persist/orphan-reconcile/expire
│   ├── async-registry.ts    # background task launch/check/update/cancel/list
│   └── index.ts
├── tools/
│   └── availability.ts      # TTL-cached readiness probes
├── context/
│   └── prompt-assembly.ts   # USER → BASE → SUFFIX + PromptProfile
└── (new) llm/
    └── credential-pool.ts   # multi-key rotation, exhaustion TTL
```

## Implementation order

### Step 1 — Backends (`backends/`)
- `BackendProtocol` ABC: `ls`, `read`, `grep`, `glob`, `write`, `edit`,
  `uploadFiles`, `downloadFiles` + async mirrors (adapted to UCH
  naming/result-shape conventions; UCH uses `Result`-style objects).
- `SandboxBackendProtocol`: adds `execute(command, timeout)`.
- `StateBackend`: in-memory Map store, `snapshot()`/`restore()` for UCCP
  persistence.
- `FilesystemBackend`: disk store rooted at a directory with
  `resolveSafePath` (no traversal outside root).
- `FilesystemPermission`: `{ pattern, allow: boolean }`, first-match-wins,
  default-allow.
- Tests: round-trip ops, path traversal rejection, permission ordering,
  snapshot/restore.

### Step 2 — Middleware (`middleware/`)
- `AgentMiddleware` interface: `name`, `tools()`, `onRequest()`,
  `onResponse()`, `onError()`, `systemPrompt()` (deepagents-inspired
  lifecycle, UCH-native shape).
- `pipeline.ts`: `assembleMiddleware(...)` with ordering constants,
  exclusion by name, validation of protected core middleware.
- Built-ins: `TodoListMiddleware` (todo store + tool), `FilesystemMiddleware`
  (tools bound to a backend + permissions), `SummarizationMiddleware`
  (uses compaction-engine), `MemoryMiddleware` (loads memory files into
  prompt), `SkillsMiddleware` (loads SKILL.md sources, last-one-wins).
- Tests: ordering, exclusion, tool injection, memory/skill loading.

### Step 3 — Tool-call repair (`query/tool-call-repair.ts`)
- `repairToolCallArguments(input, schema, toolName)` — type coercion,
  missing-default fill, string JSON parse of args.
- `deterministicToolCallId(name, index)` — stable IDs across retries.
- `deduplicateToolCalls(calls)` — identical name+input collapse.
- `detectPathOverlap(calls, tools)` — flag parallel-unsafe batches.
- Tests: coercion cases, dedup, overlap detection.

### Step 4 — Compaction engine (`query/compaction-engine.ts`)
- `compressContext(messages, budget, options)` — layered: protect first N
  turns, protect last N turns, prune oversized tool results
  (`[truncated …]`), chunked summarization with 20% safety margin,
  boundary alignment, summary retry with backoff.
- Reuses `estimateTokensApprox` from `context/compaction.ts`.
- Tests: protection, pruning, chunking, budget adherence.

### Step 5 — Credential pool (`llm/credential-pool.ts`)
- `CredentialPool`: ordered keys per provider, round-robin selection,
  exhaustion TTL backoff (by error code), priority ordering,
  `markSuccess`/`markFailure`.
- Tests: rotation, exhaustion, TTL recovery, priority.

### Step 6 — Failover (`query/failover.ts`)
- `classifyError(error, status)` → `ClassifiedError` with category
  (auth/billing/rate-limit/context-overflow/timeout/unknown) and
  `shouldFailover()`.
- `FailoverChain`: ordered model fallbacks + backoff, probe-before-use
  policy, cooldown.
- Tests: classification table, chain selection, cooldown.

### Step 7 — Prompt assembly (`context/prompt-assembly.ts`)
- `PromptProfile`: `baseSystemPrompt`, `suffix`, `excludedTools`,
  `excludedMiddleware`, per-model matching.
- `assembleSystemPrompt({ userPrompt, profile, profileBase })` —
  invariant `USER → BASE → SUFFIX`; `SystemMessage`-friendly.
- Tests: ordering invariants, profile matching, exclusion.

### Step 8 — Tool availability (`tools/availability.ts`)
- `AvailabilityRegistry`: probe functions with TTL caching (30s default),
  generation counter for invalidation, `isAvailable(name)`.
- Tests: caching, TTL expiry, invalidation.

### Step 9 — Lane queue (`query/lane-queue.ts`)
- `LaneQueue`: session lanes + global lane, single-flight per lane,
  fair ordering, capacity limits, abort support.
- Tests: serialization, fairness, abort.

### Step 10 — Subagent registries (`subagents/`)
- `SubagentRegistry`: spawn (depth limits), persist to disk (JSON),
  orphan reconciliation on startup, expiry, announce/retry queues,
  result retrieval.
- `AsyncSubagentRegistry`: launch/check/update/cancel/list of background
  tasks with status transitions.
- Tests: lifecycle, persistence, orphan sweep, expiry.

### Step 11 — Integration
- Export everything from `src/agentic/index.ts` (+ `src/llm/index.ts`).
- Update `docs/extraction-map.md` with provenance rows.
- Update README status table.

## Verification

```bash
cd projects/uch
npm run typecheck   # tsc --noEmit — must pass
npm run build       # tsc — must pass
npm test            # vitest — new tests pass; no new failures
npm run lint        # eslint — clean (if lint config permits)
```

Acceptance: 3 pre-existing failures unchanged; every new module covered
by ≥1 test file; no new dependencies.
