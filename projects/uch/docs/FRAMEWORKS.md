# UCH Cognitive Frameworks Library

The Cognitive Frameworks Library (`src/cognitive-plane/frameworks/`) is the
codified reasoning corpus of UCH: **10 families / 34 deterministic frameworks**
covering decision-making, problem-solving, RCA, strategy, productivity,
research, critical thinking, DIKW, quant signal fusion, and clean-code
principles.

The library is not a static catalog. Every invocation is traced onto the
neural event bus, journaled as a gradeable claim, and fed back into the
harness's calibration — UCH becomes *calibrated about its own reasoning
tools*.

- Registry version: `FRAMEWORK_CATALOG_VERSION` (currently **1.1.0**)
- Entry point: `src/cognitive-plane/frameworks/index.ts`
- Status: Phase 1 landed + Phase 3 meta-layer integration (traces, executive
  brain, reflex fast path, decision journal, composer) + Phase 4 docs.

---

## 1. Catalog

| Family | Frameworks | Purpose |
|---|---|---|
| `decisions` | rational, intuitive, decision-matrix, cost-benefit, pareto, swot, decision-tree, pre-mortem, delphi, nominal-group, stepladder, multi-voting, brainstorming, pmi, lean-decision, six-hats, pros-cons (17) | Choosing among alternatives |
| `problems` | ideal, five-whys, design-thinking, pdca, ooda, kepner-tregoe (6) | Solving problems |
| `rca` | rca-focus, fishbone (2) | Investigating failures |
| `strategy` | strategy-wheel, strategy-vs-plan (2) | Direction & positioning |
| `productivity` | productivity-os (1) | Planning work |
| `research` | research-methodology, research-gap (2) | Method design & gap detection |
| `critical` | critical-evaluator (1) | Verifying information |
| `knowledge` | dikw (1) | Sense-making (DIKW + invariance) |
| `signals` | signal-fusion (1) | Multi-factor composite ranking |
| `code` | code-principles (1) | Code review & refactor principles |

**34 frameworks.** All engines are deterministic: JSON in → JSON out, no LLM
required. An optional `FrameworkLLMProvider` can enrich marked fields in
llm-assisted mode; without it, every engine still completes.

## 2. Family Quick Guide

### Decisions — "which option?"
- **rational** — step-by-step optimal choice; **intuitive** — gut check when
  data is absent; **decision-matrix** — weighted scoring across criteria;
  **cost-benefit** — monetizable trade-offs; **pareto** — 80/20 focus;
  **swot** — internal/external posture; **decision-tree** — sequential
  branching outcomes; **pre-mortem** — assume failure, find causes;
  **delphi / nominal-group / stepladder / multi-voting / brainstorming** —
  group decision modes; **pmi** — plus/minus/interesting;
  **lean-decision** — minimal viable choice; **six-hats** — parallel thinking;
  **pros-cons** — two-list verdict with weighted sentiment.

### Problems — "how do I approach it?"
- **ideal** — Identify/Define/Explore/Act/Look-back framing;
  **five-whys** — root chain ≤5 levels; **design-thinking** — user-centered
  ideation; **pdca** — iterative improvement loops; **ooda** — rapid
  observe-orient-decide-act; **kepner-tregoe** — data-rich analytical
  situation appraisal.

### RCA — "why did it fail?"
- **rca-focus** — F.O.C.U.S. pipeline (Find→Organize→Clarify→Understand→Solve)
  with evidence → hypothesis → corrective action; **fishbone** — Ishikawa
  cause categories (6: people/process/tools/materials/environment/management).

### Strategy — "where are we going?"
- **strategy-wheel** — 20 questions across 4 quadrants (diagnosis, direction,
  choices, execution); **strategy-vs-plan** — the strategy/plan separation.

### Productivity — "what do I do today?"
- **productivity-os** — SMART → MIT → Eisenhower → blocks → Pomodoro →
  eat-the-frog → Pareto → GTD pipeline; 3-3-3 day planning.

### Research — "how do I find out?"
- **research-methodology** — 5-stage methodology with quality controls;
  **research-gap** — 8 gap types (contradiction, evidence, method, population,
  context, theoretical, empirical, practical).

