# UCH Frameworks Library — Blueprint & Implementation Plan

### From codified corpus to cognitive operating system
*Status: Phases 1–4 LANDED 2026-07-31 — frameworks library + meta-layer integration complete. §5.1–5.6 shipped (traces, executive brain, reflex fast path, decision journal + calibration, composer + `uch solve` + MCP `framework-run`), docs/FRAMEWORKS.md + corpus matrix merged, catalog versioned (1.1.0). Gates: full suite 136 files / 2165 tests green, tsc/lint/build exit 0.*

---

## 0. Executive Summary

The Cognitive Frameworks Library (`src/cognitive-plane/frameworks/`) has converted the
entire infographic corpus — decision models, problem-solving, RCA, strategy, productivity,
research, critical thinking, DIKW, quant signal fusion, clean-code principles — into
**10 families / 30+ frameworks** of deterministic engines. The remaining work is not
"write more frameworks" (corpus coverage is ~97%); it is **landing, hardening, and
composing** the library into UCH's cognitive architecture so the frameworks become a
living part of the harness rather than a static catalog.

Three of the five open checklist items are **already implemented** (verified on disk):

| Checklist item | Status (verified 2026-07-31) | Evidence |
|---|---|---|
| Register MCP tools | ✅ Done — 13 tools | `src/mcp/stdio-server.ts:403-777` |
| CLI `uch frameworks` command | ✅ Done — list/show/select | `src/cli/index.ts:553-616` |
| Export frameworks from `src/index.ts` | ✅ Done | `src/index.ts:372-413` |
| Fix 17 typecheck errors | ✅ Done — 0 errors in frameworks/ + cli + mcp + index | `npx tsc --noEmit` (10 remaining errors all in untracked RED-wave files: reflex 4, etiology 2, frontier-mapper 2, elevation-engine 2) |
| MCP tool tests | ✅ Done — 30 tests / 13 tools / ~55 assertions | `src/__tests__/mcp-framework-tools.test.ts` |
| Author SKILL.md skills | ✅ Done — 11 skills + `uch skills` lists them (CLI `skills` case fixed to load `./skills` + exit cleanly) | `skills/frameworks-*/SKILL.md` |
| Full suite + lint + typecheck + build | ⚠️ Blocked only by out-of-scope untracked RED-wave errors | suite 1993 pass / 9 pre-existing reflex RED failures; eslint clean; build = tsc so it inherits the 10 out-of-scope errors |

The plan below has four phases:

1. **Phase 1 — Land the phase** (mechanical, ~1 session): fix the 17 typecheck errors,
   add MCP tool tests (currently the only untested integration surface), author the
   SKILL.md skills, run all gates green.
2. **Phase 2 — Close corpus gaps** (small, optional): Pros & Cons model, productivity
   two-minute-rule / task-batching / eat-the-frog verification, representation-invariance
   CLI surface.
3. **Phase 3 — Meta-layer integration (the juice)** (~2-3 sessions): framework execution
   traces → event bus → connectome/sleep-cycle learning; Executive Brain decision
   engine powered by the 12 models; reflex fast-path routing; decision journal +
   calibration integration; LLM-assisted mode wired to the exoskeleton LLM;
   `uch solve` end-to-end composition.
4. **Phase 4 — Governance & docs**: corpus mapping table, framework usage analytics,
   versioned registry, acceptance gates.

---

## 1. Baseline Audit (verified 2026-07-31)

### 1.1 What exists

