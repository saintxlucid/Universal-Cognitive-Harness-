# EXOSYMBIOSIS — The UCH Wearable

> **Status:** Design (v0.1) · **Date:** 2026-07-31 · **Scope:** Universal integration of the
> Universal Cognitive Harness with every major coding agent/editor — VS Code + Copilot Chat,
> Claude Code, OpenAI Codex, OpenCode — as a **hive mind across apps**.
>
> Companion docs: `integrations/vscode-copilot.md`, `integrations/claude-code.md`,
> `integrations/codex.md`, `integrations/opencode.md`.

## 1. The thesis

UCH is not a plugin, an extension, an MCP server, or middleware. It is a **cognitive
augmentation layer**: the coding agent is not replaced, it **wears** UCH.

```
         UCH  (one organism)
      ┌───────────────────────────┐
      │  ONE BRAIN · ONE MEMORY   │
      │  ONE GENOME · ONE POLICY  │
      │  ONE NERVOUS SYSTEM       │
      └────────────┬──────────────┘
          /        |        \
    VS Code    Claude Code   Codex   OpenCode
    (Copilot)  (hooks+JSONL) (SDK/  (plugin+
                +SDK)         app-server) SSE)
          \        |        /
        Different hosts — same organism
```

Every AI company is independently building its own memory, planner, skills, and context
engine. That is duplicated effort. The hosts should not remember anything; they should
**ask UCH** — while UCH captures everything they think and do, across all of them.

The hosts are already converging on the same primitives (verified 2026-07-31 against
official docs):

1. **Agent Host / app-server / headless server** — every platform now separates the
   long-running agent runtime from the UI, and exposes a wire protocol for it
   (VS Code Agent Host Protocol, Codex app-server JSON-RPC, OpenCode server REST/SSE,
   Claude Code headless `-p` + SDK).
2. **Hooks with near-identical event names** — `SessionStart`, `UserPromptSubmit`,
   `PreToolUse`, `PostToolUse`, `SubagentStart/Stop`, `Stop`, `PreCompact` exist on all
   four platforms with overlapping JSON schemas.
3. **JSONL transcript stores** — every platform persists session logs on disk.
4. **OTel GenAI telemetry** — VS Code Copilot Chat and Claude Code can export traces
   following the OTel GenAI semantic conventions; UCH already owns a trace engine
   (ADR-002) with the same schema.

This document defines the **wearable contract** and the **hive-mind hub**; the companion
docs define each standalone integration.

### The three-layer split

Per [ADR-005](ADR-005-universal-cognitive-protocol.md), the wearable architecture is:

```text
Layer 1  Cognitive Core   — never knows a host (kernel, brains, organs, memory, genome)
Layer 2  Drivers (Harnesses) — one per ecosystem; each understands that app's APIs only
Layer 3  Universal Cognitive Protocol — everything translated into one format: Episode
```

UCH is the **Universal Cognitive Substrate**; each integration (VS Code, Claude Code,
Codex, OpenCode, …) is a **Cognitive Driver (Universal Cognitive Harness)** — an
adapter, disposable by design. Every platform participates at the level it actually
exposes, per rail, with graceful degradation ([INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md)).

> **Terminology reconciliation (ADR-005 Amendment A, 2026-08-01).**
> *Driver* is the **engineering term** for the per-ecosystem adapter (Layer 2);
> *Universal Cognitive Harness* remains the **product/vision term** (UCH) and the
> umbrella name for the wearable contract. In this corpus, "driver (harness)" refers
> to the component; "the UCH wearable" refers to the contract. Prior wording such as
> "harness triad" is superseded by **driver triad** (observe · translate · augment),
> and "harness manifest" by **driver manifest** (`level_claims` field).

### The driver triad — observe · translate · augment

Every driver (harness) has exactly three responsibilities:

1. **Observe** — everything the host exposes through official surfaces (hooks, plugins,
   transcripts, OTel, SDK events). Never scrape. Never hack. This is what makes the
   wearable durable as platforms evolve.
2. **Translate** — every native signal becomes a Universal Cognitive Event; host-native
   session units (Claude's Conversation, Codex's Session, Copilot's Agent Run, OpenCode's
   Session) all map to the protocol's **Episode** (ADR-005 §3). The Brain only speaks the
   protocol.
3. **Augment** — inject back into the host: genome, engineering standards, workspace
   memory, past architecture decisions, lessons, open hypotheses, active risks, taste,
   policies — and the Live Cognitive State ([LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md))
   so any host joins the organism instantly.

