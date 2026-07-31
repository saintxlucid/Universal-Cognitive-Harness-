# Phase 03 Research: Engineering Physiology (Artificial Engineering Nervous System — gap closure)

**Researched:** 2026-07-31
**Status:** Research complete — ready for planning
**Sources:** Internal code audit of `src/` (direct reads: nervous-system, coding, workspace-graphs, workspace-manifest, kernel/constitution, cognitive-plane/persistence, event-bus, control-plane, exoskeleton, suit/instinct, suit/litmus, hippocampus), phase-01 plans/validation (TDD wave pattern), 03-CONTEXT.md (locked decisions D-01..D-11).

All claims are `[VERIFIED]` via direct source reads with line anchors. This phase is entirely in-repo engineering — **zero new packages**, so no package legitimacy audit is needed (mirrors 02-RESEARCH §5).

---

## 1. Interception surface of the coding tools (Reflex Gate attachment points)

**Headline: the coding tools are a *clean* interception surface — no event bus, no gate, no external deps; every mutation is a single choke point. The catch: `FileEditor` and `DiffReview` are fully **synchronous**, so the gate's `evaluate()` MUST be synchronous.**

### 1.1 `FileEditor` — `src/coding/file-editor.ts` (240 lines)
- `constructor(config?: FileEditorConfig)` — keys only `{ root?, maxBackupPerFile?, allowOutsideRoot? }` (lines 23-27). Adding an optional `gate` key is additive; existing constructions cannot break.
- Mutation methods (all sync, all return `EditResult`):
  - `write(filePath, content): EditResult` (line 72) — `resolve()` → mkdir → backup → `fs.writeFileSync`. **Choke point: after `resolve()` (line 73), before `backup()` (line 80).**
  - `edit(filePath, startLine, endLine, replacement)` (line 96), `insert` (line 126), `append` (line 150), `deleteLines` (line 165, delegates to `edit`), `delete(filePath): boolean` (line 169 — the one method returning bare boolean, not `EditResult`).
- `EditResult` shape (lines 9-15): `{ file, applied, linesChanged, message, undoAvailable }`. **A blocked write returns `applied: false` + `message` carrying the verdict — zero API break.**
- `resolve()` (line 41) **throws** on outside-root paths *before* any gate runs — path-escape is already structurally hard-blocked; the gate only handles in-root paths.
- Existing tests: `src/coding/__tests__/coding-tools.test.ts` lines 160-245 construct with `new FileEditor({ root: tmpDir })` — no gate → unaffected.

**Design consequence:** `ReflexGate.evaluate(proposal)` must be **synchronous**. Compatible with D-03 (LLM-free) and D-08 (pain read without model calls): GraphStore is `node:sqlite` `DatabaseSync` — synchronous (graph-store.ts:1, 29-51); all D-03 checks are sync-capable. **The sync gate contract is the single most important shape decision of this phase.**

### 1.2 `CommandRunner` — `src/coding/command-runner.ts` (173 lines)
- `run(command, options?): Promise<CommandResult>` (line 64) — **already async**; a gate hook can be awaited without API break.
- `isCommandAllowed(command): { allowed, reason? }` (line 49) — existing sync denylist/allowlist pre-check. **The gate slots into `run()` right after `isCommandAllowed` (line 65), before `spawn` (line 89).** Blocked result mirrors the existing blocked shape (lines 67-74: `{ stdout: '', stderr: reason, exitCode: null, ... }`).
- Config (lines 21-27): `{ defaultTimeoutMs?, maxOutputBytes?, allowlist?, denylist?, shell? }` — gains optional `gate`. Existing tests (coding-tools.test.ts 247-291) construct without gate → unaffected.

### 1.3 `DiffReview` — `src/coding/diff-review.ts` (287 lines)
- `review(diff: string, options?): DiffReviewResult` (line 149) — **sync, pure** parse + findings; result `{ summary, findings, reviewedAt }` (36-40). `parseUnifiedDiff` (80) pure.
- Existing finding categories already relevant: `security` (SECRET_PATTERNS, 55-63; detection 222-232), `complexity` (large hunk, 162-171), `duplication` (DUPLICATE_MIN_LINES = 4, 53; 235-260), `tech-debt` (187-196).
- **Two gating options:** (1) optional `gate` in config consulted inside `review()`; (2) a thin `reviewWithGate(diff, gate)` wrapper that leaves `review()` byte-stable. **Recommended: (2)** — coding-tools.test.ts lines 293-389 assert exact finding categories/counts (e.g., `expect(result.findings.length).toBe(0)` line 378); a wrapper keeps the most-tested pure function untouched.
- `SECRET_PATTERNS` and `DUPLICATE_MIN_LINES` are reusable by the prediction-security cortex.

