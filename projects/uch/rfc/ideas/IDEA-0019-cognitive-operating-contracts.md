# IDEA-0019 — Cognitive Operating Contracts

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "instead of APIs, contracts: memory
  guarantees, reasoning guarantees, planning guarantees, verification
  guarantees; every organ signs a contract — like PCI Express, USB, POSIX;
  third-party developers can build guaranteed-interoperable organs"
- **Related:** spec/CIC (transport contract), src/drivers/conformance.ts,
  src/drivers/compliance.ts, MANIFESTO §6 (organ contracts), spec/CP.md

## Motivation

APIs say *what* you can call; contracts say *what is guaranteed*. A memory
organ that signs a memory contract can be replaced by a third-party organ
with the same guarantees. Contracts are what make organs a market instead of
a monolith.

## The corpus cannot cover it because

Organ contracts exist as internal TypeScript interfaces; conformance and
compliance certify drivers against CP/CIC. There is no external contract
standard — normative guarantees + conformance suite — that a third-party
organ can implement against and be certified on.

## Proposal sketch

- Contract = normative interface + guarantee clauses + conformance test
  suite + certification (certified / partial / not-certified), mirroring
  driver compliance.
- Kernel verifies signed contracts at attach; violations are recorded and
  gated, never silent.
- Start with two exemplar contracts: memory and verification.

## Risk assessment

- Contract scope creep: guarantees must be testable; an untestable guarantee
  is prose, not a contract.

## Where it lands

- Extension of spec/CIC or new spec/COGNITIVE-CONTRACTS.md; reuses
  compliance machinery.

## Code impact

- None until one exemplar contract exists with a conformance suite.

## Next stage

Write the verification-organ contract + conformance suite; then the memory
contract; validate that a contract change is cheaper than an API change.
