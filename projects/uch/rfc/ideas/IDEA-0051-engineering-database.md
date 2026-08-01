# IDEA-0051 — Engineering Database

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Foundation 9) — "not source
  code — engineering. Stores: requirements, architecture, intent,
  tradeoffs, meetings, knowledge, research, failures, successes,
  benchmarks, experiments"
- **Related:** decision journal, engineering-intelligence domain
  stores (150 concepts / 10 tiers), knowledge-base, research/
  foundations/ registers, failure-physics (failure corpus),
  IDEA-0050 (knowledge fabric — the connections), IDEA-0042
  (archaeology — the excavation), IDEA-0040 (jurisprudence — the
  case law over it)

## Motivation

Engineering knowledge is scattered: decisions live in the journal,
concepts in EI stores, research in `research/foundations/`, failures in
mistake-db and the failure-physics corpus. The claim: one *engineering
database* — typed artifact collections (requirements, architecture,
intent, tradeoffs, meetings, knowledge, research, failures, successes,
benchmarks, experiments) as queryable, versioned, provenance-attached
records — so the organism's engineering memory is a database, not a
pile of stores.

## The corpus cannot cover it because

No unified artifact schema set exists; tradeoffs, meetings, successes,
and experiments are not first-class records anywhere; provenance is not
attached to artifact records uniformly.

## Proposal sketch

- Typed artifact schema set with provenance (trace refs) + versioning;
  failures/successes feed jurisprudence (0040) and immunology (0038);
  archaeology (0042) and the fabric (0050) query it.
- The database is the payload layer beneath the knowledge fabric.

## Risk assessment

- Yet another database: it must be distinguished by provenance
  attachment and linkability to code/traces, or it duplicates the
  journal.

## Where it lands

- Design doc `design/ENGINEERING-DATABASE.md`; reuses journal + EI
  schemas.

## Code impact

- None until the artifact schema set is defined over existing stores.

## Next stage

Define the schema set by mapping existing stores (journal, EI,
research registers) into artifact types; identify the genuinely new
types (tradeoffs, meetings, successes).
