# ADR-002: OpenTelemetry-Based Cognitive Trace Engine

- **Status:** Accepted for implementation
- **Date:** 2026-07-31
- **Scope:** Cognitive recording, trace propagation, observability export, replay substrate

## Context

Every harness today (Claude Code, Codex, Cursor, OpenCode, Copilot) stores its own
sessions, chats, history, plans, and tool logs in a private silo. When an agent
leaves, its cognition leaves with it. ADR-001 established that the workspace owns
the intelligence: the runtime's event ledger is the durable, immutable record of
everything that happened in the workspace.

The ledger exists (`src/cognitive-plane/trace-engine/`), but its trace model is a
homemade approximation of tracing: `trace_id`, `span_id`, `parent_span_id`, `kind`,
`status`, `attributes`, `events`, and `links` are already OTel-shaped, yet there is
no interoperability with the OpenTelemetry ecosystem — no W3C `traceparent`
propagation, no exporter for Langfuse/Jaeger/Grafana/OTLP, and no correlation with
tool-level traces emitted by MCP clients and servers.

OpenTelemetry already solves the hard problems of distributed tracing: trace IDs,
parent/child spans, timestamps, correlation, and distributed context propagation.
Langfuse demonstrates that MCP clients and servers can propagate a single trace
across tool calls via trace metadata. We should build on that model rather than
re-inventing it. Every cognitive action is already a trace; we simply extend the
schema with cognitive semantics.

A second gap: the ledger records, but nothing resumes. Cognitive Replay
(`src/cognitive-plane/replay/`) can reconstruct trees, but cannot hand an incoming
agent a continuation context (trace lineage, touched files, pending plan steps,
explicit decisions) or re-feed recorded cognition to memory engines.

## Decision

### 1. The trace engine adopts the OpenTelemetry Trace Data Model as its canonical schema

`CognitiveTrace` is already structurally compatible with OTel SpanData. We formalize
the mapping and adopt OTel ID conventions:

| CognitiveTrace | OTel / W3C | Notes |
|---|---|---|
| `trace_id` | 128-bit trace id (32 hex chars) | W3C `traceparent` field 1 |
| `span_id` | 64-bit span id (16 hex chars) | W3C `traceparent` field 2 — **must change** from current 32-hex UUID |
| `parent_span_id` | parent span id (16 hex chars) | W3C `traceparent` field 2 of parent |
| `kind` | `SpanKind` | internal / server / client / producer / consumer |
| `status` | `Status` | unset / ok / error → OTel `UNSET`, `OK`, `ERROR` |
| `timestamp` / `end_timestamp` | `startTimeUnixNano` / `endTimeUnixNano` | |
| `attributes` | `attributes` | Key-value pairs, typed values |
| `events` | `events` | Name + timestamp + attributes |
| `links` | `links` | Cross-trace correlation |

### 2. A `CognitiveRecorder` bridge emits every ledger trace through `@opentelemetry/api`

- `@opentelemetry/api` (the spec API only, ~10 KB, no SDK) is the only new
  dependency. It is a no-op when no tracer provider is registered — zero cost in
  workspaces that do not opt in.
- When a provider is registered (Langfuse, Jaeger, OTLP, Honeycomb…), every
  cognitive trace and trace event is exported as a real OTel span with correct
  parent/child linkage and `uccp.*` attributes.
- The ledger remains the source of truth. OTel export is a projection, never the
  primary store — local-first storage law preserved.

### 3. W3C `traceparent` propagation across all transports

- Every driver event carries an optional `metadata.traceparent`.
- `TraceRecorder` parses incoming `traceparent` (version, trace id, span id, flags)
  and creates the child span under the remote parent — this is what lets an MCP
  client's trace continue into the workspace ledger and back out again.
- The recorder also emits `metadata.traceparent` on replayed/hydrated events so
  downstream consumers (memory, learning, exporters) can correlate.
- MCP and ACP messages carry `traceparent` when the transport supports metadata;
  the CIC contract (see [CIC-SPECIFICATION.md](CIC-SPECIFICATION.md)) exposes it.

### 4. Cognitive semantics extend the OTel schema

The base OTel model covers structure; cognitive semantics are carried in
conventions, not new wire formats:

- Span names use a dotted namespace: `llm.prompt`, `tool.call`, `file.save`,
  `git.commit`, `test.run`, `build.run`, `session.start`, `agent.attach`.
