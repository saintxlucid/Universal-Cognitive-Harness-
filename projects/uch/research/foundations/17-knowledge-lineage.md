---
track: memory
status: research-draft
version: 0.1.0
sources:
  - https://www.w3.org/TR/prov-dm/ (W3C PROV-DM — provenance data model: entity, activity, agent, wasDerivedFrom, wasGeneratedBy)
  - https://arxiv.org/abs/1706.09437 (TAPAS — provenance semantics for SQL: lineage as a first-class query concept)
  - https://docs.dagster.io/concepts/asset-lineage (Dagster — data lineage: who produced this, what depends on it)
  - https://cloud.google.com/blog/products/data-analytics/bringing-googles-data-lineage (Google Cloud Data Lineage — five-question lineage practice)
  - https://www.w3.org/TR/dcat/ (DCAT — metadata for datasets: publisher, created, modified as structured fields)
---

# Knowledge Lineage Service — G1 evidence register (IDEA-0076)

Evidence register for `rfc/ideas/IDEA-0076-knowledge-lineage-service.md`:
every idea answers five questions — where did I come from, who created
me, what changed me and why, who verified me, what depends on me. The
prototype implements: a uniform five-question interface over an
in-memory store, with extinct-object lineage stubs.

## 1. Lineage is a data model, not a log

| Evidence | Source |
| --- | --- |
| PROV-DM standardizes provenance as entities, activities, and agents with typed relations (wasGeneratedBy, wasDerivedFrom, wasAttributedTo) | W3C PROV-DM |
| Data-lineage practice answers exactly the five questions the intake poses: origin, producers, transformations, verifiers, consumers | Google Cloud lineage; Dagster asset lineage |

**Corpus anchor:** provenance is fragmented across the corpus — the
OTel ledger (ADR-002) knows *events*, UER (IDEA-0047) knows *causal
structure*, the decision journal knows *decisions*, the time machine
knows *belief states*. `LineageService` is the uniform query surface
over all of them (the prototype in-memory; wiring to the real stores is
follow-up).

## 2. Origin is immutable; changelog is append-only

| Evidence | Source |
| --- | --- |
| PROV-DM separates generation (the origin event) from derivation (subsequent transformations) — origin never changes, history accumulates | W3C PROV-DM |
| An append-only changelog is auditable: who changed what, why, and when | Corpus ledger discipline (ADR-002) |

**Corpus anchor:** `recordOrigin` writes the immutable origin
(creator + creation event + tick); `addChange` appends
who/what/why records — the same who/what/why the decision journal and
cognitive archaeology (IDEA-0042) demand.

## 3. Verification is part of lineage

| Evidence | Source |
| --- | --- |
| "Who verified this" is a lineage question with a canonical answer: the verdict, the run, and the timestamp | Data lineage practice (quality/validation records) |
| A belief that cannot name its verifiers is a rumor | Corpus claim (VISION purpose clause) |

**Corpus anchor:** `addVerification` records verdict (pass/fail/
pending), run id, and tick; `verifiedBy` returns the canonical verdict
list — unifying verdicts that today live in benchmark runs, organic
scores, and review records.

## 4. Dependents are reverse causal edges

| Evidence | Source |
| --- | --- |
| "What depends on me" is the reverse of derivation: queries traverse wasDerivedFrom backward | PROV-DM; TAPAS lineage |
| A dependency graph makes impact analysis possible (what breaks if I change this) | Dagster asset dependency |

**Corpus anchor:** `declareDependency` records the forward edge and
maintains the reverse list — the same causal spine UER (IDEA-0047)
builds; the service composes the ledger (events) + UER (causality) +
journal (decisions).

## 5. Extinction preserves lineage

| Evidence | Source |
| --- | --- |
| Even after deletion, "where did I come from" must remain answerable; provenance survives the entity | PROV-DM (retraction ≠ deletion of history); IDEA-0072 (extinct stage) |

**Corpus anchor:** `markExtinct` keeps the record with `extinct: true`
and blocks further changes — the lineage stub of IDEA-0072's Extinct
terminal state.

## Prototype claims

- Uniform five-question interface (origin / changelog / verification /
  dependents / extinction) over one store.
- Read-mostly, deterministic, in-memory (Law-12 read-model discipline).
- Extinct objects retain lineage stubs.