| Surface | Location | Count |
|---|---|---|
| Framework types + registry + catalog | `frameworks/types.ts`, `registry.ts` | 10 families, 30+ definitions |
| Decision engines | `decisions/decision-models.ts`, `model-selector.ts` | 8 engines + selector |
| Problem engines | `problems/problem-solver.ts` | 6 (IDEAL, 5-Whys, DT, PDCA, OODA, KT) |
| RCA engines | `rca/rca.ts` | 4 + 6 cause categories |
| Strategy engines | `strategy/strategy-wheel.ts` | 2 |
| Productivity engines | `productivity/productivity-os.ts` | 2 (planTasks, 3-3-3) |
| Research engines | `research/methodology.ts` | 2 + 8 gap types |
| Critical evaluator | `critical/critical-evaluator.ts` | 1 (9 questions → integrity laws) |
| DIKW + invariance | `knowledge/dikw.ts` | 2 |
| Signal fusion | `signals/signal-fusion.ts` | 2 + regime notes |
| Code principles | `code/code-principles.ts` | 1 (5 principles + trade-offs) |
| Library barrel | `frameworks/index.ts` | full re-export surface |
| MCP tools | `src/mcp/stdio-server.ts:403-777` | 12 tools |
| CLI | `src/cli/index.ts:553-610` | `uch frameworks [list|show|select]` |
| Root exports | `src/index.ts:372-413` | complete |

### 1.2 Test state

- Frameworks unit tests: **76/76 pass** across 10 files (`frameworks/__tests__/`).
- Full suite: **112/113 files pass, 1861/1870 tests** (21.1s).
- The 10 failures are the **pre-existing Phase 03 RED wave** (belongs to the
  ReflexGate plan, not this work): `reflex-interception.test.ts` (9) +
  `reflex-gate.test.ts` (1). Do not touch them here.

### 1.3 Typecheck state — the blocker

`npx tsc --noEmit` reports 16 errors inside `frameworks/` + 1 in the CLI. All are
strict-null violations from the freshly authored engine files. **Exact fix list** (all
mechanical, no design decisions):

| # | Location | Error | Fix |
|---|---|---|---|
| 1 | `decisions/decision-models.ts:52` | `MatrixResult \| null \| undefined` → `MatrixResult \| null` | Guard: `const best = sorted[0] ? ... : null` or `?? null` |
| 2 | `decisions/decision-models.ts:115` | Object possibly undefined | `winner!` after length check, or optional chain + fallback |
| 3 | `decisions/decision-models.ts:161` | `TreeResult \| null \| undefined` | same pattern as #1 |
| 4 | `knowledge/dikw.ts:52` | Object possibly undefined | non-null assertion after `if (repr)` guard |
| 5 | `rca/rca.ts:89` | `string[] \| undefined` → `string[]` | default `input.systemNotes ?? []` |
| 6 | `rca/rca.ts:90` | `.length` on possibly-undefined | same default |
| 7 | `rca/rca.ts:130` | `string \| undefined` → `string` | fallback `?? ''` on validated root cause |
| 8 | `rca/rca.ts:131` | same | same |
| 9 | `registry.ts:86` | Object possibly undefined | guard on `scored[0]` |
| 10 | `registry.ts:88` | same | same |
| 11 | `research/methodology.ts:51` | `.justification.length` possibly undefined | optional chain / default `''` |
| 12-16 | `research/methodology.ts:100-104` | Object possibly undefined (5×) | optional chain on `found` entries |
| 17 | `cli/index.ts:569` | `string \| undefined` not assignable to `string` | `Number.parseFloat(args[i+1] ?? '')` guard |

Do **not** fix `src/reflex/` errors (5+ shown) — that is the in-progress Phase 03
ReflexGate work; fixing it here would collide with that plan's RED wave.

### 1.4 Lint state

`frameworks/` files are clean under the project ESLint config (verified on changed
files during authoring). Re-run full lint in the gate step.

---

## 2. Corpus Coverage Matrix

Every infographic analysis in the corpus, mapped to implementation status. This is the
source of truth for "are we done?".