The **Cognitive Coprocessor** is the deterministic runtime that performs *Augment*: it
runs between the host's prompt and the model, silently asking "Have we done this before?
Which architecture? Known mistakes? Benchmarks? Standards? Security? Current roadmap?"
and injecting only the useful parts. The model never receives raw input alone; it
receives **augmented cognition**. The coprocessor is never an LLM and never reads hidden
chain-of-thought (COT tier ladder, §4 below).

## 2. The wear lifecycle

Inserting UCH into the agent lifecycle (per host):

```
Start ─► Wear UCH ─► Genome Sync ─► Memory Sync ─► Skill Sync
         ─► Workspace Sync ─► Policy Sync ─► Active Cognition (capture every thought)
         ─► Continuous Learning ─► Sleep ─► Persist ─► Disconnect
```

- **Wear:** the host loads the UCH wearable at startup (plugin / hooks file / prompt
  file / SDK import — per-host mechanism, see §6 and companion docs).
- **Sync (inbound, UCH → host):** genome (identity, laws, constitution), memory
  (recalled episodes, decisions, conventions), skills (catalog + loaded bodies),
  workspace state (manifest, projections), policy (permission stance, limits).
- **Active Cognition (outbound, host → UCH):** every prompt, reasoning block, message,
  tool call/result, subagent, permission decision, compaction, and model-token
  accounting is streamed to UCH as normalized cognition events (§4).
- **Learn / Sleep / Persist:** existing UCH machinery (sleep cycle distillation,
  connectome, memory filing, `saveAndHandoff`) runs on the accumulated cognition of
  *all* hosts.
- **Disconnect:** `SessionEnd`/`Stop` hooks flush, the wearable detaches, memory stays.

## 3. Topology

```
┌────────────────────────────────────────────────────────────────┐
│                        UCH DAEMON (hub)                        │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ OTLP collector│  │ Hub REST/SSE │  │ Transcript tailers   │  │
│  │ :4318         │  │ + WS :4XXX   │  │ (claude/codex/       │  │
│  └──────┬───────┘  └──────┬───────┘  │  opencode stores)     │  │
│         │                  │         └──────────┬───────────┘  │
│  ┌──────┴──────────────────┴────────────────────┴───────────┐  │
│  │  Cognition Ingest → Trace Ledger (OTel) → Event Bus      │  │
│  │  → Memory · Connectome · Genome · Skills · Sleep Cycle   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  MCP server (:transient or stdio) ── pull context for hosts   │
└────────────────────────────────────────────────────────────────┘
     ▲            ▲            ▲            ▲
  OTel rail    hooks rail   protocol rail  storage rail
     │            │            │            │
  VS Code      Claude Code    Codex       OpenCode
  Copilot      (HTTP hooks)  (app-server) (SSE + files)
  (+agent-host) (+SDK)        (+SDK)
```

The daemon is the existing UCH CLI extended with serve/ingest modes
(`node projects/uch/dist/cli/index.js`). Everything already inside UCH —
trace engine (ADR-002), neural event bus, connectome, memory stores, organic
score, projections, MCP tools — becomes the **single brain** that every host feeds.

## 4. The Cognition Capture Contract (5C)

All host adapters emit a normalized event stream. One schema, four hosts.

| Event | Host sources | Key fields |
| --- | --- | --- |
| `session.lifecycle` | SessionStart/SessionEnd, session.created, thread/start, transcript head | `host`, `sessionId`, `kind` (start/resume/end/compact/fork), `cwd`, `git` (branch/sha), `model` |
| `prompt.submitted` | UserPromptSubmit, /event user message, turn/start input | `text`, `sessionId`, `turnId`, `timestamp` |
| `cognition.reasoning` | thinking blocks, reasoning parts, reasoning items, agent_message events | `text?`, `tier` (plaintext/summary/encrypted/count-only), `signature?`, `tokens` |
| `message.assistant` | final text blocks, response items | `text`, `model`, `finishReason` |
| `tool.call` / `tool.result` | PreToolUse/PostToolUse, tool.execute.*, function_call(+output) | `name`, `input`, `output?`, `status`, `durationMs`, `callId` |
| `subagent.start/stop` | SubagentStart/Stop, task items | `agentId`, `agentType`, `parentSessionId` |
| `permission.*` | PermissionRequest/Denied, permission.asked/replied | `tool`, `decision`, `reason` |
| `model.info` | usage objects, token_count events, chat spans | `provider`, `model`, `tokens {input, output, reasoning, cacheRead, cacheWrite}` |
| `workspace.state` | file.edited, session diff, apply_patch, commit events | `path`, `diff?`, `action` |
| `compaction.*` | PreCompact/PostCompact, compact_boundary, experimental.session.compacting | `trigger`, `tokensBefore`, `summary?` |

