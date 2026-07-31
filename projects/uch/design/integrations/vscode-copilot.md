# UCH × VS Code + Copilot Chat — Standalone Integration

> **Status:** Design · **Date:** 2026-07-31 · **Host:** VS Code (Copilot Chat, Copilot
> CLI, Agent Host) · **Master doc:** `../EXOSYMBIOSIS.md`
>
> Research sources (official, 2026-07-31):
> code.visualstudio.com/docs/agents/concepts/agent-host ·
> .../docs/agents/reference/hooks-reference · .../docs/agent-customization/agent-plugins ·
> .../docs/agents/guides/monitoring-agents · microsoft.github.io/agent-host-protocol

## 1. What the host exposes

| Capability | Detail |
| --- | --- |
| **Agent Host (AHP)** | Dedicated process running agent sessions independent of the editor. Open **Agent Host Protocol**: JSON-RPC over WebSocket; clients subscribe to URI-addressed channels (sessions, chats, terminals, changesets); initial snapshot + ordered actions; reconnect + missed-actions replay; host is source of truth. Run standalone: `code agent host` (localhost + connection token, `--tunnel` for remote). Adapters: Copilot, Claude, Codex. |
| **Hooks** | `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`. Command hooks with `windows`/`linux`/`osx` overrides, `cwd`, `env`, `timeout` (default 30s). Inputs: `tool_name`, `tool_input`, `tool_use_id`, `tool_response`, `prompt`, `source`, `agent_id`, `agent_type`, `stop_hook_active`, `trigger` + common fields. Outputs: `additionalContext`, `permissionDecision` (allow/deny/ask — most restrictive wins), `updatedInput`, `decision: block`. |
| **Agent plugins (Preview)** | `plugin.json` bundling slash commands, skills, custom agents, hooks, MCP servers. **Cross-tool compatible**: VS Code auto-detects Claude format (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `${CLAUDE_PLUGIN_ROOT}`) and Copilot format (`plugin.json`, `hooks.json`). Marketplaces (git repos), local plugins via `chat.pluginLocations`, npm/PyPI sources. |
| **OTel (Copilot Chat)** | Full OTel GenAI telemetry: traces (`invoke_agent`, `chat`, `execute_tool`, `execute_hook` spans), metrics, events. Attributes under `gen_ai.*`, `github.copilot.*`, legacy `copilot_chat.*`. Content capture opt-in (`github.copilot.chat.otel.captureContent` / `COPILOT_OTEL_CAPTURE_CONTENT`). Exporters: `otlp-http` (default :4318), `otlp-grpc`, `console`, **`file` (JSONL)**; local SQLite span DB + "Chat: Export Agent Traces DB". Covers: foreground agent, Copilot CLI wrapper (`service github-copilot`), Claude agent (`service claude-code` via `CLAUDE_CODE_ENABLE_TELEMETRY`), background/terminal CLI sessions. |
| **Storage** | Chat history + agent debug logs in extension storage (sqlite `state.vscdb`, extension-host logs); Agent Debug Log panel shows full SDK hierarchy incl. prompt/response content when OTel export is off. |

## 2. Capture rails (in priority order)

### Rail A — Agent plugin hooks (P0)
A UCH agent plugin (`plugin.json` + `hooks/hooks.json`, Claude-format) installed from
the UCH marketplace or `chat.pluginLocations`. It registers command hooks on all
events that POST the JSON input to the UCH hub (`http://127.0.0.1:<hub>/ingest/vscode`)
via a small node shim (`"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/ingest.js", "--hub", "..."]` — exec form, Windows-safe).

- `SessionStart` → `session.lifecycle(start)` + inject `additionalContext`
  (genome digest + memory recall + workspace manifest).
- `UserPromptSubmit` → `prompt.submitted`.
- `PreToolUse`/`PostToolUse` → `tool.call`/`tool.result` (read-only by default;
  Policy plane may return `permissionDecision`).
- `SubagentStart`/`SubagentStop` → `subagent.start/stop`.
- `PreCompact` → `compaction.before` (payload available for archive).
- `Stop` → flush turn; `session.lifecycle` bookkeeping.
- The same plugin package is worn by Claude Code and Copilot CLI unchanged
  (cross-tool format) — this is the hive's shared membrane.

### Rail B — OTel export to UCH collector (P1)
The extension (or settings) configures:
`github.copilot.chat.otel.enabled: true`,
`otlpEndpoint: http://127.0.0.1:4318`,
`captureContent: <user consent>`,
and optionally `exporterType: file, outfile: ~/.uch/inbox/copilot-otel.jsonl` as an
offline fallback. UCH's collector (existing OTel trace engine, ADR-002) ingests
`invoke_agent`/`chat`/`execute_tool`/`execute_hook` spans, maps them to the 5C
contract (`gen_ai.usage.reasoning.output_tokens` → `cognition.reasoning` tier
count-only unless content capture enabled), and keys them by
`gen_ai.conversation.id` + traceparent. Covers **background** activity: terminal
Copilot CLI sessions and headless Agent Host turns emit to the same endpoint while
no window is attached.

### Rail C — Agent Host Protocol client (P2)
A UCH daemon module connects as an AHP client to the local Agent Host
(`code agent host`; ws://localhost + connection token), subscribes to the
`session`, `chat`, `terminal`, and `changeset` channels, and applies the state
snapshot + ordered-action stream to the trace ledger. This is the deep rail:
full session state, tool routing, terminal output — including sessions that
outlive the editor (independent execution). AHP is under active development;
the client must pin the protocol version and degrade to Rails A+B.

### Rail D — Copilot CLI (P1)
`copilot` CLI sessions inherit OTel env forwarding when launched from VS Code;
standalone terminal sessions can be pointed at UCH directly
(`COPILOT_OTEL_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318`),
emitting `github-copilot` service traces (subagents, permissions, hooks, tools).

## 3. Injection rails (UCH → VS Code)

| Surface | Use |
| --- | --- |
| `SessionStart.additionalContext` | genome + memory digest |
| Custom agent / prompt files (from plugin) | UCH persona with MCP tool access |
| MCP server (`.mcp.json` in plugin) | existing `uch` server: 25 cognitive tools |
| Skills (plugin `skills/`) | UCH skill catalog visible in "Configure Skills" |

## 4. Deployment shape

```
┌─ VS Code ────────────────────────────────┐     ┌─ UCH daemon ───────────┐
│ Copilot Chat + Agent Host ──OTel :4318───┼────►│ collector + hub        │
│ UCH plugin hooks ──POST /ingest/vscode───┼────►│ + AHP client (P2)      │
│ Copilot CLI (terminal) ──OTel :4318──────┼────►│ → trace ledger → memory│
└───────────────────────────────────────────┘     └────────────────────────┘
```

## 5. Constraints & risks

1. Agent Host/AHP is being enabled gradually; Rail C is version-pinned + optional.
2. OTel is off by default; content capture requires explicit user consent
   (privacy policy applies; honor `PRIVACY-ERASURE.md`).
3. Plugin format hooks ignore `matcher` values today (VS Code runs hooks on every
   event) — filter inside the shim by `tool_name`.
4. Hook timeout default 30s — the ingest shim must be fire-and-forget (spawn,
   return 0 immediately), never block the agent loop.
5. `stop_hook_active` must be respected to avoid infinite Stop loops.
