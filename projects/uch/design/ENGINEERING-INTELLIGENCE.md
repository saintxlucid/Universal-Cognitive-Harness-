# Engineering Intelligence Layer

- **Status:** Accepted — ADR-003; Phases A–E implemented (waves 1–5, 171 tests green in layer; see §7)
- **Date:** 2026-07-31
- **Scope:** Domain-gated engineering knowledge, unified evaluation gates, agent context enrichment, continuous judgment learning
- **Companion:** [ADR-003](ADR-003-engineering-intelligence-layer.md) (decision record)

## 1. Thesis

AI coding agents know syntax, APIs, and common frameworks. What they lack is the
deep engineering mental model senior engineers accumulate over 10–20 years
([arXiv:2310.03533 — LLMs for SE: Survey and Open Problems]). They default to
familiar collections instead of reaching for the right structure, they reason
from files instead of systems, they optimize for short-term correctness instead
of long-term maintainability.

The Harness should not just provide "memory" or "skills". It should provide an
**Engineering Intelligence Layer**: a workspace-installed corpus of engineering
domains that _continuously evaluates and influences_ any connected agent — so the
workspace behaves less like a code generator and more like an experienced
technical organization.

## 2. The ten tiers

| Tier | Domain                            | Core question                                 |
| ---- | --------------------------------- | --------------------------------------------- |
| I    | Computer Science Intelligence     | "What is the right complexity/structure?"     |
| II   | Software Engineering Intelligence | "Is this change maintainable?"                |
| III  | Systems Thinking                  | "How does this behave as part of a system?"   |
| IV   | Product Thinking                  | "Should this exist?"                          |
| V    | Engineering Economics             | "What does this cost over its lifetime?"      |
| VI   | Engineering Laws                  | "Which empirical law governs this situation?" |
| VII  | Architectural Patterns            | "Which pattern — and when _not_ to use it?"   |
| VIII | Failure Engineering               | "How can this fail, before we write it?"      |
| IX   | Engineering Taste                 | "Is this elegant, symmetric, predictable?"    |
| X    | Unknown-Unknown Discovery         | "What hasn't anybody asked?"                  |

Each tier is a **domain store**: a typed registry of engineering concepts the
evaluator can activate, and agents can be enriched with. They are not prompt
packs; they are data + activation logic (the same contract as
`src/cognitive-plane/frameworks/registry.ts`).

## 3. What already exists (verified against live code, 2026-07-31)

| Tier                        | Existing UCH organ                                                                                                                                                                                                                                                                                            | Status                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Mental Model Engine         | `src/cognitive-plane/frameworks/` — decision models (rational, intuitive, decision-matrix, cost-benefit, Pareto, SWOT, decision-tree), RCA, strategy wheel, DIKW, problem-solving, research methodology, productivity OS, code principles, critical evaluation, signal fusion (37 KB registry, 12 test files) | **Built — reuse**                                                                                                    |
| Tier IX Taste               | `src/cognitive-plane/taste/taste-engine.ts` — 9 dimensions, learn/assess/feedback loop, Storable persistence                                                                                                                                                                                                  | **Built — reuse**                                                                                                    |
| Tier VI Laws (partial)      | `src/cognitive-plane/constitution/` (governance laws), `src/kernel/constitution/` (coding guidelines, engineering-judgment, organic-score, epistemology)                                                                                                                                                      | **Partial** — enforcement gates exist; laws as _reasoning primitives_ do not                                         |
| Tier VIII Failure (partial) | `design/FAILURE-RETRY.md`, `src/cognitive-plane/integrity/` (executable inhibition gate), `src/suit/litmus`                                                                                                                                                                                                   | **Partial** — retry/erasure-focused; no pre-code "imagine failure" pass                                              |
| Tier X Unknown unknowns     | `src/engineering-intelligence/learning/dream-scan.ts` (offline scan over genome mutations + trace ledger) + `src/cognitive-plane/dreaming/`, `suggestions/`, `patterns/pattern-library.ts` (trace-pattern matching)                                                                                           | **Built — reuse** — `DreamScan` classifies 6 unknown-unknown families, emits `suggestion` events, never self-applies |
| Workspace Genome            | `src/workspace-graphs/` (knowledge/decision/task graphs, DNA fingerprint) + `src/workspace-brain/`                                                                                                                                                                                                            | **Built — reuse**                                                                                                    |
| Organizational memory       | `src/hippocampus/`, `src/mnemosyne/`, `src/sleep_cycle/` (8-stage distillation), `src/connectome/`, `src/cognitive-plane/trace-engine/` + `replay/`                                                                                                                                                           | **Built — reuse**                                                                                                    |
| Tier VII Patterns (partial) | `src/cognitive-plane/patterns/` (trace patterns), `src/cognitive-plane/frameworks/code/` (code principles)                                                                                                                                                                                                    | **Partial** — operational patterns exist; architecture-pattern trade-off catalog does not                            |

