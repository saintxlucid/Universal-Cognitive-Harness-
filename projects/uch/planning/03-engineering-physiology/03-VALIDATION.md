---
phase: 03
slug: engineering-physiology
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 03-RESEARCH.md §Validation Architecture (verified line-anchored claims).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.0 (installed 3.2.7) |
| **Config file** | `vitest.config.ts` — include `src/**/*.test.ts`, v8 coverage thresholds (statements 70 / branches 75 / functions 78 / lines 70) |
| **Quick run command** | `npx vitest run src/__tests__/<plan-scoped-test>.test.ts` |
| **Full suite command** | `npm test` + `npm run typecheck` (per wave); `npm run build` at phase gate |
| **Baseline** | 98 files / 1,708 tests passing (2026-07-31, WORKSPACE-MEMORY) — must hold |
| **Dependency contract** | package.json runtime deps unchanged at `openai` + `@opentelemetry/api` (L10: D-04's "exactly 1" predates ADR-002 — locked intent is **zero NEW** runtime deps) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/__tests__/<plan-scoped>.test.ts`
- **After every plan wave merge:** `npm test` + `npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite green + `npm run typecheck` + `npm run build`
- **Max feedback latency:** < 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01 | 01 | 0 | D-02/D-03/D-09 | T-03-01/T-03-04 | ReflexGate sync `evaluate()`; allow/block/defer; block returns before ANY fs write; escape hatch recorded; ZoneAffectProvider seam shipped | unit | `npx vitest run src/__tests__/reflex-gate.test.ts` | ❌ W0 | ⬜ pending |
| 03-02 | 01 | 0 | D-02/D-09 | T-03-01 | FileEditor block-before-write (applied:false, file absent), CommandRunner block, DiffReview `reviewWithGate` wrapper; verdict emitted as signal + bus event | integration | `npx vitest run src/__tests__/reflex-interception.test.ts` | ❌ W0 | ⬜ pending |
| 03-03 | 02 | 0 | D-03 | T-03-02 | 4 canonical checks in registry (duplicate abstraction via graph search, dependency duplication, complexity threshold, ownership boundary via projection); evidence carries node ids/rule/threshold; zero model imports | unit | `npx vitest run src/__tests__/reflex-gate.test.ts` | ❌ W0 | ⬜ pending |
| 03-04 | 02 | 0 | D-05 | T-03-03 | Exactly 5 FutureVerdicts; score + evidence each; recommended = constitution-aligned deterministic pick; LLM path absent by default | unit | `npx vitest run src/__tests__/physiology-counterfactual.test.ts` | ❌ W0 | ⬜ pending |
| 03-05 | 02 | 0 | D-06 | T-03-03 | `namingQuality`/`abstractionBalance`/`symmetryIndex` deterministic 0-1; feed cold-start + maintainability future | unit | `npx vitest run src/__tests__/physiology-metrics.test.ts` | ❌ W0 | ⬜ pending |
| 03-06 | 03 | 0 | D-06 | T-03-03 | Taste 0-100 elegance composite; accepted-PR raises / reverted lowers weights; cold-start blend below episode threshold; Storable persist, workspace-scoped; NO second preference store (L3) | unit | `npx vitest run src/__tests__/physiology-taste.test.ts` | ❌ W0 | ⬜ pending |
| 03-07 | 03 | 0 | D-08 | T-03-04 | Trauma event with decay-resistant affect; `affectFor(zone)` rises; gate with ZoneAffectProvider stiffens thresholds; pain read path has zero model calls | unit | `npx vitest run src/__tests__/physiology-pain-memory.test.ts` | ❌ W0 | ⬜ pending |
| 03-08 | 04 | 0 | D-07 | T-03-03 | `mutate(outcome, zone)` increments version, appends allele + snapshot; fingerprint UNCHANGED by mutation; snapshots capped; old snapshot loads (backward compat) | unit | `npx vitest run src/__tests__/workspace-dna-evolution.test.ts` | ❌ W0 | ⬜ pending |
| 03-09 | 04 | 0 | D-07 | T-03-05 | `attach()` carries `genome` when provided, absent otherwise; zero ProjectionEngine changes | unit | `npx vitest run src/__tests__/workspace-manifest-genome.test.ts` | ❌ W0 | ⬜ pending |
| 03-10 | 05 | 0 | D-05/D-06 | T-03-03 | Performance/security/product cortices compose reflex checks + judgment + taste; record `prediction:made`; no duplicate engines | unit | `npx vitest run src/__tests__/physiology-predictions.test.ts` | ❌ W0 | ⬜ pending |
| 03-11 | 05 | 1-5 | D-04/D-10 | T-03-01 | No regression — `npm test` exits 0 with ≥ 1,708 passing and no new failures; `npm run typecheck` green | smoke | `npm test` + `npm run typecheck` | ✅ | ⬜ pending |
| 03-12 | 01-05 | 5 | D-11 | — | Design doc `projects/uch/design/ENGINEERING-PHYSIOLOGY.md` exists BEFORE implementation plans execute; vision-conformance doc updated | manual | file existence check | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Threat refs: T-03-01 = gate bypass/ordering (block-before-write asserted via fs state, not just return value); T-03-02 = duplicate-abstraction false positives (evidence must be node-id-anchored); T-03-03 = determinism (no provider imports, no `crypto.randomUUID` in production source, fixed string ids); T-03-04 = Windows temp-dir residue (close() BEFORE rmSync, mkdtemp roots only); T-03-05 = backward compat (all attach() additions optional).*

---

## Per-Plan Acceptance Contract (from 03-RESEARCH.md §Validation Architecture)

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

---

## Wave 0 Gaps (RED scaffolds needed before implementation)

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

---

## Manual-Only Verifications

- D-11 design doc existence + vision-conformance update (file-existence check, no test gate).
- L3 taste placement deviation (extend-in-place vs `src/physiology/`) recorded explicitly in the design doc.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