### 1.4 `CodingSkills` — `src/coding/coding-skills.ts` (270 lines)
Pure catalog/matcher (`suggest` 204, `suggestAll` 229, `render` 249). **No write/execution surface exists** — skills are matched, never run here. D-02's "as applicable" honestly resolves to: **no skill-level gate**; skill-guided edits flow through FileEditor/CommandRunner anyway. Document this in the design doc.

### 1.5 `CodingToolkit` — `src/coding/toolkit.ts` (84 lines)
Facade constructing files/commands/review/skills (22-33). `CodingToolkitConfig` (7-12) gains optional `gate`, forwarded to the three tools. **This is the single wiring point proving "the gate applies regardless of which agent connects"** — the toolkit is the tool layer. Existing tests (440-480) unaffected if `gate` is optional.

---

## 2. Nervous-system API — how the gate emits signals

**`src/nervous-system/signal.ts` (173) + `src/nervous-system/nervous-system.ts` (442).**

- `createSignal(type: EventType, source: string, payload: Record<string, unknown>, options?: CreateSignalOptions): Signal` (signal.ts:136-164). Options: `{ target?, energy?, causalParent?, interrupt?, interruptLevel?, information? }`.
- **Interrupts are driven programmatically**: `{ interrupt: true, interruptLevel: 3 }` sets the flag regardless of type priority (signal.ts:161-162). `raiseInterrupt` (nervous-system.ts:116-134) ignores signals without `interrupt`/level — gate signals MUST set both to become pending interrupts. `getPendingInterrupts(aboveLevel)` (136-141) / `acknowledgeInterrupt` (143-146) are the downstream programmatic surface.
- `signalPriorityForType` (signal.ts:50-107): `tool:called`→2 (brainstem), `error:occurred`→2, `review:requested`→1, `prediction:made`→1, `pr:merged`→1. **`governance:event_denied` is NOT in the map** → falls back to priority 1/spinal (signal.ts:142). A block signal emitted as `error:occurred`/`governance:event_denied` lands spinal/brainstem — the correct "fast reflex" tier.
- **CRITICAL CAVEAT:** `emit` is **async**; the FileEditor/DiffReview gate is **sync** (§1.1). The gate fires signals fire-and-forget: `void ns.emit(sig).catch(() => {})`. Safe because handler failures are already isolated in `deliverToLayer` (nervous-system.ts:360-371) and **the nervous system is the gate's observability/escalation channel, not its enforcement mechanism** — enforcement is the sync `block` return before the write (exactly D-02's "verdicts emit signals AND are recorded", i.e., recording).
- `LayerConfig.blockOnMatch` (nervous-system.ts:281) **suppresses delivery** of matching types at a layer — the gate must not rely on it for its own semantics (the gate IS the blocker).
- Existing nervous-system tests (src/__tests__/nervous-system.test.ts, 317 lines) assert routing/energy/history — unaffected (gate is a new emitter, not a NervousSystem change).

---

## 3. Graphs available as reflex evidence (node/edge schemas)

All graph organs are `Storable` + GraphStore-backed (`node:sqlite`, **sync**). Shapes: `GraphNode { id, type, name, properties, created_at }`, `GraphEdge { id, source, target, relationship, properties, weight, valid_at, invalid_at, created_at }` (graph-store.ts:5-23).

