# COGNITIVE-KERNEL-SHIPPING.md — Wave contract: ADR-006 Phases A–F + GAP leftovers

- **Status:** ✅ **EXECUTED 2026-08-01** — all 10 workstreams (WS-A…WS-P, WS-G, WS-H) landed; integration gate run (154 files / 2436 tests, only the 2 documented pre-existing wearable-wave failures; wave files tsc/lint clean; build blocked solely by wave-owned type errors). Results recorded in `.agent/memory/WORKSPACE-MEMORY.md` (2026-08-01 entry).
- **Date:** 2026-08-01
- **Source:** ADR-006 (Phases A–F), GAP-CLOSURE-PLAN (Phases 3, 4, 6, 7), VISION.md §6,
  the sensor/effector catalogs from the strategic vision document
- **Execution mode:** maximum capacity — parallel workstreams, additive files only,
  one agent per workstream, orchestrator runs the integration gate afterwards.

## 0. Global conventions (ALL workstreams)

- Repo: `projects/uch/`. ESM: imports use `.js` suffixes (`import { x } from '../foo.js'`).
- `tsconfig` is strict + `noUncheckedIndexedAccess` — non-null assertions (`!`) where index access is guarded.
- Persistence follows `src/cognitive-plane/persistence/persistence-engine.ts`:
  `Storable { persist(filePath): Promise<void>; load(filePath): Promise<number> }` plus
  `writeSnapshot/readSnapshot` helpers. Implement `Storable` on stateful stores.
- **Injectable clock** — no `Date.now()` directly in engine code; pure functions take `now: Date` / a `Clock` arg.
- No new runtime dependencies (runtime deps stay exactly `openai` + `@opentelemetry/api`).
- Tests: vitest 4, files `src/**/*.test.ts`, deterministic + LLM-free, `mkdtempSync` for
  file-backed stores, injectable clock, explicit timeouts only if spawning real processes (not expected).
- Do NOT add comments unless a non-obvious invariant requires one sentence.
- **Ownership rule:** you may ONLY create the files listed in your contract section.
  You may READ any existing file, but you must NEVER edit an existing file, `git add`,
  `git stash`, or commit. If you believe an existing file must change, report it as a
  blocker and stop — do not edit it.
- Wave-owned dirty files (must not be touched by anyone): all `M` files from `git status`
  (exoskeleton, index.ts, cli/, protocol/cp.ts + conformance.ts, neural-event-bus.ts,
  signal.ts, executive-brain/, trace-engine/, workspace-manifest/, species-genome.ts,
  integrity-checklist.ts, organic-score.ts, replay/index.ts, llm/drivers/, accelerators/,
  mcp/stdio-server.ts, sleep_cycle/cycle.ts, etc.) plus untracked wave files
  (cognitive-wearable.ts, reflex/, etiology/, cognitive-core/, frameworks/, frontier-mapper/).
- **Scoped test gate per agent:** `npx vitest run <your test file(s)>` from `projects/uch`
  must be green before you finish. Do NOT run the full suite (parallel contention) —
  the orchestrator runs the full gate.
- Full gate (orchestrator, after all workstreams land): `vitest run`, `tsc --noEmit`,
  `eslint` on new files, `npm run build`. Known pre-existing failures (do not chase):
  `agent-integration.test.ts` / `cognitive-wearable` (2 tests) and `ingester-injection.test.ts`
  under parallel load.

---

## WS-A — ADR-006 Phase A: Cognitive Process model

**Create ONLY:**
- `src/kernel/process/types.ts`
- `src/kernel/process/process-table.ts`
- `src/kernel/process/index.ts`
- `src/__tests__/process-model.test.ts`

**Contract.** A process is the kernel's unit of persistent cognition: one PID, a
continuously evolving unit containing working-memory refs, goals, energy, permissions,
capabilities, open files, episode id, signals, context ref — and **threads** (drivers
attached to the same process). Attach = join a PID; nothing transfers, nothing syncs.

