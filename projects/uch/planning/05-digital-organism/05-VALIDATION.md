---
phase: 05
slug: digital-organism
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 05-RESEARCH.md (verified line-anchored claims) and the two
> wave plans (05-01 Wave A — physiology core; 05-02 Wave B — memory physiology).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace baseline) |
| **Config file** | `vitest.config.ts` — include `src/**/*.test.ts`, v8 coverage thresholds |
| **Quick run command** | `npx vitest run src/__tests__/<plan-scoped-test>.test.ts` |
| **Full suite command** | `npm test` + `npm run typecheck` (per wave); `npm run build` at phase gate |
| **Baseline** | 136 files / 2,165 tests passing (2026-07-31, WORKSPACE-MEMORY) — must hold |
| **Dependency contract** | package.json runtime deps unchanged at `openai` + `@opentelemetry/api` — zero NEW runtime deps (L5) |
| **Known flake (do not chase)** | `ingester-injection.test.ts` fails under full parallel load (shared `os.tmpdir()` contention), passes alone — run full suite serially if it appears (L8) |

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
| 05-01 | 01 | 1 | D-02..D-06 | T-05-01..T-05-08 | Five RED scaffolds: hormones (computeHormones/modeForLevels pure), circadian (phaseAt pure, Clock), homeostasis (sensors/setpoints/adapters), pleasure (capped connectome strengthening), gene-expression (express/modulate) — RED on new surfaces only, existing contracts untouched | unit | `npx vitest run src/__tests__/physiology-hormones.test.ts src/__tests__/physiology-circadian.test.ts src/__tests__/physiology-homeostasis.test.ts src/__tests__/physiology-pleasure.test.ts src/__tests__/physiology-gene-expression.test.ts` | ❌ W0 | ⬜ pending |
| 05-02 | 01 | 1 | D-02 | T-05-01/T-05-02/T-05-08 | Hormone engine: canonical mapping exact, mode tie-break + balanced floor, consumers as derived multipliers (never block actions), sink fires only on mode change / cortisol spike; existing cognitive-core tests still green | unit | `npx vitest run src/__tests__/physiology-hormones.test.ts` + `npx vitest run src/__tests__/cognitive-core.test.ts` | ❌ W0 | ⬜ pending |
| 05-03 | 01 | 1 | D-03 | T-05-01 | Circadian: hour windows exact, transition events, maintenance windows advisory; zero `Date.now` in module | unit | `npx vitest run src/__tests__/physiology-circadian.test.ts` | ❌ W0 | ⬜ pending |
| 05-04 | 01 | 1 | D-04 | T-05-04 | Homeostasis: deviation math, metric→action map, bounded execution (max 3), skipped list for prune/grow slots, adapters isolated; zero direct organ imports | unit | `npx vitest run src/__tests__/physiology-homeostasis.test.ts` | ❌ W0 | ⬜ pending |
| 05-05 | 01 | 1 | D-05 | T-05-05/T-05-07 | Pleasure: connectome strengthening capped at maxWeight, zoneLevel bounded, Storable round-trip, history mode without connectome | unit | `npx vitest run src/__tests__/physiology-pleasure.test.ts` | ❌ W0 | ⬜ pending |
| 05-06 | 01 | 1 | D-06 | T-05-06 | Gene expression: DEFAULT_GENES exact, activator matching, modulation + law:5 decay, immutable protection; existing genome tests still green | unit | `npx vitest run src/__tests__/physiology-gene-expression.test.ts` | ❌ W0 | ⬜ pending |
| 05-07 | 01 | 1 | D-12/D-13 | T-05-08 | Wave-A integration: 4 event types + 4 priority entries (additive, end-of-union/map), exoskeleton wires the five organs + sinks + subscriptions, `physiology` component registered; exoskeleton-organs tests still green | integration | `npx vitest run src/__tests__/exoskeleton-organs.test.ts` + `npm test` + `npm run typecheck` | ❌ W0 | ⬜ pending |
| 05-08 | 01 | 1 | D-15 | — | Design doc `design/DIGITAL-ORGANISM.md` exists BEFORE execution (blocking if absent); vision-conformance report gains the five Wave-A claims (NOT design/CONFORMANCE.md — L12) | manual | `Test-Path design/DIGITAL-ORGANISM.md` + `Select-String -Path docs/vision-conformance-2026-07-31.md -Pattern "Hormone Engine|Circadian Rhythm|Homeostatic Regulator|Pleasure System|Gene Expression"` | ❌ W0 | ⬜ pending |
| 05-09 | 02 | 2 | D-07..D-11 | T-05-09..T-05-16 | Five RED scaffolds: pruning (detection rules + archive), neurogenesis (threshold + kinds), beliefs (lifecycle + toTakes), myelination (promotion + cache), vaccines (acquire/check/seed) — RED on new surfaces only | unit | `npx vitest run src/__tests__/physiology-pruning.test.ts src/__tests__/physiology-neurogenesis.test.ts src/__tests__/physiology-beliefs.test.ts src/__tests__/physiology-myelination.test.ts src/__tests__/physiology-vaccines.test.ts` | ❌ W0 | ⬜ pending |
| 05-10 | 02 | 2 | D-07 | T-05-09/T-05-10 | Pruning: stale/orphan/dangling/duplicate/low-relevance/unused/retired detection; archive + restore (law:12); path containment; report persisted; connectome tests still green | unit | `npx vitest run src/__tests__/physiology-pruning.test.ts` | ❌ W0 | ⬜ pending |
| 05-11 | 02 | 2 | D-08 | T-05-11/T-05-16 | Neurogenesis: threshold gating (≥ N), three kinds create REAL registered entities (fast-path routine / ReflexGate check / skill record), wrappers only, no-throw on missing adapters | unit | `npx vitest run src/__tests__/physiology-neurogenesis.test.ts` | ❌ W0 | ⬜ pending |
| 05-12 | 02 | 2 | D-09 | T-05-12 | Beliefs: confidence moves (L10 mapping), decay toward prior, merge, status transitions with belief:updated only on transitions, toTakes domain 'belief' | unit | `npx vitest run src/__tests__/physiology-beliefs.test.ts` | ❌ W0 | ⬜ pending |
| 05-13 | 02 | 2 | D-10/D-11 | T-05-13..T-05-15 | Myelination + vaccines: promotion at threshold, bounded cache + catalog invalidation; CIC T01-T14 seeds idempotent, LRU cap, containment matching; CIC tests still green | unit | `npx vitest run src/__tests__/physiology-myelination.test.ts src/__tests__/physiology-vaccines.test.ts` + `npx vitest run src/__tests__/threat-mitigations-all.test.ts` | ❌ W0 | ⬜ pending |
| 05-14 | 02 | 2 | D-12/D-13 | T-05-13 | Wave-B integration: 6 event types + 6 priority entries, homeostatic prune/grow slots wired (05-01 seam closed), neurogenesis/myelination/vaccination sources mapped, dynamic vaccine:hit escalation at emission | integration | `npx vitest run src/__tests__/exoskeleton-organs.test.ts` + `npm test` + `npm run typecheck` | ❌ W0 | ⬜ pending |
| 05-15 | 02 | 2 | D-15 | — | Vision-conformance report gains the five Wave-B claims; design doc still matching | manual | `Select-String -Path docs/vision-conformance-2026-07-31.md -Pattern "Neural Pruning|Neurogenesis|Belief Objects|Myelination|Immune Vaccination"` | ❌ W0 | ⬜ pending |
| 05-16 | 01 | 1 | D-13 | — | No regression after Wave A: `npm test` exits 0 with ≥ 2,165 passing + zero new failures; `npm run typecheck` green | smoke | `npm test` + `npm run typecheck` | ✅ | ⬜ pending |
| 05-17 | 01-02 | 1-2 | D-13 | — | No regression after Wave B: full suite + typecheck + `npm run build` green at phase gate | smoke | `npm test` + `npm run typecheck` + `npm run build` | ✅ | ⬜ pending |
| 05-18 | 01-02 | 1-2 | D-13 | T-05-SC | Dependency contract: `git diff --stat package.json` empty (zero new runtime deps) | smoke | `git diff --stat package.json` | ✅ | ⬜ pending |
| 05-19 | 01-02 | 1-2 | D-14 | — | File ownership: `git status` check before touching event-bus/signal/exoskeleton (parallel waves); git diff additive-only on all extended modules | manual | `git status --porcelain` + `git diff` review | ✅ | ⬜ pending |
| 05-20 | 01-02 | 1-2 | D-15 | — | Design doc precedes execution and matches the plans' claims exactly; conformance report updated after each wave | manual | file-existence + claims cross-check | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Threat refs: T-05-01..T-05-08 = Wave-A register (payload coercion, counters, mode dominance, regulation bounds, reward cap, expression bounds, disclosure, spam); T-05-09..T-05-16 = Wave-B register (archive traversal, irreversibility, neuron growth, belief abuse, vaccine growth/bypass, cache poisoning, fabrication).*

