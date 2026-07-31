# Universal Integration — The UCH Hive Mind

Status: **Proposal (design)** — reviewed against the official documentation of
each target runtime, 2026-07-31. Implementation is a GSD execute-phase effort
starting at **M0** (below).

## 1. Vision

UCH should not be a guest in one tool. It should be the **hive brain** that every
coding surface — VS Code, GitHub Copilot Chat, OpenCode, Claude Code, Codex —
feeds and draws from automatically, like one nervous system spanning several
bodies:

- Every app's **sessions, chat logs, tool calls, background processes, model
  reasoning (COT) and trace spans** flow into a single local ledger.
- Every app can **ask the hive** (memory recall, session resume, decision log,
  context, handoff) through the same MCP surface UCH already exposes.
- Switching apps mid-task is seamless: the hive keeps one conversation, one
  decision history, one trace.

This document is the master architecture. Standalone per-runtime integration
specs live in `design/integrations/`:

| Runtime | Spec | Primary mechanism |
| --- | --- | --- |
| VS Code + Copilot Chat | `integrations/VSCODE.md` | Extension: chat participant, LM tools, MCP provider, tasks/terminal/debug observers |
| OpenCode | `integrations/OPENCODE.md` | Plugin: hooks, custom tools, SDK client |
| Claude Code | `integrations/CLAUDE-CODE.md` | Hooks + OTel export + MCP + plugin |
| Codex | `integrations/CODEX.md` | config.toml hooks + OTel exporter + MCP + plugin |

## 2. Research summary — what each runtime actually exposes

Verified against official docs (July 2026). This is the capture-surface matrix
that drives every adapter design.

