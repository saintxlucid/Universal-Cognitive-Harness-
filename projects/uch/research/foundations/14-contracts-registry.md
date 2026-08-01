---
track: governance
status: research-draft
version: 0.1.0
sources:
  - https://www.rfc-editor.org/rfc/rfc2119 (RFC 2119 — normative language: MUST/SHOULD/MAY as contract semantics)
  - https://pubs.opengroup.org/onlinepubs/9699919799/ (POSIX — program contracts are what made programs replaceable)
  - https://en.wikipedia.org/wiki/Design_by_contract (Meyer — design by contract: preconditions, postconditions, invariants)
  - https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/ (AWS Well-Architected — failure modes as first-class contract fields)
  - https://www.rfc-editor.org/rfc/rfc9110 (RFC 9110 — HTTP semantics; timing/resource envelopes in practice)
---

# Cognitive Contracts Registry — G1 evidence register (IDEA-0073)

Evidence register for `rfc/ideas/IDEA-0073-cognitive-contracts-registry.md`:
every subsystem declares formal behavioral contracts — inputs, outputs,
side effects, guarantees, failure modes, timing, resources, security —
verified against observed behavior, so substitution becomes possible.
The prototype implements: the nine-field contract record, schema
validation, conformance probes with verdicts, and breaking-change
detection (which triggers capability negotiation, IDEA-0068).

## 1. Contracts enable substitution — the POSIX argument

| Evidence | Source |
| --- | --- |
| POSIX defined *program contracts* (stdin/stdout/stderr, exit codes, file semantics), which is why Unix programs became replaceable: a new implementation satisfying the contract substitutes without rework | POSIX |
| Design by contract makes preconditions/postconditions/invariants explicit, moving assumptions out of prose into verifiable declarations | Meyer, design by contract |

**Corpus anchor:** UCH has contract *fragments* everywhere — MANIFESTO
§6 organ contracts (prose), conformance verdicts
(`src/interface/conformance.ts`), driver compliance certificates
(`src/drivers/compliance.ts`), CIC instruction rules — but no contract
as a first-class structured record. The prototype's `ContractRecord` is
the nine fields verbatim plus declaring subsystem and version.

## 2. Failure modes belong in the contract

| Evidence | Source |
| --- | --- |
| Mature reliability practice requires declaring how a component fails: failure modes are part of the interface, not an afterthought | AWS Well-Architected reliability pillar |
| A caller that knows the declared failure set can respond correctly; undeclared failures are the surprise class that breaks recovery | Reliability engineering practice |

**Corpus anchor:** the prototype's `probeContract` flags any observed
failure not in the declared `failureModes` — the failure taxonomy
(IDEA-0074) supplies the vocabulary, and contract violations feed
plugin trust scoring (IDEA-0080).

## 3. Timing and resource envelopes are contract terms

| Evidence | Source |
| --- | --- |
| HTTP semantics formalize representation choice but not timing; practical service contracts add latency and resource budgets as binding terms | RFC 9110; SRE practice |
| An envelope that is not parseable is not enforceable | Prototype claim |

**Corpus anchor:** the prototype parses `p95 < 200ms` and
`energy <= 5 per call` envelopes deterministically and probes observed
values against them — the same envelope discipline as the cognitive
SLO catalog (IDEA-0071) and energy budgets.

## 4. Breaking changes negotiate, they do not silently break

| Evidence | Source |
| --- | --- |
| A contract change that removes a declared capability is a breaking change (SemVer major) and must trigger re-negotiation, not silent failure | SemVer 2.0.0; IDEA-0068 (dialect fallback) |
| Contracts describe *behavioral guarantees*, not internal structure — implementation detail in a contract ossifies the design (DYC law) | Corpus constitution (DYC); IDEA-0068 risk notes |

**Corpus anchor:** `ContractRegistry.isBreakingChange` detects removed
outputs/side-effects/failure-modes and tightened envelopes; a breaking
change is the trigger that routes to capability negotiation (IDEA-0068)
rather than a silent break.

## Prototype claims

- Nine-field contract record with subsystem + version.
- Deterministic conformance probe: declared vs observed, verdicts
  conformant / violated / untested (untested = no evidence, not pass).
- Breaking-change detection as the capability-negotiation trigger.
