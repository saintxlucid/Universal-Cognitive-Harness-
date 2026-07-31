# IDEA-0043 — Cognitive Astronomy + Instruments

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "projects as galaxies: clusters,
  gravity, orbits, expansion, collision; knowledge becomes cosmic" and
  "cognitive instruments — not tools, scientific instruments: Architecture
  MRI, Dependency Microscope, Knowledge Telescope, Refactoring Particle
  Accelerator (millions of candidate refactorings → Pareto frontier),
  Cognitive DNA Sequencer, Entropy Spectrometer, Architecture
  Seismograph (structural instability before it becomes visible),
  Knowledge X-Ray (hidden assumptions)"
- **Related:** IDEA-0014 (cognitive observatory — the viewing surface),
  engineering-intelligence scanners, ADR-002 (trace engine), connectome,
  workspace graphs, IDEA-0012 (digital twin — required substrate for
  the particle accelerator), IDEA-0035/0036 (entropy/topology as
  measurements), IDEA-0008 (DNA sequencer over the genome)

## Motivation

The observatory is a live view of cognition; the claim is a *lens
taxonomy* — instruments with defined inputs and falsifiable output
artifacts. The Refactoring Particle Accelerator is the flagship: run
millions of candidate refactorings in simulation and return a Pareto
frontier (impact vs risk/cost) — never modify, simulate first. The
Seismograph predicts structural instability from evolution history
before failures surface.

## The corpus cannot cover it because

Observatory + scanners render current state; no instrument catalog with
input/output contracts exists, no simulator substrate is wired for
massive parallel refactoring runs (requires IDEA-0012), and no
instability-prediction instrument exists.

## Proposal sketch

- Instrument catalog: input (world model / graphs / genome / traces) →
  output artifact (MRI images of coupling, X-ray of assumptions,
  spectrum of entropy, Pareto frontier of refactorings).
- Seismograph: instability metrics over evolution history (WS-E-style
  band logic applied to failure precursors).
- Instruments read-only by law: the particle accelerator is a
  simulation consumer, never a mutator.

## Risk assessment

- Imaging theater: every instrument must return a falsifiable artifact
  against real data, or it is decoration.

## Where it lands

- Extends IDEA-0014; design doc `design/COGNITIVE-INSTRUMENTS.md`.

## Code impact

- None until the catalog is defined; Architecture MRI could prototype
  first over workspace graphs.

## Next stage

Define the Architecture MRI input/output contract over workspace
graphs; prototype a seismograph over recorded failure history.