## 4. The genuine gaps

1. **Tier I — CS Intelligence**: nothing evaluates complexity, data-structure
   trade-offs, cache/amortized/parallel complexity, or locality. No Performance
   Cortex. `perf-engineer` is a prompt-only subagent.
2. **Tier II — SE Intelligence**: the constitution enforces laws, but nothing
   _measures_ coupling, cohesion, connascence, change amplification, cognitive
   complexity as review gates.
3. **Tier III — Systems Thinking**: no failure-propagation, backpressure,
   blast-radius, or single-point-of-failure reasoning.
4. **Tier IV — Product Thinking**: absent ("should this exist?" is never asked).
5. **Tier V — Engineering Economics**: absent (build-vs-buy, lifetime ownership
   cost, risk-adjusted ROI).
6. **Tier VI — Laws as first-class objects**: laws are text/checklists today;
   the full catalog (Brooks, Conway, Gall, Lehman, Amdahl, Little, Pareto,
   Parkinson, Goodhart, Hofstadter, Murphy, Occam) is not typed reasoning
   primitives with applicability predicates and trade-off triggers.
7. **Tier VII — Architecture-pattern trade-offs**: no catalog of when _not_ to
   use each pattern.
8. **Tier VIII — Failure Engineering**: no structured pre-write failure
   imagination pass.
9. **Tier X — Unknown-unknown discovery**: no active scan for hidden
   assumptions, silent debt, dead code, duplicate concepts, inconsistent
   terminology, future migration risks.

## 5. Architecture

A new organ (see organ contract, [MANIFESTO §6](../MANIFESTO.md)):

| Engineering name     | Biological metaphor | Contract                                                          | Module                          | Measurable by                                                                                                           |
| -------------------- | ------------------- | ----------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Engineering Judgment | Cerebellum          | Domain-gated evaluation, evidence-based review, compiled judgment | `src/engineering-intelligence/` | Evaluation precision vs human review, gate veto rate, false-positive rate, drift between findings and incident outcomes |

### 5.1 Domain stores — `src/engineering-intelligence/domains/`

Ten typed registries (`tier-01-cs.ts` … `tier-10-unknown-unknowns.ts`), each a
`Storable` (persist/load via `src/cognitive-plane/persistence/`), zero new
dependencies, no cross-imports into workspace-brain.

```ts
interface EngineeringConcept {
  id: string; // 'cs.data-structures.cuckoo-filter'
  tier: TierId; // 'tier-01-cs' | … | 'tier-10-unknown'
  name: string;
  family: string; // 'algorithms' | 'os' | 'networking' | 'distributed' | …
  definition: string;
  signals: string[]; // code/design patterns that indicate relevance
  triggers: string[]; // conditions that activate the concept
  guidance: string[]; // what an evaluator should check when activated
  antiPatterns: string[]; // violations to flag
  weight: number; // learned relevance weight (connectome feedback)
  provenance: string[]; // sources (arXiv, laws-of-software-engineering, …)
}
```

Priority order for population: Tier I (CS) → Tier VI (Laws) → Tier III
(Systems) → Tier V (Economics) → Tier II (SE) → Tier VII (Patterns) → Tier IV
(Product) → Tier VIII (Failure) → Tier X (Unknowns). Tier IX (Taste) and the
Mental Model Engine are reused as-is.

### 5.2 Engineering laws as reasoning primitives — `src/engineering-intelligence/laws/`

Elevated from text to typed objects:

```ts
interface EngineeringLaw {
  id: string; // 'law.little'
  name: string;
  statement: string; // "The average number of items in a stable queue = arrival rate × average wait"
  domain: 'project' | 'team' | 'system' | 'code' | 'schedule';
  applicability: (ctx: JudgmentContext) => boolean; // predicate
  check: (ctx: JudgmentContext) => LawFinding[]; // triggers
  tradeoffs: string[]; // when the law is knowingly violated
}
```

So `Little's Law` fires on queueing/backlog designs, `Goodhart's` on
metric-driven changes, `Conway's` on team/architecture restructuring, `Amdahl's`
on parallelism claims, `Brooks'` on added-late-headcount plans. Each law carries
provenance to its empirical basis (e.g. laws-of-software-engineering catalog).

