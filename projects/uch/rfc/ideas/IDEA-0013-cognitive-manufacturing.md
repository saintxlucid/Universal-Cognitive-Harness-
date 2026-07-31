# IDEA-0013 — Cognitive Manufacturing

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "software today is handcrafted;
  industrialize it: every feature passes through manufacturing stations — no
  skipping"
- **Related:** design/CIR.md (pipeline), design/DIRECTIONS.md (SOPs),
  GSD workflow, design/ENGINEERING-INTELLIGENCE.md

## Motivation

Handcrafted software is irreproducible. A cognitive manufacturing line turns
every feature into a station sequence — requirements → intent compilation →
architecture → simulation → risk → implementation → static analysis → dynamic
testing → behavior verification → documentation → knowledge capture →
deployment → reflection → learning — where every station has inputs,
outputs, and measurements, and skipping requires explicit policy.

## The corpus cannot cover it because

CIR is a compilation pipeline (intent → executable graph); GSD and DIRECTIONS
are engineering workflows. Neither is a manufacturing line: no station
contracts, no per-station entry/exit criteria, no measurement surface, no
recorded policy exception for skips.

## Proposal sketch

- Station contract: required inputs, produced outputs, measurements, gate
  (must-pass criteria).
- Manufacturing run: feature → station sequence → trace ledger record per
  station (what passed, what was measured, what was skipped and why).
- Policy: a skip is legal only with a recorded justification that itself gets
  reviewed; the ledger makes the line auditable.

## Risk assessment

- Ceremony over velocity: gate thresholds must be derived from measured
  outcomes, not invented; the line must be faster than ad hoc, not slower.

## Where it lands

- Design doc `design/MANUFACTURING.md`; station registry built on the CIR
  pipeline stages; integrates with the ledger for auditability.

## Code impact

- None until CIR is stable; then a station registry over its stages.

## Next stage

Map the existing CIR stages onto station contracts; prototype one end-to-end
manufacturing run and measure overhead vs. handcrafted flow.
