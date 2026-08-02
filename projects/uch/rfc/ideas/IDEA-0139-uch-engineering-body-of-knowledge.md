# IDEA-0139 — UCH Engineering Body of Knowledge (UCH-EBOK)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 round-22 intake — "Not documentation. An
  engineering discipline." UCH should adopt the engineering rigor of
  operating systems, databases, compilers, avionics, and distributed
  infrastructure, organized as a ten-volume Engineering Body of
  Knowledge in which LLMs are one implementation detail.
- **Related:** IDEA-0024 (CSE discipline claim — round 1), IDEA-0048
  (consolidated normative specification), IDEA-0083 (spec repository),
  IDEA-0127 (five-spec canon + reimplementation objective), Platform
  Zero (spec-first decision), RFC-0000 (governance), VISION sec 26.

## Motivation

The corpus organizes by five books (Genesis / Constitution / Blueprint /
Standards / Ascension) and by disciplines (physics, chemistry, biology,
society, computing, mathematics). The EBOK proposes a second axis: the
ten engineering disciplines a platform must master, each a volume with
the rigor of its namesake field — DO-178C-class requirements,
SysML-style systems engineering, distributed-systems theory, formal
methods, runtime engineering, safety and verification.

## The corpus cannot cover it because

The books are narrative/governance artifacts, not discipline corpora;
nothing names the ten-volume organization. The artifact-first repository
layout (constitution / specifications / rfcs / formal-models /
reference-architecture / reference-runtime / conformance-tests /
benchmarks / safety-cases / threat-models / verification / simulation /
sdk / reference-implementations / docs) is proposed but unadopted —
restructure is a high-churn governance decision (per IDEA-0024's
discipline note), and safety-cases / threat-models / simulation /
formal-models have no first-class artifact homes today.

## Proposal sketch

- **Ten volumes** (canonical list — the intake's later section headings
  are content notes folded into these volumes):

  | Vol  | Volume                          | Corpus anchor (executed or tracked)                                       |
  | ---- | ------------------------------- | ------------------------------------------------------------------------- |
  | I    | Computational Cognitive Science | 32 Laws, RFC-0005, FORMAL_FOUNDATIONS, registers                          |
  | II   | Software Engineering            | SOP-08, constitution, conformance corpus, WS-C, IDEA-0090; delta 0140     |
  | III  | Systems Engineering             | ADR-006, anatomy, WS-E, IDEA-0072; delta 0141                             |
  | IV   | Distributed Systems             | ADR-002 ledger, WS-D, WS-I, IDEA-0088/0130/0086                           |
  | V    | Formal Methods                  | FORMAL_FOUNDATIONS I-VIII, RFC-0005, IDEA-0026/0035                       |
  | VI   | Runtime Engineering             | ADR-006, CVM, exec graph, scheduler, vmem, IDEA-0030/84/85/87, replay/UER |
  | VII  | Platform Engineering            | STACK, spec/VERSION, IDEA-0095, conformance, IDEA-0048/83/127             |
  | VIII | Safety & Verification           | provenance, deterministic replay, certification corpus, organic vetoes    |
  | IX   | Human Cognitive Systems         | psychology laws, IDEA-0092, human-factors, UX charter, rights             |
  | X    | Governance                      | RFC-0000, SOP-08, amendments, rights/responsibilities                     |

- **CSE discipline**: the seven core domains (Computational Cognitive
  Science; Runtime / Platform / Systems / Verification / Evolution /
  Observability Engineering) are a cataloging refinement of IDEA-0024's
  discipline claim, already tracked.
- **"LLMs become one implementation detail"**: ratification of the
  corpus's founding premise — inference is one opaque instruction class
  in CIR, models are interchangeable processors behind the fabric
  (ADR-004), cognition lives in the kernel, not the model.
- **Artifact-first layout**: the POSIX/LLVM/WebAssembly pattern — a
  specification ecosystem with one reference implementation; the
  volume-to-artifact mapping index is the first deliverable, restructure
  a separate ratified decision.

## Risk assessment

- Doc churn: EBOK must complement, not replace, the five-book canon;
  the mapping is the deliverable, not a file move.
- Bureaucracy: requirements and views must compile to gates or
  conformance checks, never parallel prose (same rule as
  IDEA-0140/0141).

## Where it lands

Corpus governance layer (VISION sec 26; GENESIS twelfth framing); a
volume-to-artifact index if ratified.

## Code impact

None (SOP-08 stage 1).

## Next stage

Ratification decision; then the volume-to-artifact mapping index;
restructure separately governed.