### 5.3 EngineeringEvaluator — `src/engineering-intelligence/evaluator.ts`

The unified gate. Given a target, returns a structured review:

```ts
type EvaluationTarget =
  | { kind: 'code'; diff: string; paths: string[] }
  | { kind: 'design'; text: string }
  | { kind: 'plan'; text: string }
  | { kind: 'architecture'; text: string };

interface EngineeringFinding {
  tier: TierId;
  severity: 'info' | 'warning' | 'blocking';
  conceptId: string; // domain concept or law id
  message: string;
  evidence: string[]; // concrete anchors (file:line, tokens, stats)
  suggestion: string[];
  gate?: 'veto' | 'advisory'; // veto = blocks acceptance (constitution law 7/8 style)
}

interface EngineeringReview {
  targetId: string;
  findings: EngineeringFinding[];
  score: number; // tier-weighted, reusable by OrganicScoreEngine
  summary: string;
}
```

Evaluation layers, cheapest first:

1. **Deterministic zero-LLM gates** — complexity heuristics (nesting depth,
   loop-in-loop, O(n²)-shaped access patterns, missing early exits), coupling
   heuristics (import fan-in/out, module boundary crossings), duplication,
   dead-code markers, law triggers, data-structure smell patterns (e.g. array
   used as queue → ring-buffer signal).
2. **Evidence collection** — failure-mode enumeration (network disappears,
   DB stalls, disk full, memory exhausted, clock drift, dependencies
   unavailable) mapped to the diff's touched surfaces.
3. **LLM-assisted gates (optional, explicit spans)** — product thinking,
   economics estimates, taste assessment via `TasteEngine.assess`. Runs only
   when a provider is registered; otherwise deterministic gates only. Records
   findings as `uccp.trace.kind=explicit` spans (ADR-002 boundary preserved —
   no hidden reasoning).

Findings feed the existing **OrganicScoreEngine** (`src/kernel/constitution/
organic-score.ts`): veto-capable findings (Tier III SPOF, Tier VIII unrecovered
failure modes, Tier I pathological complexity) hard-reject regardless of
aggregate, mirroring the existing security/error-masking vetoes.

### 5.4 Wiring

- **Event bus** (`src/event-bus/`): subscribe to `review:requested`,
  `build:finished`, `test:failed`, `error:occurred`; schedule background
  evaluations (nervous-system signal priority table, priority 1–2).
- **Executive-brain pre-commit filter**: `EngineeringEvaluator` findings join
  the existing `integrity-checklist` inhibition gate as evidence.
- **MCP + CLI**: new tool `engineering-review` (25th MCP tool) and command
  `uch engineering-review <target>` in `src/mcp/stdio-server.ts` /
  `src/cli/index.ts`.
- **Agent context enrichment** (`src/agentic/context/`): a "judgment pack"
  middleware (patterned on the existing skills middleware) injects the top-N
  activated concepts for the current task — the enriched request described in
  the vision: CS foundations, SE principles, systems awareness, product
  context, laws, workspace genome, organizational memory, mental models.

### 5.5 Learning loop

- Evaluator findings with human/agent feedback → `TasteEngine.learn`
  (Tier IX reinforcement).
- `connectome:link` signals on activated concepts (weight reinforcement —
  `src/connectome/wiring.ts` already supports register-or-strengthen).
- Sleep-cycle distillation (`src/sleep_cycle/cycle.ts`) consolidates repeated
  concept activations into skill entries.
- **Tier X scan** (dream engine): periodic offline pass over the workspace
  genome + trace ledger searching for unknown unknowns: silent debt, dead
  code, duplicate concepts, inconsistent terminology, hidden assumptions,
  migration risks. Emits `suggestion` events, never self-applies changes.

## 6. Success criteria

- An `EngineeringReview` on a real diff is produced deterministically
  (zero-LLM gates) in < 1 s.
- Veto gates catch ≥ 80% of planted violations in a benchmark corpus (SPOF,
  O(n²) hot path, unrecovered failure mode, Goodhart-triggering metric).
- The judgment pack measurably changes agent behavior: planted-violation
  detection rises vs. no-enrichment baseline (A/B on the benchmark corpus).
- Every tier store ships with provenance; every law with applicability
  predicate + test.

## 7. Delivery phases

