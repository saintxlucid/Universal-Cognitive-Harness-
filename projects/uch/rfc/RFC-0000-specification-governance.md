# RFC-0000 — Specification Governance System

- **Status:** Stable (governs itself)
- **Family:** Society (Governance) / Computing (Compatibility)
- **Related:** Constitution Article IV & XI, design/DIRECTIONS.md SOP-08, spec/VERSION.md
- **Date:** 2026-08-01

## Summary

UCH is specification-first, implementation-second. This RFC defines the
governance system by which the specification corpus changes — the lifecycle,
the gates, the roles, and the invariants. Every normative decision in the
project passes through it, including amendments to this RFC.

## Problem

Without a governance system, the corpus drifts: decisions are made in
conversation, recorded inconsistently, and contradicted silently by later
changes. Specification-driven engineering outperforms ad-hoc development for
large, long-lived systems because the specification — not the conversation —
is the source of truth. The project already has the raw materials (ADR
process, DIRECTIONS.md, spec/VERSION.md, conformance); this RFC makes them one
coherent system.

## The Lifecycle

```text
Idea → Research → RFC → Prototype → Benchmark → Architecture Review →
Security Review → Constitution Check → Acceptance → Specification →
Reference Implementation → Certification → Stable
```

Full stage semantics: design/DIRECTIONS.md SOP-08. Invariants:

1. **One RFC, one decision.** Scope creep invalidates the RFC.
2. **RFCs are a ledger.** Superseded RFCs are marked, never deleted (Law 12).
3. **The Constitution is the ceiling.** No RFC may contradict the 32 Laws or
   the Constitution Articles; contradictions require constitutional
   amendment first (Article IV), which is a separate, harder path.
4. **Compatibility is the floor.** Contract changes must be additive or
   follow the declared deprecation path (Law 30).
5. **Certification is evidence.** "Stable" requires a certified reference
   implementation and at least one external consumer — the status is earned,
   not declared.

## The Five Gates

Every Idea must pass five gates before it may become an RFC
(DIRECTIONS.md SOP-09): Scientific, Architectural, Engineering, Biological,
Economic. A failure at any gate kills the idea at the idea stage — the
cheapest place to kill it.

## Roles

| Role | Responsibility | Currently held by |
| --- | --- | --- |
| **Specification Council** | Accepts/rejects RFCs at Acceptance | The maintainer(s) — provisional, single-member |
| **Architecture Review** | Gate 4 of the lifecycle | Architect role (design/ARCHITECTURE.md) |
| **Security Review** | Gate 5 | Security auditor role (design/THREAT-MODEL.md) |
| **Constitution Check** | Gate 6 — laws + articles verdict | Judiciary path of the Constitution |
| **Certification Board** | Awards/withdraws certification | Conformance suite + `drivers/compliance.ts` — provisional |

All roles are currently provisional and single-member; the RFC process is
designed so that any of them can be handed to independent parties without
changing the lifecycle.

## Versioning

The corpus carries independent semver (spec/VERSION.md):

- **patch** — non-normative (clarification, examples, wording)
- **minor** — additive normative change (new law, new op, new section)
- **major** — breaking change (existing contract stops being honored)

RFCs that land a minor or major bump must link the RFC number in the spec
file's changelog note.

## Relationship to existing artifacts

| Artifact | Role in this system |
| --- | --- |
| ADR-00NN | Decision record for *implementation* choices (how), bound by the RFC for *contract* choices (what) |
| design/DIRECTIONS.md | Operating procedures of the DOE framework; SOP-08/SOP-09 are the operational face of this RFC |
| spec/VERSION.md | Corpus versioning policy; the bump rules are the mechanical enforcement of the lifecycle |
| design/CONFORMANCE.md + `src/protocol/conformance.ts` | The certification machinery |
| `src/drivers/compliance.ts` | Certificate line generation for drivers |

## Open questions

1. When the project grows beyond a single maintainer, should the Specification
   Council be elected, co-opted, or rotating?
2. Should the RFCs be mirrored to a public location (e.g., a `uch-spec` repo)
   before the runtime reaches 1.0?
3. Where does the marketplace certification (RFC-0010 territory) sit relative
   to the driver certification above?

*RFC-0000 governs itself: amendments to this RFC pass through this lifecycle.*