### 3.1 `WorkspaceKnowledgeGraph` — `src/workspace-graphs/knowledge-graph.ts` (163)
Node types: `artifact` (`file:${path}`, name=basename, props `{ path, language?, lines? }`, 53-60), `commit` (`commit:${hash}`, 62-65), `build` (`build:${id}`, 79), `failure` (`failure:${id}`, props `{ message, kind }`, 85), `pr` (91), `review` (97). Edges: `touches` commit→file with provenance props (66-76).
Evidence queries:
- `search(query)` (115) — `LIKE` on node name AND JSON-serialized properties (graph-store.ts:69-72). **This is the duplicate-abstraction primitive**: `search(<proposed basename>)` returns overlapping nodes.
- `findArtifacts()` (103) / `findCommits()` (107) / `findFailures()` (111) — type scans for dependency-duplication evidence.
- `getEdgesFrom(nodeId)` (131) — ownership/boundary evidence. `bfs`/`findPaths` (119-129) — impact depth for the counterfactual scale future.

### 3.2 `WorkspaceDecisionGraph` — `src/workspace-graphs/decision-graph.ts` (137)
Nodes `decision:${decisionId}`, **properties `{}` EMPTY by locked phase-01 contract** (55-59 — "no DecisionLog duplication"); read titles via `getDecision(id).name`, never properties. Edges: `causes | alternative_to | supersedes | references` (line 9); `references` links decisions→artifacts (76-91).
Gate use: **second duplicate-abstraction source** — `search(<proposed name>)` across decision titles catches `UserManager2`-style collisions against recorded decisions; `getRelations(decisionId)` (97) feeds the counterfactual "preferred" future (alternative/supersede chains).

### 3.3 `WorkspaceTaskGraph` — `src/workspace-graphs/task-graph.ts` (170)
Nodes `task:${taskId}` (props empty, 54-58); edges `depends_on`, `status_changed` (self-edge `{from,to}`), `touches`, `informed_by` (60-80+). Light gate use — counterfactual/ownership evidence only.

### 3.4 Detecting "duplicate abstraction" concretely (D-03 canonical check)
Vision's canonical example is `UserManager2`. Two deterministic graph-driven strategies:
1. **Token overlap on artifact/decision names**: split proposed basename into tokens, `search()` each, overlap ratio ≥ threshold → `block` with evidence `[node ids]` (same substring-overlap idea as the existing ReflexEngine, reflex-engine.ts:52-71 — see L2 on NOT touching that engine).
2. **Responsibility overlap**: compare the proposed file's would-be exports/imports (from write content via `CodeIndex` — `src/coding/code-index.ts` `getSymbols`/`getImports`) against artifact nodes and `touches` edges; colliding name+path pattern → block.

Both are sync, LLM-free, and yield `{ node ids, rule id, threshold hit }` evidence exactly as D-03 requires.

---

## 4. WorkspaceDNA — fingerprint semantics and the additive allele layer (D-07)

**`src/workspace-graphs/workspace-dna.ts` (91 lines).**

### 4.1 Current mechanics (verified)
- `stableSerialize` (29-39): recursive sorted-key JSON — key-order-stable.
- `recompute(input)` (41-56): `fingerprint = sha256:${sha256(stableSerialize(input))}`; pushes `DnaMutation { at, locus: 'workspace', fromFingerprint, toFingerprint, cause: 'input_changed' }` only when fingerprint changed AND previous non-null; capped at `maxMutations` (default 1000).
- `DnaMutation` (8-14): `{ at, locus, fromFingerprint, toFingerprint, cause: 'input_changed' | 'deliberate' }`.
- `persist` (70-77) writes `{ workspaceId, name, fingerprint, mutations }`; `load` (79-90) restores, returns `mutations.length`. **No GraphStore — pure JSON Storable.**
- Input comes from `WorkspaceBrain.dnaInputs()` = `{ genome, standards, decisions: { count, byStatus } }` (workspace-brain.ts:208-218), recomputed on `addDecision` (231) and `persistWorkspace` (246).
- Test contract (01-01-PLAN.md + src/__tests__/workspace-graphs-dna.test.ts): fingerprint `/^sha256:[0-9a-f]{64}$/`, stable input → stable fingerprint, key-order stability, no-secret-leakage.

