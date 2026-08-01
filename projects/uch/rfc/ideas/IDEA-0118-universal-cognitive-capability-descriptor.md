# IDEA-0118 — Universal Cognitive Capability Descriptor (UCCD)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 cognitive-architecture intake (round 16,
  second half) — "everyone is standardizing communication (MCP/AHP/
  UCP); nobody is standardizing cognition." The move: "UCH needs
  another specification" — the Universal Cognitive Capability
  Descriptor. "Imagine every harness publishes: identity, memory,
  reasoning, planning, verification, tools, permissions, events,
  knowledge, sessions, checkpoints, telemetry, filesystem, git,
  terminal, plugins, models, extensions, policies. Not documentation.
  Runtime discovery. Think PCI enumeration for cognition." The intake
  also gives the Application Genome view: `{Application: Cursor,
Version: 2026.x, Supports: [MCP, Rules, Agent, Composer, Background,
Extensions, Native Terminal, Workspace], Limitations: [No Shared
Memory, No Cross Session Identity, No Universal Scheduler]}` — the
  "DNA of every application" includes what it cannot do.
- **Related:** IDEA-0102 (runtime fingerprint — the versioned
  behavior-surface document; UCCD answers "what schema does the
  fingerprint serve"), IDEA-0105 (CRP — the protocol that serves the
  descriptor; UCCD is the payload shape), IDEA-0099 (capability
  scanner — the active probe; UCCD is the canonical output format the
  scanner emits), IDEA-0108 (knowledge genome — extracted meaning;
  UCCD is declared surfaces), IDEA-0096 (UCCL — ten-method adapter
  contract; UCCD is the discovery payload of `connect()`), IDEA-0068
  (capability negotiation — TLS-style dialect agreement; UCCD is the
  dictionary negotiation reads), workspace-manifest + negotiation.ts
  (identity/version/capability negotiation precedent), IDEA-0098
  (UCM — certification brands the descriptor can claim), IDEA-0124
  (UCB — the bus enumerates participants by reading UCCDs), IDEA-0121
  (runtime lifecycle — Discover phase produces the descriptor)

## Motivation

The intake's core claim: the ecosystem standardizes _communication_
(MCP, AHP, UCP) but no one standardizes _self-description_ — the
artifact that makes runtime discovery possible. The corpus has the
pieces — negotiation (0068), scanning (0099), fingerprints (0102),
CRP descriptors (0105), the knowledge genome (0108) — but no
canonical, normative descriptor schema shared by every participant:
a "PCI config space for cognition", where each device publishes its
config space and the bus enumerates it. Without a canonical schema,
every adapter describes itself differently, the scanner has no
contract to emit, and the reverse index (0119) and the bus (0124)
have no rows to consume. The Application Genome view adds the
explicit _limitations_ record — the fingerprint (0102) enumerates
surfaces, the knowledge genome (0108) extracts meaning, but no
artifact declares "this runtime cannot do shared memory" as first-
class DNA.

## The corpus cannot cover it because

- IDEA-0102 produces a versioned fingerprint _document_; the schema
  of that document is unowned — each adapter invents its own shape.
  UCCD is the normative 19-field schema (typed, versioned,
  validation-bearing) that fingerprints serve.
- IDEA-0105 CRP is a _protocol_ (runtime self-description, ten-block
  descriptor) — not a normative document schema with conformance and
  degradation rules. UCCD is the contract CRP serves: one descriptor
  format, many serving protocols.
- IDEA-0099 scans _what exists_; nothing defines the canonical output
  format the scanner must emit, so scan results are not portable.
- The Application Genome (declared supports + explicit limitations)
  exists nowhere: no current artifact records limitations as
  first-class DNA, yet limitations are what make runtime selection
  (0119) and composition (0120) honest.

## Proposal sketch

- **Spec** `uch.uccd.v1`: 19 named sections (identity, memory,
  reasoning, planning, verification, tools, permissions, events,
  knowledge, sessions, checkpoints, telemetry, filesystem, git,
  terminal, plugins, models, extensions, policies) + a normative
  `capabilities` / `limitations` pair (the Application Genome view).
  Every participant publishes one descriptor; a participant may omit
  sections it cannot describe — omission means "unknown", never
  "absent capability" (mirrors ProjectionEngine's authority
  intersection: a capability with no granted operation is absent,
  but an undescribed surface is not proof of absence).
- **Enumeration semantics**: the bus (0124) reads each participant's
  config space (UCCD) at registration, the scanner (0099) verifies
  claims actively, fingerprints (0102) pin versions, CRP (0105)
  serves descriptors on demand, certification (0098) brands them.
- **Validation**: schema conformance per section; versioned sections
  with forward-compatible unknown-section tolerance; honesty rule
  from 0105 (a runtime serves at its _verified_ level only).

## Risk assessment

- Descriptor honesty: a participant claiming capabilities it cannot
  honor — mitigated by the verified-level-only rule (0105), scanner
  verification (0099), certification brands (0098), and trust
  scoring (0080).
- Schema churn: sections must version independently and unknown
  sections must not break consumers (forward compatibility is a
  conformance requirement, not a courtesy).
- Scope creep: 19 sections is the declared ceiling; adding sections
  requires the spec-governance gate (RFC-0000), not ad-hoc growth.

## Where it lands

- `spec/` (UCCD normative), `src/cognitive-runtime/` (descriptor
  schema + validation alongside runtime-discovery), integration with
  capability-negotiation (0068) and the scanner (0099).

## Code impact

- None until designed; seeds are runtime-discovery.ts,
  capability-negotiation.ts, workspace-manifest negotiation,
  IDEA-0102 fingerprint shape, IDEA-0105 CRP descriptor.

## Next stage

- Research register (PCI/USB config-space enumeration as the model;
  G1 per section field); prototype: define UCCD v1 and emit
  descriptors for the harness triad (OpenCode, Claude Code, Codex)
  from their real surfaces, asserting each field's provenance.