**COT tier ladder** (per host, verified): Claude Code thinking blocks are plaintext
(with signature); OpenCode reasoning parts are plaintext JSON; Codex reasoning items
expose a plaintext summary while full content is often `encrypted_content`
(provider-bound); VS Code Copilot exposes reasoning *token counts* by default with
full-content capture only via `github.copilot.chat.otel.captureContent`. UCH ingests
whatever tier exists, tags it, and never over-claims (§9 caveats).

**Canonical schema = OTel traces (ADR-002).** Each cognition event maps to a span
(`session.*` → root span; `tool.*` → `execute_tool`; `cognition.reasoning` →
`chat` child span with `gen_ai.usage.reasoning.output_tokens`) plus
`host.<name>` attributes for provenance, exactly as the existing
`CognitiveTrace`/`TraceLedger`/`OtelBridge` machinery already models events. This
gives us replay (`replayEvents`, `resumeContext`, `hydrate`) for free.

**Episode mapping (ADR-005 §3).** The 5C event stream is grouped into protocol
**Episodes** — one per host-native session unit, identified by
`episode_id = sha256(workspaceId | host | nativeSessionId | sessionStartTs)`, carrying
an episode hash for integrity. Kernel `Episode` records (the fine-grained memory unit,
`src/kernel/types/episode.ts`) accumulate inside their protocol Episode; a `handoff`
event merges protocol Episodes into one continuing cognition stream. The Brain never
cares which host produced an Episode.

## 5. The sync planes

| Plane | Direction | Mechanism per host |
| --- | --- | --- |
| Genome | UCH → host | SessionStart `additionalContext` (laws, identity, constitution digest); prompt files; custom agent instructions |
| Memory | UCH → host | SessionStart/UserPromptSubmit context injection (recalled episodes, decisions, conventions, handoffs from *other* hosts) |
| Skills | UCH → host | skill catalog injection; `experimental.session.compacting` context; MCP `skill` tools |
| Workspace | ⇄ | manifest + projections pushed on session start; `workspace.state` events ingested; diffs via session_diff storage |
| Policy | UCH → host | permission stance via PreToolUse hooks (deny/allow/ask) and policy digest |
| Cognition | host → UCH | §4 capture rails (always-on, passive) |

## 6. Capture rails (per host, in priority order)

| Rail | VS Code/Copilot | Claude Code | Codex | OpenCode |
| --- | --- | --- | --- | --- |
| **Hooks** | agent hooks (plugin) | HTTP hooks → hub | command hooks → `uch ingest` | plugin events |
| **Storage tail** | (sqlite chat store, optional) | `~/.claude/projects/*.jsonl` + `subagents/` | `~/.codex/sessions/**/rollout-*.jsonl` | `~/.local/share/opencode/storage/{session,message,part}/` |
| **Protocol client** | AHP client (sessions/chats/terminals channels) | Agent SDK (TS/Python) | app-server JSON-RPC client (turn/item events, command/exec, process/spawn) | server SSE `/event` + REST `/session/:id/message` |
| **OTel rail** | Copilot OTLP → UCH collector `:4318` (`captureContent` opt-in; file exporter fallback) | `CLAUDE_CODE_ENABLE_TELEMETRY` → collector | (future; SDK tracing) | n/a |

Every host has ≥2 independent rails, so capture survives a single-rail failure.
The **hooks rail** is the low-latency live stream; the **storage rail** is the
lossless backfill; the **protocol rail** is the deep/background view; the **OTel rail**
is the vendor-grade structured view.

## 7. Hive-mind semantics

- **One identity:** all sessions from all hosts carry the same organism ID
  (traceparent root + `host` attribute), so the ledger, connectome, and memory
  treat them as one cognition stream.
- **Cross-app memory:** what Claude Code learned this morning is recalled inside
  VS Code this afternoon (existing `uch.recall`/`getContext` + memory filing rules;
  no per-app memory duplication).
- **Cross-app handoff:** `saveAndHandoff` per host session; `resumeContext` restores
  a task in any host, with the continuation traceparent.
- **Cross-app learning:** the sleep cycle distills skills from cognition across all
  hosts; the connectome weights edges by cross-host co-activation; the mistake DB
  prevents all hosts from repeating the same error.