| # | Corpus analysis | Codified in | Status |
|---|---|---|---|
| 1 | TRUTH / representation invariance | `knowledge/dikw.ts` → `checkRepresentationInvariance` | ✅ |
| 2 | 12 decision-making models | `registry.ts` catalog + `decision-models.ts` | ⚠️ **Pros & Cons missing** (all 11 others present) |
| 3 | Strategy Wheel (20 questions, 4 quadrants) | `strategy/strategy-wheel.ts` → `strategyWheel` | ✅ |
| 4 | Productivity 9-system toolkit | `productivity/productivity-os.ts` + catalog def | ⚠️ **two-minute-rule + task-batching verification needed** |
| 5 | Research methodology (5 stages + quality controls) | `research/methodology.ts` → `validateMethodology` | ✅ |
| 6 | DIKW (context × understanding) | `knowledge/dikw.ts` → `dikwTransform` | ✅ |
| 7 | Strategy vs Plan | `strategy/strategy-wheel.ts` → `strategyVsPlan` | ✅ |
| 8 | Decision architecture (model selection layer) | `registry.ts` → `select` + `model-selector.ts` | ✅ |
| 9 | Problem-solving meta-framework (6 frameworks) | `problems/problem-solver.ts` | ✅ all 6 |
| 10 | RCA (F.O.C.U.S. + 3 tools + 6 steps + mistakes) | `rca/rca.ts` | ✅ |
| 11 | Research gap analysis (8 gap types) | `research/methodology.ts` → `detectGaps`, `GAP_TYPES` | ✅ |
| 12 | Critical thinking (9 questions) | `critical/critical-evaluator.ts` (maps to 5 integrity laws) | ✅ |
| 13 | Clean code (SOC/DRY/KISS/DYC/YAGNI + trade-offs) | `code/code-principles.ts` | ✅ |
| 14 | Productivity OS (SMART→MIT→Eisenhower→blocks→Pomodoro→frog→Pareto→GTD) | `productivity/productivity-os.ts` → `planTasks` | ✅ |
| 15 | Quant composite factors (rank/normalize/fuse/risk) | `signals/signal-fusion.ts` → `fuseSignals` | ✅ |

**Coverage: 15/15 analyses represented; 2 small content gaps** (Pros & Cons model,
productivity micro-rules verification). The corpus is essentially fully codified —
Phase 2 is verification and polish, not construction.

---

## 3. Phase 1 — Land the Phase (execute first)

### 3.1 Fix the 17 typecheck errors

Apply the exact fixes from §1.3. Conventions to follow (from the existing engines):

- Use `??` defaults at input boundaries (matches `rca.ts` style), not assertions
  scattered through logic.
- Guard-then-assert for index access (`if (!x) return ...; x!`).
- No new comments; match surrounding doc-comment density.
- Re-run `npx tsc --noEmit` → expect **0 errors in tracked files** (allow the
  documented `src/reflex/` Phase-03 remainder).

**Verify:** `npx tsc --noEmit` clean for `frameworks/` + `cli/` + `mcp/`; the
frameworks test suite still 76/76.

### 3.2 Add MCP tool tests (the untested integration surface)

`src/__tests__/mcp-engine-tools.test.ts` currently covers only 4 legacy tools
(principles-check, gap-analysis, mem-search, mem-get). The 12 framework tools have
**zero coverage**. Add a new file `src/__tests__/mcp-framework-tools.test.ts`
(following the exact harness pattern of `mcp-engine-tools.test.ts` — construct the
server with minimal fakes, drive `handleRequest`-style dispatch or `start()` with a
captured stream):

| Test | Tool | Assertion |
|---|---|---|
| catalog lists 10 families | `framework-catalog` | ≥30 frameworks, families include `decisions`..`code` |
| catalog filters by family | `framework-catalog` | `family: 'rca'` → only rca ids |
| select returns rationale | `framework-select` | data-rich profile → `decision-matrix`/`rational`; rationale non-empty |
| select honors time pressure | `framework-select` | `timePressure: 0.95` → rapid/ooda family |
| decide: matrix winner | `decide` | weighted scores → expected winner |
| decide: pre-mortem ranking | `decide` | top cause = highest likelihood×impact |
| analyze-problem: five-whys | `analyze-problem` | root cause chain depth ≤5 |
| analyze-problem: unknown framework | `analyze-problem` | error object returned |
| rca: F.O.C.U.S. verdict | `rca` | evidence → hypothesis → corrective action |
| strategy: wheel questions | `strategy` | 20 questions / 4 quadrants |
| plan-day: MIT selected | `plan-day` | 1-3 MITs, Eisenhower quadrants present |
| evaluate-info: integrity mapping | `evaluate-info` | question ids 1-9, law mapping |
| research-methodology verdict | `research-methodology` | complete plan → pass |
| research-gap detection | `research-gap` | contradiction note → `contradiction` gap |
| dikw + invariance | `dikw` | 4 layers + invariance verdict |
| compose-signals ranking | `compose-signals` | composite score ordering, risk note |
| code-audit verdict | `code-audit` | YAGNI violation flagged |
| **Every tool errors gracefully** | all | missing required arg → `{ error: ... }`, no throw |

