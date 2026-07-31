# IDEA-0017 — Reality Synchronization

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "every second UCH compares reality ↔
  model ↔ memory ↔ knowledge ↔ predictions ↔ expectations ↔ architecture ↔
  git ↔ filesystem ↔ IDE ↔ internet ↔ human — the organism never drifts"
- **Related:** design/SENSORS-EFFECTORS.md, src/drivers/sensors,
  docs/GENESIS.md (Reality engine), src/context/gatherer.ts,
  IDEA-0002 (belief revision)

## Motivation

Drift is the silent failure of long-lived cognition: the model of the world
quietly diverges from the world. A synchronization engine continuously
reconciles predictions and expectations against observed reality; an
expectation violation is a drift signal that triggers belief revision and
memory rewrite — the organism stays honest.

## The corpus cannot cover it because

Sensors emit change events (change-only, per design); the Reality engine is
listed as an embryo (drivers, sensors, effectors). There is no continuous
sync loop: no expectation-vs-observation reconciliation, no drift signal,
no defined coupling to belief revision.

## Proposal sketch

- Sync engine: maintain expectations (predicted world state per model) and
  compare against sensor-observed reality.
- Violation → drift signal with magnitude → belief revision (IDEA-0002
  chemistry) → memory rewrite → experience record.
- Batch and change-only emission (already the sensor contract) to bound loop
  bandwidth; drift rate is a physiology metric (IDEA-0011).

## Risk assessment

- Loop bandwidth and feedback pathology (over-correction); the sync loop must
  be damped and governed like any organ.

## Where it lands

- Design doc `design/SYNC-ENGINE.md`; extends composeDriver rather than
  replacing it.

## Code impact

- None until the prototype: expectation-vs-observation reconciliation over
  existing GitSensor/SessionSensor data.

## Next stage

Prototype drift detection on real git history (predicted file-set vs. actual
changes); measure whether violations predict real divergence.
