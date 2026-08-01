# UCH Specification Corpus — Versioning & Stability Policy

**Specification:** `spec/` — LAWS_OF_COGNITIVE_PHYSICS, GENOME,
FORMAL_FOUNDATIONS, CP, CONSTITUTION, COGNITIVE_ONTOLOGY,
COGNITIVE_BIOLOGY, CIR, VERSION
**Version:** 0.4.0
**Status:** Draft (0.x — no compatibility promise yet)
**Last updated:** 2026-08-01

---

## 0. Changelog

| Date | Version | Change | RFC |
| --- | --- | --- | --- |
| 2026-08-01 | 0.3.0 → 0.4.0 | New normative spec: spec/CIR.md — Cognitive Intermediate Representation (instruction model, classes, pipeline, 17-pass optimizer, gates, versioning, trace contract), promoted from design/CIR.md at RFC-0004 Acceptance | RFC-0004 |
| 2026-08-01 | 0.2.0 → 0.3.0 | FORMAL_FOUNDATIONS Part VIII promoted from draft to normative (Cognitive Physics: quantities/units, conservation, failure physics I(b) = confidence − evidenceMass with held-out-validated θ = 0.5, cognitive calculus) | RFC-0005 |
| 2026-08-01 | 0.1.0 → 0.2.0 | 13 new laws (Laws 20–32) added in five families; Constitution extended with Articles IX–XI (Cognitive Rights, Cognitive Responsibilities, Immutability of the Core); specification governance declared (RFC-0000) | RFC-0000 |

---

## 1. Purpose

The `spec/` corpus is a **versioned contract set**: the Laws of Cognitive
Physics, the genome shape, the protocol ABI, the constitution, and the
cognitive ontology. Each document already carries its own version where it
is a contract (CP 1.0.0, CIC envelope, …). This policy version the corpus
*as a whole*, so consumers and CI can answer one question: **is the
specification corpus newer than what I last verified against?**

## 2. Versioning model

The corpus carries **independent semantic versioning** — `major.minor.patch`,
tracked in this file. The corpus version is deliberately independent of the
package version: the package ships faster, the corpus must not.

Version bumps are **declared, not computed**. When a spec file changes, the
author updates the `**Version:**` and `**Last updated:**` fields above in the
same change. CI (see §5) enforces that no spec file is newer than the
declared date.

## 3. Bump rules

| Bump | Applies to |
| --- | --- |
| **patch** | Additive documentation changes: clarifications, corrected wording, expanded examples, no normative change |
| **minor** | New protocols, contracts, or normative sections added to the corpus; existing contracts unchanged |
| **major** | Breaking contract changes: an existing protocol op, envelope shape, law, or schema stops being honored as previously specified |

A change that touches a contract's normative meaning is never a patch, even
if the diff looks small.

## 4. Stability ladder

| Version | Ladder | Meaning |
| --- | --- | --- |
| `0.x` | **Draft** | Contracts are being shaped; consumers must pin to exact versions |
| `1.0.0` | **Stable** | The corpus promises: no breaking change without a major bump; majors are announced and co-published where feasible |
| `2+` | **Evolving** | Stable with a documented migration path per major |

`0.x` makes no compatibility promise: any change may be breaking, and the
bump rules in §3 apply only to the *shape of the history*, not to what
`0.x` owes consumers.

## 5. CI intent

Every push/PR that touches `spec/**` runs:

```text
node scripts/spec-version-check.mjs
```

The check compares the newest modification date of any file under `spec/`
against the declared `**Last updated:**` date. If a spec file is newer than
the declared date, the change **has not declared a version bump** and the
gate fails, listing the offending files. The intent: no spec change lands
without an explicit version + date declaration in this file.

The spec-version gate is advisory during `0.x` (draft): it enforces
declaration discipline, not semantic compatibility — compatibility promises
begin at `1.0.0`.
