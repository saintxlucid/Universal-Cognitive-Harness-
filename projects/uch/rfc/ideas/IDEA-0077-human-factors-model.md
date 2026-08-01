# IDEA-0077 — Human Factors Model

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "The organism should know Expertise, Stress, Focus, Fatigue,
  Communication Style, Risk Tolerance, Review Style, Decision Style.
  Not personal profiling. Workflow optimization."
- **Related:** IDEA-0041 (cognitive anthropology — de-identified team
  behavior model, privacy-governed), design/COGNITIVE-MIDDLEWARE.md
  (genome stages in the middleware pipeline), src/context/gatherer.ts
  (workspace context collection), IDEA-0063 (resource allocator —
  attention/tokens/depth), IDEA-0034 (decision law — risk tolerance as
  a parameter), IDEA-0039 (embryology — stage-dependent behavior),
  DIRECTION/SOP (review styles in workflow), budgets (energy limits)

## Motivation

Software tools tune themselves to their users' workflows — editor
settings, review habits, risk profiles. A cognitive organism working
alongside a human should know the *work posture*: expertise (what can
be delegated, what needs hand-holding), stress and fatigue (when to
simplify, when to stop), focus (what is interruptible), communication
style (how to report), risk tolerance (when to flag vs. when to
proceed), review and decision styles (how to present options). The
intake's framing is precise: this is not profiling — it is workflow
optimization, the same parameters a good senior engineer tracks about
their collaborator.

## The corpus cannot cover it because

IDEA-0041 (anthropology) models *teams* de-identified and
privacy-governed — it is a research layer, not a per-user operating
parameter. The decision law (IDEA-0034) has risk and utility terms but
no declared risk-tolerance profile source; the scheduler knows task
priorities, not human focus; budgets know energy, not fatigue. Nothing
in the corpus reads "the human is stressed, simplify the plan" —
because no human-state model exists.

## Proposal sketch

- A human-factors profile per user: eight fields (expertise, stress,
  focus, fatigue, communication style, risk tolerance, review style,
  decision style), each with observable sources (interaction patterns,
  explicit settings, stated preferences) and confidence.
- Privacy governance from day one (mirrors IDEA-0041): the profile is
  local, user-owned, user-editable, and never shared into collective
  stores without consent; everything is derived from observed *work
  signals*, not personal data.
- Consumption points: the decision law seeds risk tolerance; the
  scheduler weights focus (IDEA-0063); reporting organs shape output to
  communication style; the review workflow adapts to review style.

## Risk assessment

- Creep: a human-factors model is one export away from surveillance.
  The constitution's information-integrity laws apply; the profile
  must be *opt-in visible* (the user can read and delete it), and its
  only outputs are workflow adjustments, never judgments.

## Where it lands

- `design/HUMAN-FACTORS.md`; consumes gatherer signals; feeds the
  decision law and scheduler.

## Code impact

- None until the profile schema and privacy rules are specified.

## Next stage

- Profile schema drafted with only observable, user-verifiable
  sources; one consumption point (risk tolerance → decision law)
  prototyped.