### 4.2 Additive allele layer (D-07 design constraints)
- **Fingerprint identity preserved**: alleles are outcome-derived and **must NOT enter the `stableSerialize` input of `recompute()`**. If alleles entered the fingerprint, an outage would change identity — a fork, exactly what D-07 forbids. Fingerprint = identity over workspace state; alleles = parallel versioned record.
- New additive members (extend in place — D-01 forbids a parallel DNA module):
  - `genomeVersion: number` (starts 0, increments per mutation)
  - `alleles: GenomeAllele[]`, `GenomeAllele = { id: string; kind: 'stability' | 'caution'; zone: string; at: number; version: number; outcome: 'merge' | 'bug' | 'rollback' | 'outage' }`
  - `snapshots: GenomeSnapshot[]` (retained, capped like mutations): `{ version, fingerprint, alleles, at, cause }`
  - `mutate(outcome: 'merge' | 'bug' | 'rollback' | 'outage', zone: string): GenomeSnapshot` — merge → +stability; bug/rollback/outage → +caution in zone; version++, snapshot appended.
- **Keep `DnaMutation` untouched** (it records fingerprint changes); `GenomeAllele`/`GenomeSnapshot` are sibling types. Widening `cause` is unnecessary and risks the existing dna test asserting `cause: 'input_changed'`.
- `persist()` extends snapshot JSON with `{ genomeVersion, alleles, snapshots }`; `load()` defaults missing fields to `[]`/`0` (readSnapshot returns partials safely, persistence-engine.ts:23-27) → **old snapshots load cleanly (backward compatible)**.
- Wiring: `WorkspaceBrain` owns `dna` (lazy getter, 76-79). The outcome→mutation subscription belongs in a small `src/physiology/evolution.ts` subscriber (maps events → `dna.mutate(...)`) rather than in WorkspaceBrain's 300 lines — keeps its 8 existing describes untouched (D-10).

---

## 5. attach/projection path — genome inheritance channel (D-07)

**`src/workspace-manifest/attach.ts` (342) + `src/control-plane/projections.ts` (231).**

- `attach(options?): Promise<AttachmentResult>` (attach.ts:121). `AttachOptions` (46-74) already has 13 optional fields — adding `genome?: WorkspaceDNA | GenomeDescriptor` is additive.
- `AttachmentResult` (76-95): `{ attached, reason?, discovery, version?, capabilities, drivers, workspace_id, session_id, grant?, governance?, projection? }` — every non-essential field optional. Adding `genome?: { version: number; fingerprint: string | null; alleles: GenomeAllele[] }` is safe for the existing suite (control-plane/agent-integration/e2e/uccp tests); the field MUST be optional.
- Two options:
  1. **`AttachOptions.genome` → new optional `AttachmentResult.genome` field (recommended)** — attach() copies `{ version, fingerprint, alleles }`. No ProjectionEngine change, additive.
  2. Extend `WorkspaceProjection` (projections.ts:56-69) with `genome?` — but projections are *capability-filtered state views* (grant ∩ workspace state); genome is identity/metadata, not grant-scoped state; `project()` would need the genome passed in — more coupling, no capability benefit.
- **Recommendation: option 1.** The genome rides the attach result beside `grant`/`projection`; agents receive current version + alleles. D-07's "existing attach/projection path" is satisfied with zero ProjectionEngine changes (its 14 tests untouched).

---

## 6. Scoring engines the counterfactual/taste/prediction tiers reuse

### 6.1 `EngineeringJudgmentEngine` — `src/kernel/constitution/engineering-judgment.ts` (82)
- `evaluate(input): EngineeringJudgmentResult`; input `{ intent, proposedChange, context: { existingArchitecture?, dependencies?, modules? } }` (1-9); result `{ verdict: 'pass'|'review', score: 0-1, flags: string[], recommendations, riskLevel: 'low'|'medium'|'high', nextSteps }` (11-18).
- Deterministic: flags `duplicate-abstraction` (30-35), `missing-verification` (37-41), `dependency-risk` (42-48); score `0.95 - flags*0.16` floor 0.2 (75).
- Counterfactual reuse: debt future = judgment flags; security future = `riskLevel`; `verdict: 'review'` = the "defer" trigger. Existing test src/__tests__/engineering-judgment.test.ts — do not alter.