### Critical thinking — "can I trust this?"
- **critical-evaluator** — 9 questions mapped to the 5 Information Integrity
  laws (objectivity, qualified source, no prejudice, no propaganda, whole
  truth).

### Knowledge — "what does this mean?"
- **dikw** — data→information→knowledge→wisdom transform; plus
  `checkRepresentationInvariance` — TRUTH: a claim is consistent across
  representations.

### Signals — "what does the composite say?"
- **signal-fusion** — rank/normalize/fuse across factors with regime notes
  and risk controls; composite score ordering with per-factor contribution.

### Code — "is this clean?"
- **code-principles** — SOC/DRY/KISS/DYC/YAGNI with trade-off checks; the
  determinisic partner of the Organic Score engine.

## 3. Selection Layer

`FrameworkRegistry.select(input)` scores every framework against the problem
profile and returns the best fit, runner-up, rationale, and alternatives.
Profile signals: `dataAvailability`, `timePressure`, `stakeholderInvolvement`,
`risk`, `complexity`, `clarity`, `rootCauseNeeded`, `humanCentered`,
`continuousImprovement`, `speedAdaptability`, optional `family` filter.

A profile classifies into a **problem type** for analytics:
`root-cause | human-centered | improvement | rapid | time-critical |
data-rich | uncertain | group | unclear | general`
(`frameworkProblemTypeOf`, shared with connectome auto-wiring and sleep-cycle
consolidation).

## 4. CLI Surface

```
uch frameworks                     List the catalog (families + ids)
uch frameworks show <id>           Show a framework definition
uch frameworks select "<problem>" [--data 0.8] [--time 0.2] ...
uch frameworks invariance "<claim>" "<repr1>" "<repr2>" [..]
uch frameworks stats               Journal analytics (usage, accuracy, drift)
uch solve "<problem>" [--profile flags] [--options a,b,c] [--criteria c1,c2]
                                   [--weights 0.3,0.7] [--scores "8,4;9,5"]
                                   [--pros "x;y"] [--cons "x;y"]
                                   [--risk-causes "x;y"] [--risk-likelihood ...]
                                   [--risk-impact ...] [--evidence "x;y"]
uch calibration                    Calibration profile incl. `frameworks`
                                   section (journal verdicts as gradeable
                                   takes, Brier-style accuracy per model)
```

`uch solve` runs the full pipeline: **select** (choose model) →
**understand** (IDEAL) → **diagnose** (RCA when `--root-cause`) →
**decide** (matrix when options+criteria, else pros-cons) →
**risk-gate** (pre-mortem; risks ≥ 60% riskScore → `review` verdict) →
**plan**. Every solve appends journal entries and persists them to
`.uccp/persist/framework-journal.json`.

## 5. MCP Surface

All tools registered in `src/mcp/stdio-server.ts` (framework family):

| Tool | Purpose |
|---|---|
| `framework-catalog` | List frameworks, optional family filter, registry version |
| `framework-select` | Selection layer with rationale; honors time pressure |
| `decide` | Decision engines (matrix / pre-mortem / pros-cons branches) |
| `analyze-problem` | Problem engines (five-whys, design-thinking, etc.) |
| `rca` | F.O.C.U.S. RCA verdict |
| `strategy` | Strategy wheel (20 questions / 4 quadrants) |
| `plan-day` | Productivity OS plan |
| `evaluate-info` | Critical evaluator (9 questions → integrity laws) |
| `research-methodology` / `research-gap` | Methodology verdict + gap types |
| `dikw` | DIKW transform + representation invariance |
| `compose-signals` | Composite signal fusion ranking |
| `code-audit` | Clean-code principles verdict |
| `framework-stats` | Usage analytics: journal + trace stats (usage, accuracy, dominant per problem type, drift, reversed) |
| `framework-run` | Full solve pipeline in one call (composer); one call = one trace tree |

## 6. Traces, Journal, and Analytics

### Execution traces (Phase 3 §5.1)
`FrameworkTraceRecorder` records every invocation
(`selection | completion | error`), capped at 5,000 traces, and emits
`framework:selected` / `framework:completed` / `framework:error` events on the
neural event bus (signal priority table; OTel-compatible metadata, ADR-002).
Consumers: the **decision journal** (deduped via `metadata.replay_of`),
**sleep cycle** consolidation ("dominant framework per problem type"),
**connectome** auto-wiring (`connectome:link` between problem-type and
framework nodes).

