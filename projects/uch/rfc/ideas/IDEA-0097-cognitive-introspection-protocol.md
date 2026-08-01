# IDEA-0097 — Cognitive Introspection Protocol (CIP)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 compatibility-layer intake (round 14) — the
  headline claim: "MCP standardizes _tool access_; CIP could standardize
  _cognitive state exchange_. If an application wants deep integration,
  it can voluntarily expose structured state" — `{session,
active_goal, available_capabilities, tool_history, context_summary,
events}` — giving UCH rich semantic visibility without relying on
  undocumented internals. The intake's discipline line: the leap is
  **deep semantic integration, not unrestricted access** — three consent
  zones: Green (appropriate with permission: user-authored chat,
  workspace state, project files, user-intended logs, configuration,
  extensions, tool execution history, build output, git history), Yellow
  (depends on the application's APIs and permissions: internal indexes,
  session metadata, token usage, model selection, performance metrics,
  local caches), Red (never assume: hidden chain-of-thought, private
  provider-side inference traces, protected secrets, other users'
  memory, internal data structures).
- **Related:** design/LIVE-COGNITIVE-STATE.md (`uch.cognitive-state.v1`
  — the UCH-produced document), design/UNIVERSAL-INTEGRATION.md (hive
  capture surfaces), design/INTEGRATION-LEVELS.md (L3 rule: cognitive
  traces are _generated from observable artifacts, never hidden COT_),
  design/PRIVACY-ERASURE.md, design/THREAT-MODEL.md, design/
  EXOSYMBIOSIS.md §9 (privacy posture), CIC-SPECIFICATION.md (transport
  envelope), EVENT-GOVERNANCE.md (event schema governance), MCP
  (tool-access standard the protocol complements)

## Motivation

UCH has two cognitive-state flows today. **Outbound**: Live Cognitive
State (`uch.cognitive-state.v1`) — UCH produces a document that any
agent reads to join the organism instantly; hosts are consumers.
**Inbound capture**: hive adapters — bespoke per-runtime tails and
hooks that _pull_ transcripts, rollouts, and events from each
application's on-disk or extension surfaces. The intake's claim: there
is no _standardized, voluntary, inbound_ contract — a named protocol an
external application implements (like an MCP server, but for state) to
publish `{session, active_goal, capabilities, tool_history,
context_summary, events}` into UCH. CIP is the inbound twin of the Live
Cognitive State document: same schema family, opposite direction,
voluntary by design. Its consent taxonomy (Green/Yellow/Red) formalizes
the line the corpus already draws at L3 — UCH never derives cognition
from hidden chain-of-thought — as a _negotiable contract_: an
application that wants deep integration opts in via CIP and declares
which zones it exposes; UCH never scrapes what is not volunteered.

## The corpus cannot cover it because

- Live Cognitive State is **UCH-produced, host-consumed**; nothing
  specifies the reverse direction as a protocol third-party apps
  implement. Hive capture works per-runtime by contract of the adapter,
  not by a shared publish contract the _application_ offers.
- The Green/Yellow/Red taxonomy exists implicitly (PRIVACY-ERASURE,
  THREAT-MODEL, EXOSYMBIOSIS §9, L3 rule 3) but is not a **negotiable
  zone declaration** an application attaches to its published state —
  "I expose Green + these Yellow items; Red is refused" — which is what
  makes deep integration safe for enterprises.
- The intake's example payload maps field-for-field onto
  `uch.cognitive-state.v1` (session → native_session_id/episode_id,
  active_goal → goal, context_summary → intent/working_set, events →
  obstacles/hypotheses/risks/verification) — an alignment that has not
  been named or specified.

## Proposal sketch

- **CIP v1 = a publish contract + a zone declaration.** An application
  that wants deep integration hosts a CIP endpoint (MCP tool pair or
  HTTP like the hive daemon's ingest) serving a document aligned with
  `uch.cognitive-state.v1` plus a `zones` block declaring Green/Yellow/
  Red exposure. The UCH side _discovers_ the endpoint (IDEA-0099
  scanner), _negotiates_ zones on connect (workspace-manifest
  negotiation), and _ingests_ state into the hive ledger with full
  provenance (EVENT-GOVERNANCE gate).
- **Schema alignment**: CIP document = `uch.cognitive-state.v1` +
  `exposed_zones` + `tool_history` (the one new field; bounded, per
  permission). No field may contain hidden chain-of-thought — Red is a
  refusal, not an absence; the L3 rule extends to inbound state.
- **Consent as contract**: zone declarations are per-session,
  versioned, and revocable; erasure follows PRIVACY-ERASURE semantics;
  a CIP document is never the source of authority for tool execution
  (that remains grants + projections).
- **Positioning**: MCP standardizes what tools can be called; CIP
  standardizes what cognitive state trusted systems intentionally
  share; UCCL (IDEA-0096) is the runtime + governance + reference
  implementation tying them together.

## Risk assessment

- Adoption: CIP only matters if applications implement it — the value
  proposition is the same one that made MCP spread: one contract, one
  conformance test, no reverse engineering. The passive-tail fallback
  (UNIVERSAL-INTEGRATION) must remain, with CIP strictly additive.
- Leakage: zone declarations must be auditable (who published what,
  when) and default-to-minimal (an app publishes nothing unless it
  declares a zone).
- Scope: CIP specifies state exchange only — never execution authority,
  never telemetry beyond the declared zones.

## Where it lands

- `spec/` (CIP draft, RFC-0006 candidate), aligned with
  `uch.cognitive-state.v1`; hive daemon ingest endpoint (POST
  `/cip/documents`), zone negotiation in attach/negotiation.

## Code impact

- None until the protocol is specified; seeds are the hive ingest
  endpoint, uch.cognitive-state.v1 schema, EVENT-GOVERNANCE gate.

## Next stage

- Research register (G1 per claim: MCP's adoption mechanics, voluntary
  state-exchange precedents, consent/zone models); prototype: a mock
  application (OpenCode plugin or a test fixture) publishing a CIP
  document into the hive ledger with zone negotiation and erasure.