### 6.2 `OrganicScoreEngine` — `src/kernel/constitution/organic-score.ts` (415)
- `evaluate(input: OrganicScoreInput): OrganicScoreResult`; input `{ change, intent?, context?: { filesTouched?, testsRun? } }` (49-56); result `{ verdict: 'pass'|'revise'|'reject', score: 0-100, metrics: MetricVerdict[15], findings, recommendations }` (58-64). Constitutional vetoes: any security/error-handling flag → `reject` (363-370).
- **Exported evidence lists are gold for prediction cortices + taste cold-start** (all exported for tests): `GENERIC_NAMING` (70-74), `OVER_ABSTRACTION`/`UNDER_ABSTRACTION` (76-85), `SECURITY_SMELLS` (98-103), `PERFORMANCE_RISKS` (105-108), `CORRECTNESS_EDGES` (110-114), `TEST_SIGNALS` (116-119), `TRACEABILITY_SIGNALS` (121-125), `SCOPE_CREEP_MARKERS` (127-130), `DEBT_MARKERS` (132-135), `VERIFY_SIGNALS` (137-139), `DOC_SIGNALS` (141-144).
- Counterfactual mapping: debt→`future-readiness`/`complexity`; security→`security`; scale→`performance`/`complexity`; maintainability→`coupling-cohesion`/`abstraction-fit`/`naming`/`documentation`; preferred→aggregate + veto-absence + `TRACEABILITY_SIGNALS`. Engine untouched — only consumed.

### 6.3 `CodeScorer` — `src/suit/litmus/code-scorer.ts` (257) — tertiary
`score(profile: FileProfile): ScoredFile` — 16 deterministic dimensions, composite 0-1, `rejected` below threshold (78-111). `FileProfile` (47-63) needs parsed file metrics; `CodeIndex` can extract them from proposed content without a model. Optional input for the maintainability future.

### 6.4 New deterministic metrics needed for taste cold-start (D-06) — gap confirmed
No elegance-specific metrics exist: naming quality is only a `GENERIC_NAMING` flag list; abstraction balance only phrase lists; **structure symmetry does not exist anywhere**. **Recommendation: `src/physiology/metrics.ts`** — pure, unit-testable:
- `namingQuality(name: string): number` (0-1) — tokenize camelCase/snake, penalize generic tokens, require ≥1 domain token (mirror naming-reflex logic reflex-engine.ts:173-195 without touching that engine)
- `abstractionBalance(text: string): number` (0-1) — OVER/UNDER_ABSTRACTION hit counts, neutral when neither
- `symmetryIndex(profile: { functions: Array<{ lines: number }>; files: number[] }): number` (0-1) — 1 − normalized variance of function/file sizes
These feed taste cold-start AND the maintainability future AND the product cortex.

### 6.5 `ReflexEngine` (suit/instinct) — DO NOT TOUCH, adapt concepts (L2)
Existing engine, 6 built-in checks driven by caller-supplied `ReflexContext` (reflex-engine.ts:19-35), used by ImmuneSystem + CLI (`src/cli/uccp.ts` HTTP endpoint line 618), asserted by **`instinct.test.ts:27` `expect(engine.getReflexes()).toHaveLength(6)`**. The Reflex Gate (src/reflex/) is a **new registry** reusing the *check concepts* but deriving evidence from graphs, not caller context. Do not extend ReflexEngine; do not couple gate→ReflexEngine.

---

## 7. Event bus — which existing events carry the new payloads (D-04)

**`src/event-bus/neural-event-bus.ts`** — 80 event types (1-77); `publish({ type, source, payload, metadata? })` (215-221); payload free-form `Record<string, unknown>`. **No new event types; payload conventions are the design surface.**

