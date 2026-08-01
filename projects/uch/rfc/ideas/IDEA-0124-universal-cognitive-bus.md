# IDEA-0124 — Universal Cognitive Bus (UCB / Cognitive PCIe)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 cognitive-architecture intake (round 16,
  second half) — "The biggest opportunity: Cognitive PCIe. I think
  you're still thinking in terms of software integrations. Think bus
  architecture instead. Hardware doesn't integrate device-to-device.
  It plugs into a bus. Claude, Cursor, Codex, Copilot, Gemini,
  VS Code, JetBrains, Docker, Git, Filesystem → Universal Cognitive
  Bus (UCB) → Event Ledger, Identity, Memory, Scheduler, Context
  Compiler, Security, Knowledge Graph, Observability, Capability
  Registry. Now every participant speaks one protocol. No point-to-
  point integrations."
- **Related:** IDEA-0028 (cognitive motherboard — named buses per
  function; UCB is the single-bus reframing with a topology RULE),
  IDEA-0010 (signal fabric — urgency/entropy/decay/preemption
  semantics; the bus's signaling layer), IDEA-0096 (UCCL — the
  ten-method contract each participant plugs in with; the bus is
  what they plug into), IDEA-0118 (UCCD — the config space the bus
  enumerates at registration), IDEA-0121 (lifecycle — registration
  and phase hooks happen on the bus), IDEA-0064 (multi-UCH
  networking — the bus across hosts), neural-event-bus (the kernel's
  internal bus; UCB is its external face), ADR-002 (trace ledger —
  the bus's Event Ledger service), ADR-006 (microkernel — the bus is
  kernel-owned infrastructure), IDEA-0068 (negotiation — the
  registration handshake), CIC (the bus's envelope/security layer)

## Motivation

The intake's claim: every current integration is point-to-point
(one adapter per pair), and the ecosystem's protocol proliferation
(MCP, AHP, ACP, A2A...) makes the pair-graph worse. Hardware solved
this with buses: devices don't integrate device-to-device, they plug
into a shared bus with one protocol and a config space. UCB is the
same move for cognition — one bus, nine kernel services (Event
Ledger, Identity, Memory, Scheduler, Context Compiler, Security,
Knowledge Graph, Observability, Capability Registry — each mapping
to an executed kernel service), and the hard topology rule: **no
point-to-point integrations**.

## The corpus cannot cover it because

- IDEA-0028 proposes named buses per function (a motherboard with
  many bus lanes) — a per-function bus taxonomy, not the single-bus
  topology rule; UCB is the one bus every participant plugs into,
  with enumeration (0118) and lifecycle (0121) semantics.
- The neural-event-bus is kernel-internal; its external face (how a
  Claude harness, a terminal, a git hook and a browser plugin all
  transact on the same substrate) is not specified as a bus
  contract.
- IDEA-0010 gives the signaling semantics (urgency/entropy/decay/
  preemption) but no service set, no registration protocol, and no
  prohibition on point-to-point adapters — the topology rule is the
  genuinely new constraint.

## Proposal sketch

- **Bus profile** `uch.ucb.v1`: nine services (each mapped to an
  executed kernel component — ledger → ADR-002, identity →
  workspace manifest, memory → memory manager, scheduler →
  CognitiveScheduler, context compiler → CIR/compressor, security →
  CIC + permissions, knowledge graph → workspace-graphs, observability
  → SLOs/telemetry 0122, capability registry → capability-negotiation)
  — UCB is a facade contract over services that already exist.
- **Registration**: a participant plugs in by publishing its UCCD
  (0118) and negotiating a dialect (0068); the bus enumerates it
  like a PCI device and feeds the reverse index (0119).
- **Transactions**: participants exchange UCP events (ADR-005)
  carried in CIC envelopes with traceparent lineage (ADR-002) — the
  bus is the transport, the ledger is the record, the fabric (0010)
  is the QoS layer.
- **Topology rule**: new integrations are bus participants, never
  point-to-point adapters; existing point-to-point adapters
  (vscode-copilot rail, ACP driver, etc.) are bus-bound at the
  adapter's bus-facing edge, not removed.

## Risk assessment

- Bottleneck: a single bus concentrates traffic — partitioning by
  signal priority (0010) and per-service budgets; the fabric's
  backpressure (trace-persistence bufferedBytes precedent) applies.
- Security: the bus is the trust boundary — CIC envelopes, consent
  zones (0097), and least-privilege grants (ProjectionEngine)
  govern what crosses it.
- Adoption: a bus needs critical mass — start with the harness triad
  (OpenCode/Claude Code/Codex) plus git/filesystem, then grow the
  participant list.

## Where it lands

- Spec (bus profile), `src/runtime/` bus facade over existing kernel
  services, driver compliance (compliance.ts) gains a
  "bus-participant" certification mode.

## Code impact

- None until designed; seeds are neural-event-bus, ledger, CIC
  envelope, capability negotiation, driver compliance.

## Next stage

- Research register (bus topologies — CAN/PCIe/USB as models;
  G1 per service mapping); prototype: three participants on one bus
  with UCCD enumeration (0118) and ledger-backed events, asserting
  zero point-to-point traffic.