### Decision journal (Phase 3 §5.4)
`FrameworkDecisionJournal` treats every verdict as a gradeable claim
("model X, profile Y → verdict Z"). Entries are open until resolved
(`correct | incorrect | partial | unresolvable`). Persisted via the Storable
convention to `.uccp/persist/framework-journal.json`. Open entries merge into
the calibration takes fence as `framework`-domain takes
(`syncTakesWithJournal`), so `uch calibration` reports per-model accuracy and
Brier scores. Analytics: usage per model, accuracy per model (sorted worst
first), dominant framework per problem type, **reversed** (models whose
verdicts were wrong), and **drift** (last-20 vs previous-20 usage windows).

### Composer (Phase 3 §5.6)
`FrameworkComposer.solve(problem, profile)` — the corpus's universal
lifecycle (Observe → Understand → Analyze → Generate → Choose → Implement →
Evaluate → Learn) as a deterministic chain. One solve emits a full trace tree
(selection + per-stage completions) and records journal entries per stage.

## 7. Corpus Provenance

Every corpus analysis maps to a codified engine. Source of truth for "are we
done?" — future corpus additions check in here.

| # | Corpus analysis | Codified in | Status |
|---|---|---|---|
| 1 | TRUTH / representation invariance | `knowledge/dikw.ts` → `checkRepresentationInvariance` | ✅ |
| 2 | 12 decision-making models (+ pros-cons, group modes) | `registry.ts` catalog + `decision-models.ts` | ✅ |
| 3 | Strategy Wheel (20 questions, 4 quadrants) | `strategy/strategy-wheel.ts` → `strategyWheel` | ✅ |
| 4 | Productivity 9-system toolkit | `productivity/productivity-os.ts` + catalog def | ✅ |
| 5 | Research methodology (5 stages + quality controls) | `research/methodology.ts` → `validateMethodology` | ✅ |
| 6 | DIKW (context × understanding) | `knowledge/dikw.ts` → `dikwTransform` | ✅ |
| 7 | Strategy vs Plan | `strategy/strategy-wheel.ts` → `strategyVsPlan` | ✅ |
| 8 | Decision architecture (model selection layer) | `registry.ts` → `select` + `model-selector.ts` | ✅ |
| 9 | Problem-solving meta-framework (6 frameworks) | `problems/problem-solver.ts` | ✅ |
| 10 | RCA (F.O.C.U.S. + 3 tools + 6 steps + mistakes) | `rca/rca.ts` | ✅ |
| 11 | Research gap analysis (8 gap types) | `research/methodology.ts` → `detectGaps`, `GAP_TYPES` | ✅ |
| 12 | Critical thinking (9 questions) | `critical/critical-evaluator.ts` (maps to 5 integrity laws) | ✅ |
| 13 | Clean code (SOC/DRY/KISS/DYC/YAGNI + trade-offs) | `code/code-principles.ts` | ✅ |
| 14 | Productivity OS (SMART→MIT→Eisenhower→blocks→Pomodoro→frog→Pareto→GTD) | `productivity/productivity-os.ts` → `planTasks` | ✅ |
| 15 | Quant composite factors (rank/normalize/fuse/risk) | `signals/signal-fusion.ts` → `fuseSignals` | ✅ |

**15/15 analyses codified.** Any new corpus analysis lands in the matrix
before implementation.

## 8. Registry Versioning

`FRAMEWORK_CATALOG_VERSION` (`src/cognitive-plane/frameworks/registry.ts`)
must be bumped on any catalog change (new framework, renamed family, revised
selection metadata). It is returned by the MCP `framework-catalog` and
`framework-stats` tools and asserted by the integrity tests
(`src/cognitive-plane/frameworks/__tests__/frameworks.test.ts`) — drift is
caught by the suite.

## 9. Skills

Each family has a SKILL.md under `skills/frameworks-*` (overview, decisions,
problems, rca, strategy, productivity, research, critical, knowledge, signals,
code). `uch skills` lists them for agent auto-discovery; each skill mirrors
the corresponding MCP tool description and points to the CLI verification
command.