| Physiology need | Event type(s) | Proposed payload contract (plans lock these keys) |
|---|---|---|
| Reflex `block` record | `governance:event_denied` (semantic match; already used by EventGovernance, event-governance.ts:272-279) | `{ gate: 'reflex', tool, target, check_id, rule, evidence: string[], threshold, reason, override }` |
| Reflex `allow` record | `tool:called` (pri 2) | `{ tool, target, verdict: 'allow', checks_run, duration_ms }` |
| Reflex `defer` record | `review:requested` (pri 1 — routes to review tier = "defer") | `{ tool, target, checks: string[], reason }` |
| Trauma (pain memory) | `error:occurred` (2), `build:failed`/`test:failed`/`ci:failed` (1) | `{ message, kind?: 'outage'\|'data-loss'\|'security-incident'\|'hard-regression', zone?: string, path?: string, severity? }` |
| Genome: merge | `pr:merged` (1) — **no publisher exists yet**; tests publish directly, wiring adds the subscription | `{ pr_id, title, files?: string[], hash? }` |
| Genome: bug | `error:occurred`/`test:failed`/`build:failed` (same as trauma; evolution subscriber maps kind/zone) | reuse trauma payload |
| Genome: rollback | `git:commit` revert detection — git-driver payload is `{ message, hash, author, branch }` (git-driver.ts:110) | heuristic on `payload.message` (`/^revert/i` or `Revert "`) |
| Genome: outage | `error:occurred` with `payload.kind === 'outage'` | reuse |
| Taste: accepted | `pr:merged` | `{ pr_id, files?, patterns?: string[] }` — raises weights for its patterns |
| Taste: reverted | `pr:reviewed`/`review:submitted` `{ decision: 'changes_requested'\|'reverted' }` + git revert | `{ pr_id, decision, files? }` |
| Prediction cortex records | `prediction:made` (1; precedent activation-field.ts:253 `{ entityId, score, hit, predictionScore }`) | `{ cortex: 'performance'\|'security'\|'product', risk, evidence: string[], target }` |
| Reflex signal (nervous system) | any of the above via `createSignal(..., { interrupt: true, interruptLevel })` | payload passthrough + `{ verdict }` |

**Key precedent:** WorkspaceBrain wires bus→organs with `String(payload.x ?? '')` coercion (workspace-brain.ts:164-205) — physiology subscribers follow the same convention (untrusted payloads never flow raw into ids/properties; D-10/T-01-01 threat pattern).

---

## 8. Test conventions to mirror (src/__tests__)

Verified from phase-01 plans + existing files:
1. **Naming**: `src/__tests__/<domain>-<thing>.test.ts`. New files: `reflex-gate.test.ts`, `reflex-interception.test.ts`, `physiology-metrics.test.ts`, `physiology-counterfactual.test.ts`, `physiology-taste.test.ts`, `physiology-pain-memory.test.ts`, `workspace-dna-evolution.test.ts`, `workspace-manifest-genome.test.ts`, `physiology-predictions.test.ts`.
2. **Structure**: `describe`/`it`/`expect` from vitest; ESM imports with `.js` extensions (`import { ReflexGate } from '../reflex/gate.js';`).
3. **Temp-dir lifecycle** (mandatory; precedent neural-fs.test.ts:336-353, encoded 01-01-PLAN.md): `dir = mkdtempSync(join(tmpdir(), 'uch-<prefix>-'))` in beforeEach; `close()` (SQLite handles!) then `rmSync(dir, { recursive: true, force: true })` in afterEach. Windows: open handles block deletion — close BEFORE rmSync.
4. **Determinism**: zero `crypto.randomUUID()` in production source; tests may use fixed strings; gate verdict ids deterministic (`${checkId}:${target}`).
5. **Non-null assertions**: `arr[0]!.name` style.
6. **Context-factory helpers**: `makeContext(overrides)` (instinct.test.ts:4-22) — mirror for `WriteProposal`.
7. **RED at wave 0**: plan-01 tests import not-yet-existing modules → "Cannot find module" collection failure (01-01-PLAN.md:203). Wave-0 gate = RED only; full suite gates after GREEN.
8. **Storable contract**: persist/load round-trip; missing file → 0; JSON-safe properties only (no `Date` in graph props; timestamps epoch-ms numbers).
9. **Coverage thresholds** (vitest.config.ts:18-23): statements 70 / branches 75 / functions 78 / lines 70 — every new module needs tests.
10. **D-10 hard rules**: no test calls a provider API; no fixture contains secrets; no test altered outside the plan's `files_modified`.
11. **Feedback latency < 15s** (01-VALIDATION.md:79-80) — quick commands are single-file vitest runs.

---

## 9. Landmines

### L1 — Circular imports: `src/reflex` must be a LEAF
Pain memory (physiology, slow tier) is *read by* the reflex tier (D-08). **If `src/reflex/gate.ts` imports `PainMemory`, the layering inverts and cycles become possible.** Rule: `src/reflex/` imports only event-bus types, nervous-system `createSignal`, graph organs, branded types, persistence. The gate reads pain through an **injected provider**: `export type ZoneAffectProvider = (zone: string) => number;` in `ReflexGateConfig` (optional, default `() => 0`); physiology/wiring supplies the real one. **Plan 03-01 must ship the `ZoneAffectProvider` seam even though pain memory lands in 03-05** — retrofitting later means touching every check.

