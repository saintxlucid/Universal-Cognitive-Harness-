# IDEA-0091 — Morphogenesis (Organ Development)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 cognitive-microarchitecture intake (round 12) —
  "Morphogenesis: The organism should be able to grow new organs from
  primitive building blocks. Not install plugins. Actually develop."
- **Related:** IDEA-0039 (cognitive embryology — workspace-level
  development stages), IDEA-0013 (cognitive manufacturing — station
  contracts + gates over CIR stages), IDEA-0023 (elemental cognitive
  primitives — 7-class periodic table + normative composition rule),
  IDEA-0056 (cognitive object model — lifecycle observe → propose →
  verify → commit → evolve → archive), IDEA-0072 (universal lifecycle
  engine), src/kernel/process/ (WS-A process table + attach-joins-PID),
  engineering-chain (plan → simulation → verification → execution →
  validation → evidence → replay), CIR (RFC-0004 — compiled
  development), WS-C (organism versioning)

## Motivation

Organs are installed wholesale: registered in the process table or
manifest and attached. Biology develops instead: a stem cell becomes a
neuron through stages — specification, growth, wiring, myelination,
optimization — each stage gated, each reversible. The intake's claim:
UCH organs should _develop_ from primitive building blocks through a
canonical developmental program — Specification → Scaffold → Primitive
Function → Sensory Wiring → Memory Wiring → Signal Wiring → Behavior →
Optimization — rather than being installed as monolithic plugins.
This is genuinely novel relative to the corpus: embryology (IDEA-0039)
describes the _workspace's_ developmental stages; morphogenesis
describes the _organ's_ — the same program, applied at organ
granularity, with elemental primitives (IDEA-0023) as the building
material and manufacturing gates (IDEA-0013) as the quality control.

## The corpus cannot cover it because

There is no developmental program for organs: registration is atomic
(manifest/process table), there is no scaffold stage, no incremental
wiring, no stage gates with evidence requirements. Embryology is
workspace-level (Conception → Civilization), not organ-level;
manufacturing (IDEA-0013) assumes CIR-stage stations for _reasoning
work_, not for _organ growth_. Elemental primitives (IDEA-0023) and
the object lifecycle (IDEA-0056) exist as proposals but nothing
composes them into a growth program.

## Proposal sketch

- Canonical developmental program for every organ: Specification →
  Scaffold → Primitive Function → Sensory Wiring → Memory Wiring →
  Signal Wiring → Behavior → Optimization; each stage produces a
  verifiable artifact (spec, scaffold, functioning primitive,
  wiring receipts, behavior test, optimization report).
- Stage gates use the engineering-chain evidence contract: a stage
  advances only with evidence; gates are constitution-checked (the
  scaffold's primitive function must not violate Laws).
- Building blocks: elemental primitives (IDEA-0023) are the material;
  the object lifecycle (IDEA-0056) is the bookkeeping; development is
  ledgered end-to-end so any stage is replayable (ADR-002).
- Morphogenesis composes with embryology: the organism's stage
  determines which organs may start developing (stage-dependent
  activation, IDEA-0039).

## Risk assessment

- Half-grown organs: a development interrupted mid-wiring must yield a
  dormant scaffold (never a half-functional organ claiming readiness) —
  health registry states (IDEA-0070) cover this.
- Development cost: growth is budgeted work (DMA-style background,
  IDEA-0030); no organ develops on the hot path.

## Where it lands

- `src/kernel/process/` (development program + stage ledger),
  `src/kernel/morphogenesis/` (program engine), process table (dormant
  scaffold states).

## Code impact

- None until the developmental program is specified; the WS-A process
  model + engineering-chain + elemental primitives are the seed.

## Next stage

- Design the program for one small organ (e.g., a sensor, IDEA-0030
  style) as the proof case; then prototype scaffold → primitive
  function on it.