---

## Per-Plan Acceptance Contract (from the two wave plans)

| Contract | Validation the tests must encode |
|---|---|
| D-01 layout | `src/physiology/` created fresh (circadian/homeostasis/pleasure in Wave A; pruning/neurogenesis/beliefs in Wave B + index barrel); endocrine/immune/fastpath/species-genome extended in place additively; no imports FROM physiology in pre-existing code |
| D-02 hormones | computeHormones pure with the exact canonical formulas; modeForLevels tie-break order + balanced floor; consumers are derived multipliers (reflex strictness, verification depth, frontier scan, prune aggressiveness, maintenance bias); never block actions; hormone:changed on mode change / cortisol spike |
| D-03 circadian | phaseAt pure with exact hour windows (morning 6-11 / afternoon 12-16 / evening 17-21 / night 22-5); transition events; maintenance windows advisory; zero `Date.now` in engine code |
| D-04 homeostasis | read-only sensors + setpoints; deviation = (v−t)/max(t,ε) with |d| > tolerance gating; DEFAULT_ACTION_MAP; max 3 actions/cycle; adapters isolated; prune/grow skipped in Wave A → wired in Wave B via registerAction |
| D-05 pleasure | reward records with deterministic ids; connectome strengthening capped at maxWeight; zoneLevel bounded (maxZoneLevel); zoneRelaxation derived; Storable round-trip; history mode without connectome |
| D-06 gene expression | DEFAULT_GENES (6, all mutable); express() containment matching; strength = expression × (1 + domainMultiplier); modulateExpression with law:5 decay; immutable genes never modulated; laws()/commitments() unchanged |
| D-07 pruning | stale/orphan/dangling/duplicate/low-relevance/unused/retired detection; archive ≠ delete (restore, law:12); path containment; report persisted; never touches genome/laws/external files |
| D-08 neurogenesis | threshold-gated (≥ N, default 10); three kinds create real registered entities (fast-path routine / ReflexGate check / skill record); wrappers over existing engines only; no-throw on missing adapters |
| D-09 beliefs | confidence moves fixed per quality (correct +0.10 / incorrect −0.15 / partial +0.02 / unresolvable 0 — L10); decay toward 0.3 prior; merge unions evidence; status lifecycle with belief:updated on transitions only; toTakes domain 'belief' with correct resolution mapping |
| D-10 myelination | threshold promotion (default 10) via engineFactory → router.register; deterministic engines only; FNV-1a cache bounded + invalidated on catalog version change; FastPathRouter members unchanged |
| D-11 vaccines | acquire/check (containment matching, lowercase); CIC T01-T14 seeds idempotent (14); LRU cap (default 64); hits counted; no model judgment |
| D-12 event types | 10 new types total (4 Wave A + 6 Wave B), additive end-of-union; static priorities in `src/nervous-system/signal.ts`; dynamic escalation (hormone:changed cortisol spike, vaccine:hit critical) at emission via createSignal options |
| D-13 testing contract | All new tests deterministic/LLM-free/temp-dir (`uch-<organ>-` prefixes); injectable Clock everywhere (no Date.now in engines); zero crypto.randomUUID in production code; no pre-existing test altered outside files_modified; full suite + tsc + build green at each wave merge |
| D-14 DOE | git-status file ownership respected; stash-prove typecheck; only `files_modified` touched; additive diffs on extended modules |
| D-15 design doc | `design/DIGITAL-ORGANISM.md` exists BEFORE execution and matches plans exactly; vision-conformance report (dated doc — NOT design/CONFORMANCE.md, L12) updated after each wave |