### L2 — Existing `ReflexEngine` (suit/instinct) + exactly-6 test
`instinct.test.ts:27` asserts 6 reflexes. The gate must NOT extend that engine or share its registry (graph-derived vs context-derived). Document the boundary in the design doc.

### L3 — Existing `TasteEngine` (cognitive-plane/taste) vs D-01 placement
`src/cognitive-plane/taste/taste-engine.ts` **already exists**: 9 TasteDimensions, `learn()`/`assess()`, Storable-style persist/load — but scores 0-1 (D-06 needs 0-100), **no cold-start heuristics**, no outcome-driven learning, no event integration. D-01 says taste lives in `src/physiology/`; D-04 (reuse) + phase-01 anti-duplication convention (genome: "do NOT create a parallel DNA module") argue **extend-in-place**. **Recommendation: extend `src/cognitive-plane/taste/taste-engine.ts` in place** (add outcome learning, cold-start, 0-100 composite, formal Storable conformance) and record the placement deviation explicitly in the D-11 design doc — or compose from `src/physiology/taste.ts` without duplicating the preference store. Either way: **do not build a second preference store.** Flag for planner/discuss-phase.

### L4 — Sync gate vs async infrastructure
FileEditor/DiffReview sync → `evaluate()` sync. NervousSystem.emit async → fire-and-forget with `.catch(() => {})`. Do NOT make `evaluate()` async "just in case" — it breaks the FileEditor API (all callers + 7 tests). LLM scoring (D-05 optional futures) lives ABOVE the gate in a separate async path.

### L5 — `governance:event_denied`/`review:requested` absent from `signalPriorityForType`
createSignal falls back to priority 1 (spinal) for them (signal.ts:142). Fine for reflex signals; plans must not assume a priority that doesn't exist. For brainstem-level signals use `error:occurred`/`tool:called` types; record the verdict event with the semantically-named type.

### L6 — Fake-root / drive-root residue
WorkspaceBrain is constructed in ~9 test files with fake/mkdtemp roots; phase 01 converted integration describes to mkdtemp (01-01-PLAN.md:283-291). **Any physiology organ attached to WorkspaceBrain must be LAZY** (zero I/O until first access — precedent workspace-brain.ts:51-55) or the suite breaks on Windows (open SQLite + rmSync). Keep `src/physiology/` stores constructed explicitly, not via the WorkspaceBrain constructor.

### L7 — DNA backward compatibility + fingerprint purity
`load()` must default missing `genomeVersion`/`alleles`/`snapshots`. **Alleles never enter `recompute()` input.** Fingerprint-stability tests (`recompute({a:1})` twice → same fingerprint, 0 mutations) must keep passing — adding alleles must not trigger fingerprint mutations.

### L8 — attach() result additions must be optional
`AttachmentResult.genome?` only. Preserve the "no manifest → minimal result" contract (attach.ts:130-140).

### L9 — coding-tools.test.ts is the interception regression canary
480 lines, 5 describes. Gate hooks must be constructor-injected and default-off. `DiffReview.review()` findings-count assertions (e.g., line 378 `toBe(0)`) forbid in-review gate findings by default — use the `reviewWithGate` wrapper or an optional `gateVerdict?` result field.

### L10 — D-04's "exactly 1 runtime dep" is STALE
package.json dependencies = `openai` **+ `@opentelemetry/api`** (ADR-002; verified). Locked intent = **zero NEW runtime dependencies**; "exactly 1" predates ADR-002. Plans assert "dep count unchanged (2)" — flag in the design doc to avoid a spurious verification failure.

### L11 — Branded-type strictness on verdict evidence
Gate evidence (node ids, thresholds) is plain JSON; only signal `source` needs `componentID(...)` branding — createSignal handles it internally (signal.ts:146). No manual brand casting outside signal creation.

### L12 — No publisher currently emits `pr:merged`, `pr:reviewed`, `review:submitted`, `ci:*`
Taste/genome wiring must **subscribe**; tests must **publish** directly (existing pattern: workspace-brain.test.ts). Wiring defines the payload contract; forward-compatible with the git driver.

