---
phase: 01
slug: organism-organs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.0 (installed 3.2.7) |
| **Config file** | `vitest.config.ts` — include `src/**/*.test.ts`, v8 coverage thresholds (statements 70 / branches 75 / functions 78 / lines 70) |
| **Quick run command** | `npx vitest run src/__tests__/workspace-graphs-<organ>.test.ts` |
| **Full suite command** | `npm test` (vitest run) |
| **Estimated runtime** | ~10-13 seconds (baseline verified 2026-07-31 by two independent runs: **87 files / 1,568 tests passing / 0 failures**. Note: `neural-fs.test.ts:45` observed flaky once — drive-state-dependent backslash test, passes on re-runs; do not treat as known debt unless it fails reproducibly) |

---

## Sampling Rate

- **After every task commit:** Run the per-organ quick command (`npx vitest run src/__tests__/workspace-graphs-*.test.ts`)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run typecheck` + `npm run build`
- **Max feedback latency:** ~14 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 0 | D-01/D-02 | T-01-01 / T-01-02 | Node ids from payload paths treated as opaque strings; no filesystem access in organs | unit | `npx vitest run src/__tests__/workspace-graphs-knowledge.test.ts` | ❌ W0 | ⬜ pending |
| 01-02 | 01 | 0 | D-01/D-02 | T-01-02 | Decision nodes reference `decision:{id}` only — no DecisionLog data duplication | unit | `npx vitest run src/__tests__/workspace-graphs-decisions.test.ts` | ❌ W0 | ⬜ pending |
| 01-03 | 01 | 0 | D-01/D-02 | T-01-02 | Task nodes reference `task:{id}` only — no TaskScheduler data duplication | unit | `npx vitest run src/__tests__/workspace-graphs-tasks.test.ts` | ❌ W0 | ⬜ pending |
| 01-04 | 01 | 0 | D-01/D-02 | T-01-02 | Cycle nodes with outcomes; persist/load round-trip via temp dir; SQLite closed before rmSync | unit | `npx vitest run src/__tests__/workspace-graphs-evolution.test.ts` | ❌ W0 | ⬜ pending |
| 01-05 | 01 | 0 | D-01/D-02 | T-01-03 | sha256 fingerprint — no secrets hashed; mutation events recorded; encode/decode round-trip | unit | `npx vitest run src/__tests__/workspace-graphs-dna.test.ts` | ❌ W0 | ⬜ pending |
| 01-06 | 01 | 1 | D-03/D-04 | T-01-01 | Organs exposed as readonly properties; bus events (git:commit/file:saved/error:occurred) produce graph mutations | integration | `npx vitest run src/__tests__/workspace-brain.test.ts` | ✅ exists — extend | ⬜ pending |
| 01-07 | 01 | 1 | D-05 | T-01-01 | `persist`/`load` signatures; load returns count; missing file returns 0; temp-dir lifecycle | unit | per-organ files above | ❌ W0 | ⬜ pending |
| 01-08 | 01 | 1 | D-06 | — | No regression — `npm test` exits 0 with ≥ 1,546 passing and no new failures (current green: 1,568) | smoke | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Threat refs: T-01-01 = event-payload coercion (`String(payload.x ?? '')`) + deterministic ids (Pitfall 4); T-01-02 = no data duplication / no secrets in graph properties (Security Domain); T-01-03 = sha256 fingerprint only, no secrets.*

---

## Wave 0 Requirements

- [ ] `src/__tests__/workspace-graphs-knowledge.test.ts` — knowledge graph behaviors (REQ: D-02/D-04)
- [ ] `src/__tests__/workspace-graphs-decisions.test.ts` — decision graph behaviors (REQ: D-02)
- [ ] `src/__tests__/workspace-graphs-tasks.test.ts` — task graph behaviors (REQ: D-02)
- [ ] `src/__tests__/workspace-graphs-evolution.test.ts` — evolution history + persist/load (REQ: D-02/D-05)
- [ ] `src/__tests__/workspace-graphs-dna.test.ts` — DNA fingerprint/mutations (REQ: D-02)
- [ ] Extend `src/__tests__/workspace-brain.test.ts` — brain composition + event wiring (REQ: D-03/D-04)
- Framework install: none needed — vitest + config verified present.

---

## Manual-Only Verifications

All phase behaviors have automated verification. (No live-LLM paths in organ logic; deterministic tests only, per D-06.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
