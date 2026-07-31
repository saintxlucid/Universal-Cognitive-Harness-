# Engineering Physiology — Reflex Gate, Counterfactual, Taste, Pain Memory, Genome Evolution, Prediction Cortices

**Status:** Accepted — phase contract (D-11)
**Phase:** 03-engineering-physiology
**Date:** 2026-07-31
**Relation:** Extends `design/ARCHITECTURE.md`, `design/CONFORMANCE.md`, `MANIFESTO.md` §6 (organism architecture)

---

## 1. Purpose and Phase Boundary

The AENS (Artificial Engineering Nervous System) vision closes the gap between
"an AI with review gatekeepers" and "an engineering organism." The conformance
audit (2026-07-31) showed UCH already ships ~70% of the vision: nervous-system
signal infrastructure, basal ganglia action selection, cortices, engineering
judgment, the Organic Score engine, the 14-law constitution, the memory
taxonomy, and the workspace genome fingerprint.

The genuine delta this phase ships — six subsystems that do NOT exist:

| # | Subsystem | Claim it enforces |
|---|---|---|
| 1 | **Reflex Gate** (`src/reflex/`) | "No model bypasses reflexes. Ever." — hard pre-write interrupts on the coding path |
| 2 | **Counterfactual Engine** (`src/physiology/`) | Five-futures evaluation of any proposed change |
| 3 | **Taste Engine** (`src/physiology/`) | Elegance scoring learned from episodic outcomes, not lint rules |
| 4 | **Genome Evolution** (extends `src/workspace-graphs/workspace-dna.ts`) | DNA mutates from outcomes and is inherited by connected agents |
| 5 | **Pain Memory** (`src/physiology/`) | Affect-weighted episodic records that permanently stiffen reflex thresholds |
| 6 | **Prediction Cortices** (compositors) | Performance/security/product checks that run before code exists |

**Contract of the layer:** the reflex tier is LLM-free, deterministic, and
millisecond-scale; LLM scoring is allowed only above it (judgment and
consciousness tiers). The layer reuses the event bus, nervous-system signals,
graph stores, branded types, and persistence — no new runtime dependencies.

---

## 2. Layered Architecture

```
Consciousness tier   ExecutiveBrain critic, reflection        (LLM allowed)
        ▲
Judgment tier        EngineeringJudgment, OrganicScore,       (LLM optional)
        ▲             counterfactual futures, taste
Reflex tier          ReflexGate: deterministic checks,        (LLM-FREE, ms)
        ▲             pain-escalated thresholds
Tool layer           FileEditor / CommandRunner / DiffReview / CodingToolkit
```

- **Reflex tier (this phase, P1 first):** synchronous, deterministic,
  zero-model. Verdicts `allow | block | defer`. Evidence is
  node-id-anchored (`file:...`, `decision:...`, `scope:project:<id>`,
  `lines:<n>`, `import:<spec>`).
- **Judgment tier:** existing engines (OrganicScoreEngine, EngineeringJudgment,
  security rule set) score futures; the counterfactual engine composes them
  into five deterministic futures.
- **Consciousness tier:** unchanged; consumes recorded signals/events.

---

## 3. Reflex Gate (`src/reflex/`)

### 3.1 Layout (D-01)

```
src/reflex/
  types.ts    — type surface (leaf: type-only imports)
  gate.ts     — ReflexGate (imports types + node:path + createSignal)
  checks.ts   — createReflexChecks (4 canonical checks; graph picks injected)
```

`src/reflex/` is a **leaf**: no imports into suit/instinct/reflex-engine,
OrganicScoreEngine, or EngineeringJudgmentEngine (those engines are concepts
for the checks to mirror, never imports). Zero `crypto.randomUUID()` in
production or test source; `process.env` read once in the gate constructor.

### 3.2 Type surface

`ReflexVerdict`, `WriteProposal`, `ReflexEvidence`, `ReflexCheckContext`,
`ReflexCheck`, `ReflexResult`, `ZoneAffectProvider`, `ReflexGateConfig`,
`ReflexGateLike` — exactly as locked by `planning/03-engineering-physiology/03-01-PLAN.md` `<interfaces>`.

### 3.3 Gate semantics

- `evaluate(proposal): ReflexResult` — **SYNC**. Same proposal + same state →
  same verdict, repeatedly.
- Zone = `proposal.zone ?? path.dirname(proposal.target)`; targets without a
  path separator → zone = target.
