# COGNITIVE-TRACE.md — The Cognitive Trace: Schema, Organ Ownership, Driver Contract

- **Status:** Approved design ([ADR-005](ADR-005-universal-cognitive-protocol.md) Amendment A)
- **Date:** 2026-08-01
- **Scope:** The canonical recording unit of an Episode — the OTel-shaped cognitive
  trace — plus the organs that own it and the contract every driver (harness) must
  fulfill to emit one.
- **Prerequisites:** [ADR-002](ADR-002-otel-trace-engine.md) (OTel trace model),
  [ADR-005](ADR-005-universal-cognitive-protocol.md) §3 (Episode canonicalization),
  [EVENT-GOVERNANCE.md](EVENT-GOVERNANCE.md) (the gate every trace passes),
  [EXOSYMBIOSIS.md](EXOSYMBIOSIS.md) §4 (the 5C capture contract)
- **Companions:** [COGNITIVE-MIDDLEWARE.md](COGNITIVE-MIDDLEWARE.md) (the pipeline that
  carries traces), [LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md) (the present,
  derived from traces), [COGNITIVE-PACKAGES.md](COGNITIVE-PACKAGES.md) (how drivers
  ship)

## 1. Purpose

ADR-005 §3 defines the **Episode** — the host-neutral session unit — but not the
shape of the cognition inside it. This document fixes that shape: the **Cognitive
Trace**.

> A Cognitive Trace is the immutable, OTel-shaped record of everything observable
> that happened during an Episode: prompts, actions, tool calls, decisions,
> verification, and explicit summaries — with lineage, provenance, and cost.

