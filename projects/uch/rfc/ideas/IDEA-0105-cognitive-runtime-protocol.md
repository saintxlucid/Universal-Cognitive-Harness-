# IDEA-0105 — Cognitive Runtime Protocol (CRP)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 abstraction-layer intake (round 15) — the
  round's headline: "UCH shouldn't stop at MCP. MCP asks 'what tools
  do you have?'; CRP asks 'what cognitive capabilities do you
  expose?' — `{identity, capabilities, context, session, workspace,
events, checkpoints, knowledge, observability, permissions}`. This
  describes an intelligence, not a tool." The protocol half of the
  intake's closing recommendation: CIR (universal language for
  context/intent/goals/architecture/policies/project knowledge) +
  CRP (universal runtime protocol for sessions, capabilities,
  lifecycle events, checkpoints, permissions, observability).
- **Related:** IDEA-0097 (CIP — voluntary inbound cognitive-state
  exchange; CRP is the runtime protocol whose discovery surface
  includes CIP documents), IDEA-0096 (UCCL — the adapter contract
  layer CRP rides on), CIC-SPECIFICATION.md (transport envelope —
  what CRP is carried in), design/LIVE-COGNITIVE-STATE.md
  (uch.cognitive-state.v1 — the session/knowledge blocks' shape),
  MCP (tool access — the complement), ACP/A2A (agent protocols),
  src/cognitive-plane/protocol/protocol-adapter.ts, ADR-005 (UCP),
  INTEGRATION-LEVELS (L3 — what a runtime may honestly expose)

## Motivation

The ecosystem standardized tool access (MCP) and is standardizing
agent-to-agent exchange (ACP/A2A); what nothing standardizes is the
**runtime-level description of an intelligence** — the capabilities,
context model, session model, lifecycle events, checkpoints,
knowledge surface, observability, and permissions an agentic runtime
exposes. The intake's claim: an intelligence is not a tool with a
tool list; it is a runtime with a cognitive surface. CRP is the
protocol that makes that surface queryable and bindable: a client
asks "what cognitive capabilities do you expose?" and receives a
structured answer describing the runtime as a first-class cognitive
citizen — what it can do, what state it keeps, what it publishes,
what it can checkpoint, what it exposes observably, what it permits.
MCP makes UCH tool-compatible; CRP makes UCH intelligence-compatible.

## The corpus cannot cover it because

- The ten-block descriptor has no home: Live Cognitive State is
  UCH's _own_ document (outbound); CIP (0097) is the _voluntary
  state-exchange_ contract (inbound); neither is a runtime _protocol
  surface_ describing another runtime's capabilities/checkpoints/
  observability/permissions as a discoverable answer.
- Session/capability/lifecycle/checkpoint/observability semantics are
  each implemented inside UCH (trace ledger, WS-D checkpoints, health
  registry, capability registry, SLOs) — but only as UCH-internal
  machinery, never as a published contract other runtimes implement
  to describe _themselves_.
- The intake's descriptor blocks map onto existing schemas field by
  field (session → uch.cognitive-state.v1; capabilities → capability
  descriptors; checkpoints → WS-D snapshot semantics; observability →
  WS-E/IDEA-0071; permissions → grants) — an alignment that has not
  been named or specified as a protocol.

## Proposal sketch

- **CRP v1 = a query surface + a descriptor schema.** A runtime
  hosts a CRP endpoint (MCP tool pair or CIC envelope) answering
  `describe-runtime()` with the ten-block document:
  `identity / capabilities / context / session / workspace / events /
checkpoints / knowledge / observability / permissions`. Each block
  is defined by existing schema families (Live Cognitive State,
  capability descriptors, grants + projections, WS-E metrics) with
  the permission block bounded by CIP zone declarations (0097) —
  Red is a refusal, never an absence.
- **Positioning**: MCP standardizes _tool access_; CIP standardizes
  _voluntary state exchange_; CRP standardizes _runtime self-
  description_ — "what cognitive capabilities do you expose?" CRP
  is what the boot sequence (0103) calls at stage 4, what the UCM
  (0098) scores at the Cognitive row, and what the fingerprint
  (0102) verifies live.
- **Honesty rule**: a CRP descriptor may only claim what conformance
  evidence supports (INTEGRATION-LEVELS rule 2 — served at the
  verified level, never the claimed one); describing an intelligence
  obligates the same discipline as describing a driver.
- **Consumption**: UCH ingests CRP descriptors into the ecosystem
  twin (0107) and uses them to bind sessions (session sync),
  checkpoint continuity, and observability rails across hosts.

## Risk assessment

- Descriptor inflation: ten blocks must stay a floor with fixed
  schema references — runtime-specific richness lives in extension
  blocks, never in the core (same rule as IDEA-0095).
- Anthropomorphism scope: "describes an intelligence" must not imply
  claims about model internals — CRP describes the _runtime surface_;
  hidden chain-of-thought stays Red (0097), and the descriptor is
  observability, not introspection of private cognition.
- Adoption: like CIP, CRP is only valuable if implemented — it must
  be a thin protocol over existing schemas, so a runtime can
  implement it from the Live Cognitive State document it already
  produces.

## Where it lands

- `spec/` (CRP draft, RFC-0007 candidate) with the ten-block schema
  referencing existing families; endpoint in the protocol adapter;
  boot stage 4 integration; UCM Cognitive-row scoring.

## Code impact

- None until the protocol is specified; seeds are protocol-adapter,
  uch.cognitive-state.v1, grants + projections, health registry,
  WS-D snapshot semantics.

## Next stage

- Research register (G1 per claim: MCP's adoption mechanics, agent
  protocol landscape, self-description precedents); prototype: one
  runtime (the UCH MCP server itself) answering `describe-runtime()`
  with a valid ten-block CRP document.
