# IDEA-0120 — Runtime Composition (multi-runtime orchestration)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 cognitive-architecture intake (round 16,
  second half) — "Runtime Composition: imagine one engineering task
  instead of using one agent: Planning → Claude; Reasoning → GPT;
  Implementation → Codex; Verification → Gemini; Security → OpenCode;
  Memory → UCH. The developer interacts with one organism. Not six
  products."
- **Related:** ADR-004 (fabric dispatch — model/provider-level
  routing per call; composition is the task-level extension),
  IDEA-0119 (cognitive reverse index — the routing substrate for
  stage assignment), IDEA-0046 (accelerator catalog), IDEA-0065
  (consensus layer), IDEA-0047 UER (cross-host causal graph — the
  audit spine of a composed episode), ADR-005 (Episode — one episode
  spanning hosts), attach + ProjectionEngine (isolation across
  participants), IDEA-0075 (intent objects — the composition input),
  IDEA-0034 (decision law — stage allocation by EU/IG under
  energy/risk), IDEA-0109 (AHP — a shipping multi-agent session
  substrate, the composition pattern appearing in a vendor product),
  IDEA-0121 (lifecycle hooks — the handoff contract per stage),
  multiAgentConsensus (precedent), INTEGRATION-LEVELS (per-host
  capability grading)

## Motivation

The corpus routes _compute_ — ADR-004 dispatches calls across
providers by tier/cost/latency, and the fabric reroutes on failure.
The intake's claim is one level up: route _tasks_, decomposing an
engineering job into stages and executing each stage on the
best-verified runtime ("planning on Claude, implementation on Codex,
verification on Gemini, security on OpenCode") while the developer
interacts with one organism. This is the composition pattern AHP
(0109) is shipping inside VS Code — one host, many engine adapters,
one session model — extended across products and made evidence-
driven by the reverse index (0119).

## The corpus cannot cover it because

- ADR-004's fabric routes calls within one harness's runtime; no
  mechanism decomposes an intent into stages and hands each stage to
  a _different_ harness with session-level continuity.
- The Episode model (ADR-005) and UER (0047) can _record_ a composed
  episode, but no orchestrator _produces_ one — composition is an
  unowned execution pattern, not a pipeline.
- Handoff semantics (how a checkpoint on Codex becomes a verified
  starting point on Gemini) exist only as attach/session mechanics,
  not as a stage-contract with gates.

## Proposal sketch

- **Stage decomposition**: intent (0075) → stages (plan, implement,
  verify, security, ...) with per-stage success criteria (the
  manufacturing gate pattern of IDEA-0013).
- **Assignment**: each stage routed via the reverse index (0119) to
  the best-verified runtime for its capability set; decision law
  (0034) weighs expected utility, information gain, energy, risk.
- **Handoff contract**: stage output checkpointed (0121 lifecycle,
  WS-D transactions), Live Cognitive State (uch.cognitive-state.v1)
  carries the stage summary, the next stage attaches (attach/PID
  join semantics) — no chat-text copying; state transfers via
  checkpoints.
- **Audit spine**: the whole composition is ONE Episode (ADR-005);
  UER (0047) links each host's traces by traceparent, so "one
  organism" is provable — one causal graph, not six log silos.
- **Isolation**: each stage runs in its own VCM (WS-A process
  model); a failing stage cannot corrupt another's state.

## Risk assessment

- Handoff fidelity: state must transfer via checkpoints and
  structured state, never prose — the L3 observable-only rule.
- Energy/latency budgets: composition multiplies handoffs; budgets
  (0016/0037) must bound stage count and rerouting.
- Vendor surface drift: stages depend on per-runtime capabilities;
  fingerprints (0102) and verified-level serving (0105) gate stage
  eligibility.

## Where it lands

- Control-plane orchestration over attach + ledger + UER;
  CLI `uch compose <intent>`; per-stage gates in the manufacturing
  pattern (0013).

## Code impact

- None until designed; seeds are ADR-004 scheduler, attach/PID
  semantics, UER ingestion (uer-ingest.ts), intent objects (0075),
  decision law (0034).

## Next stage

- Research register (stage taxonomy: planning/reasoning/
  implementation/verification/security; handoff semantics in AHP vs
  attach); prototype: compose one task across two real runtimes and
  assert single-episode lineage in UER.