- `zoneAffect` read **once** per evaluate; every check receives
  `{ zoneAffect: () => affect }`.
- All checks run; evidence from every flagged check is collected (no
  short-circuit); verdict precedence: block > defer > allow.
- **Pain escalation (D-08 seam):** `affect >= PAIN_ESCALATION_THRESHOLD (0.7)`
  upgrades each defer evidence in the zone to block (cloned entry — check-owned
  objects are never mutated).
- **Escape hatch (D-02):** `override.names` (config) merged with env
  `UCH_REFLEX_OVERRIDE` (comma-separated, `'*'` = all) at construction.
  Suppressed evidence is excluded from the verdict but **kept in the record**
  and still emitted as `governance:event_denied` with
  `override: { name, recorded: true }` — violations are recorded, never
  silently skipped.
- **Recording (D-04, no new event types):**

| Verdict | Event sink | Signal sink |
|---|---|---|
| block | `governance:event_denied` (gate/tool/target/check_id/rule/evidence/threshold/reason/override?) | `error:occurred`, `{ interrupt: true, interruptLevel: 2 }` |
| defer | `review:requested` (tool/target/checks/reason) | `review:requested`, `{ interrupt: false }` |
| allow | `tool:called` (tool/target/verdict/checks_run/duration_ms) | none |

- Sink invocation is wrapped in try/catch — recording never breaks
  enforcement (T-03-07). Sinks are fire-and-forget; the gate never awaits.

### 3.4 Canonical checks (`checks.ts`)

`createReflexChecks({ knowledgeGraph?, decisionGraph?, grant? })`:

| Check | Rule | Level | Trigger | Evidence |
|---|---|---|---|---|
| `duplicate-abstraction` | `duplicate-abstraction-overlap` | block | basename token-overlap ≥ 0.6 with graph artifacts/decisions | hit node ids, `overlap>=0.6` |
| `duplicate-dependency` | `dependency-inventory-collision` | block | content imports a specifier matching an existing artifact (≠ target) | artifact ids, `import:<spec>` |
| `complexity-threshold` | `line-complexity-threshold` | block | content ≥ 400 lines | `lines:<n>` |
| | `function-count-defer` | defer | ≥ 25 functions in content | `functions:<n>` |
| `ownership-boundary` | `ownership-scope-violation` | block | target outside the grant's project/branch pin | `scope:project:<id>`, `target:<path>` |

All checks null-pass when their inputs are absent (no graphs → pass; no
content → pass; no grant → pass). Graph access is injected picks
(`search`, `findArtifacts`) — the gate/checks never construct graphs; they
stay deterministic and sync over `DatabaseSync`-backed organs.

### 3.5 Interception points (D-02)

| Point | Choke location | Blocked/deferred behavior |
|---|---|---|
| `FileEditor` | after `resolve()`, before ANY fs mutation (mkdir/backup/write/rm) | `{ applied: false, linesChanged: 0, undoAvailable: false, message: 'Reflex gate blocked/deferred: <reason>' }`; `delete()` → `false`; `undo()` NOT gated |
| `CommandRunner` | after `isCommandAllowed`, before `spawn` | existing blocked shape (`exitCode: null`, `durationMs: 0`, stderr reason) |
| `DiffReview` | exported `reviewWithGate(diff, gate?, options?)` wrapper | `review()` byte-stable; `gateVerdict` attached only when verdict ≠ allow |
| `CodingToolkit` | config `gate` forwarded to FileEditor + CommandRunner | `reviewWithGate` convenience passthrough |

Gate is **default-off** (`gate: undefined` → byte-identical behavior; the
existing `coding-tools.test.ts` canary is the regression contract).

---

## 4. Physiology Tier (`src/physiology/`)

### 4.1 Counterfactual Engine (P2)

Five futures — Technical Debt, Security Risk, Scale, Maintainability,
Preferred — each scored by existing deterministic engines first (organic-score
metrics, judgment rules, security rule set, complexity metrics, constitution
alignment). Output `FutureVerdict[]` (always exactly 5, each with score +
evidence) plus a recommended future picked by **constitution alignment**, not
likelihood. LLM futures are optional, gated above the reflex tier; default
path is deterministic. Dry-run/recommendation only — never auto-applies.

### 4.2 Taste Engine (P3)

Elegance score 0–100 alongside the Organic Score. Learns from episodic
outcomes: accepted PRs raise weights for their patterns; reverted/regressed
changes lower them. Cold-start = deterministic heuristics (naming quality,
abstraction balance, structure symmetry) below an episode threshold. Weights
persist via `Storable`, workspace-scoped.