- `types.ts`: `PID = number` (branded: `export type PID = number & { readonly __brand: unique symbol }` —
  follow the repo's branding style if one exists, else plain `number`); `ProcessStatus =
  'running' | 'suspended' | 'terminated'`; `ProcessThread { threadId: number; driverLabel:
  string; attachedAt: Date }`; `CognitiveProcess { pid; name; ownerLabel; status; goals:
  string[]; capabilities: string[]; permissions: string[]; openFiles: string[]; episodeId?;
  contextRef?; pendingSignals: string[]; threads: ProcessThread[]; createdAt: Date;
  updatedAt: Date }`; `ProcessSpec` (subset used at spawn).
- `process-table.ts`: class `ProcessTable` — `spawn(spec): CognitiveProcess`,
  `attach(pid, driverLabel): ProcessThread` (throws on unknown/terminated pid),
  `kill(pid): boolean` (status → 'terminated'; record PRESERVED — reversibility law 12),
  `signal(pid, name): boolean` (appends to `pendingSignals`),
  `drainSignals(pid): string[]` (threads consume), `get(pid)`, `list()`,
  `threadsOf(pid): ProcessThread[]`, `persist(filePath)`, `load(filePath)`. Monotonic PID
  counter (starts 1, never reused — carried across `load`).
- `index.ts` re-exports.
- **Tests:** spawn → running + pid monotonic; attach adds thread, second driver = second
  thread on same pid; attach to unknown/terminated pid throws; kill preserves record +
  status; signal/drain queue semantics; persist/load round-trip (pid counter continues);
  no state transfer on attach (thread has no process fields).
- **Read-only anchors:** `src/workspace-manifest/attach.ts`, `src/control-plane/projections.ts`,
  `src/state-virtualization/` — align vocabulary (grant, projection) but do not import anything
  from dirty files if it creates type friction; self-contained is fine.
- **Non-goals:** no exoskeleton wiring, no CLI, no MCP tool, no event-bus edits.

## WS-B — ADR-006 Phase B: Cognitive Virtual Memory Manager

**Create ONLY:**
- `src/kernel/memory/vmem/types.ts`
- `src/kernel/memory/vmem/vmem.ts`
- `src/kernel/memory/vmem/index.ts`
- `src/__tests__/cognitive-vmem.test.ts`

**Contract.** Working memory is RAM; stores are disk. A paging hierarchy
Hot → Warm → Cold → Archive with automatic promotion, eviction, and compaction,
scored by recency + salience + energy. Not vector search — memory management.

- `types.ts`: `MemoryTier = 'hot' | 'warm' | 'cold' | 'archive'`; `Page { id: string;
  payloadRef: string; tier: MemoryTier; salience: number; energyCost: number; sizeBytes:
  number; lastTouched: Date }`; `PagingPolicy { hotCapacity; warmCapacity; coldCapacity;
  promoteThreshold: number; evictThreshold: number; compactByHash: boolean }`.
- `vmem.ts`: class `CognitiveVMem` — `pageIn(id, payloadRef, meta): Page` (starts hot),
  `touch(id, now?)` (updates recency; may auto-promote to hot), `promote(id)`,
  `evict()` (lowest-scored page in warm/cold demotes a tier; archive is never auto-deleted —
  law 12 reversibility), `compact()` (merge pages sharing payloadRef hash into one, sum
  sizeBytes), `residency(id): MemoryTier | undefined`, `score(page, now): number`
  (deterministic: recency decay × salience × energy weight), `stats(): { perTier counts;
  totalBytes }`, `persist/load`.
- Policy defaults: hot 8 / warm 16 / cold 32; thresholds constants in code.
- **Tests:** pageIn → hot; touch promotes warm→hot; capacity overflow evicts lowest score
  (deterministic with fixed clock); compaction merges duplicate payloadRef pages;
  archive page can be promoted back (reversibility); persistence round-trip preserves tiers;
  clock injection changes scores deterministically.
- **Read-only anchors:** `src/kernel/retrieval/recency-decay.ts`, `src/kernel/retrieval/context-compressor.ts`,
  `design/RETRIEVAL-SCALING.md` (import the recency-decay helper if its signature is stable;
  else reimplement a small local decay).

## WS-C — ADR-006 Phase C: Organism versioning + restore

**Create ONLY:**
- `src/kernel/organism/versioned-store.ts`
- `src/kernel/organism/restore.ts`
- `src/kernel/organism/index.ts`
- `src/__tests__/organism-versioning.test.ts`

**Contract.** Everything the organism is becomes versioned (identity, genome, beliefs,
policies, skills) so the organism can be rolled back like a repository — a living
versioning, not a git shim. Restore = snapshot → verify → roll forward/back.

- `versioned-store.ts`: `VersionRecord<T> { version: number; value: T; committedAt: Date;
  message?: string }`; class `VersionedStore<T>` — `commit(value, message?): number`
  (returns new version; monotonic 1..n), `current(): VersionRecord<T>` (throws if empty),
  `at(version): T | undefined`, `history(): VersionRecord<T>[]` (immutable copies),
  `rollbackTo(version): boolean` (current becomes that version; history preserved —
  law 12), `persist/load`. Factory `createVersionedStore<T>(kind: string)`.
- `restore.ts`: `RestoreTarget = 'identity' | 'genome' | 'beliefs' | 'policies' | 'skills'`;
  `restoreOrganism({ store, target, toVersion, validator? }): OrganismRestoreReport` —
  `validator(value): string[]` (shape checks) MUST pass before the store is touched; on
  failure the store is NOT mutated and the report records `verified: false` + reasons.
  `OrganismRestoreReport { target; from: number; to: number; verified: boolean;
  reasons: string[]; restoredAt: Date }`.
- **Tests:** monotonic versions; history immutability; rollbackTo restores exact value and
  keeps history; rollbackTo unknown version → false, no mutation; validator rejection →
  store untouched + verified false; per-kind isolation (two stores); persistence round-trip;
  roll forward again after rollback.
- **Read-only anchor:** `src/cognitive-plane/replay/cognitive-time-machine.ts`
  (beliefTimeline pattern — alignment only).

## WS-D — ADR-006 Phase D: Transactional cognition

**Create ONLY:**
- `src/kernel/transactional/types.ts`
- `src/kernel/transactional/transaction.ts`
- `src/kernel/transactional/index.ts`
- `src/__tests__/transactional-cognition.test.ts`

**Contract.** Every thought is ACID: think → verify → commit, rollback on failed
verification. No unverified knowledge reaches long-term memory. One kernel primitive
composing proposal → gate → commit → ledger entry.

- `types.ts`: `GateVerdict { gateId: string; pass: boolean; reason?: string }`;
  `VerificationGate { id: string; verify(proposal: unknown): GateVerdict }` (sync);
  `TransactionStatus = 'proposed' | 'committed' | 'rolled-back'`; `Transaction { id: string;
  proposal: unknown; status: TransactionStatus; openedAt: Date; committedAt?: Date;
  verdicts: GateVerdict[] }`.
- `transaction.ts`: class `TransactionalMemory` — `propose(proposal): Transaction`
  (id = monotonic `tx-<n>`), `verify(tx, gates: VerificationGate[]): GateVerdict[]`
  (runs ALL gates; records on tx), `commit(tx): boolean` (refuses if any recorded verdict
  failed or already committed/rolled-back), `rollback(tx): boolean` (only from 'proposed'),
  `committed(): unknown[]`, `ledger(): Transaction[]` (append-only order), `persist/load`.
  Optional helpers in `transaction.ts`: `integrityGate()` and `organicScoreGate()` — thin
  adapters over `src/cognitive-plane/integrity/integrity-checklist.ts` and
  `src/kernel/constitution/organic-score.ts` (READ-ONLY imports — if their signatures are
  unstable mid-wave, ship the helpers as a clearly-marked TODO-free interface-only version:
  the gates interface is the contract, adapters are best-effort).
- **Tests:** all-pass → commit appends to committed; any fail → commit refuses + rollback
  succeeds; rollback on committed → false; double-commit idempotent false; gates all
  consulted (order preserved in verdicts); persistence round-trip; ledger append-only.
- **Non-goals:** no ExecutiveBrain/exoskeleton wiring.

## WS-E — ADR-006 Phase E: Self-diagnosis (SMART for cognition)

**Create ONLY:**
- `src/kernel/diagnostics/types.ts`
- `src/kernel/diagnostics/metrics.ts`
- `src/kernel/diagnostics/health.ts`
- `src/kernel/diagnostics/index.ts`
- `src/__tests__/self-diagnosis.test.ts`

**Contract.** A kernel service exposes organism health: memory fragmentation, reasoning
drift, knowledge entropy, contradiction rate, energy efficiency, learning rate, skill
usage, architecture drift, confidence, bias, hallucination risk, verification coverage —
with thresholds and remediation hints. Exactly like SMART for SSDs.

- `types.ts`: `HealthStatus = 'healthy' | 'warn' | 'critical'`; `HealthMetric { id: string;
  label: string; value: number; status: HealthStatus; threshold: { warn: number; critical:
  number }; remediationHint?: string }`; `HealthInputs` (all optional, all 0–1 or ratios,
  documented): memoryFragmentation, reasoningDrift, knowledgeEntropy, contradictionRate,
  energyEfficiency, learningRate, skillUsage, architectureDrift, confidence, biasSignal,
  hallucinationRisk, verificationCoverage. `CognitiveHealthReport { overall: HealthStatus;
  metrics: HealthMetric[]; remediations: string[]; generatedAt: Date }`.
- `metrics.ts`: pure producers, one per metric, `(inputs, now?)` → `HealthMetric` — band
  logic: value ≥ critical → critical; ≥ warn → warn; else healthy. Define sensible bands
  (e.g., verificationCoverage: warn < 0.6, critical < 0.3; contradictionRate: warn > 0.2,
  critical > 0.4; hallucinationRisk: warn > 0.5, critical > 0.8; energyEfficiency is a
  "higher is better" metric — invert band logic).
- `health.ts`: `diagnose(inputs, now?): CognitiveHealthReport` — runs all producers,
  overall = worst status (critical > warn > healthy), remediations = hints from
  warn/critical metrics.
- **Tests:** each metric's three bands (healthy/warn/critical boundary values); higher-is-
  better inversion for efficiency; aggregation worst-wins; determinism (same inputs → same
  output); injectable clock appears in report.generatedAt.

## WS-F — ADR-006 Phase F: Cognitive Filesystem mount semantics

**Create ONLY:**
- `src/neural-fs/mounts.ts`
- `src/neural-fs/__tests__/mounts.test.ts`

**Contract.** Drivers mount the cognitive filesystem (`mount Claude → /workspace`).
Mounts project capabilities onto the tree — grants intersect with mount scope before any
path is accessible. CIC operations become the FS verbs.

- `mounts.ts`: `Mount { point: string; scope: string; grantId: string; capabilities:
  string[]; attachedAt: Date }`; class `MountTable` — `mount(spec): Mount` (throws on
  duplicate point), `unmount(point): boolean`, `resolve(path): { mount: Mount; remainder:
  string } | undefined` (longest-prefix match on points), `canAccess(path, capability):
  boolean` (resolve + capability ∈ mount.capabilities AND capability ∈ grantedCapabilities
  param), `list(): Mount[]`, `persist/load`.
- `canAccess(path, capability, grantedCapabilities)` — authority intersection mirroring
  ProjectionEngine semantics (READ `src/control-plane/projections.ts`; reimplement the
  intersection locally, do not edit it).
- Also export `CP_VERBS: Record<string, string[]>` mapping CP op names (from
  `src/protocol/catalog.ts` — read-only) to FS verb families (e.g., RECALL → ['/memory',
  '/knowledge'] read; STORE → ['/memory'] write; OBSERVE → ['/events'] read). Keep the
  mapping a plain constant; exact op names read from the catalog at runtime if exported,
  else a documented static subset.
- **Tests:** mount/unmount; duplicate point rejected; longest-prefix resolution;
  canAccess denies capability not in mount OR not in grant; unmount leaves other mounts
  intact; persistence round-trip; CP_VERBS covers the exported catalog ops (if runtime
  catalog available) else covers the documented subset.

## WS-I — GAP Phase 7: Cognitive Merge — trivial slice

**Create ONLY:**
- `src/kernel/merge/cognitive-merge.ts`
- `src/kernel/merge/index.ts`
- `src/__tests__/cognitive-merge.test.ts`

**Contract.** The flagship feature's buildable part: two organisms (two engineers, two
tools) → merge *cognition*. Trivial slice: disjoint knowledge unions cleanly; genuine
belief conflicts are DETECTED and reported, never auto-resolved (open research problem).

- `cognitive-merge.ts`: minimal local `BeliefLike { claim: string; confidence: number;
  verdict?: string; evidence: string[] }` (self-contained — do NOT import the physiology
  wave's belief objects); `MergeConflict { claim: string; a: BeliefLike; b: BeliefLike;
  reason: 'confidence' | 'verdict' | 'evidence' }`; `MergeResult { beliefs: BeliefLike[];
  conflicts: MergeConflict[]; stats: { added: number; merged: number; conflicted: number } }`;
  `mergeCognition(a: BeliefLike[], b: BeliefLike[]): MergeResult` —
  same claim + same verdict + compatible confidence (|Δ| ≤ 0.15) → merged (evidence
  union, mean confidence); otherwise → conflict (both sides preserved in `conflicts`,
  neither in `beliefs`); disjoint → union. Deterministic (stable sort by claim); inputs
  never mutated (defensive copies).
- **Tests:** disjoint union adds; identical claim + same verdict → evidence union + mean
  confidence; confidence divergence > 0.15 → conflict with both sources; verdict
  mismatch → conflict; empty side(s); determinism; immutability of inputs; stats counts.

## WS-P — GAP Phase 4: Cognitive Packages engine (offline core)

**Create ONLY:**
- `src/kernel/packages/manifest.ts`
- `src/kernel/packages/registry.ts`
- `src/kernel/packages/index.ts`
- `src/__tests__/cognitive-packages.test.ts`

**Contract.** Versioned bundles of skills + policy additions + reference knowledge.
Offline registry, supply-chain safe. **Hard rule: no package auto-modifies the
Constitution — policy entries are quarantined for review, never applied.**

- Design contract: READ `design/COGNITIVE-PACKAGES.md` first and align names/shapes.
- `manifest.ts`: `CognitivePackage { name: string; version: string; kind: 'skill' |
  'policy' | 'knowledge' | 'brain'; entries: PackageEntry[]; requires?: string[] }`;
  `PackageEntry { path: string; content: string; hash: string }`;
  `validatePackage(pkg): string[]` — name pattern `^[a-z0-9][a-z0-9-]{0,62}$`,
  version semver-ish `^\d+\.\d+\.\d+$`, ≥1 entry, each entry hash = sha256(content)
  (`node:crypto`), requires names valid, no absolute paths in entry.path.
- `registry.ts`: class `PackageRegistry` — `constructor(rootDir: string)`;
  `install(pkg): InstallResult { installed: true; policyPendingReview: string[] }` —
  writes `{root}/.uccp/packages/<name>@<version>/` entry files; **policy entries are
  written under `<name>@<version>/policy-quarantine/` and reported, never applied to any
  constitution/policy store**; re-install same name+version → error; `verify(name,
  version?): VerifyResult` — recompute hashes of on-disk entries vs manifest (tamper
  detection); `remove(name)`, `list(): InstalledPackage[]`; all offline (no network).
- **Tests:** install/verify/remove lifecycle in mkdtemp; tampered file → verify fails;
  policy entries land in quarantine + `policyPendingReview` populated + no policy store
  touched; name/version validation errors; duplicate install rejected; list after
  install/remove; persistence across instances (new registry on same root).

## WS-G — Governance + sensor catalogs (docs + tiny script)

**Create ONLY:** (edits are explicitly allowed ONLY for the two listed existing files)
- `spec/VERSION.md` (NEW)
- `scripts/spec-version-check.mjs` (NEW — directory `projects/uch/scripts/` may be created)
- `design/integrations/SENSOR-CATALOGS.md` (NEW)
- `design/EVENT-GOVERNANCE.md` (EDIT — append one section at end only)
- `package.json` (EDIT — add exactly one line to `scripts`)

**Contract:**
1. `spec/VERSION.md` — spec versioning + stability policy: independent semver for the
   specification corpus (`spec/`), initial `0.1.0`, rules: additive doc changes bump patch,
   new protocols/contracts bump minor, breaking contract changes bump major; stability
   ladder (0.x = draft); CI intent documented.
2. `scripts/spec-version-check.mjs` — deterministic Node script: reads `spec/VERSION.md`
   for the declared version + last-updated date; compares newest mtime of any `spec/**`
   file against that date; exits 1 with a message listing changed files when the spec was
   modified after the declared version date without a bump. No dependencies (pure node:fs).
3. `package.json` — add `"check:spec-version": "node scripts/spec-version-check.mjs"`
   to the `scripts` block. Touch NOTHING else in that file.
4. `design/EVENT-GOVERNANCE.md` — append "## Event schema versioning policy" (after
   reading the file to match tone): event schemas carry semver; additive-only field
   additions within a minor; deprecation windows (min 2 minor versions); breaking changes
   require a new event type name; changelog lives in the design doc.
5. `design/integrations/SENSOR-CATALOGS.md` — per-host sensor/effector catalogs:
   Claude: Hook / Session / Tool / Git / Terminal / MCP / Skill / Diff / Approval sensors,
   effectors: Memory-Injection, Prompt-Augmentation, Policy-Enforcement,
   Architecture-Suggestion, Test-Injection, Context-Compression, Tool-Selection,
   Skill-Activation. VSCode: Extension / Agent-Host / Git / LSP / Debug / Test / Build /
   Terminal sensors. Map each to an existing `src/drivers/sensors|effectors` implementation
   where one exists (read those dirs), else mark `future`.

## WS-H — GAP Phase 6: ECS spike (decision record, no code)

**Create ONLY:**
- `design/ECS-SPIKE.md`

**Contract.** 2–3 day spike compressed into one decision record: (1) enumerate the actual
cross-type query patterns UCH needs (grep the test corpus + kernel for "across types",
e.g. open hypotheses across Episodes touching a file; list 5–8 concrete patterns);
(2) assess the current object-store model against a Bevy-style ECS for those patterns
(entities = episodes/memories/beliefs/…, components = behavior, systems = processors);
(3) decision: **adopt / reject / hybrid** with rationale, effort estimate, and risks.
Do NOT write ECS code beyond short illustrative sketches inside the doc. Verdict must be
evidence-driven, not metaphor appeal. End with a one-line recommendation the ADR process
can pick up.

---

## Integration gate (orchestrator, after all workstreams)

1. `npx vitest run` from `projects/uch` — expect only the 2 known pre-existing failures
   (wearable/middleware wave) + the ingester flake (rerun once if it appears).
2. `npx tsc --noEmit` — attribute any new errors to the owning workstream, fix in place.
3. `npx eslint` on all new files.
4. `npm run build`.
5. Record results in `.agent/memory/WORKSPACE-MEMORY.md` + session log; update ADR-006
   status table + GAP-CLOSURE-PLAN rows.
