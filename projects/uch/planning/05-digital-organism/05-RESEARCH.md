# Phase 05 Research: Digital Organism (Waves A + B — physiology core + memory physiology)

*Verified against the live repo 2026-07-31. All line numbers/paths checked on disk.*

---

## 1. Baseline audit — what 03 claimed vs. what exists

The 03-engineering-physiology phase landed **only part** of its scope:

| 03 claim | On-disk reality (verified) |
|---|---|
| Reflex Gate (`src/reflex/gate.ts`, checks, types) | ✅ EXISTS — `ReflexGate`, verdicts, `PAIN_ESCALATION_THRESHOLD = 0.7`, `zoneAffect` provider seam, `makeProposal` tests |
| Reflex interception (file-editor/command-runner) | ⚠️ `reflex-interception.test.ts` exists (untracked, 9 tests) — interception wiring state unclear; do not assume |
| Taste Engine | ✅ EXISTS — `src/cognitive-plane/taste/taste-engine.ts` (TasteDimension, TastePreference, TasteFeedback, TasteAssessment) |
| `src/physiology/` (evolution, predictions, counterfactual, pain-memory) | ❌ **DOES NOT EXIST** — directory absent; 03-05 never executed |
| WorkspaceDNA allele layer (mutate/alleles/snapshots) | ❌ ABSENT — `workspace-dna.ts` has only `DnaMutation` + fingerprint + mutation counting |
| Pain-memory store | ❌ ABSENT — only the `zoneAffect` injection seam + threshold constant in the reflex gate |

