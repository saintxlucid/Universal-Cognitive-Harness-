# Phase 05: Digital Organism — Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Source:** User vision statement ("stop borrowing metaphors from biology and
actually engineer a digital organism" — 28-subsystem Complete Artificial
Organism spec) + verified on-disk audit of UCH + user selections
(Waves A+B, GSD plan-phase workflow)

<domain>
## Phase Boundary

The UCH project has mapped the *macro* anatomy: cortices
(`src/cortex_kernel/`), reflexes (`src/reflex/`), connectome
(`src/connectome/`), sleep (`src/sleep_cycle/`), metabolism
(`src/metabolism/`), immune + endocrine (`src/cognitive-core/`), genome
(`src/cognitive-plane/genome/`), calibration (`src/cognitive-plane/calibration/`).

The user's 28-subsystem vision audit (verified on disk 2026-07-31) shows
**~5 shipped, ~15 partial, ~8 missing**. The missing pieces are the
*microscopic biology* — the regulatory and developmental systems that turn a
collection of organs into a self-regulating organism:

| # | Vision subsystem | On-disk state | Verdict |
|---|---|---|---|
| 1 | Artificial DNA | `species-genome.ts` (18 laws, 10 commitments) + `workspace-dna.ts` (fingerprint only — NO allele layer, 03-05 never landed) | Partial |
| 2 | Gene Expression | genome is passive | **Missing** |
| 3 | Epigenetics | none (03-05 allele layer absent) | **Missing** |
| 4 | Neural Development | vision layer 7 only | **Missing** (deferred) |
| 5 | Myelination | `fast-path-router.ts` (static prefix trie) | Partial |
| 6 | Synaptic Plasticity | `connectome/wiring.ts` (weighted edges, activate, link) | Partial |
| 7 | Neurogenesis | — | **Missing** |
| 8 | Neural Pruning | connectome `checkIntegrity` only | **Missing** |
| 9 | White Matter | connectome + fast paths | Partial (deferred) |
| 10 | Context Flow | `mnemosyne/` + `context/` | Shipped |
| 11 | Resource Circulation | `metabolism/` + control-plane budgets | Shipped |
| 12 | Hormones | `cognitive-core/endocrine.ts` — 8-signal tracker, no behavioral modes | Partial |
| 13 | Circadian Rhythm | — | **Missing** |
| 14 | Sleep | `sleep_cycle/cycle.ts` (8-stage pipeline, framework source) | Shipped |
| 15 | Dreams | — | **Missing** (deferred) |
| 16 | Imagination | none (`physiology/counterfactual.ts` absent) | **Missing** (deferred) |
| 17 | Inner Speech | OTel trace engine (event records only) | **Missing** (deferred) |
| 18 | Intuition | frontier-mapper + EI layer + framework select | Partial (deferred) |
| 19 | Consciousness Levels | `aether/consciousness.ts` (`reflex/working/strategic/reflective/meta`) | Partial |
| 20 | Pain | `reflex/gate.ts` `zoneAffect` seam + `PAIN_ESCALATION_THRESHOLD`; NO pain-memory store | Partial |
| 21 | Pleasure | — | **Missing** |
| 22 | Curiosity | `frontier-mapper/` (research gaps) | Partial (deferred) |
| 23 | Instinct Library | `src/reflex/` gate + checks; `suit/instinct/` legacy | Shipped |
| 24 | Belief System | `kernel/epistemic/` + calibration takes (conviction) | Partial |
| 25 | Theory of Mind | — | **Missing** (deferred) |
| 26 | Immune Memory | `cognitive-core/immune.ts` (threat scans only, no vaccination) | Partial |
| 27 | Homeostasis | metabolism budgets only; no cross-system regulator | Partial |
| 28 | Executive Federation | `cortex_kernel/` (executive-cortex, meta-brain, integrator) | Partial (deferred) |
| + | Physiology Layer | `src/physiology/` DOES NOT EXIST (03-05 never executed) | **Missing** |

**Critical audit finding:** the 03-05 plan (genome evolution + prediction
cortices) never landed — `src/physiology/`, the allele layer, pain-memory
store, counterfactual engine and prediction cortices are all absent. Phase 05
is additive over the *actual* baseline, and the new `src/physiology/`
directory is created fresh, not extended.

