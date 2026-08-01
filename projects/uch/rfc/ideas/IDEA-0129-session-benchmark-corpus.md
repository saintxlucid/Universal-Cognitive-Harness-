# IDEA-0129 — Session-Benchmark Corpus (every engineering session becomes a benchmark)

- **Status:** Idea (SOP-08 stage 1 — no code)
- **Origin:** 2026-08-01 reimplementation-objective intake (round 19) —
  "The largest moat isn't IR. It's replay. Observe → Plan → Execute →
  Checkpoint → Replay → Compare → Benchmark → Optimize. Now every
  engineering session becomes a benchmark. Eventually you have
  millions of engineering episodes. No competitor has that."
- **Related:** ADR-002 (trace ledger + replay), IDEA-0047 UER
  (causal graph; P2 = real ledger + git ingestion), cognitive time
  machine (beliefsAt/diffBeliefs), EI benchmark runner + corpus
  (17 training + 16 held-out labeled cases — synthetic, not
  captured), IDEA-0018 (benchmark methodology), IDEA-0128
  (profiler — per-session attribution), IDEA-0012 (digital twin —
  what-if over episodes), WS-D (checkpoint/commit points),
  engineering-learning loop (taste reinforcement)

## Motivation

The benchmark corpus today is synthetic (17 + 16 labeled cases with
fresh wording). A real session corpus is different in kind: every
engineering session — a migration, a refactor, an incident — becomes
a replayable, comparable episode (state before, proposed changes,
verdicts, costs, outcomes). Replay (ADR-002) + comparison
(profiler 0128) turn episodes into benchmarks; benchmarks train
taste (learning loop); the corpus compounds: adoption adds episodes,
episodes add gravity. "Millions of engineering episodes" is the
moat claim — a dataset no competitor can reimplement because it is
the byproduct of real engineering, not authoring.

## The corpus cannot cover it because

UER P1 is a deterministic in-memory graph with traceparent ingestion;
its P2 (real ADR-002 ledger ingestion + git) is planned but not
executed. The EI corpus is labeled by hand; no pipeline captures a
real session and labels it (goal, actions, verdicts, cost profile).
The time machine can re-query beliefs, but nothing persists a session
as a first-class benchmark episode with comparison semantics
(replay → compare → optimize). Checkpoints exist (WS-D) but are not
harvested into a corpus.

## Proposal sketch

- **Episode capture (P1):** at session end (and at WS-D commit
  points), persist an episode envelope — goal/intent (0075), action
  record from UER, verdicts from the decision journal, cost profile
  from the profiler (0128), outcome/acceptance evidence — into a
  versioned corpus store (IDEA-0049 storage contract).
- **Episode replay/compare (P2):** replay the deterministic subset
  (CIR/CP ops), re-run the engineering evaluator over the episode
  (EI runner), emit per-episode benchmark rows (costs, vetoes,
  verdicts) — the corpus becomes the training data for the learning
  loop and the calibration data for the decision law (IDEA-0034).
- **Optimization loop:** benchmark-driven prioritization — recurring
  cost patterns from the corpus feed the observatory (0014), the
  twin (0012) simulates alternatives over captured episodes.
- **Privacy:** episodes are de-identified per governance (IDEA-0041
  privacy rules; PRIVACY-ERASURE.md); capture is opt-in per
  workspace.

## Risk assessment

- Capture burden: capture must be zero-effort (session-end hook) or
  it will not happen; start with the hook, not the pipeline.
- Benchmark validity: replaying a session is not the same as
  re-running it (LLM nondeterminism) — the corpus benchmarks the
  _deterministic_ layer (decisions, costs, verdicts) and treats
  model output as opaque, per the CVM delegated-op rule.
- Privacy: episodes contain real work; de-identification and
  consent are gating, not afterthoughts.

## Where it lands

- Extends UER (IDEA-0047) P2; design doc `design/SESSION-BENCHMARK-CORPUS.md`; corpus store via IDEA-0049.

## Code impact

- None at SOP-08 stage 1. Later: episode capture hook in the
  exoskeleton session lifecycle; replay-compare runner alongside the
  EI benchmark runner.

## Next stage

UER P2 first (real ledger + git ingestion); then the capture hook;
then corpus schema.
