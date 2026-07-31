# 04-02-SUMMARY.md — Brain/Suit Separation, Wave 1 (GREEN)

**Executed:** 2026-07-31 by OpenCode (autonomous)
**Plan:** `04-brain-suit-separation/04-02-PLAN.md` (wave 1)
**Depends on:** 04-01 (RED scaffold + CognitiveCore — landed by parallel wave, verified)

## What shipped

### Task 1 (pre-landed by parallel wave, verified this session)
- `src/exoskeleton/immune.ts` + `endocrine.ts` → `src/cognitive-core/` (rename, staged in git)
- `src/index.ts` exports updated to `./cognitive-core/immune.js` + `endocrine.js` + new `CognitiveCore`/`CognitiveCoreConfig` exports (lines 543-548)

### Task 2 (pre-landed, verified this session)
- `src/cognitive-core/cognitive-core.ts` (241 lines): owns all 20 cognitive organs + trace ledger + aether loop; import firewall clean; 6 metabolism components (exoskeleton/aether/endocrine/immune/sleep-cycle/reflex); 3 aether registrations (endocrine/immune/hippocampus); connectome seeds + consciousness feed; lifecycle D-05; `agentId` honors 'exoskeleton' override
- `src/cognitive-core/index.ts` — export surface
- `src/__tests__/cognitive-core.test.ts` — 14 cases + import firewall, GREEN

### Task 3 (executed this session)
- **`src/exoskeleton/exoskeleton.ts` refactored (793 → ~700 lines):**
  - `readonly core: CognitiveCore` declared first; 20 cognitive members now delegate by reference to `this.core.X` (zero construction in the suit — `new CognitiveKernel|WorkspaceBrain|Connectome|SleepCycle|ImmuneSystem|EndocrineSystem|AetherCore|TraceRecorder|NeuralEventBus` all absent)
  - Constructor order: config → suit infra (tools/permissions/history/model) → control plane (auth/secrets/policies/budgets/otlp/lifecycle/plugins) → suit intelligence (codeScorer/reflexEngine) → **core** (governance instances injected) → delegates → suit companions (frameworkTracer, engineeringEnrichment, metabolism `engineering` component) → drivers → registerCoreServices → setupPolicies → framework-connectome wiring → fastPath
  - Lifecycle: `start()` = `core.start()` → `lifecycle.startAll()` → `session:started`; `stop()` = `session:ended` → detach transports → `lifecycle.stopAll()` → `core.stop()`
  - `registerCoreServices`: `trace-persistence` + `aether` services removed (core owns them); `otlp-exporter` deps → `[]`
  - `getState()` reads `core.getState()`; `getStats()` = `{ ...core.getStats(), transports, litmus, instinct, frameworks, reflex, agentic }` — all prior keys preserved
  - Suit keeps suit intelligence: code scorer, reflex engine, fast-path (7 routines incl. 5 framework engines), agentic engine, LLM adapter, transports, engineering enrichment, framework tracer
  - **Framework-connectome wiring retained in the suit** (`wireFrameworkConnectome`) — plan written before the frameworks wave; `framework-trace-consumption.test.ts` asserts connectome links from framework events, so the subscription is suit intelligence, not core wiring
  - `metabolism.registerComponent('engineering')` kept (7th component) — parallel-wave addition, required by existing behavior

## Fixes landed in the same session (prerequisite gates)

- 9 typecheck errors eliminated: `TraceEventType` union extended (`framework_select/complete/error`), `WorkspaceDecisionGraph.search()` added (reflex-check contract), `ReflexGate` eventSink typed to `Omit<NeuralEvent,'id'|'timestamp'>`, `EventType` import resolved (parallel-wave churn)
- `executive-brain/decision-engine.ts` TS2783 bug: `{ problem: prompt, ...profile }` spread overwrote the prompt — now `{ ...profile, problem: prompt }`
- **FileEditor gate interception implemented** (reflex wave): `gate?: ReflexGateLike` config, block/defer short-circuit before ANY fs mutation on write/edit/insert/append/deleteLines/delete; original-path targets; `blocked`/`deferred` messages
- **Reflex determinism flake killed**: test now strips `duration_ms` (a real timing measurement) before `toEqual` — 5/5 stable runs

## Gates

| Gate | Result |
|---|---|
| Full suite | **133 files / 2,140 tests / 2,140 passed (0 failures)** |
| `tsc --noEmit` | exit 0 |
| `tsc` (build) | exit 0 |
| `eslint` (changed scope) | 0 problems |
| Structural checks | no organ construction in suit; `readonly core` first; delegates by reference |

## Notes / follow-ups

- **Behavior shift (accepted, per locked contract):** the suit's `sleepCycle` is the core's 4-arg instance — it no longer receives the `300000` deepSleep interval or the frameworkTracer `getDominantPerProblemType` stats provider that the pre-refactor suit wired (the parallel frameworks wave added them). Framework-pattern distillation in sleep still works via isolated `SleepCycle` construction (tests) and the connectome wiring; re-wiring the stats provider into the core's sleep cycle is a candidate for wave 04-03 (core injection + optional `SleepFrameworkSource` config field — additive, does not break 04-01 locked surface)
- 04-02's written acceptance criteria reference the pre-fix baseline (2,081 + 9 failures); actual gate exceeded it (2,140 / 0 failures — the 9 reflex failures were fixed in this session's prerequisite wave)
- Wave 04-03 (detachment + `uch daemon`) and the MANIFESTO §6 module-path docs update remain pending