| Phase | Deliverable                                                                                       | Gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | This design doc + ADR-003                                                                         | ✅ Design review — 2026-07-31                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **B** | Domain stores: Tier I (CS) → VI (Laws) → III (Systems) → V (Economics) → II → VII → IV → VIII → X | **Wave 1 ✅** (2026-07-31): Tier I (69 concepts), Tier VI (12 laws), Tier III (12), Tier V (10) + `EngineeringEvaluator` + `analyzer`; 34 tests green, lint + scoped typecheck clean. **Wave 2 ✅** (2026-07-31): Tier II (20: coupling→evolvability), Tier VII (13 patterns with when-NOT-to-use), Tier IV (8 product), Tier VIII (9 failure), Tier X (9 unknown-unknowns) registered; Tier II coupling gate (change-amplification + import fan-out, advisory-only) in evaluator; symmetric containment in `DomainStore.activate` (derived-form matching: microservices/deploy/failed); diff-prefixed import counting in analyzer; 150 concepts across 8 stores; 26 new tests (60 total in layer); suite green, lint clean, scoped typecheck clean |
| **C** | `EngineeringEvaluator` + deterministic gates + persistence                                        | **Wave 3 ✅** (2026-07-31): benchmark corpus (5 veto / 7 advisory / 5 negative-control cases; `runEngineeringBenchmark` reports recall, vetoRecall, negative-control pass rate, latency) + `organic-hookup.ts` helpers (`autoTarget`, `coerceFindings`, `engineeringFindingsFor`) + `OrganicScoreEngine` engineering veto (`gate: 'veto'` findings hard-reject, record `vetoedBy`); MCP `organic-score` `engineeringTarget`/`engineeringFindings` inputs + CLI `--kind`/`--findings`; contract met: veto recall ≥ 80%, every target < 1 s, negative controls pass 100%; 41 tests green in scope; lint + scoped typecheck clean                                                                                                                      |
| **D** | Wiring: event bus, executive filter, MCP `engineering-review`, CLI, judgment-pack middleware      | **Wave 4 ✅** (2026-07-31): `EngineeringEnrichment` organ (git:commit/file:saved/test:failed/build:failed/error:occurred → `engineering:reviewed` event with findings + veto_count); MCP `engineering-review` tool; CLI `engineering-review` + `engineering-benchmark`; ExecutiveBrain `evaluateChange` attaches `engineeringReview` and escalates to review on veto; exoskeleton middleware + metabolism component; 13 new tests + 2 executive escalation tests; suite green, lint clean                                                                                                                                                                                                                                                           |
| **E** | Learning loop: taste feedback, connectome weights, sleep distillation, Tier X dream scan          | **Wave 5 ✅** (2026-08-01): `EngineeringLearningLoop` — taste reinforcement/penalty via `TasteEngine.learn`, activation accounting → `connectome:link` register-or-strengthen events, `getDominantPerProblemType` (SleepFrameworkSource contract) → sleep-cycle skill distillation; `DreamScan` — deterministic Tier X offline scan (6 unknown-unknown families over DNA mutations + trace ledger, `suggestion` events only); exoskeleton metabolism components `engineering-learning` + `dream-scan`; 11 new tests (171 in layer), tsc 0 errors, eslint clean                                                                                                                                                                                      |

Phases B–E are TDD waves under the GSD workflow; each lands as conventional
commits with the full suite green (100 test files / 1,738 tests baseline,
2026-07-31).

## 8. Risks and constraints

- **Scope discipline**: domain stores are data + activation logic, not
  frameworks. Any tier that grows beyond registry+gate contracts is moved to
  its own subsystem.
- **No hidden reasoning**: LLM-assisted gates record only explicit findings
  (ADR-002 §5). Deterministic gates are the default path.
- **Veto power is bounded**: only constitution-anchored gates (Tier III SPOF,
  Tier VIII unrecovered failure, Tier I pathological complexity) can veto;
  everything else is advisory evidence.
- **Knowledge rot**: concept definitions carry provenance and revision dates;
  sleep-cycle distillation flags stale or unused concepts for review.
- **Zero new dependencies**: all persistence, events, and scoring reuse
  existing seams (Storable, event bus, OrganicScoreEngine, TasteEngine).

## 9. References

- arXiv:2310.03533 — _Large Language Models for Software Engineering: Survey and Open Problems_
- arXiv:2004.10777 — _Code Smells and Refactoring: A Tertiary Systematic Review_
- laws-of-software-engineering.com — _Laws of Software Engineering_ (catalog of empirical laws)
- Manning — _The Coder Cafe_ (Teiva Harsanyi) — data-structure trade-off corpus
- [MANIFESTO §6](../MANIFESTO.md) — organ contract
- [ADR-002](ADR-002-otel-trace-engine.md) — observable/private trace boundary
