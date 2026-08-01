# IDEA-0073 — Cognitive Contracts Registry

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Every subsystem must expose formal contracts: Inputs, Outputs, Side
  Effects, Guarantees, Failure Modes, Timing, Resources, Security.
  Like RFCs."
- **Related:** IDEA-0019 (cognitive operating contracts — proposed
  certification of contracts), MANIFESTO §6 (16 organ contracts),
  src/interface/conformance.ts + src/drivers/compliance.ts (verdict
  certification), CIC v0.1 (instruction surface + session rules),
  src/kernel/cic (grants), engineering constitution (14 laws),
  IDEA-0053 (constitution engine — execute-time enforcement), IDEA-0083
  (specification repository — machine-readable home for contracts),
  IDEA-0067 (organ design system — behavior patterns)

## Motivation

An organ's contract is its RFC: what it consumes, what it produces,
what side effects it may have, what it guarantees, how it fails, its
timing and resource envelope, its security posture. Contracts are what
make substitution possible — POSIX defined program contracts, which is
why programs became replaceable. UCH has contract *fragments*
everywhere (MANIFESTO §6 organ contracts, conformance verdicts,
compliance certificates, CIC instruction rules, the constitution's
laws) but no *contract as a first-class record* that a subsystem
declares and that the organism verifies.

## The corpus cannot cover it because

IDEA-0019 (operating contracts) proposed certification but is
stage-1; MANIFESTO §6 defines contracts in prose, not as structured
records; conformance/compliance certify *protocols and drivers*, not
organ behavioral contracts; the engineering constitution states
laws, not per-subsystem guarantees. No subsystem today declares
inputs/outputs/side effects/failure modes/timing/resources/security
in one place, and nothing verifies a declaration against behavior.

## Proposal sketch

- A contract record format (the nine fields verbatim: inputs, outputs,
  side effects, guarantees, failure modes, timing, resources, security
  — plus the declaring subsystem and version) stored in the
  specification repository (IDEA-0083) as machine-readable specs.
- A contract registry + verification: runtime conformance probes check
  declarations against observed behavior (the compliance machinery
  extends from drivers to organs); verdicts feed plugin trust scoring
  (IDEA-0080) and the review board (IDEA-0022).
- Contracts versioned per IDEA-0069; a breaking contract change
  triggers capability negotiation (IDEA-0068) rather than silent break.

## Risk assessment

- Contract literalism: contracts that describe implementation details
  ossify and block evolution. Contracts must describe *behavioral
  guarantees*, not internal structure (the constitution's DYC law);
  the verification surface must be a small probe set, not exhaustive.

## Where it lands

- `design/CONTRACTS.md` + the contract records under the spec
  repository; extends IDEA-0019 and the compliance machinery.

## Code impact

- None until the record format and probe interface are specified.

## Next stage

- One organ's contract drafted in the nine-field format against its
  MANIFESTO §6 prose as validation.
