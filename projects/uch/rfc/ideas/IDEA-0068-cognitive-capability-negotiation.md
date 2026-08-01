# IDEA-0068 — Cognitive Capability Negotiation & Discovery

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "I support Memory v3, Signal ABI v2, Genome v1.8, Reflection,
  Verification, Dreaming, Simulation. UCH negotiates the optimal
  protocol. Exactly like TLS or USB." and "Who can verify this? Who
  understands Kubernetes? Who can optimize Rust? Who can simulate this?"
- **Related:** src/workspace-manifest/negotiation.ts (workspace-level
  `negotiate` + `negotiateVersion` + attach-as-discovery),
  src/cognitive-runtime/capability-registry (per-agent grants),
  src/drivers/compliance.ts (L0–L4 driver certification),
  src/interface/conformance.ts (server-side certification), CIC v0.1
  instruction surface, IDEA-0054 (driver ecosystem + certification),
  IDEA-0019 (operating contracts), MANIFESTO §6 (organ contracts)

## Motivation

Two agents should meet and agree on the protocol dialect they share —
exactly as TLS negotiates cipher suites and USB negotiates descriptors.
Today UCH negotiates at exactly one level: the workspace manifest
(`negotiate` + `negotiateVersion` picks compatible runtime versions and
drivers at attach). Below that, every organ, memory type, genome,
signal class, and skill is assumed compatible or breaks loudly at
runtime. Above that, nothing lets the organism *ask* "who can verify
this?" — capability discovery is a static registry lookup, not a
question the organism can pose dynamically.

## The corpus cannot cover it because

`negotiation.ts` is scoped to manifest attach (runtime version +
drivers) and carries no protocol level for cognitive capabilities
(memory schema versions, signal ABI versions, genome versions, skill
interfaces). The capability registry grants what an agent *may* do but
records no versioned capability set an agent *supports*; compliance
certification stamps a driver's declared level but nothing negotiates
between two compliant-but-different levels. Dynamic discovery ("who can
verify", "who understands Kubernetes") exists only as hardcoded routing
(routeToExpert, EI layer lookups) — not as a queryable protocol.

## Proposal sketch

- A capability descriptor format (name + semantic version + feature
  set + required dependencies) attached to every organ, memory type,
  genome, signal class, skill, and accelerator.
- A negotiation protocol over the CIC envelope: offer → compare →
  intersect → select dialect (both endpoints keep their old dialect
  until the new one is verified — TLS-style fallback).
- A discovery query surface (IDEA-0057-compatible): FIND organ WHERE
  verifies=true AND domain=kubernetes — answered from the capability
  registry plus live compliance certificates.
- Negotiated dialects become a versioned record in the trace ledger
  (ADR-002) so every dialect decision is replayable.

## Risk assessment

- Infinite negotiation loops (A supports v2, B supports v3, neither
  shares a dialect). The intersection must be deterministic and
  fallback to "no capability" rather than hang; capability sets must be
  monotone (adding a capability never removes one).

## Where it lands

- Design doc `design/CAPABILITY-NEGOTIATION.md`; extends
  workspace-manifest/negotiation.ts + capability-registry +
  compliance.ts.

## Code impact

- None until the descriptor format and negotiation state machine are
  specified; the existing `negotiate` becomes the workspace-level case
  of the general protocol.

## Next stage

- Descriptor format drafted against one real pair (memory v3 ↔ v2
  fallback); audit of negotiate.ts for extraction into the general
  protocol.