---

## Validation Architecture

> No `.planning/config.json` exists at workspace or project root (verified); per phase-01 precedent (01-VALIDATION.md) the per-phase validation contract lives here so each plan encodes it.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 (installed 3.2.7), `vitest.config.ts` (include `src/**/*.test.ts`; v8 coverage: statements 70 / branches 75 / functions 78 / lines 70) |
| Quick run command | `npx vitest run src/__tests__/<plan-scoped-test>.test.ts` |
| Full suite command | `npm test` + `npm run typecheck` (per wave); + `npm run build` at phase gate |
| Baseline | 98 files / 1,708 tests passing (2026-07-31, WORKSPACE-MEMORY) — must hold |

### What each plan's acceptance criteria must prove

| Contract | Validation the tests must encode |
|---|---|
| D-02 gate semantics | `allow`/`block`/`defer`; block returns before ANY fs write (file absent + `applied: false`); escape hatch honored but violations recorded; verdict emitted as signal + bus event |
| D-03 LLM-free determinism | Gate test file has zero provider imports; same proposal → same verdict repeatedly; evidence carries node ids/rule/threshold; `evaluate` is sync (no Promise in signature) |
| D-04 reuse | package.json diff empty; only existing EventTypes (type-check enforces); Storable persist/load round-trip per new store; missing file → 0 |
| D-05 counterfactual | `FutureVerdict[]` always exactly 5 futures; each with score + evidence; recommended future = constitution-aligned pick, deterministic; LLM path absent by default |
| D-06 taste | 0-100 elegance composite; accepted-PR patterns raise weights, reverted lower; cold-start deterministic (naming/abstraction/symmetry) below episode threshold; weights persist via Storable, workspace-scoped |
| D-07 genome | `mutate(outcome, zone)` increments version, appends allele + snapshot; fingerprint UNCHANGED by mutation; snapshots retained + capped; old snapshot loads (backward compat); `attach()` carries `genome` when provided, absent otherwise |
| D-08 pain memory | Trauma record with decay-resistant affect; `affectFor(zone)` rises after trauma; gate with ZoneAffectProvider stiffens thresholds; pain read path has no model calls |
| D-09 prototype | 03-01 runs green standalone (own tests only); no other plan required |
| D-10 testing contract | All new tests deterministic/LLM-free/temp-dir; zero residue; no pre-existing test altered outside `files_modified`; full suite + tsc + build green at each wave merge |
| D-11 design doc | `projects/uch/design/ENGINEERING-PHYSIOLOGY.md` exists before implementation plans execute; conformance doc updated |

### Sampling rate
- **Per task commit:** `npx vitest run src/__tests__/<plan-scoped>.test.ts`
- **Per wave merge:** `npm test` + `npm run typecheck`
- **Phase gate:** full suite + `npm run build` green before `/gsd-verify-work`

### Wave 0 gaps (RED scaffolds needed before implementation)
- [ ] `src/__tests__/reflex-gate.test.ts` — verdicts, registry, escape hatch, sync contract (D-02/D-03/D-09)
- [ ] `src/__tests__/reflex-interception.test.ts` — FileEditor block-before-write, CommandRunner block, DiffReview wrapper (D-02)
- [ ] `src/__tests__/physiology-metrics.test.ts` — namingQuality/abstractionBalance/symmetryIndex (D-06 cold-start)
- [ ] `src/__tests__/physiology-counterfactual.test.ts` — five futures, evidence, determinism (D-05)
- [ ] `src/__tests__/physiology-taste.test.ts` — outcome learning, cold-start blend, 0-100, persist (D-06)
- [ ] `src/__tests__/workspace-dna-evolution.test.ts` — mutate/version/snapshots/fingerprint-purity/backward-compat (D-07)
- [ ] `src/__tests__/workspace-manifest-genome.test.ts` — attach genome inheritance (D-07)
- [ ] `src/__tests__/physiology-pain-memory.test.ts` — trauma affect, zone stiffening, Storable (D-08)
- [ ] `src/__tests__/physiology-predictions.test.ts` — performance/security/product cortices (D-05/D-06 composition)
- Framework install: none — vitest verified present.

<!-- PLAN-STRUCTURE -->
