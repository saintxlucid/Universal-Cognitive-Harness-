# IDEA-0096 — Universal Cognitive Compatibility Layer (UCCL)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 compatibility-layer intake (round 14) — "the AI
  ecosystem is fragmenting, but the integration patterns are converging.
  The opportunity is not to write adapters one by one; it is to define a
  Universal Cognitive Compatibility Layer (UCCL) that every adapter
  implements. Instead of 'Supports Cursor', say 'UCH Certified
  Compatibility'." Ten compatibility tiers (AI providers, coding
  applications, IDEs, editor protocols, version control, CI/CD, clouds,
  container platforms, memory providers, agent standards) plus a
  Universal Cognitive Adapter contract: `discover / connect /
authenticate / capabilities / observe / execute / synchronize /
heartbeat / checkpoint / disconnect`.
- **Related:** design/ECOSYSTEM-COMPATIBILITY.md ("one contract, many
  adapters" — the compatibility posture), design/UNIVERSAL-INTEGRATION.md
  (hive architecture + per-runtime capture matrix),
  design/integrations/COMPATIBILITY-MATRIX.md v1.0 (evidence layer: 23
  harnesses / 9 IDEs / 24 providers / 14 SDKs / 6 protocols),
  design/INTEGRATION-LEVELS.md (L0–L4 ladder + transport tiers T0–T4),
  ADR-005 (UCP), src/drivers/ (ide/mcp/acp/agent/git/filesystem/runtime
  drivers + compose + registry), src/cognitive-plane/protocol/
  protocol-adapter.ts (register/unregister/health adapter factory),
  src/workspace-manifest/negotiation.ts (attach-time negotiation),
  IDEA-0049 (cognitive storage engine — Tier 9 backends),
  IDEA-0052 (skill compiler — Tier 10), IDEA-0095 (cognitive ABI)

## Motivation

UCH already integrates at the transport level: per-runtime adapters
(Claude hooks, Codex hooks, OpenCode plugin, VS Code extension) speak
CIC/MCP/ACP into the hive, and drivers are certified L0–L4. What does
not exist is a single **normative adapter contract** that any
third-party integration — a new IDE, a new coding agent, a CI service,
a memory vendor — implements to become "UCH Certified" without bespoke
engineering. The intake's claim: the ecosystem converges on a handful
of integration patterns (MCP, SDKs, CLIs, skills/context files, agent
configs, tool APIs, extension APIs, workspace context); the layer that
turns that convergence into an interface is the UCCL. Providers become
interchangeable execution backends (Tier 1, already true of the fabric);
Cursor and Windsurf become IDE implementations of one editor-protocol
surface (Tier 3/4) rather than special cases; memory backends become
pluggable storage engines (Tier 9, IDEA-0049); and repository context
artifacts are generated from one source (Tier 10: AGENTS.md / Claude
Skills / Cursor Rules / Copilot / Gemini / OpenCode from a single UCH
Context Specification).

## The corpus cannot cover it because

- **The adapter contract is per-family, not one.** Drivers have a
  sensor/effector contract (src/drivers/compose.ts), protocol adapters
  have register/unregister/health (protocol-adapter.ts), and ACP/MCP/
  IDE drivers each define their own shape. Nothing binds
  `discover / connect / authenticate / capabilities / observe /
execute / synchronize / heartbeat / checkpoint / disconnect` into one
  versioned contract a third-party adapter implements and is certified
  against — the driver-side twin of what IDEA-0095 does for organs.
- **Context generation is one-directional.** UCH consumes AGENTS.md and
  produces its own; it does not _generate_ repository context artifacts
  for external agents from a single source. IDEA-0052 compiles skills
  (prose → skill IR); repository-context generation (one UCH Context
  Specification → AGENTS.md + Claude Skills + Cursor Rules + Copilot +
  Gemini + OpenCode) is a different, unowned surface.
- **The ten tiers are surveyed, not specified.** COMPATIBILITY-MATRIX.md
  is the evidence layer; ECOSYSTEM-COMPATIBILITY.md is the strategy;
  neither is a normative classification (which tier, which surface, what
  a compliant implementation must do).

## Proposal sketch

- **UCCL v1 = one adapter contract + one capability classification.**
  The ten-method interface becomes the normative adapter surface (each
  method maps onto existing machinery: `discover` → surface scanning
  (IDEA-0099), `connect/authenticate` → CIC handshake + negotiation,
  `capabilities` → capability descriptors (registry ∩ projections),
  `observe` → sensor rails, `execute` → CP ops, `synchronize` → sync
  planes (genome/memory/skills/workspace/policy/cognition),
  `heartbeat` → health registry, `checkpoint` → WS-D snapshots,
  `disconnect` → graceful degradation per INTEGRATION-LEVELS rule 4).
  A conformance suite (mirroring src/protocol/conformance.ts) certifies
  adapters; certification brands live in IDEA-0098.
- **The tier map as normative classification**: providers (T1) are
  interchangeable execution backends behind the fabric; applications
  (T2A/T2B) and IDEs (T3) implement the editor-protocol surface (T4:
  workspace, selection, files, git, LSP, debug, tasks, terminal,
  diagnostics, MCP, execution, telemetry); VCS/CI/CD/cloud/container
  targets (T5–T8) are transport endpoints of the same event rails;
  memory (T9) is IDEA-0049 storage engines; agent standards (T10) are
  the context-generation surface below.
- **UCH Context Specification**: one canonical repository-context
  document (goals, architecture, conventions, risks, ownership) compiled
  into each external agent's artifact format — AGENTS.md, CLAUDE.md,
  Cursor Rules, Copilot instructions, Gemini instructions, OpenCode
  config — with a round-trip conformance check (external agent's
  artifact parses back to the same facts).

## Risk assessment

- Interface bloat: ten methods must stay the floor — family-specific
  surfaces live behind capability descriptors, never in the contract
  (same rule as IDEA-0095).
- Conformance cost: certification must be deterministic (no LLM in the
  loop), or third-party adapters will not bother.
- Scope creep: the tier map is classification, not a build list — UCCL
  specifies the contract; each tier's adapters are separate waves.

## Where it lands

- `spec/` (new UCCL section + UCM in IDEA-0098), adapter conformance
  suite, driver SDK documentation, context generator (compiler over the
  workspace manifest + genome).

## Code impact

- None until the contract is specified; seeds are compose.ts, protocol-
  adapter.ts, negotiation.ts, conformance.ts, compliance.ts.

## Next stage

- Research: map every existing driver/protocol-adapter onto the ten
  methods (gap table per family); prototype: one third-party-shaped
  adapter (e.g. a Cursor MCP-first adapter) certified against the UCCL
  contract.
