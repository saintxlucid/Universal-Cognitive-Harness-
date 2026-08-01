# IDEA-0103 — Cognitive BIOS (The Universal Boot Sequence)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 abstraction-layer intake (round 15) — "before
  UCH connects, it performs a boot sequence: Identify → Authenticate →
  Enumerate → Capability Discovery → Topology Scan → Permission
  Negotiation → Security Scan → Memory Discovery → Tool Discovery →
  Ready — exactly like USB enumeration." The boot is what makes the
  Cognitive Abstraction Layer safe: every connect follows the same
  staged protocol, and nothing is assumed before its stage completes.
- **Related:** IDEA-0096 (UCCL ten-method contract — the boot sequence
  is the formal definition of `connect()/authenticate()`),
  src/workspace-manifest/negotiation.ts + src/cognitive-plane/
  protocol/capability-negotiation.ts (handshake: version/capability/
  permission exchange — stage 5-6 seeds), IDEA-0099 (scanner —
  stages 3-4 consume scanned surfaces), IDEA-0102 (runtime fingerprint
  — what stages 3-4 enumerate), IDEA-0097 (CIP Green/Yellow/Red —
  stage 7's consent boundary), src/cognitive-runtime/capability-
  registry.ts + grants.ts + src/control-plane/projections.ts (stage
  6's authority), design/THREAT-MODEL.md + design/PRIVACY-ERASURE.md
  (stage 7's security posture), CIC-SPECIFICATION.md (transport
  envelope the boot rides on)

## Motivation

Negotiation exists and is real: attach-time handshake exchanges
version, capability, and permission (workspace-manifest negotiation;
capability-negotiation module). But it is a single handshake, not a
**staged boot protocol with ordering and failure semantics**. The
intake's claim: like USB enumeration (address → descriptor → config →
ready) or a hardware BIOS (POST → device discovery → boot device →
handoff), the pre-connect sequence is itself a protocol with ten
named stages, each of which must complete before the next, each with
defined failure behavior (retry, degrade, abort). This is what turns
"UCH can discover, negotiate, and unify every legitimate integration
surface" from a posture into an executable procedure — and what makes
the CAL claim (one abstraction, infinite clients) safe: every client
boots the same way, and a hostile or broken client stops at the stage
it fails.

## The corpus cannot cover it because

- Negotiation is one exchange at attach; there is no ordered stage
  model (Identify before Authenticate before Enumerate...), no
  per-stage completion criteria, no explicit failure semantics
  (which stages are retryable, which degrade, which abort the
  connect).
- Security scanning and memory/tool discovery are performed
  implicitly (gatherer, registry reads) — never as declared stages
  with gates in the connect flow; "Ready" is not a defined state
  with evidence.
- The UCCL contract (IDEA-0096) names `connect()` and `authenticate()`
  but leaves the sequence unspecified; a third-party adapter needs the
  sequence specified to be conformant and auditable.

## Proposal sketch

- **Boot protocol `uch.boot.v1`**: ten stages, each with input/output/
  gate: (1) Identify (fingerprint + identity claims), (2) Authenticate
  (CIC handshake), (3) Enumerate (surfaces per taxonomy), (4)
  Capability Discovery (scanner result vs registry), (5) Topology Scan
  (capability graph edges), (6) Permission Negotiation (grants ∩
  projections; CIP zone declaration), (7) Security Scan (threat-model
  checks, quarantine per WS-P), (8) Memory Discovery (storage engines
  per IDEA-0049, placement policy per IDEA-0029), (9) Tool Discovery
  (MCP/ACP surfaces), (10) Ready (boot report: what connected, at what
  level, with what evidence).
- **Failure semantics**: each stage declares retryable/degradable/
  fatal; a failed gate drops the rail to its lowest safe level
  (INTEGRATION-LEVELS rule 4) or aborts the connect — never partial
  silent state. Boot reports are ledgered (ADR-002) for auditability.
- **Boot as contract**: the ten stages become the conformance test of
  `connect()` in the UCCL adapter suite (IDEA-0096) — an adapter that
  cannot produce a boot report is not certified.

## Risk assessment

- Over-formalization: ten stages must stay cheap (each is a probe or
  a registry read — no LLM in the loop), or adapters will skip them;
  the boot is a sequence of evidence-producing steps, not ceremony.
- Stage coupling: stages must not assume earlier stages' _conclusions_,
  only their completion (a capability discovered in stage 4 may be
  refused in stage 6).
- Compatibility: boot failure modes must map onto degradation paths
  already defined (INTEGRATION-LEVELS rule 4), never new ad-hoc
  behaviors.

## Where it lands

- `spec/` (boot protocol section of the UCCL spec), adapter
  conformance suite stage tests, boot report ledger event type.

## Code impact

- None until specified; seeds are negotiation.ts, capability-
  negotiation.ts, attach.ts, grants + projections, scanner (0099).

## Next stage

- Prototype: run a ten-stage boot against the existing OpenCode plugin
  attach path; assert the boot report equals the current attach result
  plus per-stage evidence.