| Capability | VS Code / Copilot | OpenCode | Claude Code | Codex |
| --- | --- | --- | --- | --- |
| Live prompt/response hook | `ChatParticipant` handler (own participant only) | `chat.message`, `message.part.updated`, `event` | `UserPromptSubmit`, `Stop`, `SessionStart/End` | `UserPromptSubmit`, `Stop`, `SessionStart/End` |
| Reasoning / COT capture | **Not exposed** (public API nor stored journals) | `ReasoningPart` (part type `reasoning`, start/end ts) | `thinking` content blocks in transcript JSONL | `reasoning` items in rollout JSONL / `exec --json` (needs `model_reasoning_summary=detailed` or `show_raw_agent_reasoning=true`) |
| Tool calls | LM tool invocations inside own participant; stored `toolRequests` in chatSessions journals | `tool.execute.before/after` (input: `{tool, sessionID, callID}`, output: `{args}` / `{title, output, metadata}`) | `PreToolUse` / `PostToolUse` (tool_name, tool_input, tool_response) | `PreToolUse` / `PostToolUse` (same schema family) |
| Session lifecycle | no public API (journals on disk) | `session.created/updated/idle/compacted/deleted/diff/error` | `SessionStart` / `SessionEnd` (reason: clear/resume/logout/…) | `SessionStart` / `SessionEnd` (source: startup/resume/clear/compact) |
| Background processes | Terminal API (`onDidStartTerminalShellExecution`), Task API (`onDidStartTask`), Debug API (`onDidStartDebugSession`) | `tool.execute.*` for `bash` + `shell.env` | `Bash` tool via `PreToolUse`/`PostToolUse` | `command_execution` items (command, exit_code, aggregated_output) |
| Passive transcript on disk | `chatSessions/*.jsonl` (delta journals), `transcripts/*.jsonl`, `agent-traces.db` (OTel spans), `state.vscdb` | `~/.local/share/opencode/storage/` JSON files or `opencode.db` (SQLite) | `~/.claude/projects/<enc>/<session>.jsonl` | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` + `state.sqlite` |
| OTel export | n/a (agent-traces.db is OTel spans, no export) | n/a | `CLAUDE_CODE_ENABLE_TELEMETRY=1` + `OTEL_EXPORTER_OTLP_*` | `[otel.trace_exporter.<id>]` (otlp-http / otlp-grpc) |
| MCP consumption | `mcpServers` contribution point + `vscode.lm.registerMcpServerDefinitionProvider`; `.vscode/mcp.json` | `mcp` key in opencode.json | `.mcp.json`, `~/.claude.json`, `claude mcp add` | `[mcp_servers]` in config.toml |
| Headless drive | n/a (participant only) | SDK `client.session.prompt`, `opencode run` | SDK `query()` (stream events) | `codex exec --json` |
| Instructions injection | `.github/copilot-instructions.md` | AGENTS.md / system-prompt transform hook | CLAUDE.md (hierarchy + imports) | AGENTS.md (hierarchy + imports) |

Key conclusions:

1. **Every runtime has a native on-disk transcript** that is append-only
   (JSONL) or file-per-entity JSON — a *passive tail ingestor* gives us full
   chat-log + COT capture with **zero integration**, even for apps we don't
   officially support yet (Cursor, Windsurf, Copilot CLI).
2. **Every runtime except VS Code Copilot can export COT.** VS Code is
   architecturally closed (no public reasoning surface); its best capture is
   the OTel span store (`agent-traces.db` — real token counts) + chat session
   journals (messages + tool calls).
3. **All four runtimes speak MCP** as clients, so UCH's existing 25-tool MCP
   server is the single brain-access surface.
4. **Hooks are the live signal** for Claude Code and Codex; **plugins are the
   live signal** for OpenCode; **the extension host is the live signal** for
   VS Code.

## 3. Architecture — the Hive

```
                    ┌─────────────────────────────────────────────┐
                    │              UCH HIVE DAEMON                │
                    │  (local process, ~/.uch/, port 4318/3999)   │
                    │                                             │
  live adapters ──► │  Spool watcher    ──┐                       │
  (hooks/plugins/   │  HTTP ingest  ──────┤                       │
   extension)       │  OTLP receiver ─────┤  Hive Ledger          │
                    │  Transcript tails ──┤  (append-only JSONL)  │
  passive tails ──► │  (claude/codex/     │  TraceLedger (OTel)   │
  (claude jsonl,    │   opencode/copilot) │  Kernel memory        │
   codex rollouts,  │                     │  Session store        │
   opencode db,     │                     │  Decision/convention  │
   copilot journals)│                     │  Connectome           │
                    │                     │                       │
                    │  MCP server (25+    │  Synthesis jobs:      │
                    │  tools) ◄───────────┤  summarize, decide,   │
                    │  streamable HTTP    │  distill, handoff     │
                    └─────────────────────────────────────────────┘
                          ▲                     │
        ┌─────────────────┴───────────┐         │
        │  one brain, five bodies     │         │
        ▼                             ▼         ▼
  VS Code ext      OpenCode       Claude Code   Codex        CLI
  (participant+    (plugin hooks) (hooks+OTel)  (hooks+OTel) (uch hive)
   LM tools,        │               │            │
   terminal/task    ▼               ▼            ▼
   observers)   ──► all write HiveEvents to the daemon (spool/HTTP)
```

### 3.1 Components

**Hive Daemon** (`uch hive` — extends the existing `uch serve` control plane)
is the single always-on local process that owns all persistence. It binds
`127.0.0.1` only and exposes:

| Endpoint | Purpose | Consumers |
| --- | --- | --- |
| `POST /hive/events` | push HiveEvent batches (JSON) | VS Code extension, OpenCode plugin |
| `GET /hive/events?cursor=` | read-back / catch-up | extension, plugin, webviews |
| spool dir `~/.uch/spool/` | drop `.hive.jsonl` files; daemon tails them | process-based adapters (hooks, CLI) — zero network |
| `POST /v1/traces` (OTLP/HTTP) | receive Claude Code / Codex OTel spans | P2 milestone |
| MCP streamable HTTP | UCH MCP server (existing tools) | VS Code extension (registerMcpServerDefinitionProvider), web clients |
| MCP STDIO | `node dist/cli/index.js mcp` (existing) | Claude Code, Codex, OpenCode configs |

**Hive Ledger** — append-only `~/.uch/hive/events/YYYY/MM/DD/hive-events.jsonl`.
Every line is a normalized **HiveEvent** (§4). The ledger is the canonical
cross-app conversation memory; it is what the sleep cycle, decision log,
connectome, and Organic Score engines consume.

**Adapters (live)** — thin per-runtime shims that translate native signals
into HiveEvents and push them (spool file append or HTTP):

| Runtime | Adapter | Native signal → HiveEvent |
| --- | --- | --- |
| Claude Code | `.claude/settings.json` hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`, `SubagentStop`, `PreCompact`) | hook JSON stdin → HiveEvent; `transcript_path` enables full replay |
| Codex | `config.toml` `[hooks]` (same event family) | hook JSON stdin → HiveEvent; `turn_id` available |
| OpenCode | `.opencode/plugins/uch-hive.ts` (`event`, `chat.message`, `message.part.updated`, `tool.execute.before/after`, `session.*`) | plugin args → HiveEvent via `ctx.client` or spool |
| VS Code | extension (`ChatParticipant` handler, `vscode.lm` tools, terminal/task/debug observers) | extension host → HTTP `POST /hive/events` |

