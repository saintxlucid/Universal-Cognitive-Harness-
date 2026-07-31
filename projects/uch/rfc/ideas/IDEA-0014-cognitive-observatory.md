# IDEA-0014 — Cognitive Observatory

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "NASA mission control, not logs and
  Grafana: a living MRI of cognition — watch attention move, knowledge flow,
  signals propagate, confidence rise, entropy drop"
- **Related:** trace ledger (ADR-002), cognitive replay, cognitive time
  machine, connectome, engineering-intelligence, IDEA-0011 (physiology)

## Motivation

Inspect the organism, not its logs. A live view of cognitive state:
attention moving, knowledge flowing, signals propagating, ideas forming,
confidence rising, entropy dropping, learning occurring. The prescriptive
layer ("why / should / next / intervene") is the Phase-02 frontier beyond
observation.

## The corpus cannot cover it because

The ledger is after-the-fact and event-oriented; replay and the Time Machine
reconstruct the past. There is no live cognitive-state projection and no
visualization surface; the observatory prescriptive layer is noted as a
frontier but not designed.

## Proposal sketch

- Observatory = live projection of the physiology vector (IDEA-0011), signal
  fabric pressure (IDEA-0010), field activity (IDEA-0006), and graph motion.
- Surface-first: MCP/CLI cognitive-state endpoint and trace visualization;
  UI later.
- Every chart must map to a decision it informs, else it is cut (anti-metric-
  zoo rule, shared with IDEA-0011).

## Risk assessment

- Visualization theater: pretty charts that change no decision are debt.
- The prescriptive layer depends on observation being trusted first.

## Where it lands

- Design doc `design/OBSERVATORY.md`; Phase-02 frontier with the digital twin
  (IDEA-0012).

## Code impact

- None initially; a live cognitive-state endpoint is the minimal prototype.

## Next stage

Live cognitive-state endpoint + minimal trace visualization; then decide
whether the prescriptive layer is justified by how operators use it.
