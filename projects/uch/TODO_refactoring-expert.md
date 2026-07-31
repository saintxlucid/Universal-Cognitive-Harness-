# Refactoring Expert — UCH (`projects/uch`)

**Session**: 2026-07-31
**Scope**: Behavior-preserving refactoring of tracked, non-parallel-wave files only.
**Rule**: No commits unless asked; no parallel-wave files (untracked `cognitive-plane/frameworks/`, `reflex/`, `etiology/`, `engineering-intelligence/`, `cognitive-core/`, `kernel/epistemic/`; dirty `cli/*`, `exoskeleton/*`, `mcp/stdio-server.ts`, `event-bus/*`, `executive-brain/*`, `trace-engine/*`, `organic-score.ts`, `attach.ts`, `decision-graph.ts`, `cycle.ts`, `signal.ts`).

## 0. Baseline (measured 2026-07-31)

- Cyclomatic complexity scan (TS AST, 470 functions): `cli/index.ts:main` = **90 cc / 681 ln** (hotspot #1 — deferred, parallel wave owns the file).
- Long-method hotspots in scope: `cp.ts:createDefaultCPServer` 223ln/26cc, `loop.ts:queryLoop` 197ln/22cc, `conformance.ts:runConformance` 143ln/19cc (deferred), `permissions.ts:hasPermissionsToUseTool` 70ln/22cc, `manifest.ts:validateManifest` 62ln/18cc, `tool-call-repair.ts:coerceValue` 58ln/25cc, `semantic.ts:chunkSemantic` 75ln/12cc.
- Baseline tests (target scope): **118/118 passing** (loop-engine 13, permissions 18, tool-call-repair 27, chunkers 20, cp 18, workspace-manifest 22).
- Repo state: parallel agent wave in progress — only touch files listed per-task below.

## 1. Task list

### R-1 — Extract CP handlers from `createDefaultCPServer` (protocol/cp.ts)
- [x] Analyze: 17 inline `server.register({...})` closures, 223-line factory, cc 26.
- [x] Extract `DefaultHandlerContext { kernel, server, gapAnalysis }` + named handler factories.
- [x] Extract repeated `String(payload.x ?? '')` + trim + throw into `requireText(payload, key, message)`.
- [x] Extract `contentToString()` for retrieve/simulate/critique serialization (also reused by `episodeBrief`).
- [x] `createDefaultCPServer` becomes a declarative registration table.
- [x] Verify: `cp.test.ts` (18) + `mcp-cp.test.ts` (4) green; **cc 26 → 2, 223 ln → 31 ln**.
- Pattern: Extract Method + Factory. No behavior change; public API (`CPServer`, ops) untouched.

### R-2 — Guard clauses in `hasPermissionsToUseTool` (agentic/permissions/permissions.ts)
- [x] Extract predicates: `isSafetySensitiveWrite`, `matchesAnyRule`, `isEditTool`.
- [x] Extract mode fallback switch → `defaultDecision(mode, headless)`.
- [x] Flatten to single-level flow: bypass → deny → tool-check → allow → mode edits → readonly → ask → default.
- [x] Verify: `permissions.test.ts` (18) green; **cc 22 → 15, 70 ln → 53 ln**.
- Pattern: Guard Clauses + Extract Method. All reason strings preserved verbatim.

### R-3 — Strategy table for `coerceValue` (agentic/query/tool-call-repair.ts)
- [x] Extract per-type coercers: `coerceNumber/Boolean/String/Array/Object`.
- [x] Dispatch via `const COERCERS: Record<string, Coercer>` table + `NOOP_COERCER` fallback.
- [x] Preserve exact edge semantics (boolean→1/0, '1'→true, CSV fallback, NaN passthrough).
- [x] Verify: `tool-call-repair.test.ts` (27) green; **cc 25 → 2 (dispatch), coercers 5–8 each**.
- Pattern: Strategy + Replace Conditional with Polymorphism (table dispatch).

### R-4 — `chunkSemantic` extraction + dead-code removal (chunkers/semantic.ts)
- [x] Removed unreachable `else if (group.length > maxChars * 1.5)` (first branch already catches all > maxChars).
- [x] Removed dead `targetWords`/`void targetWords` variable.
- [x] Extracted `embedSentenceSpans`, `adjacentSimilarities`, `selectBoundaries`, `groupSpans`, `chunkGroups`.
- [x] Verify: `chunkers.test.ts` (20) green; **cc 12 → 5, 75 ln → 26 ln**.
- Pattern: Compose Method + dead-code elimination (behavior identical).

### R-5 — Table-driven `validateManifest` (workspace-manifest/manifest.ts)
- [x] Required string fields → data table `REQUIRED_STRING_FIELDS` with path accessor.
- [x] Extract `validateEntryArray` / `pushRequiredStringErrors` array validators.
- [x] Verify: `workspace-manifest.test.ts` (22) green; **cc 18 → 7, 62 ln → 29 ln**.
- [x] Note: first attempt introduced a regression (undefined capabilities/drivers failed array check) — caught by round-trip test, fixed with `raw === undefined` guard. Lesson: preserve `!== undefined` guards when extracting optional-field validators.
- Pattern: Replace Conditionals with Table/Data-driven validation.

### R-6 — De-duplicate `queryLoop` (agentic/query/loop.ts)
- [x] Extract `makeTerminal` (return shape duplicated 7×).
- [x] Extract `buildAssistantMessage(modelResult)`.
- [x] Extract `compactIfNeeded` + `summarizeWith` — kills duplicated summarize closure (auto-compact + prompt_too_long; ids `compact`/`ptl-compact` preserved).
- [x] Verify: `loop-engine.test.ts` (13) green; **197 ln → 128 ln, cc 22 → 21**.
- Pattern: Extract Method + remove duplication.

### R-7 — DEFERRED: `cli/index.ts:main` (101 cc / 754 ln, grew with parallel wave)
- [ ] Blocked: file has uncommitted lines from the active audit wave (`fix/uch-audit-2026-07-31` branch, +shell-injection hardening landed 3b8f2bf). Requires wave settlement. Top debt item.

### R-8 — Data-driven conformance suite (protocol/conformance.ts) — Wave 2
- [x] Extracted 19 inline `record(...)` cases into `CONFORMANCE_CASES` table (`name` + `run(server)`).
- [x] `runConformance` is now a compact executor loop; `buildReport` extracted; `expectSuccess`/`expectFailure` module-level.
- [x] Verify: `cp.test.ts` (18) + `mcp-cp.test.ts` (4) green; **19 cc / 143 ln → ~4 cc / 23 ln**.
- Pattern: Extract Method + data-driven table (suite becomes declarative, cases independently extendable).

### R-9 — Type-check table in `validateInputAgainstSchema` (agentic/tools/types.ts) — Wave 2
- [x] Extracted 5 inline type checks into `TYPE_CHECKS` table (type/invalid/message triplets).
- [x] Verify: `tools.test.ts` (23) green; **18 cc / 34 ln → 10 cc / 23 ln**; error messages verbatim.
- Pattern: Replace Conditional with Table.

### R-10 — De-duplicate `CPServer` error envelopes (protocol/cp.ts) — Wave 2
- [x] Extracted private `failure(op, requestId, error, durationMs)`; dispatch parse-failure + invoke unsupported-op + invoke parse-failure all reuse it.
- [x] Verify: `cp.test.ts` + `mcp-cp.test.ts` green; 3 duplicated envelope shapes → 1.
- Pattern: Extract Method + DRY.

## 2. Quality checklist (applies per task)

- [x] Tests pass without changes (45/45 targeted Wave 2; 122/122 Wave 1).
- [x] Complexity reduced (runConformance 19→~4 cc; validateInputAgainstSchema 18→10 cc).
- [x] SOLID applied (SRP via extraction; OCP via case/type tables).
- [x] Duplicate code extracted (error envelopes, case executor, type checks).
- [x] Nested conditionals ≤ 2 levels.
- [x] Performance verified (no new allocations in hot loops).
- [x] Coding standards followed (eslint clean on all files).

## 3. Commands

- Targeted: `npx vitest run src/protocol/__tests__/cp.test.ts src/agentic/__tests__/permissions.test.ts src/agentic/__tests__/tool-call-repair.test.ts src/chunkers/__tests__/chunkers.test.ts src/workspace-manifest/__tests__/workspace-manifest.test.ts src/agentic/__tests__/loop-engine.test.ts`
- Full suite: `npm test` (2160 passed, 1 pre-existing env failure)
- `npm run typecheck` — 6 pre-existing errors, all in parallel-wave files (cli/index.ts, frameworks/composer.ts, stdio-server.ts — verified identical with refactors stashed)
- `npm run lint`

## 4. Validation — RESULTS

### Wave 1 (2026-07-31)

| Function | Before | After |
| --- | --- | --- |
| `createDefaultCPServer` (cp.ts) | 26 cc / 223 ln | **2 cc / 31 ln** |
| `hasPermissionsToUseTool` (permissions.ts) | 22 cc / 70 ln | **15 cc / 53 ln** |
| `coerceValue` (tool-call-repair.ts) | 25 cc / 58 ln | **2 cc / 4 ln** + coercers 5–8 cc |
| `chunkSemantic` (semantic.ts) | 12 cc / 75 ln | **5 cc / 26 ln** |
| `validateManifest` (manifest.ts) | 18 cc / 62 ln | **7 cc / 29 ln** |
| `queryLoop` (loop.ts) | 22 cc / 197 ln | **21 cc / 128 ln** |
| **Wave 1 totals** | **125 cc / 685 ln** | **~52 cc / ~271 ln** (−58% cc, −60% lines) |

### Wave 2 (2026-07-31, same session)

| Function | Before | After |
| --- | --- | --- |
| `runConformance` (conformance.ts) | 19 cc / 143 ln | **~4 cc / 23 ln** (executor over `CONFORMANCE_CASES` table) |
| `validateInputAgainstSchema` (tools/types.ts) | 18 cc / 34 ln | **10 cc / 23 ln** (`TYPE_CHECKS` table) |
| `CPServer` error envelopes (cp.ts) | 3 duplicated shapes | **1** (`failure()` helper) |

- [x] All targeted tests green after each refactor (Wave 2: 45/45; Wave 1: 122/122).
- [x] Full suite: **2165/2165 green** (136 files — the previous known Windows-path failure is resolved; parallel wave fixed it).
- [x] Typecheck: **0 errors with and without Wave 2 changes** (stash-proven; the 6 pre-existing errors were resolved by the landed audit wave).
- [x] Lint: clean on all touched files.
- [x] Complexity re-measured (see tables).
- [x] Remaining debt logged: `cli/index.ts:main` (R-7, 101 cc — audit wave still dirty), `planTasks` 84ln/25cc (untracked wave), `validateMethodology` 70ln/20cc (untracked wave), `parseFactsFence` 80ln/17cc (no test coverage — needs tests before refactor), `runToolUse` 97ln/12cc (weak direct coverage), `attach` 143ln (dirty file).