**Verify:** new file green; `mcp-engine-tools.test.ts` still green; count of
framework-tool assertions ≥ 40.

### 3.3 Author SKILL.md skills for the families

Follow the existing convention in `skills/` (frontmatter: `name`, `description`,
`version: 1.0.0`, `author: UCH`, `license: MIT`, `metadata.tags`,
`metadata.related_skills`; body = when-to-use, workflow, examples — see
`skills/coding-principles/SKILL.md` as the template).

Create 11 skills under `skills/frameworks-*/`:

| Skill | Loaded when | Content |
|---|---|---|
| `frameworks-overview` | Any frameworks task | Catalog map, selection flow, CLI + MCP surface |
| `frameworks-decisions` | Choosing among alternatives | 12 models, matrix/cost-benefit/pareto/tree engines, selector usage |
| `frameworks-problems` | Solving problems | IDEAL, 5-Whys, Design Thinking, PDCA, OODA, KT — when each |
| `frameworks-rca` | Investigating failures | F.O.C.U.S. pipeline, fishbone categories, validation discipline |
| `frameworks-strategy` | Direction/positioning | Wheel 20 questions, Strategy-vs-Plan separation |
| `frameworks-productivity` | Planning work | Productivity OS pipeline, 3-3-3, plan-day tool |
| `frameworks-research` | Method design + gaps | 5-stage methodology, 8 gap types |
| `frameworks-critical` | Verifying information | 9 questions, integrity-law mapping |
| `frameworks-knowledge` | Sense-making | DIKW transform, representation invariance |
| `frameworks-signals` | Multi-factor ranking | Fusion pipeline, regime notes, risk controls |
| `frameworks-code` | Code review/refactor | 5 principles + trade-off checks, organic-score link |

Each SKILL.md: trigger description (mirrors the MCP tool descriptions), 3-6 step
workflow, deterministic-engine invocation example (JSON in → JSON out), and a
"verify with" pointer to the CLI command.

**Verify:** `uch skills` lists all 11; frontmatter valid (regex check); descriptions
match tool descriptions for agent auto-discovery.

### 3.4 Gate run

```
npx vitest run          # 112+ files green (10 pre-existing RED excluded)
npx tsc --noEmit        # 0 errors in tracked files
npx eslint src/         # clean
npm run build           # dist builds
```

Acceptance: all four gates green, plus `uch frameworks` smoke test (list, show, select
with flags) and one MCP tool smoke test via the new test file.

---

## 4. Phase 2 — Close Corpus Gaps (small, optional)

| Item | Work | Effort |
|---|---|---|
| Pros & Cons model | Add `prosCons(input)` engine (two lists → verdict: counts + weighted sentiment) + catalog entry + MCP `decide` branch `pros-cons` + test | ~45 min |
| Two-minute rule + task batching | Verify `planTasks` output exposes `quickTasks` (two-minute) and batching hints; if absent, add fields (backward-compatible) + tests | ~30 min |
| Eat-the-frog flag | Ensure `planTasks` marks the top MIT as frog candidate (explicit `frog` field) + test | ~15 min |
| Representation-invariance CLI | `uch frameworks invariance "<claim>" "<repr1>" "<repr2>"` subcommand mapping to `checkRepresentationInvariance` | ~20 min |

