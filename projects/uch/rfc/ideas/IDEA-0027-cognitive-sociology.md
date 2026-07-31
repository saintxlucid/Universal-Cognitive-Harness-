# IDEA-0027 — Cognitive Sociology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "the hierarchy continues past
  ecology: Cognitive Sociology — multiple agents, trust, reputation,
  authority, negotiation, consensus, organizations — then Cognitive
  Civilization: standards, culture, institutions, inheritance, collective
  memory"
- **Related:** docs/GENESIS.md (Civilization engine), design/ADR-005 (attach,
  multi-agent), src/kernel/merge (cognitive merge), design/CIR.md,
  spec/CONSTITUTION.md

## Motivation

Multi-agent is currently topology ("multiple organisms, not multiple
chats"). The claim: a formal social layer — how agents form trust,
reputation, authority, negotiate, reach consensus, and organize — is the
missing discipline between ecology (resource competition) and civilization
(standards and institutions). Collective memory and inherited standards are
what make a colony outlive its members.

## The corpus cannot cover it because

Attach and the Civilization engine coordinate organisms; cognitive merge
unions knowledge; the constitution governs a single organism. There is no
model of inter-organism trust, reputation, negotiation, or consensus, and
no institution/inheritance concept (a standard that outlives its authors).

## Proposal sketch

- Social layer: reputation from verified outcomes (not claims), authority
  from demonstrated conformance, negotiation as contract exchange
  (IDEA-0019), consensus with veto aggregation (IDEA-0022).
- Civilization layer: standards as durable, versioned artifacts; inheritance
  = new organisms adopt the genome + standards corpus at birth.

## Risk assessment

- Sociology is the most human-metaphor-dense layer; every concept must map
  to a measurable primitive (reputation ← conformance results, authority ←
  certified contracts) or it is cut.

## Where it lands

- Design doc `design/COGNITIVE-SOCIOLOGY.md`; extends ADR-005 multi-agent
  semantics.

## Code impact

- None until the trust/reputation primitive exists as a read model over
  conformance + ledger data.

## Next stage

Prototype reputation as a derived measure over existing conformance and
ledger records; test whether it predicts which agent's changes pass review.
