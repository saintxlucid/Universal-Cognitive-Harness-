# ADR-003: Engineering Intelligence Layer

- **Status:** Accepted for implementation (Phase A design complete)
- **Date:** 2026-07-31
- **Scope:** Domain-gated engineering knowledge, unified evaluation gates, agent context enrichment, continuous judgment learning
- **Companion design:** [ENGINEERING-INTELLIGENCE.md](ENGINEERING-INTELLIGENCE.md)

## Context

The workspace owns the intelligence (ADR-001), and cognition is observable
tracing (ADR-002) — but the harness evaluates _cognition_, not _engineering
quality_. AI coding agents know syntax, APIs, and frameworks; they lack the
10–20-year engineering mental model: complexity reasoning, data-structure
trade-offs, systems failure modes, product judgment, engineering economics,
and the empirical laws senior engineers use as decision heuristics
([arXiv:2310.03533], [laws-of-software-engineering.com]).

A survey of the live UCH codebase (2026-07-31) shows the _substrate_ for this
already exists:

- **Mental Model Engine** is built (`src/cognitive-plane/frameworks/registry.ts`,
  37 KB: decision models, RCA, strategy, DIKW, problem-solving, research,
  code principles) — 12 test files green.
- **Tier IX Taste** is built (`src/cognitive-plane/taste/taste-engine.ts`,
  9 dimensions, learn/assess/feedback, Storable).
- **Laws** exist as enforcement gates (`src/cognitive-plane/constitution/`,
  `src/kernel/constitution/` with organic-score and integrity laws) — but not
  as typed reasoning primitives.
- **Workspace genome** (`src/workspace-graphs/`), **organizational memory**
  (hippocampus, mnemosyne, sleep cycle, connectome, trace engine) are built.
- **Failure engineering** is partial (FAILURE-RETRY design, integrity
  checklist, suit/litmus) — no pre-write failure-imagination pass.

The genuine gaps are the domain knowledge itself: no CS complexity/structure
evaluation, no SE quality measurement gates, no systems-failure reasoning, no
product thinking, no engineering economics, no architecture-pattern trade-off
catalog, no active unknown-unknown discovery.

## Decision

### 1. New organ: Engineering Judgment (Cerebellum)

Per the [MANIFESTO §6](../MANIFESTO.md) organ contract:

| Engineering name     | Biological metaphor | Contract                                                          | Module                          | Measurable by                                                                                                           |
| -------------------- | ------------------- | ----------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Engineering Judgment | Cerebellum          | Domain-gated evaluation, evidence-based review, compiled judgment | `src/engineering-intelligence/` | Evaluation precision vs human review, gate veto rate, false-positive rate, drift between findings and incident outcomes |

Zero new dependencies. All persistence, events, and scoring reuse existing
seams: `Storable` persistence, neural event bus, `OrganicScoreEngine`,
`TasteEngine`, connectome wiring, sleep-cycle distillation.

### 2. Ten tier domain stores

`src/engineering-intelligence/domains/tier-01-cs.ts` … `tier-10-unknown-unknowns.ts`,
each a `Storable` registry of typed `EngineeringConcept` objects (id, tier,
family, definition, signals, triggers, guidance, antiPatterns, learned weight,
provenance). Tier IX (Taste) and the Mental Model Engine are reused, not
rebuilt.

Population priority: Tier I (CS) → Tier VI (Laws) → Tier III (Systems) →
Tier V (Economics) → Tier II (SE) → Tier VII (Patterns) → Tier IV (Product) →
Tier VIII (Failure) → Tier X (Unknowns).

### 3. Engineering laws as reasoning primitives

Laws are elevated from text to typed objects (`EngineeringLaw`: statement,
domain, `applicability` predicate, `check` triggers, `tradeoffs`), so
Little's Law fires on queueing designs, Goodhart's on metric-driven changes,
Amdahl's on parallelism claims, Conway's on team/architecture restructure.
Provenance required per law.

### 4. EngineeringEvaluator — the unified gate

`evaluate(target)` over code/design/plan/architecture targets returns
`EngineeringReview` (findings with tier, severity, conceptId, evidence,
suggestion; gate = veto or advisory; tier-weighted score).