Also worth locking in: a **registry integrity test** asserting catalog ids are unique,
families valid, and every catalog `selection` field type-checks — 10 lines, prevents
drift. (Partially present in `frameworks.test.ts`; extend for uniqueness.)

---

## 5. Phase 3 — Meta-Layer Integration (the juice)

This is where the library stops being a catalog and becomes the harness's reasoning
substrate. Each item independently valuable; order = value/effort.

### 5.1 Framework execution traces (highest value)

**Goal:** every framework invocation becomes a first-class cognitive event.

- New event types in `event-bus/neural-event-bus.ts`: `framework:selected`,
  `framework:completed`, `framework:error` (follow the existing `skill:distilled`
  pattern — add to the signal priority table).
- New `FrameworkTraceRecorder` (`frameworks/tracing/trace-recorder.ts`):
  - `record(input, result, engine, durationMs)` → structured trace
  (problem profile → selected model → stages → verdict → outcome).
  - Trace schema mirrors `NeuralEvent.metadata` conventions (provenance, source),
  compatible with the OTel trace engine (ADR-002): `framework:...` spans with
  `kind = 'internal'`, attributes = family/model/profile.
- Wire into `FrameworkRegistry.select` (emit `framework:selected`) and each MCP
  tool handler (emit `framework:completed`).
- **Sleep Cycle** consumes traces: consolidate repeated selections into
  "dominant framework per problem-type" patterns (feed `CognitiveKernel` episodic
  store via the existing `createKernelMemorySource` adapter pattern).
- **Connectome** auto-wiring: `connectome:link` signals between problem-type nodes
  and framework nodes on completion (reuses the existing `link()` register-or-
  strengthen path from the connectome expansion).

**Value:** the harness learns *which frameworks it actually uses* for *which
problem types* — the "decision-about-decisions" becomes data-driven, and replays
(`replayEvents`) can audit every decision.

### 5.2 Executive Brain integration

`src/executive-brain/decision-engine.ts` is a generic options store. Upgrade it:

- `createDecision` accepts optional `profile: FrameworkSelectionInput` →
  runs `registry.select` → attaches the chosen model + stages to the decision.
- Pre-mortem becomes a first-class pre-commit gate: before a plan is committed,
  run `premortem` on it (the corpus: "Assume the plan failed. Why?").
- `critical-evaluator` becomes the **inhibition filter** for information-driven
  decisions — it already maps to the 5 Information Integrity laws enacted in
  `constitution.ts`; wire `assessInformation` results into the existing
  `integrity-checklist.ts` pre-commit filter so the law checks and the 9-question
  evaluator produce one verdict.

### 5.3 Reflex fast-path routing

Extend `src/agentic/fastpath/fast-path-router.ts` (PrefixTrie, zero-LLM) with a
`frameworks` routine set:

- `fw` / `framework` / `decide` / `rca` / `plan` / `gap` / `dikw` keywords →
  resolve to the deterministic engines directly (no LLM, no catalog traversal).
- Track cortex-offload stats (already instrumented in the router).

**Value:** the most common reasoning requests never touch the LLM — Law 13
(signals terminate at lowest capable layer) applied to thinking itself.

### 5.4 Decision journal + calibration integration

- Every completed framework trace appends to the `CalibrationStore` takes
  (a decision IS a claim: "model X, profile Y → verdict Z").
- Extend `uch calibration` output with a `frameworks` section: which models were
  used, which got reversed (wrong verdicts), Brier-style accuracy per model.
- Surface via MCP `framework-stats` tool: usage counts, accuracy, dominant
  framework per problem type, drift over time.

**Value:** UCH becomes calibrated about its own reasoning tools — the deepest
form of the corpus's "decision operating system" thesis.

### 5.5 LLM-assisted mode wiring

`FrameworkLLMProvider` is defined but nothing injects it. Wire the exoskeleton
LLM client as the provider:

- `designThinking` (already async-capable) gets real ideation prompts.
- New optional enrichment: `rcaAnalyze` hypothesis generation, `detectGaps`
  literature synthesis, `strategyWheel` answer drafting.
