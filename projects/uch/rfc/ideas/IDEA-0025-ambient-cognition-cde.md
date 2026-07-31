# IDEA-0025 — Ambient Cognition and the CDE

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "the runtime should disappear:
  developers should experience Workspace Intelligence, not UCH — ambient,
  invisible, exactly how TCP or virtual memory are invisible today; the IDE
  becomes one viewport into a persistent cognitive system (CDE — Cognitive
  Development Environment)"
- **Related:** VISION.md, design/ADR-005 (attach), design/LIVE-COGNITIVE-STATE,
  IDEA-0024 (CSE roadmap)

## Motivation

TCP and virtual memory won by disappearing: nobody "uses TCP", the stack
just works. The claim: UCH's endgame is the same — the runtime is ambient,
and what developers experience is Workspace Intelligence. The CDE is the
product framing of that: IDE → viewport; the engineering environment is a
persistent cognitive system, not a tool that starts and stops.

## The corpus cannot cover it because

Attach/ADR-005 gets agents into the organism, but the experience surface is
still tool-centric (drivers adapt tools to UCH). There is no "ambient
surface" framing — a persistent workspace intelligence that the tool merely
renders — and no CDE product definition.

## Proposal sketch

- Ambient layer: Live Cognitive State + workspace graphs + twin
  (IDEA-0012) presented through any viewport (IDE, CLI, web) as the same
  persistent thing.
- CDE definition: the viewport contract (what every IDE-embedded view shows:
  organism state, physiology, signals, history), independent of any vendor.
- Success test: a user cannot tell where UCH starts and the workspace ends.

## Risk assessment

- Ambient is a UX claim; it must be measured (time-to-context, perceived
  latency), not announced.

## Where it lands

- Design doc `design/CDE.md`; observatory (IDEA-0014) is the first viewport.

## Code impact

- None until the observatory and twin exist; the CDE contract is a
  specification of surfaces, not a new subsystem.

## Next stage

Define the viewport contract against Live Cognitive State; prototype one
ambient view (workspace intelligence panel) in the observatory.