**Consequence for phase 05:** the physiology layer is created fresh. Nothing
in this phase may import from `src/physiology/*` (it will exist only after
this phase's plans land). Gene expression (D-06) does NOT depend on the
allele layer — expression strength lives in `SpeciesGenome`.

## 2. EndocrineSystem — the hormone engine extension point

`src/cognitive-core/endocrine.ts` (92 lines, verified):

- `GlobalSignals`: urgency, confidence, uncertainty, resourcePressure,
  technicalDebtLevel, riskLevel, userSatisfactionTrend, cognitiveLoad —
  all 0-1, clamped.
- Constructor subscribes to the `NervousSystem` bus (`brainstem` channel,
  `endocrine-listener` tag); `onSignal` currently reacts to
  `error:occurred` (uncertainty +0.05, confidence −0.05) and `aether:tick`
  (cognitiveLoad sync).
- `modulate(key, delta)` — clamped linear delta. `tick()` syncs urgency/
  load/uncertainty from `Consciousness.getState()` and appends history
  (capped 1000). `destroy()` unsubscribes.

**Extension (hormone engine):** keep all existing members; add
`HormoneLevels { dopamine, cortisol, melatonin, adrenaline, serotonin }`,
`getMode()`, `getHormones()`, `getLevel(name)`, `computeHormones(input)`
(pure function), reward/pain ingestion hooks. The nervous-system
subscription gains: `pr:merged`/`test:passed` → dopamine up;
`error:occurred` outage → cortisol up; `circadian:phase` night →
melatonin up; urgency ≥ 0.8 → adrenaline up; stable week (no
errors, merges landing) → serotonin up. **Do not break** the existing
`modulate`/`getSignals` contract — `tick()` tests exist
(`cognitive-core.test.ts`).

## 3. SpeciesGenome — the gene-expression extension point

`src/cognitive-plane/genome/species-genome.ts` (verified):

- `GenomeLaw`: 18 laws — critical anchors for phase 05:
  - **law:5 Universal Decay** — "Every entity carries a birth timestamp,
    half-life, and decay function" → normative basis for pruning + belief
    decay + epigenetic decay.
  - **law:9 Developmental Lifecycle** — "Every component passes through
    defined lifecycle stages" → normative basis for neurogenesis.
  - **law:13 Minimal Consciousness** — → hormones/circadian operate below
    the executive tier.
  - **law:17 Signal Fusion** — weak signals only act in aggregate →
    hormones derive from multiple signals, never one.
  - **law:2 Conservation of Energy / law:14 Economic Rationality /
    commitment:8 "Never starve a component"** → homeostasis authority.
- `ImmutableCommitment`: 10 commitments (incl. "Never stop learning").
- `SpeciesGenome` class — laws()/commitments() accessors; config carries
  speciesName/speciesVersion.

**Extension:** additive gene layer — `Gene`, `GeneDomain`, expression
strength 0-1, activators, halfLife; `express(context)`; epigenetic
modulation via outcome counters. Immutable laws/commitments untouched.

## 4. Connectome — plasticity, reward, and pruning target

`src/connectome/wiring.ts` (verified):

- `Connection`: from/to/type/weight (default 1)/activation/
  lastActivatedAt + `ConnectionType` ('event-driven'|'data-flow'|
  'control'|'reference').
- `registerNode/removeNode/hasNode/getNodes` — `removeNode` cascades edge
  removal.
- `link(from, to, type, description?, weight?)` — register-or-strengthen,
  capped at `config.maxWeight`, delta `config.strengthenDelta`.
- `setWeight(id, weight)`, `activate()` (BFS with per-hop decay +
  lastActivatedAt), `getNeighborhood()` (activation-ordered), `rankPaths`.
- `checkIntegrity()` → weak connectivity, components, dangling edges,
  emergency-broadcast flag.
- `Storable` persist/load with date round-trip.

**Uses:** pleasure (D-05) = `link()`/`setWeight()` on reward; pruning
(D-07) = stale-node/weak-edge removal + integrity repair (heal);
plasticity metadata (confidence/reliability per edge) is NOT present —
belief store covers the confidence dimension instead of extending
Connection (keeps this phase additive).

## 5. SleepCycle — circadian/homeostasis consumer

`src/sleep_cycle/cycle.ts` (verified):

- `SleepPhase = 'awake' | 'napping' | 'deep-sleep' | 'dreaming' | 'waking'`
  — the **dreaming** phase type already exists (engine deferred).
- `SleepCycle` — 8-stage pipeline (scout/filter/extract/score/generate/
  review/publish) with real metrics; `nap()` returns `SleepReport`.
- `SleepMemorySource`/`SleepSkillSink`/`SleepFrameworkSource` adapters;
  `createKernelMemorySource(kernel)`.

**Uses:** circadian night phase schedules `nap()` windows; homeostasis
`consolidate` action triggers it; melatonin modulates its cadence.

## 6. Metabolism — homeostasis sensor + throttle target

`src/metabolism/metabolism.ts` (verified):

- `Metabolism` — per-component `EnergyAllocation` budgets,
  `BudgetOverride` map, `registerComponent(id, budget?)`,
  `getAllBudgets()`, `getStatus(componentId)`, `getStarvedComponents()`,
  `getEnergyLogs(count)`, `getStats()`; ROI-based economic gate with
  pending proposals; tick timer + `refresh()`.
- Exoskeleton registers components (incl. `engineering`).

**Uses:** homeostasis sensors read `getAllBudgets()`/`getStarvedComponents()`
(resourcePressure, token/cost pressure); `throttle` action = BudgetOverride
insertion; `escalate` = starved-component alert to executive.

## 7. FastPathRouter — myelination target

`src/agentic/fastpath/fast-path-router.ts` (verified):

- `RoutineHandler { name, match, execute }`; `PrefixTrie` (insert,
  collectCompletions, size); `FastPathRouter`: `register(routine)`,
  `resolve(input)` → `RoutineResult | null`, `getStats()` (resolved/
  missRate/avgResolutionMs), `listRoutines()`, `trim(maxCalls)`.
- Exoskeleton builds it with 3 builtin routines (status/health/memory) +
  framework routines (`buildFastPathRouter`, wireFrameworkConnectome).

**Uses:** myelination (D-10) registers new routine handlers from
deterministic engines on frequency threshold; `getStats()` is the sensor.

## 8. ImmuneSystem — vaccination target

`src/cognitive-core/immune.ts` (verified):

- `ThreatAssessment { severity, source, description, subsystem,
  recommendation }`; `ImmuneSystem` holds policies (PolicyEngine), auth
  (Auth), reflexEngine (suit/instinct ReflexEngine — note: the LEGACY
  engine, imported as `ReflexEngine` from `../suit/instinct/reflex-engine.js`).
- `tick()` scans (agent count, etc.), `reportThreat()`.

**Uses:** vaccination (D-11) adds a vaccines store + `checkVaccines()` +
`acquireVaccine()`; seed patterns come from the CIC registry
(`src/kernel/cic/threat-mitigations.ts` — verified present). NOTE: there is
NO `THREAT_MITIGATIONS` const array — the registry exports 14 mitigation
CLASSES implementing the `ThreatMitigation` interface (`id: ThreatID`,
`description`, `severity`, `subsystem`, `detect(immune, policies)`,
`mitigate(immune, policies)`, `isActive`): T01 UnauthorizedMemoryAccess, T02
CrossProjectContamination, T03 PrivilegeEscalation, T04 ConsentBypass, T05
DataExfiltration, T06 RunawayProcess, T07 CascadingPolicy, T08 ReplayAttack,
T09 ConsolidationPoisoning, T10 RetentionPolicy, T11 HardDeleteWithoutAudit,
T12 TimingSideChannel, T13 TokenExhaustion, T14 SessionHijacking
(verified lines 5-33, `src/kernel/cic/threat-mitigations.ts:5`).
Vaccine seeds = deterministic signatures derived from these class ids +
descriptions (e.g. pattern `T03:PrivilegeEscalation`); exercised by
`src/__tests__/threat-mitigations-all.test.ts`.

## 9. Calibration + epistemic — belief integration

- `src/cognitive-plane/calibration/takes.ts` — `Take` (claim, conviction,
  domain, status, quality, outcome, evidence), `TakeFence`,
  `QUALITY_VALUES` ('correct'|'incorrect'|'partial'|'unresolvable').
- `src/cognitive-plane/calibration/calibration.ts` — `brierForTake`,
  `computeCalibrationProfile` (scorecards, buckets, narratives).
- `src/kernel/epistemic/` — `epistemic-immune.ts`, `elevation-engine.ts`,
  `inquiry-contract.ts` — the facts-vs-claims distinction lives here.
- `FrameworkDecisionJournal.toTakes()` + `syncTakesWithJournal` — precedent
  for belief→take seeding (journal → takes fence, domain 'framework').

**Uses:** beliefs (D-09) seed the takes fence with `domain: 'belief'`;
calibration resolutions feed belief confidence.

## 10. FrontierMapper — neurogenesis signal

`src/frontier-mapper/frontier-mapper.ts` (verified):

- `ResearchGap { id, claim, kind, evidence, status: open|claimed|resolved,
  createdAt }`, `GapStats`, `FrontierScanInput`; class `FrontierMapper`.

**Uses:** repeated open gaps + framework-journal dominance → neurogenesis
candidates.

## 11. Event bus + signal priority table — D-12 additions

86 existing event types (verified on disk 2026-07-31: `EventType` union,
lines 1-87 of `src/event-bus/neural-event-bus.ts` — file/git/terminal/
test/build/ci/prompt/tool/error/debug/dependency/pr/review/workspace/agent/
session/sleep/consolidation/skill/prediction/memory/module/aether/mcp +
framework + EI additions; `signal:fused`, `connectome:link`,
`engineering:reviewed` present). The STATIC priority table is
`signalPriorityForType: Map<EventType, SignalPriority>` in
`src/nervous-system/signal.ts` (0 peripheral … 4 cortex) — the D-12
insertions go THERE, and dynamic escalation to interrupt level 4 happens at
emission time via `createSignal(..., { interrupt: true, interruptLevel })`.
Phase 05 adds 10 new types (CONTEXT D-12) — all additive, no renames. The
`skill:distilled` pattern (metadata.importance + provenance) is the
template for the new event payloads.

## 12. Exoskeleton wiring surface

`src/exoskeleton/exoskeleton.ts` (verified): components wired —
metabolism, immuneSystem, endocrineSystem, sleepCycle, connectome,
fastPath + `registerComponent('engineering')` + `wireFrameworkConnectome()`.
Phase-05 organs register as components (`registerComponent('physiology')`)
and the exoskeleton exposes them (lazy getters per workspace-brain
precedent — no eager I/O, L6).

---

## 13. Landmines

### L1 — `src/physiology/` does not exist yet
Do not import from it anywhere in phase-05 plans' pre-existing code.
Plans create it.

### L2 — TWO reflex engines exist
`src/reflex/` (new gate: ReflexGate, zoneAffect, checks) AND
`suit/instinct/reflex-engine.ts` (legacy: ReflexEngine with
block/warn/info) — `immune.ts` imports the LEGACY one. Phase 05 touches
`src/reflex/gate.ts` only for the strictness-multiplier seam; do not
rewire immune's import.

### L3 — EndocrineSystem determinism
Existing `tick()` reads `Consciousness.getState()` — fine. New hormone
computation must take an explicit `now: Date` (or Clock) — no Date.now()
inside engine code (D-13). Tests use fixed sequences.

### L4 — Connectome weight caps
`link()`/`setWeight()` are capped at `maxWeight` — pleasure rewards must
respect the cap; tests assert the cap, not unbounded growth.

### L5 — No new runtime dependencies
Runtime deps stay `openai` + `@opentelemetry/api`. Type-only imports
allowed. No third-party scheduling/date libraries — the injectable Clock
is a 10-line interface.

### L6 — DOE file ownership
Plans must declare `files_modified` and only touch those; the parallel
waves (04-brain-suit-separation etc.) own `src/cli/index.ts`,
`src/mcp/stdio-server.ts`, `src/event-bus/neural-event-bus.ts` — phase-05
plans edit the event bus ONLY via the documented D-12 additive pattern,
and only if no parallel wave currently owns it (check git status first).

### L7 — Test-file lint discipline
Unused args/vars in test files fail `eslint src/` (learned twice:
`_limit`, `_z`, duplicate `report`). New scaffolds: prefix unused params
with `_`, no dead consts.

### L8 — Known suite flake (do not chase)
`ingester-injection.test.ts` fails 3 tests under full parallel load,
passes alone — shared `os.tmpdir()` contention (`X:\DAIRA\.tmp`). Phase-05
tests use unique mkdtemp prefixes (`uch-<organ>-`) and avoid shared temp
roots.

### L9 — Journal persistence path
Framework journal persists to `.uccp/persist/framework-journal.json`
(git-ignored). Phase-05 Storable artifacts go to the same convention
(`.uccp/persist/`) — never into memory DBs or source tree.

### L10 — Belief/calibration round-trip
`syncTakesWithJournal` precedent shows the resolution mapping
(quality → outcome true/false/null) — beliefs must follow the SAME
mapping (correct→true, incorrect→false, partial/unresolvable→null) or
the takes fence misreports.

### L11 — Sleep cycle ownership
`sleep_cycle/cycle.ts` is owned by the sleep-wave agents (framework-trace
consumption + connectome wiring). Phase-05 circadian plan reads
`SleepPhase` and schedules `nap()` via the exoskeleton surface — do not
edit cycle.ts internals unless declared in `files_modified`.

### L12 — CONFORMANCE.md is NOT a claims table
`design/CONFORMANCE.md` (126 lines, verified) is the CIC
fixtures/compatibility doc. The vision-conformance claims surface is the
dated report `docs/vision-conformance-2026-07-31.md`. Phase-05 conformance
updates append to a vision-conformance report (D-15 corrected); the 03-05
plan's "CONFORMANCE.md claims table" assumption must NOT be repeated.

### L13 — EndocrineSystem constructor is positional
`new EndocrineSystem(nervousSystem, consciousness)` — phase-05 extensions
come via an OPTIONAL third `config` parameter (clock, eventSink). Existing
call sites in `cognitive-core.test.ts` and the exoskeleton stay untouched.

### L14 — ReflexGate has a runtime check registry
`ReflexGate.register(check)` exists (`src/reflex/gate.ts:37`) — the
neurogenesis `reflex-check` kind registers through an adapter on THIS
registry (there is no other checks registry; `createReflexChecks` is a
static factory, `src/reflex/checks.ts:21`).