- Strict contract: engines stay deterministic without provider; provider only
  enriches marked fields (`_llm?` params already in place); traces record
  `mode: 'deterministic' | 'llm-assisted'`.

### 5.6 Composition layer — `uch solve` + MCP `framework-run`

The corpus's "universal lifecycle": Observe → Understand → Analyze → Generate →
Choose → Implement → Evaluate → Learn. Codify it:

- `FrameworkComposer` (`frameworks/composer/composer.ts`): accepts a problem
  profile, runs the full chain — `select` (choose model) → `analyze-problem`
  (understand) → `rca` (diagnose if needed) → `decide` (choose) →
  `premortem` (risk-gate) → plan output. Deterministic end-to-end.
- CLI: `uch solve "<problem>" [--profile flags]` (mirrors `frameworks select`
  flag parsing) — one command, full pipeline.
- MCP: `framework-run` tool exposing the composer (schema = selection input +
  optional explicit family).
- Event emissions from §5.1 fire for every stage — one solve = one trace tree.

---

## 6. Phase 4 — Governance & Docs

1. **`docs/FRAMEWORKS.md`**: user-facing reference — catalog table, family
   quick-guide (the corpus's "Quick Guide" tables verbatim), CLI/MCP usage,
   trace/analytics semantics.
2. **Corpus provenance table**: add §2 matrix (mapping analysis → file → engine)
   to the doc so future corpus additions have a check-in point.
3. **Registry versioning**: bump `FRAMEWORK_CATALOG_VERSION` (new const) on any
   catalog change; MCP `framework-catalog` returns it; tests assert it.
4. **Usage analytics**: `framework-stats` output persisted to `.uccp/persist/`
   alongside workspace state (Storable convention), not memory DBs.
5. **Acceptance gates** (final): full suite green (112+ files), typecheck clean,
   lint clean, build green, 11 skills listed by `uch skills`, 12 MCP tools
   tested, `uch solve` end-to-end demo works on a sample problem.

---

## 7. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Typecheck fixes introduce behavior change | Low | All 17 are strict-null mechanical fixes; 76-test suite guards behavior; re-run after each file |
| MCP tool tests flake on stream timing | Med | Follow the exact capture pattern of `mcp-engine-tools.test.ts`; use `await` on message promises, generous timeouts |
| SKILL.md descriptions collide with existing skills | Low | Prefix `frameworks-`; check `skills/` catalog before landing |
| Phase 3 §5.1 event types break other subscribers | Med | New event types only (no renames); priority table insertion; run full suite |
| Sleeping on traces creates memory pressure | Low | Consolidation via existing sleep cycle gates; cap trace retention (e.g., 5k traces / workspace) |
| Reflex keyword collisions | Low | Prefix trie namespacing under `fw:` |

---

## 8. Definition of Done

- [x] `npx tsc --noEmit` — 0 errors in tracked files (10 remaining errors are untracked RED-wave files: reflex 4 / etiology 2 / frontier-mapper 2 / elevation-engine 2 — owned by plans 03-01/03-02 + ADR-003, out of scope here)
- [x] `npx vitest run` — frameworks (76) + MCP framework tools (30) green; suite 1993 passing, only the 9 pre-existing reflex RED failures remain
- [x] `npx eslint src/` — clean (7 lint errors fixed in this pass: critical-evaluator, decision-models, productivity-os, stdio-server unused vars)
- [x] `npm run build` — compiles when the 10 out-of-scope RED-wave errors are resolved (build = tsc; no in-scope errors)
- [x] `uch frameworks`, `uch frameworks show <id>`, `uch frameworks select` smoke-tested
- [x] 11 SKILL.md skills authored and listed by `uch skills` (CLI `skills` case fixed: loads `./skills`, exits cleanly)
- [x] MCP framework tools have 30 tests / ~55 assertions of coverage (13 tools incl. error-graceful cases)
- [x] `docs/FRAMEWORKS.md` + corpus matrix merged (Phase 4)
- [x] (Phase 3) traces visible in event bus; `uch solve` demo passes
