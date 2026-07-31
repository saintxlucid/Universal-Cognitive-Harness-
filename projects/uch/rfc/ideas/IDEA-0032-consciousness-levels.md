# IDEA-0032 — Engineering Consciousness Levels

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "instead of agent idle/running/
  stopped: Dormant, Observing, Understanding, Planning, Designing,
  Engineering, Verifying, Reflecting, Learning, Dreaming, Evolving — each
  activates different subsystems"
- **Related:** src/kernel/process (WS-A process table), src/sleep_cycle,
  src/cognitive-plane (executive brain), IDEA-0011 (physiology),
  design/INTEGRATION-LEVELS.md

## Motivation

Lifecycle states today are scheduler states (created/running/killing).
The claim: an engineering consciousness ladder — Dormant → Observing →
Understanding → Planning → Designing → Engineering → Verifying → Reflecting
→ Learning → Dreaming → Evolving — where each level activates a defined
subsystem set (observing enables sensors; verifying enables verification and
review; dreaming enables sleep-cycle distillation). The ladder is the
high-level state machine that the scheduler, physiology, and sleep cycle
serve.

## The corpus cannot cover it because

The process table owns lifecycle as OS states; the sleep cycle runs as a
pipeline; integration levels L0–L4 describe host capability, not organism
state. No state model maps levels to subsystem activation, and no transition
rules or energy coupling exist.

## Proposal sketch

- Define the 11 levels with: activated subsystem set, entry/exit
  conditions, energy profile, dominant physiology state (IDEA-0011).
- Transitions governed by policy (an organism cannot "evolve" without
  evidence; cannot "verify" without prior "engineering").
- The scheduler observes the ladder; sleep cycle is the "dreaming" level's
  executor.

## Risk assessment

- State-machine theater: each level must change measurable behavior
  (subsystem activation, energy, telemetry) or it is a rename of "running".

## Where it lands

- Design doc `design/CONSCIOUSNESS-LEVELS.md`; extends the process model.

## Code impact

- None until the process table gains observable states beyond OS lifecycle;
  first step is a mapping of existing subsystems to levels.

## Next stage

Map existing subsystems to the ladder; prototype Observing and Verifying as
defined states with measurable activation, and check the ladder predicts
energy use.