The trace is the *history*; the Live Cognitive State
([LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md)) is the *present* derived from it.
The trace is what replay, memory, sleep distillation, the connectome, and the
Engineering Intelligence layer consume. It is never a transcript of hidden
chain-of-thought (ADR-002 §5, MANIFESTO commitment #6) — only observable artifacts.

## 2. Schema (`uch.cognitive-trace.v1`)

The canonical schema is the **OpenTelemetry Trace Data Model** (ADR-002 §1), extended
with cognitive semantics in conventions, not new wire formats.

### 2.1 Identifiers

| Field | Format | Notes |
|---|---|---|
| `trace_id` | 32-hex (128-bit) | W3C `traceparent` field 1 |
| `span_id` | 16-hex (64-bit) | W3C `traceparent` field 2 |
| `parent_span_id` | 16-hex | Optional; absent = root |
| `episode_id` | `sha256(workspace_id \| host \| native_session_id \| session_start_ts)` | Protocol Episode (ADR-005 §3) |
| `episode_hash` | content fingerprint over the episode's trace stream | Integrity + dedupe |
| `event_id` | ULID / deterministic id | The 5C event's immutable id |

### 2.2 Span kinds

Span names use the dotted namespace from ADR-002 §4; every span maps to one or more
5C events (EXOSYMBIOSIS §4):

| Span name | 5C source events | Kind | Payload highlights |
|---|---|---|---|
| `session.start` / `session.end` | `session.lifecycle` | server | host, sessionId, cwd, git {branch, sha}, model, reason |
| `llm.prompt` | `prompt.submitted` | client | text (truncated), turnId, traceparent |
| `chat.reasoning` | `cognition.reasoning` | internal | tier (plaintext/summary/encrypted/count-only), signature?, tokens |
| `message.assistant` | `message.assistant` | producer | text, model, finishReason |
| `tool.call` | `tool.call` / `tool.result` | client | name, input (redacted), output? (truncated), status, durationMs, callId |
| `subagent.*` | `subagent.start/stop` | internal | agentId, agentType, parentSessionId |
| `permission.*` | `permission.*` | internal | tool, decision, reason |
| `file.save` / `git.commit` / `build.run` / `test.run` | `workspace.state` + driver rails | producer | path, diff?, action, exit code |
| `decision.recorded` | `decision` / `convention` | producer | title, alternatives, status |
| `compaction.*` | `compaction.*` | internal | trigger, tokensBefore, summary? |
| `plan.step` | explicit planning artifacts | internal | step, status, dependencies |

### 2.3 Reserved attributes (`uccp.*`)

| Attribute | Value |
|---|---|
| `uccp.event.type` | The 5C event type (event-name qualifier) |
| `uccp.event.source` | driver id + rail (`hook:Stop`, `tail:claude-jsonl`, `plugin:tool.execute.after`, `ext:chatParticipant`, `otlp`) |
| `uccp.agent.id` | organism agent id |
| `uccp.session.id` | native session id |
| `uccp.workspace.id` | git-root hash (workspace manifest) |
| `uccp.episode.id` / `uccp.episode.hash` | protocol Episode identity |
| `uccp.trace.kind` | `observable` (third-party driver events) \| `explicit` (first-party planning artifacts) |
| `uccp.tier.cot` | `plaintext` \| `summary` \| `encrypted` \| `count-only` \| `none` |
| `uccp.grant.id` | the grant that authorized the driver session |
| `uccp.cost.usd` / `uccp.tokens.*` | model.info accounting |

### 2.4 Trace events (timeline)

Trace events carry `uccp.event.type` as the event-name qualifier and are the
fine-grained timeline inside a span: `prompt`, `tool`, `file`, `terminal`, `git`,
`build`, `test`, `mcp`, `agent`, `session`, `decision`, `plan_step`, `reflection`,
`human_feedback` (ADR-002 §4). Every trace event is causally linked (Law 3) and
carries provenance (Law 4).

## 3. Organ ownership

| Organ | Module | Owns | Does not own |
|---|---|---|---|
| **Trace Ledger** | `src/cognitive-plane/trace-engine/trace-ledger.ts` | The append-only span store (canonical, keyed by `span_id`) | Anything not yet gated |
| **Trace Recorder** | `src/cognitive-plane/trace-engine/trace-recorder.ts` | Bus → trace mapping, remote-parent continuation, tier tagging | Deciding what *may* be recorded (governance does) |
| **Cognitive Trace** | `src/cognitive-plane/trace-engine/cognitive-trace.ts` | The trace/span model, id normalization | Storage |
| **Otel Bridge** | `src/cognitive-plane/trace-engine/otel-bridge.ts` | Projection to external OTel providers (Langfuse/Jaeger/OTLP) | The ledger itself (local-first law) |
| **Cognitive Replay** | `src/cognitive-plane/replay/cognitive-replay.ts` | `replayEvents`, `resumeContext`, `hydrate` | Live state (that is the middleware's image) |
| **Event Governance** | `src/control-plane/event-governance.ts` | The gate every trace passes: provenance, idempotency, policy, grant, staleness, audit | The trace content |
| **Neural Event Bus** | `src/event-bus/neural-event-bus.ts` | The transport every trace rides | The trace schema |
| **Synthesis consumers** | sleep cycle, connectome, decision log, engineering intelligence | What they derive from traces (Law 6 residue) | The raw trace stream (consolidation-only visibility, Constitution Art. III §6) |

**Ownership rule (Law 19 — Cognition Ownership):** the trace belongs to the
organism, not to the driver that emitted it. The driver holds a time-limited grant
to write into the ledger and to read its own projection — never to copy, fork, or
claim the cognition it observed.

## 4. The driver contract

Every driver (harness) that emits cognitive traces must satisfy all of the
following. A driver that cannot satisfy a requirement degrades to the highest
level it can honestly declare (INTEGRATION-LEVELS.md §4) — it never fakes a trace.

1. **Propagate lineage.** Accept a W3C `traceparent` from the host/transport and
   attach it to every emitted event; when absent, receive one from the middleware.
   A `handoff` event continues the trace, never restarts it (ADR-002 §3).
2. **Map, don't invent.** Every native signal maps to a 5C event and a span name
   from §2.2. Unknown native fields are dropped, not guessed (schema-drift
   tolerant parse).
3. **Group into Episodes.** Emit events inside the Episode identified by
   `episode_id`; carry the episode hash; one Episode per host-native session unit.
4. **Never record hidden cognition.** Only observable artifacts — and explicit
   first-party artifacts tagged `uccp.trace.kind=explicit`. Reasoning is
   best-effort tiered: tag the COT tier honestly (`uccp.tier.cot`) and never
   over-claim (EXOSYMBIOSIS §4 tier ladder).
5. **Redact and truncate at the boundary.** Secrets by pattern before write;
   payload caps (tool output 64 KB, reasoning 16 KB, prompt 32 KB — configurable).
   The ledger never stores credentials (UNIVERSAL-INTEGRATION §4).
6. **Pass the governance gate.** Every emitted event carries provenance
   (`uccp.event.source`, reliability, native ids) and rides the governed event
   path; denials are observable, never silent (EVENT-GOVERNANCE.md).
7. **Declare level claims.** The driver manifest's `level_claims` field
   (INTEGRATION-LEVELS.md §4) states what the driver actually achieves per rail —
   including the trace rail — and is visible to the user.
8. **Honor retention and erasure.** Traces respect retention policy and the
   privacy-erasure machinery; erased traces are gone from the ledger and the
   middleware image (PRIVACY-ERASURE.md).

## 5. Lifecycle

```text
driver (observe) ──► 5C event + traceparent
        │
        ▼
Event Governance gate ──► Trace Ledger (append-only, span-keyed)
        │                              │
        │                              ├─► OtelBridge ──► external OTel providers (projection)
        │                              │
        │                              ├─► Cognitive Replay (replayEvents / resumeContext / hydrate)
        │                              │
        │                              └─► Synthesis consumers (sleep, connectome, decisions, EI)
        │
        └─► Middleware ──► Cognitive Image cache (per grant, read-optimized)
```

The ledger is the source of truth; everything else — export, replay, the image — is
a derived projection (Law 12: regenerable, never authoritative over the ledger).

## 6. Verification

- Every trace round-trips: emit → gate → ledger → replay, with lineage intact
  (`traceparent` continuation across a handoff).
- Id normalization: legacy 32-hex span ids load as W3C 16-hex on read.
- The observable/private boundary holds: no trace contains tier `none` content
  marked as reasoning; COT tiers are tagged, never upgraded.
- Redaction fixtures: known secret patterns never appear in the ledger.
- Existing suite stays green — this document changes no code.
