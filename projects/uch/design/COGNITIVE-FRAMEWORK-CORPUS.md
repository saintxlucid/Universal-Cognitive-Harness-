# COGNITIVE-FRAMEWORK-CORPUS — the reasoning-framework corpus, codified

- **Status:** Verified (2026-08-01)
- **Origin:** a 15-image corpus of reasoning/strategy/productivity
  infographics analysed into structured breakdowns (decision models,
  strategy wheel, productivity systems, research methodology, DIKW,
  plan-vs-strategy, decision architecture, problem-solving, RCA,
  research gaps, critical thinking, clean code, productivity OS,
  quantitative investing, truth-and-representation).
- **Substrate:** the Cognitive Frameworks Library
  (`src/cognitive-plane/frameworks/`), 10 families / 34 catalog entries,
  plus the decision-about-decisions selection layer.
- **Delta shipped with this document:** GTD workflow engine +
  Pomodoro scheduler (`productivity-os.ts`), 13 new tests.

## 1. Purpose

The corpus argues one thesis in fifteen different idioms: **no single
model has a monopoly on truth or on good decisions. The symbol is not
the truth — it is a way of pointing toward it. The quality of an
outcome depends on matching the model to the nature of the problem.**

This document is the single reference map: every infographic analysis →
the deterministic engine that codifies it → how the engines compose.

## 2. Coverage map (analysis → engine)

| #   | Corpus analysis                               | Codified engine                                               | File                               |
| --- | --------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| 1   | Truth & representation invariance (3 symbols) | `checkRepresentationInvariance`                               | `knowledge/dikw.ts`                |
| 2   | 12 decision models                            | decisions family — 17 frameworks (§2.1)                       | `registry.ts`                      |
| 3   | Strategy wheel (20 questions)                 | `strategyWheel` — WHY/WHO/WHAT/HOW                            | `strategy/strategy-wheel.ts`       |
| 4   | 9 productivity systems                        | productivity family — see §2.1                                | `productivity/productivity-os.ts`  |
| 5   | Research methodology (5 stages)               | `validateMethodology`                                         | `research/methodology.ts`          |
| 6   | DIKW (data → wisdom)                          | `dikwTransform` — context as catalyst                         | `knowledge/dikw.ts`                |
| 7   | A plan is not a strategy                      | `strategyVsPlan` — pillars vs elements                        | `strategy/strategy-wheel.ts`       |
| 8   | Decision architecture                         | `FrameworkRegistry.select` + `classifyDecision`               | `registry.ts`, `model-selector.ts` |
| 9   | Problem solving (6 frameworks)                | problems family — see §2.1                                    | `problems/problem-solver.ts`       |
| 10  | Root cause analysis                           | `rcaAnalyze`, `traceFiveWhys`, `fishbone`, `paretoPrioritize` | `rca/rca.ts`                       |
| 11  | Research gap analysis (8 gap types)           | `detectGaps` + `GAP_TYPES`                                    | `research/methodology.ts`          |
| 12  | Critical thinking (9 questions)               | `assessInformation`                                           | `critical/critical-evaluator.ts`   |
| 13  | Clean code principles                         | `auditCodePrinciples` (SOC/DRY/KISS/DYC/YAGNI)                | `code/code-principles.ts`          |
| 14  | Productivity OS                               | `planTasks` — SMART → MIT → blocks → review                   | `productivity/productivity-os.ts`  |
| 15  | Quantitative investing                        | `fuseSignals` — normalize/weight/fuse/rank                    | `signals/signal-fusion.ts`         |

Coverage verdict: **15/15 analyses have a deterministic engine.** The
remaining narrative-only material (Pomodoro interval history, GTD
weekly-review cadence) is behavioural guidance, not computation.

### 2.1 Family indices (§2 rows 2, 4, 9)

```text
decisions:    rational, intuitive, decision-matrix, cost-benefit, pareto,
              swot, decision-tree, pre-mortem, delphi, nominal-group,
              stepladder, multi-voting, brainstorming, pmi, lean-decision,
              six-hats, pros-cons
problems:     ideal, fiveWhys, designThinking, pdcaPlan, ooda,
              kepnerTregoe
productivity: planTasks, threeThreeThree, gtdWorkflow, planPomodoros
```

## 3. The selection meta-layer (decision-about-decisions)

The corpus's mature claim is that model selection is itself a decision.
Two layers implement it:

1. **Condition scoring** — `FrameworkRegistry.select` scores every
   candidate against the problem profile (data availability, time
   pressure, stakeholder involvement, risk, complexity, clarity, plus
   explicit signals: root-cause, human-centered, continuous-improvement,
   speed-adaptability) and returns the best match with a rationale.
2. **Quick-guide heuristics** — `classifyDecision` implements the
   corpus's cheat sheet: fast → intuitive/PMI/lean; data-rich →
   rational/matrix/cost-benefit/pareto; group → delphi/nominal-group;
   uncertainty → tree/pre-mortem; strategic → SWOT.

`FrameworkComposer` (`composer/composer.ts`, `uch solve`) composes a
full pipeline from the selected framework and records the choice in the
decision journal for calibration.

## 4. The unified thesis, as executed

| Layer          | Corpus analysis                           | Engine                                               |
| -------------- | ----------------------------------------- | ---------------------------------------------------- |
| Foundation     | critical thinking; truth & representation | `assessInformation`, `checkRepresentationInvariance` |
| Diagnosis      | RCA; research gaps                        | `rcaAnalyze` + tools, `detectGaps`                   |
| Selection      | decision architecture                     | `registry.select`, `classifyDecision`                |
| Direction      | strategy wheel; plan vs strategy          | `strategyWheel`, `strategyVsPlan`                    |
| Execution      | productivity OS; problem solving          | `planTasks` + extras, problem-solver family          |
| Quantification | quantitative investing                    | `fuseSignals`                                        |

The corpus's closing insight — "edge comes from the architecture of
the decision system, not from any one formula" — is literally the
architecture of this library: weak, deterministic engines composed
through one selection layer, all under the critical-thinking evaluator.

## 5. Composition rule

Every engine is deterministic, pure, and clock-free (replay-safe).
Engines never call LLMs; the optional LLM-assisted mode lives in the
composer, not the engines. New frameworks enter through the catalog
(`registry.ts`) with selection metadata; the catalog version gates
MCP/CLI consumers.