**The genuine delta this phase ships — ten subsystems (Waves A + B):**

*Wave A — Physiology Core (the user's "final gap"):*
1. **Hormone Engine** — dopamine / cortisol / melatonin / adrenaline /
   serotonin as **global operating modes** (explore / caution / maintain /
   sprint / stabilize / balanced) that change *behavior* of other subsystems
   (reflex strictness, verification depth, exploration rate, sleep
   scheduling) — not just numbers on a dashboard.
2. **Circadian Rhythm** — diurnal scheduler: morning fast execution,
   afternoon balanced, night maintenance (consolidation, compression,
   research, benchmarking, evolution). Injectable clock, deterministic.
3. **Homeostatic Regulator** — the Cognitive Physiology Layer core: senses
   memory growth, token usage, context size, CPU/load, costs, latency,
   knowledge freshness, confidence, plugin health, graph integrity →
   regulates (prune, consolidate, throttle, heal, grow, evolve) toward
   equilibrium. Aging, healing, growth and evolution governed here.
4. **Pleasure System** — positive reinforcement: successful outcomes
   (pr:merged, build:finished, test:passed) strengthen connectome pathways
   and raise dopamine — the polar opposite of the pain seam.
5. **Gene Expression + Epigenetics** — species genome becomes *active*:
   project-type detection activates genes (game engine → rendering/physics/
   memory genes); outcome history modulates expression strength (repeated
   security bugs → security genes dominant → stricter reviews). No code
   changes — pure weight modulation.

*Wave B — Memory Physiology:*
6. **Neural Pruning** — obsolete knowledge removal: connectome stale nodes
   and weak edges, memory duplicates (merge by content hash), unused skills
   (archive), low-relevance knowledge (decay). Enacts law:5 Universal Decay.
   Archived ≠ deleted (reversibility, law:12).
7. **Neurogenesis** — capability creation: repeated task patterns (framework
   journal dominant-per-problem-type + frontier gaps + instinct misses) →
   create a registered specialist capability (fast-path routine from a
   deterministic-engine template, or a reflex check, or a skill entry).
8. **Belief Objects** — beliefs as evolving hypotheses: { claim, confidence,
   strength, evidence, source, status } — verification outcomes move
   confidence, disconfirmation decays it, duplicates merge. Facts stay
   verified; beliefs stay hypotheses. Feeds the calibration takes fence.
9. **Myelination** — frequency → reflex promotion: frequently used
   deterministic pipelines (frameworks, checks) are promoted into fast-path
   routines (registered handlers) and cached — the organism literally
   becomes faster because it practiced.
10. **Immune Vaccination** — threat → persistent recognition: after a threat
    is handled, a vaccine (signature + countermeasure) is stored; subsequent
    matching threats are recognized instantly. Seed vaccines from the CIC
    threat-mitigations registry (prompt injection, malicious packages).

All ten must reuse the existing event bus, nervous-system signals, Storable
persistence, branded types, and the verified integration surface in
`src/exoskeleton/exoskeleton.ts`. No new runtime dependencies. Everything is
deterministic and LLM-free (hormones/circadian/homeostasis/pruning/pleasure/
beliefs/vaccination are pure state machines; neurogenesis creates engines,
not model calls; myelination registers existing engines as fast paths).
</domain>

<decisions>
## Implementation Decisions

### D-01: Subsystem layout
- **Create `src/physiology/`** (fresh — the 03-05 plan never landed):
  `circadian.ts`, `homeostasis.ts`, `pleasure.ts`, `pruning.ts`,
  `neurogenesis.ts`, `beliefs.ts` + `index.ts`.
- **Extend in place** (no parallel modules):
  - `src/cognitive-core/endocrine.ts` → hormone engine (operating modes)
  - `src/cognitive-plane/genome/species-genome.ts` → gene expression +
    epigenetic modulation
  - `src/agentic/fastpath/fast-path-router.ts` → myelination promotion
  - `src/cognitive-core/immune.ts` → vaccination store
- Locked: one cohesive physiology layer; every new organ implements
  `Storable` where state persists; no new runtime dependencies
  (runtime deps stay exactly `openai` + `@opentelemetry/api`).

### D-02: Hormones are operating modes, not emotions
- Five hormones with levels 0-1, derived **deterministically** from
  `GlobalSignals` + reward/pain events (pure function, injectable clock):
  dopamine (exploration/reward), cortisol (caution/verification),
  melatonin (maintenance), adrenaline (speed), serotonin
  (stability/refactoring).
- The dominant hormone defines an `OperatingMode`:
  `explore | caution | maintain | sprint | stabilize | balanced`.
- Mode consumers (wired, not hard-coded): reflex gate strictness
  multiplier (cortisol ↑ → stricter), verification depth (adrenaline ↑ →
  speed over optimization), curiosity/frontier scan rate (dopamine ↑),
  sleep scheduling (melatonin ↑ → maintenance), pruning aggressiveness
  (serotonin ↑ → deeper cleanup).
- `EndocrineSystem` gains `getMode()`, `getHormones()`, `getLevel(name)`;
  existing `getSignals()/setSignal()/tick()` semantics preserved.
- Locked: hormones NEVER directly block actions — they modulate thresholds
  of the reflex/judgment tiers; the modulation is observable in the
  `hormone:changed` event.

### D-03: Circadian rhythm — schedule, not enforcement
- Injectable `Clock` (`now(): Date`) everywhere — zero `Date.now()`
  directly in engines (determinism contract, mirrors D-13).
- Phase from local hour: `morning` (sprint-leaning budgets),
  `afternoon` (balanced), `evening` (declining), `night` (maintenance).
- `CircadianRhythm.phaseAt(now)` is a pure function; the scheduler
  component emits `circadian:phase` events on transition and suggests
  maintenance windows to the homeostatic regulator + sleep scheduler.
- Locked: circadian rhythm never forces work off-hours — it modulates
  budgets and schedules maintenance; the organism must remain responsive
  at any hour (production incidents do not wait for morning).

### D-04: Homeostatic Regulator — the Cognitive Physiology Layer core
- Sensors (read-only, from existing stores): memory growth
  (hippocampus/mnemosyne counts), token usage + budgets (Metabolism),
  context size (ContextFlow), CPU/load (Metabolism profile), API costs
  (budgets), latency (telemetry), knowledge freshness (calibration +
  decay), confidence (calibration profile), plugin health (control-plane),
  graph integrity (Connectome.checkIntegrity).
- Setpoints + tolerance bands per metric (configurable, persisted).
- Regulation actions (deterministic, scheduled — never on the hot path):
  `prune` (call pruning organ), `consolidate` (schedule sleep cycle),
  `throttle` (Metabolism budget override), `heal` (connectome repair),
  `grow` (neurogenesis trigger), `evolve` (gene expression strength
  adjustment), `escalate` (signal to executive via nervous system).
- Aging (law:5), healing, growth and evolution all route THROUGH this
  regulator — it is the single coordination point, not a parallel system.
- Emits `homeostasis:regulated` events with the metric deltas.
- Locked: one regulator instance per workspace; its loop runs on a
  schedule (circadian-driven), never synchronously inside an event handler.

### D-05: Pleasure system — the reward pole
- Reward events: `pr:merged`, `build:finished`, `test:passed`,
  `ci:passed`, `review:submitted` (positive outcome), `skill:distilled`.
- Effects: connectome edge weights for the involved problem-type/framework
  nodes strengthened (+reward), dopamine raised, pleasure history recorded.
- Mirrors pain memory's zone semantics: reward applies to *zones*
  (path/domain) so future decisions in rewarded zones see relaxed
  thresholds (opposite pole of `zoneAffect`).
- Persisted via Storable; emits `reward:gained` events.
- Locked: rewards are bounded (weight cap, matching connectome's
  `maxWeight`); no unbounded positive feedback loops.

### D-06: Gene expression + epigenetics
- `SpeciesGenome` gains an in-place additive layer:
  - `Gene`: { id, name, description, expression (0-1), activators:
    keywords/domains, halfLife (expression decay), immutable flag }.
  - `express(workspaceContext)` → active genes (activator match on
    project type/keywords/files) with expression strengths.
  - Epigenetic modulation: outcome counters (security incidents, outages,
    merge success rate) → expression multipliers per gene domain,
    decaying back to baseline over time (law:5). `modulateExpression()`
    is deterministic and recorded.
- No new event types from the genome itself; expression changes surface
  via the existing event bus where consumers subscribe
  (e.g., `engineering:reviewed` outcomes feed the counters).
- Locked: immutable genes (laws/commitments) never change expression;
  only mutable genes (engineering principles, risk profile, quality
  standards, capabilities) carry expression strength.

### D-07: Neural pruning — enacting law:5 Universal Decay
- Targets (all read-only inputs; pruning produces archive records):
  - Connectome: nodes/edges past half-life with low weight (stale),
    orphaned nodes, dangling edges (`checkIntegrity` output).
  - Memory: duplicate consolidation candidates (content-hash merge),
    low-relevance episodes (decayed below threshold).
  - Skills: unused skills → archived (not deleted; reversible, law:12).
  - Beliefs: retired beliefs (see D-09) purged from active set.
- `PruningReport`: { pruned, merged, archived, retained } per target with
  ids; persisted; emits `pruned:completed`.
- Locked: pruning never touches the workspace genome, immutable laws, or
  any file outside the organism's own stores; archived entities remain
  restorable (Storable archive files).

### D-08: Neurogenesis — enacting law:9 Developmental Lifecycle
- Signals: framework journal `dominantPerProblemType`, frontier-mapper
  open gaps, reflex gate misses (defer → never resolved), repeated
  `tool:called` families.
- Creation: when a pattern repeats ≥ N times (configurable), create a
  capability: register a fast-path routine wrapping an existing
  deterministic engine (frameworks), or a reflex check from a seed
  pattern, or a skill entry from a template. The created artifact is a
  REAL registered entity, not a metaphor.
- Records `neuron:created` { id, kind, source, pattern, artifact }.
- Locked: neurogenesis creates *wrappers over existing engines* — it
  never invents new logic by itself; capabilities are deterministic.

### D-09: Belief objects
- `Belief`: { id, claim, confidence (0-1), strength, evidence: string[],
  source, status: `tentative | held | contested | retired`, updatedAt }.
- Evolution: verification outcome (correct/incorrect/partial mapping to
  calibration `TakeQuality`) moves confidence; no evidence → decay toward
  prior (law:5); identical claims merge (evidence union).
- Integration: beliefs can seed the calibration takes fence (claim →
  take with conviction = confidence); calibration resolutions feed back.
- Facts are verified statements; beliefs are hypotheses — the store keeps
  them strictly separate (epistemic distinction, `kernel/epistemic/`).
- Emits `belief:updated` on significant changes (status transitions).

### D-10: Myelination — frequency → reflex promotion
- Source signals: FrameworkTraceRecorder stats (usageByFramework),
  framework journal usage, fast-path router stats (misses → candidates).
- Promotion: pipeline used ≥ threshold times (default 10) with stable
  verdicts → register a fast-path routine (PrefixTrie handler) wrapping
  the engine; result-shape caching for repeated inputs (deterministic
  engines only — never LLM).
- Records `myelinated:promoted` { engine, routineId, usageCount }.
- Locked: promotion only for deterministic zero-LLM pipelines; cached
  results invalidated on catalog version change
  (`FRAMEWORK_CATALOG_VERSION`).

### D-11: Immune vaccination
- `Vaccine`: { id, pattern (threat signature), countermeasure,
  source, createdAt, hits }.
- Acquisition: after a threat is handled (immune scan → mitigation or
  `error:occurred` with known root cause) → store a vaccine for the
  signature; seed vaccines from the CIC threat-mitigations registry
  (prompt injection, malicious package, dangerous command shape).
- Recognition: immune/reflex scans check vaccines before full analysis →
  known signature → immediate countermeasure, `vaccine:acquired`/hit
  recorded.
- Extends `ImmuneSystem` in place (new `vaccines` store + `checkVaccines()`
  + `acquireVaccine()`); existing threat-scan semantics unchanged.
- Locked: vaccines match on deterministic signatures (string/regex/shape
  hashes), never on model judgment; the store is bounded (LRU cap).

### D-12: New event types (justified — genuinely new physiology)
- `hormone:changed`, `circadian:phase`, `reward:gained`,
  `homeostasis:regulated`, `pruned:completed`, `neuron:created`,
  `belief:updated`, `myelinated:promoted`, `vaccine:acquired`,
  `vaccine:hit`.
- All inserted into the STATIC `signalPriorityForType` map in
  `src/nervous-system/signal.ts` (not the bus file) at low priority 1-3.
  The dynamic escalation — `vaccine:hit` and `hormone:changed` emitted at
  priority 4 when cortisol spikes / threat is critical — is done at
  EMISSION time via `createSignal(..., { interrupt: true, interruptLevel: 4 })`
  (the static map is type→priority, it cannot be cortisol-dependent).
  No existing event type is renamed or repurposed.

### D-13: Testing contract
- All physiology tests: deterministic, LLM-free vitest, temp-dir lifecycle
  (`mkdtempSync` + cleanup), **injectable clock** everywhere (no
  `Date.now()` directly in engine code — pure functions take `now`).
- TDD: RED scaffolds first per plan (member/collection RED), then GREEN.
- Gate: full suite + `tsc --noEmit` + `eslint src/` + `npm run build`
  green; no test altered outside `files_modified`; no provider calls; no
  real secrets in fixtures.
- Known flake (do not chase): `ingester-injection.test.ts` fails under
  full parallel load (shared `os.tmpdir()` contention), passes alone.

### D-14: File ownership + DOE compliance
- Follow `design/DIRECTIONS.md` (DOE): git-status file ownership (never
  edit files another wave owns), stash-prove typecheck, TDD waves,
  recorded learning.
- New organs live in new files (`src/physiology/*`) or extend the four
  listed existing modules in place — no edits to modules outside the
  plan's `files_modified`.

### D-15: Phase deliverable documents
- Design doc `design/DIGITAL-ORGANISM.md` produced by the orchestrator
  BEFORE execution (contract for the phase; mirrors 03-D11).
- Conformance: the workspace's vision-claims surface is the DATED report
  `docs/vision-conformance-2026-07-31.md` — NOT `design/CONFORMANCE.md`
  (verified: that file is the CIC fixtures/compatibility doc, 126 lines,
  no claims table). The ten new claims are appended to the vision-conformance
  report after execution; `planning/05-digital-organism/05-VALIDATION.md`
  records the per-wave acceptance evidence.
- Locked: design doc precedes execution; it must match the plans' claims
  exactly.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Physiology integration surface (existing, verified)
- `src/cognitive-core/endocrine.ts` — EndocrineSystem (8 GlobalSignals, modulate, tick; extension point for hormone engine)
- `src/cognitive-core/immune.ts` — ImmuneSystem (threat scans; extension point for vaccines)
- `src/metabolism/metabolism.ts` — Metabolism (config, BudgetOverride; homeostasis sensor + throttle target)
- `src/sleep_cycle/cycle.ts` — SleepCycle (SleepPhase incl. dreaming, 8-stage nap, framework source; circadian/homeostasis consumers)
- `src/connectome/wiring.ts` — Connectome (weighted edges, activate, link, checkIntegrity, Storable; plasticity/pruning/reward targets)
- `src/agentic/fastpath/fast-path-router.ts` — PrefixTrie + FastPathRouter (stats; myelination promotion target)
- `src/reflex/gate.ts` — ReflexGate (zoneAffect seam, PAIN_ESCALATION_THRESHOLD; cortisol consumer, pain pole)
- `src/cognitive-plane/genome/species-genome.ts` — SpeciesGenome (18 laws incl. law:5 decay, law:9 lifecycle, law:13 minimal consciousness, law:17 fusion; gene-expression extension point)
- `src/cognitive-plane/calibration/` — TakeFence, CalibrationStore, computeCalibrationProfile (beliefs integration)
- `src/kernel/epistemic/` — epistemic foundation (facts vs beliefs distinction)
- `src/frontier-mapper/frontier-mapper.ts` — FrontierMapper (research gaps; neurogenesis signal)
- `src/aether/consciousness.ts` — ConsciousnessLayer + state (mode consumer)
- `src/cognitive-plane/frameworks/` — registry/journal/tracing (myelination + neurogenesis sources)
- `src/event-bus/neural-event-bus.ts` — 86 existing event types (verified on disk 2026-07-31; D-12 additions)
- `src/nervous-system/signal.ts` — `signalPriorityForType` static priority table + `createSignal` (D-12 additions live HERE, not in the bus file)
- `src/cognitive-plane/persistence/persistence-engine.ts` — Storable, writeSnapshot, readSnapshot
- `src/exoskeleton/exoskeleton.ts` — component wiring surface (lines ~89-230)

### Governance
- `design/DIRECTIONS.md` — DOE rules (SOPs, verification gate, file ownership, debt register)
- `design/CONFORMANCE.md` — claims table (Phase-05 rows appended)
- `design/ENGINEERING-PHYSIOLOGY.md` — phase-03 design doc (adopted concepts)

### Prior phase context
- `planning/01-organism-organs/01-CONTEXT.md` — graph/DNA conventions
- `planning/03-engineering-physiology/03-CONTEXT.md` — physiology conventions this phase extends
- `planning/03-engineering-physiology/03-05-PLAN.md` — plan format to mirror (frontmatter + must_haves + tasks) and the 03-05 scope that NEVER landed (do not assume it exists)
</canonical_refs>

<specifics>
## Specific Ideas

- The hormone engine's canonical mapping MUST be covered by real tests:
  cortisol rises after `error:occurred` outages and raises the reflex
  strictness multiplier; adrenaline after a `prompt:sent` with urgency
  ≥ 0.8 biases verification depth down; melatonin at night (circadian)
  biases the regulator toward consolidation.
- Pleasure's canonical example: repeated `pr:merged` in `src/` raises the
  connectome weight between problem-type and framework nodes for that
  zone — the organism "prefers" what succeeds.
- Neurogenesis's canonical example: 10+ `rca`/`five-whys` invocations in a
  database-adjacent zone → the organism creates a `db-specialist` fast-path
  routine wrapping the RCA engines.
- Belief's canonical example: "this project values simplicity" with
  confidence 0.74, contested by a complexity regression, retired when
  confidence falls below 0.2.
- Pruning's canonical example: a connectome node with weight 0.05, last
  activated 90 days ago (injectable clock), no neighborhood → archived,
  restorable.
- The user's "no code changes — the organism adapts" (epigenetics) is the
  acid test: security-bug outcomes must change review strictness through
  expression weights alone, with zero new checks.
</specifics>

<deferred>
## Deferred Ideas

- **Dreams (vision #15) + Imagination Cortex (#16)** — combinatorial
  ideation + whole-project what-if simulation; requires the Digital Twin
  (02-01 plan) and the dream engine (Layer 7). Later wave.
- **Theory of Mind (#25)** — collaborator profiles (Alice: backend, strict
  reviewer, performance focus); requires agent-attach telemetry maturity.
- **Executive Federation (#28)** — meta-executive arbitration exists in
  `cortex_kernel/`; full federation with per-domain executives is a later
  wave.
- **Inner Speech (#17)** — structured reasoning-state layer (hypotheses/
  evidence/plans/verification checkpoints as auditable records); the OTel
  trace engine is the substrate, but the state layer itself is separate.
- **Neural Development stages (#4)** — the 7-stage ladder remains Layer-7
  vision; neurogenesis (D-08) is the first mechanical step.
- **Consciousness-level routing (#19)** — the layer type exists
  (`aether/consciousness.ts`); routing *events* by level is a later wave.
- **Completing the unlanded 03-05 scope** (genome allele layer, prediction
  cortices, counterfactual engine, pain-memory store) — NOT a dependency
  of phase 05; re-planned separately if requested.
- Cross-workspace collective genome — phase 06+ frontier.
</deferred>

---

*Phase: 05-digital-organism*
*Context gathered: 2026-07-31 via user vision + on-disk audit + user decisions*