Three evaluation layers, cheapest first:

1. **Deterministic zero-LLM gates** — complexity heuristics, coupling
   heuristics, duplication, dead-code markers, law triggers, data-structure
   smell patterns.
2. **Evidence collection** — failure-mode enumeration (network, DB stall,
   disk full, memory exhaustion, clock drift, dependency unavailability)
   mapped to touched surfaces.
3. **LLM-assisted gates (optional)** — product thinking, economics, taste via
   `TasteEngine.assess`; explicit spans only (`uccp.trace.kind=explicit`),
   honoring the ADR-002 observable/private boundary.

Veto-capable findings (Tier III SPOF, Tier VIII unrecovered failure modes,
Tier I pathological complexity) hard-reject through `OrganicScoreEngine`
regardless of aggregate — mirroring the existing security/error-masking
vetoes.

### 5. Wiring

- Event-bus subscriptions: `review:requested`, `build:finished`,
  `test:failed`, `error:occurred` → background evaluations.
- Executive-brain pre-commit filter: findings join the existing
  integrity-checklist inhibition gate.
- New MCP tool `engineering-review` (25th tool in `src/mcp/stdio-server.ts`)
  - CLI command `uch engineering-review` in `src/cli/index.ts`.
- Judgment-pack context middleware in `src/agentic/context/` (patterned on
  the skills middleware): injects the top-N activated concepts per task —
  CS foundations, SE principles, systems awareness, product context, laws,
  workspace genome, organizational memory, mental models.

### 6. Learning loop

Findings + human/agent feedback → `TasteEngine.learn`; activated concepts →
`connectome:link` register-or-strengthen; sleep-cycle distillation →
skill entries; periodic dream-engine scan (Tier X) over genome + ledger →
`suggestion` events (never self-applied changes).

## Consequences

### Positive

- Any connected model is guided by accumulated, evidence-backed engineering
  judgment instead of its own training priors — the workspace behaves like an
  experienced technical organization.
- Deterministic gates work with zero LLM cost, zero latency budget pressure,
  and full reproducibility.
- Veto gates are bounded and constitution-anchored; everything else is
  advisory evidence, so the layer audits without overriding.
- Reuses the existing organ substrate (Storable, event bus, OrganicScore,
  Taste, connectome, sleep cycle) — no new architecture seams.
- Learnable: every finding is a learning datum; taste, connectome weights,
  and distilled skills get stronger with use.

### Constraints

- Zero new runtime dependencies.
- No hidden reasoning: LLM-assisted gates record explicit findings only.
- Domain stores are data + activation logic; any tier that outgrows the
  registry+gate contract moves to its own subsystem.
- Concepts carry provenance and revision dates; sleep-cycle distillation
  flags stale knowledge for review.
- The benchmark corpus for veto recall (≥ 80%) is a Phase C deliverable, not
  an assumption.

## Alternatives considered

| Alternative                                                  | Decision                                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt packs / skill documents per tier                      | Rejected: text is not evaluated, measured, or learned; vision explicitly demands first-class reasoning objects                                  |
| Single monolithic "engineering rules" module                 | Rejected: ten tiers have distinct activation surfaces and independent lifecycle; per-tier stores keep blast radius small                        |
| LLM-only evaluation                                          | Rejected: cost, latency, non-determinism, and the observable/private boundary; deterministic gates come first, LLM gates are optional additions |
| New dependency for complexity analysis (e.g. eslint plugins) | Rejected for Phase B/C: heuristic gates cover the benchmark corpus; plugin integration is a possible later enhancement                          |
| Teach taste via prompts                                      | Rejected: Tier IX already learns from feedback (`TasteEngine`); prompts cannot encode learned preference                                        |

## Implementation status (2026-07-31)

