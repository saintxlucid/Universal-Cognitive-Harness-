# IDEA-0033 — Cognitive Firmware

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "stop thinking of skills as
  prompts; think of them as cognitive firmware. Firmware changes how the
  organism *behaves*, not what it knows" — a ten-layer firmware stack:
  Survival (reality sync, truth, context, memory), Engineering
  (architecture, refactoring, pattern synthesis, debt scan, organic
  code), Thinking (simulation, counterfactual, devil's advocate, red
  team, systems thinker, tradeoff), Scientific (evidence, hypothesis,
  experiment, statistics, causality), Creativity (idea, analogy,
  constraint breaking, first principles, concept fusion), Meta
  (self-critic, self-reflection, learning, skill evolution, benchmark,
  capability optimizer), Software Manufacturing (requirements, architecture,
  risk, test, documentation, deployment), Cognitive Enhancement
  (curiosity, taste, intuition, wisdom, philosophy, ethics), Executive
  (strategy, opportunity, ROI, resource allocation, decision), Evolution
  (mutation, selection, genome optimization, capability discovery,
  research)
- **Related:** ADR-006 (kernel services), MANIFESTO §6 (organs),
  `.agents/skills/` (skills), src/cognitive-plane, VISION.md §10
  (capability hierarchy)

## Motivation

The claim: the capability hierarchy should be Laws → Kernel Services →
Firmware → Accelerators → Organs → Skills → Drivers → Applications, with
Firmware as a distinct tier. Skills are composable workflows a caller
invokes; organs are specialized systems built on the kernel; firmware is
the permanent behavioral layer — behaviors that run continuously and
change how the organism behaves, not what it knows. Most of the ~55 named
engines in the ten layers already have corpus ancestors (truth → integrity
laws + structuredFacts; organic code → OrganicScoreEngine; simulation →
IDEA-0012; meta → self-evolution DBs; economics → IDEA-0016); the delta
is the *category* and its lifecycle rules.

## The corpus cannot cover it because

Skills are static instruction sets; organs are subsystems with contracts;
nothing defines a permanent behavior tier with its own activation policy
(always-on vs event-triggered), energy budget, measurement, and governed
self-update (the "Skill Evolution" engine — firmware that rewrites
itself).

## Proposal sketch

- Define the Firmware contract: name, behavior contract, trigger
  conditions, activation energy, telemetry, learnable parameters,
  governance path for self-modification.
- Catalog existing organs/skills against the ten layers; unclaimed
  engines become candidate firmware with a first-class home.
- The hierarchy formalizes where every new capability lands — no more
  isolated modules.

## Risk assessment

- Taxonomy theater: each firmware unit must change measurable behavior
  (telemetry deltas), or it is a renamed skill.

## Where it lands

- Design doc `design/FIRMWARE.md`; MANIFESTO §6 amendment; VISION.md §10.

## Code impact

- None until the contract is defined; first step is a catalog of existing
  subsystems against the ten layers.

## Next stage

Catalog existing organs/skills against the ten layers; identify the
smallest set of genuinely new behaviors that earn firmware status.
