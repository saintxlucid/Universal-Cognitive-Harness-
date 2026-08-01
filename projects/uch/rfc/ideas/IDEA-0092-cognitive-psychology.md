# IDEA-0092 — Cognitive Psychology

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 computational-cognitive-science intake
  (round 12) — "Curiosity, Habituation, Cognitive bias detection,
  Selective attention, Goal persistence, Cognitive dissonance, Decision
  fatigue, Overconfidence detection — not to imitate human flaws, but
  to understand and compensate for them."
- **Related:** Psychology-family laws (6 Habit, 7 Uncertainty, 13
  Curiosity, 24, 25, 26 — laws declare psychology), src/cortex_kernel/
  attention-cortex.ts + integrator.ts (selective attention), decision
  law (IDEA-0034 — overconfidence detection, calibration fences,
  IDA-style value of information), src/cognitive-plane/calibration/
  voice-gate.ts + fences (calibration), IDEA-0077 (human factors
  model — per-user workflow optimization), IDEA-0037 (thermodynamics —
  fatigue as load/heat), IDEA-0086 (belief propagation — contradiction
  ripple as dissonance), IDEA-0093 (attention algebra), ux-charter
  (interruptibility), mnemosyne retrieval (attentional weight)

## Motivation

Psychology is the only discipline in the twelve that the corpus
declares but does not operate. Laws 6/7/13/24/25/26 name habits,
uncertainty, and curiosity; the AttentionCortex implements selective
attention; the decision law detects overconfidence. But there is no
_psychology discipline_ — no catalog of mechanisms with named
triggers, responses, and compensation loops. The intake's claim is
that the organism needs its own psychology, explicitly modeled not to
imitate human flaws but to detect and compensate for them: curiosity
drives exploration, habituation stops it, dissonance flags belief
conflicts, fatigue explains degraded decisions, and each mechanism
has a check → correct → learn loop.

## The corpus cannot cover it because

The mechanisms are scattered and unnamed. Curiosity has no mechanism
(the decision law's information-gain term is the closest — it
literally implements curiosity as expected information gain, but is
not exposed as a psychology behavior). Habituation has no mechanism
(novelty attenuation exists inside the integrator's attention
adjustment but is unnamed and uncompensated). Dissonance has no
trigger (the contradiction ripple of IDEA-0086 is the natural one,
unwired). Fatigue has no model (energy budgets exist; decision
fatigue — degraded policy adherence under depletion — is unstated).
Bias detection exists only as overconfidence fences; no bias catalog,
no compensation.

## Proposal sketch

- Mechanism catalog with named entries, each bound to an existing
  organ: curiosity (information-gain-driven exploration, IDEA-0034's
  IG term), habituation (novelty-attenuated attention, integrator),
  selective attention (AttentionCortex — already built), goal
  persistence (intent objects + scheduler priority, IDEA-0075),
  dissonance (contradiction ripple trigger, IDEA-0086), decision
  fatigue (policy adherence degrading as energy depletes, IDEA-0037),
  overconfidence detection (calibration fences — already built).
- Compensation loop per mechanism: detect (a named observable,
  IDEA-0071 SLO where possible) → correct (a bounded response) →
  learn (feed the taste/learning organs). Compensations are
  deliberate asymmetries — e.g., fatigue triggers _more_ verification,
  not less; curiosity is _budgeted_ so exploration never starves
  exploitation.
- Psychology is observable: mechanisms report to health/SLOs; the
  observatory (IDEA-0014) can show the organism's psychological state
  the way a dashboard shows CPU load.

## Risk assessment

- Anthropomorphism theater: mechanisms must be defined as
  compensations with measurable effects, never as human-emulation
  flavor; each catalog entry requires a falsifiable observable.
- Loop feedback: a compensation loop must not feed itself (fatigue
  compensation raising verification load) — bounds and budgets gate
  every correction.

## Where it lands

- `src/cognitive-plane/psychology/` catalog + compensation wiring into
  attention, intent, and energy organs.

## Code impact

- None until the catalog is specified; decision-law IG, the
  AttentionCortex, and budgets are the seed.

## Next stage

- Prototype curiosity: information-gain-driven exploration scheduling
  over the decision law, with a starvation guard.