- **Background capture:** VS Code Agent Host sessions that outlive the editor,
  Codex background turns (`turn/start` while no client attached), and headless
  Claude/OpenCode servers are all observable via the protocol/OTel rails — the hive
  never loses track of background work.

## 8. What UCH returns (the value loop)

1. **Context** — `getContext(userMessage)` enriched with cross-host memory
   (existing plugin, now fed by all hosts).
2. **Guardrails** — organic score / engineering vetoes / constitution applied to
   changes made in *any* host; security smells flagged even if the host didn't ask.
3. **Continuity** — session handoff between apps; compaction summaries archived;
   `PreCompact` context injection protects what hosts would forget.
4. **Learning** — sleep-cycle distillations, mistake DB, skill registry, experience
   patterns — all host-agnostic.
5. **Replay/observability** — full cognitive replay of any session from any host,
   with the reasoning, tool trace, token accounting, and lineage intact.

## 9. Verified constraints & caveats (research 2026-07-31)

1. **Transcript formats are NOT stable interfaces.** Claude Code (official docs:
   "the entry format is internal to Claude Code and changes between versions"),
   Codex ("the transcript format isn't a stable interface for hooks"), and
   OpenCode storage layout all warn explicitly. → Pin parsers per version, degrade
   gracefully, and prefer official interfaces (`/export`, `--output-format
   stream-json`, `thread/read` + `includeTurns`, `/session/:id/message`) for
   correctness.
2. **COT availability differs by host** (§4 tier ladder). Codex full reasoning is
   often `encrypted_content`; Copilot requires `captureContent: true` opt-in.
   Design must treat reasoning as a best-effort tiered signal, never a guarantee.
3. **AHP / Agent Host is under active development** ("being enabled gradually"),
   and Codex WebSocket transport is experimental; the UCH AHP and WS clients are
   P2, not P0.
4. **Codex hooks are command-only today** (`type: "command"`; HTTP/prompt/agent
   handlers parsed but skipped). Codex rail uses command hooks that exec
   `node …/uch ingest` with JSON on stdin — exec form on Windows requires a real
   `.exe` (`node`), so use `"command": "node"` + `args` (matches workspace Windows
   constraints).
5. **Claude HTTP hooks require an allowlist** (`allowedHttpHookUrls`) — the UCH
   hub URL must be listed; the hooks doc's Windows guidance is to run PowerShell
   or exec-form node.
6. **VS Code OTel is off by default and content-capture is opt-in** — the
   extension should configure it, and the user must consent to content capture
   (privacy: `PRIVACY-ERASURE.md` applies to everything captured).
7. **OpenCode plugin events are the primary live rail**; `message.part.updated`
   carries `reasoning` parts with plaintext text — the richest free COT source.
8. **Windows paths** (this workspace): Claude `%USERPROFILE%\.claude\projects`,
   Codex `%USERPROFILE%\.codex\sessions`, OpenCode
   `%USERPROFILE%\.local\share\opencode` (project-scoped storage exists when the
   repo carries `.opencode/`).
9. **Hooks can block** — UCH PreToolUse rails are read-only pass-through by
   default; any deny/allow is policy-gated (§5 Policy plane) and logged with
   provenance (EVENT-GOVERNANCE).

## 10. Roadmap

| Phase | Scope | Rail |
| --- | --- | --- |
| P0 | Hub daemon (`uch serve`: OTLP collector + REST/SSE + ingest), 5C schema, hooks rails for all 4 hosts, context-injection rails | hooks + hub |
| P1 | Transcript tailers (claude/codex/opencode), compaction capture, token accounting, ledger replay | storage |
| P2 | Copilot OTel rail + agent-host (AHP) client, Codex app-server client, Claude Agent SDK embedding | protocol + OTel |
| P3 | Background capture completeness, cross-host handoff UX, hive routing (route task to best-worn host) | protocol |
| P4 | Cross-host sleep distillation, connectome cross-host weighting, forgetting/erasure, fleet policy | kernel |

## 11. Deliverables per integration

- `integrations/vscode-copilot.md` — UCH VS Code extension + agent plugin
  (hooks + OTel + AHP), Copilot CLI rail.
- `integrations/claude-code.md` — HTTP hooks rail, transcript tailer, SDK
  embedding, headless + telemetry rail.
- `integrations/codex.md` — hooks rail (command → `uch ingest`), rollout tailer,
  app-server client, SDK embedding.
- `integrations/opencode.md` — plugin rail, server SSE/REST rail, storage tailer,
  context injection.