**Ingestors (passive)** — daemon-side tails that read native stores. They make
capture work even when the live adapter is absent, and they backfill history:

| Store | Path (Windows: `%USERPROFILE%`) | Format |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/<encoded>/<session>.jsonl` | JSONL: `summary`/`user`/`assistant`/`file-history-snapshot`; assistant content blocks incl. `thinking`, `tool_use`; `usage` per message |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` + `state.sqlite` | JSONL envelope `{timestamp, type, payload}`; `response_item` (message/reasoning/function_call/function_call_output), `event_msg` (user_message/agent_message/token_count) |
| OpenCode | `~/.local/share/opencode/storage/{session,message,part}/...` (JSON) or `opencode.db` (SQLite: session/message/part tables, `info` JSON column) | file-per-entity JSON / SQLite |
| VS Code Copilot | `<User>/workspaceStorage/<hash>/chatSessions/*.jsonl`, `globalStorage/emptyWindowChatSessions/*.jsonl`, `globalStorage/github.copilot-chat/agent-traces.db`, `transcripts/*.jsonl`, `state.vscdb` | delta journals (`kind` 0/1/2 patches), SQLite |

Ingestor mechanics: keep a per-file cursor (byte offset) in
`~/.uch/hive/state/cursors.json`; tail appended lines; parse defensively
(unknown fields ignored, schema-drift tolerant); dedupe on
`(runtime, runtimeSessionId, nativeEventId)`.

### 3.2 Cross-workspace identity

- `workspaceId`: stable git-root hash (existing workspace-manifest contract).
- `hiveSessionId = sha256(workspaceId + "|" + runtime + "|" + runtimeSessionId)`. This is
  the **protocol Episode id** (ADR-005 §3): Claude's Conversation, Codex's Session,
  Copilot's Agent Run, and OpenCode's Session all map to one Episode — the Brain never
  cares where the episode originated. Every Episode carries an episode hash (content
  fingerprint) for integrity and dedupe.
