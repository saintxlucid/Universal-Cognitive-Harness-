# IDEA-0074 — Cognitive Failure Taxonomy

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Today errors look like 'Exception'. UCH should classify: Reasoning
  Failure, Knowledge Failure, Memory Failure, Identity Failure,
  Constitution Failure, Evidence Failure, Simulation Failure,
  Verification Failure, Attention Failure, Homeostasis Failure. Each
  handled differently."
- **Related:** RFC-0005 failure physics (src/engineering-intelligence/
  failure-physics/instability.ts — spof/network/db/complexity families,
  I(b) instability measure, θ = 0.5 veto threshold), src/engineering-
  intelligence/domains/tier-08 (9 failure concepts), design/
  FAILURE-RETRY.md (retry policy per failure class), src/cognitive-
  plane/integrity/integrity-checklist.ts (5-question inhibition gate),
  src/mnemosyne/parahippocampal-gate.ts (poisoning detection),
  WS-E diagnostics (homeostasis-relevant metrics), IDEA-0062 (security
  architecture — one boundary), IDEA-0071 (cognitive SLOs — failure
  rates as observables), CP ops (verification requirement per op)

## Motivation

An exception says *what* failed; a taxonomy says *which faculty*
failed, *why that class is different*, and *how to respond*. A
reasoning failure (bad inference chain) is handled by reverification;
a memory failure (corrupt recall) by quarantine and re-ingestion; a
constitution failure (law violation) by veto — never by retry.
Classifying failures by cognitive faculty turns error handling from
generic retries into per-faculty policy, which is exactly what
reliability engineering did with error taxonomy in mature systems.

## The corpus cannot cover it because

RFC-0005 classifies *physics* failures (4 families, veto-via-
instability) and tier-08 catalogs *engineering* failure concepts —
neither is a runtime failure taxonomy for the ten cognitive faculties.
FAILURE-RETRY.md defines retry policies but keyed to operation types,
not faculties; the integrity checklist gates *actions*, it does not
classify *outcomes*. Errors still surface as generic exceptions with no
faculty tag, so recovery policy cannot discriminate.

## Proposal sketch

- Ten faculty failure classes (reasoning, knowledge, memory, identity,
  constitution, evidence, simulation, verification, attention,
  homeostasis), each with: detection signal, severity, canonical
  response (retry / reverify / quarantine / veto / degrade / rehomeo-
  stat), and ledger event type (ADR-002-compatible).
- Faculty tags on error records: every failure published on the signal
  bus carries its class; the response registry maps class → policy,
  overriding generic retry (constitution failures never retry).
- Failure class rates become Cognitive SLO observables (IDEA-0071:
  hallucination rate = evidence-failure rate, contradiction rate =
  reasoning-failure rate) and feed RFC-0005 instability.

## Risk assessment

- Misclassification: a failure tagged with the wrong faculty gets the
  wrong response. The tagger must be conservative (default to
  reasoning class with verification instead of aggressive quarantine),
  and every tag must be auditable in the ledger.

## Where it lands

- `design/FAILURE-TAXONOMY.md`; extends RFC-0005 + FAILURE-RETRY.md +
  the event type catalog.

## Code impact

- None until the ten classes and response registry are specified;
  RFC-0005's veto remains the constitution-failure response.

## Next stage

- Ten classes drafted with detection signals + canonical responses;
  map existing error paths onto the classes as validation.
