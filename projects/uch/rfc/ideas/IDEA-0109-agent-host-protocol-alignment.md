# IDEA-0109 — Agent Host Protocol: First External Validation of the UCP Session Model

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 cognitive-host intake (round 16) — the
  "Universal Cognitive Host" architecture vision. New ecosystem
  evidence: VS Code's Agent Host ships as a dedicated background
  process owning session state, exposing an open, model-agnostic
  JSON-RPC **Agent Host Protocol (AHP)** with URI-addressed channels
  and state snapshots/deltas; first-party adapters (Copilot, Claude,
  Codex) run inside the host and translate native turns into the AHP
  session format, so VS Code shows all agent sessions in one unified
  view. The intake's claim: "each ecosystem remains siloed — there is
  no unified memory or identity layer across them", and the protocol
  that would unify them is a superset of existing agent schemas (the
  corpus's UCP claim), now empirically testable against AHP.
- **Related:** ADR-005 (UCP + Episode model), EXOSYMBIOSIS §4/§7
  (the "Agent Host / app-server / headless server" observation +
  AHP client rail at P2), design/integrations/vscode-copilot.md
  (Rail C — AHP client, P2), design/INTEGRATION-LEVELS.md (VS Code
  row: "L4 — Agent Host Protocol, evolving"), src/cognitive-plane/
  protocol/ (protocol-adapter + capability-negotiation),
  design/LIVE-COGNITIVE-STATE.md (state document AHP's deltas
  resemble), IDEA-0096 (UCCL — AHP is a Tier-4 editor-protocol
  surface), IDEA-0054 (driver ecosystem interop), IDEA-0105 (CRP —
  runtime self-description; AHP is the first external session-
  hosting protocol to compare against), CIC-SPECIFICATION.md

## Motivation

The corpus already observed the decoupling (EXOSYMBIOSIS §4.1:
"every platform now separates the agent runtime") and planned an AHP
client (vscode-copilot Rail C, P2). What the round-16 evidence adds
is that AHP is **shipping as a multi-agent session substrate**:
one host process, multiple first-party engine adapters (Copilot,
Claude, Codex), one session model with snapshot/delta sync to many
clients. That is the UCP session-model claim _built by someone
else_ — the strongest external validation the corpus's Layer-3
design has received, and a concrete alignment target: "UCP is a
superset of existing agent schemas" (EXOSYMBIOSIS Layer 3) can now
be checked field by field against AHP's session/delta model. The
intake's value is not the observation (already captured) but the
two moves it motivates: (1) treat AHP as a first-class protocol to
speak, not just a rail to tail — a UCH AHP _host-side_ or
_client-side_ integration reaches Copilot+Claude+Codex sessions
behind one protocol; (2) align the Episode/event schema with AHP's
session semantics (state snapshots, deltas, URI channels) so
UCP-adjacent protocols converge instead of proliferating.

## The corpus cannot cover it because

- AHP is planned as a **client rail** (tail sessions from the Agent
  Host); nothing positions AHP as the _first external implementation
  of the UCP session model_ — a validation data point and a schema
  alignment target for the Episode model (ADR-005 §3) and the event
  catalog.
- No schema-comparison exists between the corpus's Episode/session
  semantics and AHP's (session state ownership, URI-addressed
  channels, snapshot+delta sync, multi-client resync) — the
  "superset" claim is asserted (EXOSYMBIOSIS Layer 3) but untested
  against a real shipping protocol.
- The unified-session-view pattern (one UI, many engine adapters
  behind one protocol) is the UCH attach/hive pattern appearing in a
  vendor product; the corpus has no note on _co-opting or
  interoperating with_ such hosting substrates rather than only
  connecting to their endpoints.

## Proposal sketch

- **AHP alignment study (research)**: map the AHP session model
  (JSON-RPC surface, channels, snapshots/deltas, lifecycle) onto the
  UCP Episode model and event catalog; produce the first empirical
  test of "UCP ⊇ existing agent schemas"; record gaps (fields AHP
  has that UCP lacks and vice versa) as schema-change proposals.
- **AHP driver (prototype)**: upgrade the planned client rail into a
  first-class driver — connect to the Agent Host, consume session
  snapshots/deltas as UCP events (L3 per INTEGRATION-LEVELS), and
  optionally publish UCH state back (suggestions/constraints via the
  host's channels — the effector path). One protocol reaches
  Copilot + Claude + Codex sessions in VS Code.
- **Host-side option**: UCH as an AHP-compatible host (serving its
  own sessions to VS Code's unified view) — validated only if the
  alignment study shows the models interoperate cleanly; otherwise
  the client-side path suffices.
- **Positioning**: AHP joins MCP (tools) and CRP (IDEA-0105,
  runtime description) as external protocols UCH _aligns with_
  rather than competes against — the compatibility-layer posture of
  IDEA-0096.

## Risk assessment

- Vendor coupling: AHP is Microsoft-hosted; alignment must be
  protocol-level (open spec) and degradation-safe (the rail remains
  optional; passive tails still cover VS Code at L1-L2).
- Over-alignment: the Episode model must not be bent to AHP's shape —
  the study's output is gap _proposals_ through the event-governance
  gate, not ad-hoc schema changes.
- Assumption risk: AHP's openness ("being enabled gradually",
  EXOSYMBIOSIS) may change — the driver must pin protocol versions
  and fingerprint (IDEA-0102) per release.

## Where it lands

- `research/` (AHP↔UCP alignment study), `src/drivers/ahp/`
  (client driver), spec annex if the study proposes schema changes.

## Code impact

- None until the study exists; seeds are vscode-copilot Rail C
  planning, protocol-adapter, ADR-005 Episode model, EXOSYMBIOSIS
  P2 rail list.

## Next stage

- Research register (G1 per claim: AHP protocol surface as
  documented 2026, MCP-apps interplay, multi-client sync semantics);
  then the alignment study as the prototype's prerequisite.