- Runtime session ids are never shared across apps; the **handoff event**
  (`kind: "handoff"`) is the explicit bridge ("switched from Claude Code
  session X to OpenCode session Y on task T"), authored by the agent or the
  user, and indexed for `session-handoff` MCP recall. A handoff merges two protocol
  Episodes into one continuing cognition stream.
- Trace correlation: adapters propagate/accept W3C `traceparent`; Claude Code
  `prompt_id`, Codex `turn_id`, OpenCode part ids and Copilot request ids are
  preserved in `provenance.nativeIds`.

### 3.3 Integration levels

Each adapter participates at the level its host actually exposes, per rail, with graceful
degradation — the full ladder and conformance criteria are in
[INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md) (ADR-005 §4). In short: L0 workspace
events, L1 session lifecycle, L2 tooling, L3 cognition traces + Live Cognitive State,
L4 native. The M-series roadmap (§8) is self-classifying: M0 → L0, M1 → L1–L2,
M2 → L3, M3 → L4.

### 3.4 Event flow

```
native signal ──► adapter ──► HiveEvent (spool/HTTP)
                                  │
                                  ▼
                      ┌─ dedupe + validate (zod) ─┐
                      ▼                           ▼
               Hive ledger              TraceLedger (OTel schema,
               (conversation)           span per turn/tool/reasoning)
                      │                           │
                      ▼                           ▼
              Synthesis jobs ──► kernel.remember / decisionLog /
              (on session.end)     connectome.link / sleep cycle /
                                   handoff doc
```

## 4. HiveEvent schema (v1)

One canonical envelope for every capture, every runtime:

```jsonc
{
  "v": 1,
  "id": "01J0HIVE...",                    // ULID, sortable
  "ts": "2026-07-31T12:00:00.000Z",
  "runtime": "claude-code",               // claude-code | codex | opencode | vscode | copilot | uch
  "runtimeSessionId": "00893aaf-…",       // native session id (uuid / rollout id / chat session id)
  "workspaceId": "3f9a…",                 // git-root hash (workspace-manifest)
  "kind": "session.start",                // see table below
  "payload": { /* kind-specific, native-shaped */ },
  "traceparent": "00-<32hex>-<16hex>-01", // W3C; absent → daemon assigns
  "provenance": {
    "source": "hook:Stop | tail:claude-jsonl | plugin:tool.execute.after | ext:chatParticipant | otlp",
    "reliability": 0.9,                   // 1.0 native hook, 0.8 tail parse
    "nativeIds": { "promptId": "…", "turnId": "…", "requestId": "…" }
  },
  "meta": { "model": "claude-sonnet-4-5", "tokens": {"input":1,"output":2,"cacheRead":3,"reasoning":4}, "costUsd": 0.01 }
}
```

| `kind` | Payload highlights | Emitted by |
| --- | --- | --- |
| `session.start` | title, cwd, model, source (startup/resume/clear/compact) | all adapters |
| `session.end` | reason, durationMs, totals (tokens, cost, tool calls) | all adapters |
| `user.prompt` | text, references/files, prompt_id | hooks, participant, plugin |
| `assistant.message` | text (streamed or final), finish reason | hooks (`Stop`/transcript), plugin, participant |
| `reasoning` | text, summary, model, effort | claude thinking blocks, codex reasoning items, opencode ReasoningPart |
| `tool.call` | tool name, input args (redacted), id | PreToolUse, tool.execute.before, LM tool invoke |
| `tool.result` | output (truncated), error, durationMs | PostToolUse, tool.execute.after |
| `file.edit` | file, before/after (or diff), session diff link | git ingest, opencode session_diff, vscode file observers |
| `background.process` | kind (task/terminal/debug/shell), command, cwd, exitCode, pid | vscode terminal/task/debug API; bash tool calls; codex command_execution |
| `trace.span` | otel span fields (trace_id, span_id, parent, attributes) | OTLP receiver; TraceLedger mirror |
| `decision` / `convention` | title, description, alternatives | agent calls, synthesis jobs |
| `handoff` | from session, to session, task, summary | session-handoff bridge |
| `cognitive.state` | Live Cognitive State snapshot (`uch.cognitive-state.v1`, [LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md)) | synthesis job on attach/heartbeat/session.end |

Rules: events are **append-only, immutable**; payloads are truncated at
adapter level (tool output 64 KB, reasoning 16 KB, prompt 32 KB — configurable);
secrets are redacted by pattern before write (`.env` values, `API_KEY=…`,
`token`, `password`); the ledger never stores credentials.

## 5. Reasoning (COT) policy

| Runtime | Capturable? | Mechanism | Notes |
| --- | --- | --- | --- |
| Claude Code | yes | `thinking` content blocks in transcript JSONL (tail) | always on when extended thinking is used; also via `Stop` hook + transcript_path read |
| Codex | yes | rollout `response_item` content blocks type `reasoning`; `exec --json` item type `reasoning` | recommend `model_reasoning_summary=detailed`; raw COT requires `show_raw_agent_reasoning=true` (opt-in) |
| OpenCode | yes | part type `reasoning` (start/end timestamps) | in storage + `message.part.updated` |
| VS Code Copilot | **no** | — | public API and on-disk journals do not include reasoning; capture tokens + messages + tool calls only. `agent-traces.db` has per-turn token counts (best-available proxy) |
| UCH in-process (opencode plugin boot) | yes | `learnFromInteraction` + fabric concepts | existing |

COT handling rules (privacy-first, per `design/PRIVACY-ERASURE.md`):

1. COT is written to a **separate vault** `~/.uch/hive/reasoning/` (optional
   AES-GCM encryption with `UCH_VAULT_KEY`); the main ledger stores only a
   hash reference.
2. COT is **excluded from MCP recall** by default; a dedicated tool
   `reasoning-read` (opt-in per session, logged in the audit trail) exposes it.
3. Retention: COT vault TTL (default 30 days, configurable); ledger
   transcripts are retained per user policy.
4. Distillation jobs may consume COT locally (sleep cycle, decision
   extraction) but never ship it out of the machine.

## 6. Background processes

The hive treats any non-interactive execution as a `background.process` event,
which feeds the WorkspaceBrain build/failure graphs and trace ledger:

- **VS Code extension**: `window.onDidStartTerminalShellExecution` /
  `onDidEndTerminalShellExecution` (terminal API, requires shell integration),
  `tasks.onDidStartTask`, `debug.onDidStartDebugSession` +
  `onDidReceiveDebugSessionCustomEvent`.
- **Claude Code / Codex**: any `Bash`/`command_execution` tool call captured
  via `PreToolUse`/`PostToolUse` hooks (input includes tool_input.command) and
  the transcript/rollout tail.
- **OpenCode**: `tool.execute.before/after` for `bash` (args.command) and
  `shell.env` hook.

## 7. Security & privacy

- Daemon binds `127.0.0.1`; HTTP endpoints require a bearer token
  (`~/.uch/hive/token`, generated at first `uch hive init`).
- Spool dir `0700`; ledger dir `0700`.
- Redaction at the adapter boundary (regex patterns above).
- Erasure: existing privacy-erasure machinery extended to the ledger + COT
  vault (`uch hive erase <workspace|session|text>`).
- Threat model additions tracked against `design/THREAT-MODEL.md`
  (file-watcher symlink attacks on spool, HTTP token leakage, COT vault key
  handling).

## 8. Roadmap (GSD execute phases)

| Milestone | Scope | Entry criterion | Levels (INTEGRATION-LEVELS.md) |
| --- | --- | --- | --- |
| **M0 — Hive core (passive)** | HiveEvent schema + ledger + daemon (`uch hive`) + spool watcher + tails for claude/codex/opencode/copilot + cursors + dedupe | ledger round-trip tests; tail integration tests against fixture transcripts | L0 all platforms |
| **M1 — Live adapters** | Claude hooks JSON (generated by `uch hive init --claude`), Codex `config.toml` hooks, OpenCode `uch-hive` plugin, VS Code extension skeleton (participant + LM tools + MCP provider) | per-runtime E2E: real session produces correct HiveEvents; MCP recall finds events | L1–L2 per platform map |
| **M2 — Traces + COT vault** | OTLP/HTTP receiver (`/v1/traces`), TraceLedger span mapping, COT vault + `reasoning-read` tool, background capture for VS Code, Live Cognitive State synthesis | otel-bridge tests; COT vault tests; vault excluded from recall; cognitive.state round-trip per grant | L3 |
| **M3 — Bidirectional hive** | instructions injection (CLAUDE.md / AGENTS.md / `.github/copilot-instructions.md` generated from hive context), headless drive (SDK/`exec` wrappers as UCH tools), cross-session synthesis (dream engine), Cognitive Coprocessor augment planes | multi-app handoff scenario test | L4 per vendor allowance |

## 9. Verification strategy

- **Unit**: HiveEvent zod validation, redaction, cursor tailing, dedupe.
- **Fixture-based**: checked-in sample transcript/rollout/journal files
  (scrubbed) → ingestor parity tests vs. live adapters.
- **E2E (CI, no network)**: spawn `claude --print`, `codex exec`, `opencode
  run` against a sandbox repo with adapters installed; assert ledger contents.
- **VS Code**: extension host test suite (`@vscode/test-electron`) with a fake
  Copilot participant; journal fixtures for passive ingest.
- **Gates**: existing suite (141 files / 2232 tests) must stay green; Organic
  Score ≥ 90 on all new code.

## 10. Related docs

- `integrations/VSCODE.md` — standalone VS Code + Copilot Chat integration
- `integrations/OPENCODE.md` — standalone OpenCode integration
- `integrations/CLAUDE-CODE.md` — standalone Claude Code integration
- `integrations/CODEX.md` — standalone Codex integration
- `ADR-002-otel-trace-engine.md` — trace schema this design reuses
- `WORKSPACE-MANIFEST.md` — workspace identity contract
- `PRIVACY-ERASURE.md`, `THREAT-MODEL.md` — security posture