**Deviation L3 (explicit):** taste placement. The phase context locked D-01's
"taste engine lives in `src/physiology/`", but the shipped `taste-engine.ts`
already exists in `src/cognitive-plane/taste/` (9 dimensions). Decision:
**extend in place** — the episodic-outcome learning layer extends the existing
store rather than creating a parallel second preference store. Recorded here
and in the validation contract; no duplicate store (03-VALIDATION.md L3).

### 4.3 Pain Memory (P5)

Affect-weighted episodic store of "trauma events" (production outage, data
loss, security incident, hard test regression). Decay-resistant affect;
`affectFor(zone)` rises after trauma; reflex checks consult it through the
`ZoneAffectProvider` seam — zones with affect ≥ 0.7 get permanently stricter
thresholds. Read path is LLM-free; persisted via `Storable`.

### 4.4 Genome Evolution (P4)

`WorkspaceDNA` (existing `src/workspace-graphs/workspace-dna.ts`) gains
outcome-driven mutation: merge → +stability alleles; bug/rollback/outage →
+caution alleles (increased reflex strictness in affected zones). Each
mutation increments a version; snapshots retained and capped. **Fingerprint
remains the identity — alleles are additive, never a fork.** Inheritance:
connected agents receive the current genome through the existing
`attach()`/projection path — no new channel. Backward compat: old snapshots
load.

### 4.5 Prediction Cortices (P6)

Performance/security/product checks running **before** code exists, as part
of the reflex+judgment pipeline. Implemented as **compositors** over reflex
checks + judgment + taste — no new standalone engines with duplicate logic.
Emit `prediction:made` (existing event type).

---

## 5. Reuse Map (D-04)

| Need | Reused subsystem |
|---|---|
| Verdict signals | `src/nervous-system/signal.ts` (`createSignal`, `InterruptLevel`) |
| Events | `src/event-bus/neural-event-bus.ts` — no new event types |
| Persistence | `Storable` / `writeSnapshot` / `readSnapshot` (`src/cognitive-plane/persistence/persistence-engine.ts`) |
| Evidence sources | `WorkspaceKnowledgeGraph`, `WorkspaceDecisionGraph` (sync `search`), `WorkspaceManifest` grant + `CapabilityScope` |
| Scoring inputs | `OrganicScoreEngine`, `EngineeringJudgmentEngine`, constitution rule sets (read-only) |
| Branded types | `src/shared/branded-types.ts` |
| Interception | `src/coding/` (file-editor, command-runner, diff-review, toolkit) |

**Dependency contract:** runtime deps unchanged — `openai` +
`@opentelemetry/api` only; zero new event types; zero new stores beyond the
three physiology stores (counterfactual is stateless composition).

---

## 6. Determinism and Safety Contract

1. Reflex path: zero model calls, zero `Date` in evidence (duration_ms only),
   zero random ids, sync signatures, deterministic ordering (registry order).
2. Evidence carries identifiers only — never file content, secrets, or
   command output (T-03-03). Content is used only for line counts and import
   specifiers, never recorded.
3. Block precedes ANY filesystem mutation (fs-state asserted in tests, not
   just return values — T-03-01).
4. Escape hatch violations are always recorded (T-03-05).
5. Sink exceptions never break enforcement (T-03-07).
6. Tests: deterministic, LLM-free, temp-dir lifecycle
   (`mkdtempSync` + `close` + `rmSync`), zero residue (T-03-04).

---

## 7. Phase Deliverables

| Deliverable | Artifact | Gate |
|---|---|---|
| Design doc (this file) | `design/ENGINEERING-PHYSIOLOGY.md` | exists before execution (D-11) |
| Plan 03-01 wave 0 (RED) | `src/__tests__/reflex-gate.test.ts`, `reflex-interception.test.ts` | RED at collection |
| Plan 03-02 | `src/reflex/` + coding interception | gate tests + canary green |
| Plan 03-03 | full check registry | evidence node-id-anchored |
| Plan 03-04 | counterfactual + taste cold-start metrics | exactly 5 futures; deterministic |
| Plan 03-05 | genome evolution + pain memory + predictions | fingerprint purity; attach compat |
| Conformance update | `docs/vision-conformance-2026-07-31.md` | new claims verified |

---

*Contract established 2026-07-31. Downstream plans implement against this
document and the locked `<interfaces>` blocks in plans 03-01/03-02.*