---

## Wave 0 Gaps (RED scaffolds needed before implementation)

- [ ] `src/__tests__/physiology-hormones.test.ts` — pure mapping, mode selection, multipliers, sink semantics (D-02)
- [ ] `src/__tests__/physiology-circadian.test.ts` — hour windows, transitions, maintenance windows (D-03)
- [ ] `src/__tests__/physiology-homeostasis.test.ts` — sensors, deviation, action map, bounds, slots (D-04)
- [ ] `src/__tests__/physiology-pleasure.test.ts` — connectome cap, zone bounds, Storable (D-05)
- [ ] `src/__tests__/physiology-gene-expression.test.ts` — DEFAULT_GENES, express, modulation, immutable (D-06)
- [ ] `src/__tests__/physiology-pruning.test.ts` — detection rules, archive/restore, report (D-07)
- [ ] `src/__tests__/physiology-neurogenesis.test.ts` — threshold, three kinds, records (D-08)
- [ ] `src/__tests__/physiology-beliefs.test.ts` — lifecycle, decay, merge, toTakes, Storable (D-09)
- [ ] `src/__tests__/physiology-myelination.test.ts` — promotion, cache, invalidation (D-10)
- [ ] `src/__tests__/physiology-vaccines.test.ts` — acquire/check/seed/LRU/hits (D-11)
- Framework install: none — vitest verified present.

---

## Manual-Only Verifications

- D-15: `design/DIGITAL-ORGANISM.md` exists BEFORE execution (blocking gate, mirrors 03-D11) and its claims match the plans exactly.
- D-15: vision-conformance report updated after each wave with the wave's five claims (05-08 / 05-15).
- D-14: file-ownership check (`git status`) before editing `src/event-bus/neural-event-bus.ts`, `src/nervous-system/signal.ts`, `src/exoskeleton/exoskeleton.ts` (parallel waves may own them — L6; additive edits only).
- L12 correction: conformance claims go to `docs/vision-conformance-2026-07-31.md`, NEVER to `design/CONFORMANCE.md` (CIC fixtures doc).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