| Item                                                                                                                                                                                                                                                                                                                              | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase A: design doc + this ADR                                                                                                                                                                                                                                                                                                    | ✅ `design/ENGINEERING-INTELLIGENCE.md`, `design/ADR-003-engineering-intelligence-layer.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Phase B wave 1: Tier I (CS, 69 concepts), Tier III (Systems, 12), Tier V (Economics, 10), Tier VI (Laws, 12 primitives) + `EngineeringEvaluator` (complexity, structure-smell, failure-surface, economics, law gates; veto on pathological complexity) + `analyzer` (diff stats, code facts)                                      | ✅ `src/engineering-intelligence/` — 34 new tests green; lint clean; typecheck clean (18 pre-existing errors are untracked Phase 03 files); standalone build + runtime smoke verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Phase B wave 2: Tier II (SE, 20: coupling→evolvability), Tier VII (Patterns, 13 with when-NOT-to-use), Tier IV (Product, 8), Tier VIII (Failure, 9), Tier X (Unknowns, 9) stores registered; coupling gate (change-amplification + import fan-out) in evaluator; symmetric activation containment + diff-prefixed import counting | ✅ `src/engineering-intelligence/` — 150 concepts across 8 stores; 26 new tests (60 in layer); suite green; lint clean; scoped typecheck clean (10 pre-existing errors remain in untracked Phase 03 files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Phase C: benchmark corpus (veto recall ≥ 80%, zero-LLM path < 1 s), organic-score veto integration                                                                                                                                                                                                                                | ✅ `src/engineering-intelligence/benchmark/` (17-case labeled corpus: 5 veto, 7 advisory, 5 negative controls; `runEngineeringBenchmark` reports recall/vetoRecall/negative-control pass rate/latency p95) + `src/engineering-intelligence/organic-hookup.ts` (`autoTarget`, `coerceFindings`, `engineeringFindingsFor`) + `OrganicScoreEngine.evaluate` accepts `engineeringFindings` — `gate: 'veto'` findings hard-reject and record `vetoedBy` (mirrors constitutional vetoes); MCP `organic-score` tool accepts `engineeringTarget`/`engineeringFindings`; CLI accepts `--kind`/`--findings`. Benchmark contract met: veto recall ≥ 80%, every case < 1 s. 12 hookup + 6 MCP + 5 veto-gate tests green (41 in scope); lint + scoped typecheck clean (10 pre-existing errors remain in untracked Phase 03 files)                                                                                                                                                                                          |
| Phase D: event-bus/executive/MCP `engineering-review`/CLI/judgment-pack enrichment wiring                                                                                                                                                                                                                                         | ✅ `src/engineering-intelligence/enrichment/engineering-enrichment.ts` (`EngineeringEnrichment` organ watching git:commit/file:saved/test:failed/build:failed/error:occurred → publishes `engineering:reviewed` with findings + veto_count; `targetFromEvent` extraction) + new `engineering:reviewed` event type + MCP `engineering-review` tool (auto-detect target kind) + CLI `engineering-review`/`engineering-benchmark` commands + ExecutiveBrain `evaluateChange` attaches `engineeringReview` and escalates pass→review on engineering vetoes + exoskeleton middleware wiring (metabolism component `engineering`). 13 new tests (8 enrichment + 5 MCP review) + 2 executive escalation tests; contract: integration tests green, suite stays green                                                                                                                                                                                                                                                  |
| Phase E: learning loop (taste feedback, connectome weights, sleep distillation) + Tier X dream scan                                                                                                                                                                                                                               | ✅ `src/engineering-intelligence/learning/learning-loop.ts` (`EngineeringLearningLoop`: taste reinforcement on clean reviews / penalty on vetoes via `TasteEngine.learn`; concept activation accounting with `connectomeThreshold`; `connectome:link` register-or-strengthen events on repeated activations; `getDominantPerProblemType` satisfies the `SleepFrameworkSource` contract so the sleep cycle distills engineering concepts into skills) + `src/engineering-intelligence/learning/dream-scan.ts` (`DreamScan`: deterministic offline Tier X scan over workspace DNA mutations + ADR-002 trace ledger — silent debt, dead code, duplicate concepts, inconsistent terminology, hidden assumptions, migration risks; classified against Tier X concept ids `unknown.<class>`; emits `suggestion` events, never self-applies) + new `suggestion` EventType + exoskeleton wiring (metabolism components `engineering-learning`, `dream-scan`). 11 new tests (171 in layer); tsc 0 errors; eslint clean |
