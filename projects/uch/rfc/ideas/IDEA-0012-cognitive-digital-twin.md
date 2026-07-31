# IDEA-0012 — Cognitive Digital Twin (executable)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "a complete executable twin; millions
  of simulated futures before touching one line — CFD for software"
- **Related:** src/workspace-graphs, src/control-plane/projections,
  src/cognitive-plane/replay, IDEA-0001 (equations), IDEA-0005 (calculus)

## Motivation

A continuously maintained executable model of the workspace: architecture,
dependencies, data flow, ownership, patterns, hotspots, technical debt, risk,
knowledge, intent. Before a change, the runtime simulates its impact — "what
if I delete this service?", "what if I change this interface?" — instead of
guessing. CFD-style simulation rather than heuristics.

## The corpus cannot cover it because

Projections and workspace graphs are state models; the Time Machine answers
"what did we believe at t?"; nothing answers "what will happen if…?". There
is no scenario runner, no mutation→propagation→measure loop.

## Proposal sketch

- Twin = workspace graphs + physics equations (IDEA-0001) + scenario runner.
- Scenario: mutate (delete service / change interface / swap language) →
  propagate along graph edges with measured weights → report deltas in
  coupling, debt (IDEA-0015), risk, build health, blast radius.
- Batch runs with energy caps (simulation cost is a budget like any other).

## Risk assessment

- Simulation validity: a wrong model confidently predicts. Start with
  qualitative propagation over the real graphs; add equations only where a
  historical validation exists (does the simulation reproduce past refactors?).
- This is the Phase-02 frontier item ("what-if simulation") — high value,
  high difficulty; do not start before the graphs are trusted.

## Where it lands

- Design doc `design/DIGITAL-TWIN.md`; GAP-CLOSURE-PLAN Phase 02.

## Code impact

- None until a validation study: replay past real refactors through the
  scenario runner and measure prediction quality.

## Next stage

Scenario runner over existing workspace-graphs; validate against git history
of real refactors before trusting any prediction.