- Reserved attribute keys: `uccp.event.type`, `uccp.event.source`,
  `uccp.agent.id`, `uccp.session.id`, `uccp.workspace.id`, `uccp.trace.kind`
  (`observable` for third-party harness events, `explicit` for first-party
  planning artifacts).
- Trace event types (prompt, tool, file, terminal, git, build, test, mcp,
  agent, session, decision, plan_step, reflection, human_feedback) map to OTel
  span events with `uccp.event.type` as the event name qualifier.

### 5. Observable execution vs. private model reasoning (unchanged law, now explicit)

Commitment #6 of the [MANIFESTO](../MANIFESTO.md) remains binding: private
chain-of-thought and raw model inner dialogue are **never** recorded. For
third-party harnesses (Claude Code, Copilot, Cursor, Codex) we capture only what is
observable and reproducible:

- user prompts, agent responses, tool invocations, MCP interactions, file diffs,
  terminal commands, git operations, diagnostics, test runs, build outputs,
  execution traces, decisions explicitly surfaced by the agent, outcomes,
  evaluations, human feedback.

For agents we control, structured planning artifacts and reasoning summaries may be
recorded **explicitly** as `uccp.trace.kind=explicit` spans. The recorder never
infers hidden reasoning.

### 6. Cognitive Replay becomes a first-class resume mechanism

`CognitiveReplay` gains three capabilities on top of tree reconstruction:

- `replayEvents(traceId)` — chronological, flattened stream of every trace event
  in a tree, with span context.
- `resumeContext(traceId)` — a machine-readable continuation packet: trace lineage,
  files touched, explicit decisions, pending plan steps, error summary, and a
  continuation header (`trace_id` + new parent `span_id`) that lets an incoming
  agent continue the same cognitive trace instead of starting a new one.
- `hydrate(eventBus)` — re-publishes replayed traces as `NeuralEvent`s (source
  `replay`, metadata carrying the original trace lineage) so memory, learning, and
  reflection engines can re-consume past cognition without re-running it.

## Consequences

### Positive

- Interoperability: any OTel-compatible backend (Langfuse, Jaeger, OTLP, Grafana)
  can ingest workspace cognition without a bespoke exporter.
- Cross-tool correlation: MCP/ACP/IDE drivers propagating `traceparent` make one
  continuous trace across Claude Code → tool call → git → build → test.
- Replay becomes "the flight recorder": an incoming agent receives the actual
  trace, not a summary — it watches what happened, then continues it.
- The brain reads traces, not chats: memory/learning engines consume hydrated
  replay events with full context (inputs, outputs, files, timing, failures,
  dependencies, agent, IDE, workspace).
- The schema is already backward compatible; existing persisted ledger files load
  unchanged (span id length normalization is applied on read).

### Constraints

- `@opentelemetry/api` is the only new runtime dependency; SDK exporters remain
  optional, user-registered, and never required for recording.
- Span ids change from 32-hex to 16-hex (W3C). The ledger normalizes legacy ids
  on load; new ids are always W3C-conformant.
- No hidden reasoning capture. The observable/private boundary is enforced in the
  recorder, not delegated to exporters.
- Replay hydration re-publishes events through the normal event bus path so
  governance and policy checks apply uniformly (no privileged backdoor).

## Alternatives considered

| Alternative | Decision |
| --- | --- |
| Keep the bespoke trace model and add a custom exporter per backend | Rejected: N exporters, no ecosystem, no propagation standard |
| Vendor in the full OTel SDK | Rejected: heavyweight, and the ledger is the source of truth; the API-only bridge covers export |
| Replace the ledger with OTLP storage | Rejected: local-first law; the ledger stays the durable store, OTLP is a projection |
| Store conversation logs and model thoughts as traces | Rejected: violates the observable/private boundary (MANIFESTO commitment #6) |

## Implementation status (2026-07-31)

| Item | Status |
| --- | --- |
| `@opentelemetry/api` dependency | ✅ Installed |
| OTel bridge (span export + traceparent parse/serialize) | ✅ `src/cognitive-plane/trace-engine/otel-bridge.ts` |
| Recorder support: remote parent via `metadata.traceparent`, optional emitter | ✅ `src/cognitive-plane/trace-engine/trace-recorder.ts` |
| Replay: `replayEvents`, `resumeContext`, `hydrate` | ✅ `src/cognitive-plane/replay/cognitive-replay.ts` |
| MCP/ACP driver propagation of `traceparent` | Follow-on: CIC + driver metadata wiring |
| Docs: CONFORMANCE, CIC-SPECIFICATION updates | Follow-on |
