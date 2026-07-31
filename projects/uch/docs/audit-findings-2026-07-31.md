# UCH Audit Findings Register — 2026-07-31

> **Scope:** `projects/uch` (v0.2.0) · **Branch:** `main` (working tree)
> **Method:** live static analysis of high-risk subsystems (reflex gate, event bus, nervous system, trace engine, persistence, aether, sleep cycle, file-editor, engineering-intelligence, cognitive-core, UCCP server, auth, secrets) + dependency scans + git history secret scan
> **Baseline evidence:** 133 test files / 2,140 tests green · `tsc --noEmit` clean · eslint 5 known unused-var errors (test files) · root workspace 41/41
> **Source reports:** `TODO_bug-risk-analyst.md` (functional/concurrency) · `TODO-repo-security-audit.md` (security/architecture)
> **This file is the canonical consolidated register.** Status updates go here first; the TODO files are working notes.

---

## 1. Executive Summary

| Severity | Count | Theme |
|---|---|---|
| High | 5 | Network exposure + default creds; fs path escape; stream crash; timer overlap/rejection; unbounded body |
| Medium | 10 | Leaks; lifecycle rollback gaps; silent data loss; auth audit gaps; weak key derivation; OCP/SRP/DIP violations; dev-dep CVEs |
| Low | 8 | Trace coverage gaps; analyzer noise; determinism residue; naming/contract hazards; fat facade; CLI flush |

**Top 5 risks (probability × blast radius):**
1. **UCCP HTTP binds all interfaces with unauthenticated state-mutating endpoints** (BUG-001) — LAN/browser attacker can poison cognitive state, invoke write-capable MCP tools, read internals.
2. **Default API key `dev-key` + open CORS + optional auth** (BUG-002) — fail-open posture by default.
3. **Unbounded request-body buffering** (BUG-003) — remote memory-exhaustion DoS on a network-bound server.
4. **FileEditor path-escape** (BUG-201) — reflex-gate containment boundary void; writes outside workspace root.
5. **Write-stream crash + timer overlap/unhandled rejection** (BUG-202/203) — process crash paths in persistence and aether/sleep layers.

**Readiness verdict:** C+ — acceptable as a localhost-only cognitive runtime; not production-network-safe until Fix Batch B1 lands (loopback bind, fail-closed auth, body limits).

---

## 2. Master Findings Register

> ID namespaces: `BUG-XXX` (security/architecture audit) and `BRA-ITEM-x.y` (bug-risk analysis). Mapping: BRA 1.1=BUG-201 · 1.2=BUG-202 · 1.3=BUG-203 · 1.4=BUG-204 · 1.5=BUG-205 · 1.7=BUG-206. Items below are canonical and deduplicated.
> Status legend: ☐ open · ☑ fixed (only after verification test passes) · ⚠️ mitigated-partially

### 2.1 Security — network & access control

#### BUG-001 · HIGH · A01 · ☐ open
- **Location:** `src/cli/uccp.ts:664` (and `/api/*`, `/mcp`, `/sse`, `/messages`, `/cp/v1/*` handlers)
- **Issue:** `this.httpServer.listen(this.options.httpPort)` with no host argument binds `::`/`0.0.0.0`. `/api/aether/observe`, `/mcp`, `/messages`, `/sse`, `/cp/v1/*` require no auth; `/api/status` auth is optional. MCP toolset includes write tools (`session-save`, `sm-store`, `remember`) that persist memory/session files.
- **Impact:** any LAN peer or malicious website (CSRF-style, CORS allows JSON POST) can inject cognitive state, overwrite memory stores, read workspace/trace summaries. Disk writes from unauthenticated MCP calls; no traceback.
- **Fix:** bind loopback by default (`listen(port, host)` with `host = options.host ?? '127.0.0.1'`); fail-closed `requireAuth` wrapper on every route except `/health`; require token for MCP JSON-RPC sessions.
- **Test:** e2e — no token → 401 on `/api/aether/observe`; socket bound to loopback.
- **Effort:** S

#### BUG-002 · HIGH · A05 · ☐ open
- **Location:** `src/cli/uccp.ts:99, 334, 412-414`
- **Issue:** API key defaults to `'dev-key'` and is registered as valid; `Access-Control-Allow-Origin: *` with `Allow-Headers: Content-Type, Authorization`; `/api/status` returns workspace/trace/policy/secrets-count/plugin data without credentials.
- **Impact:** default credential + browser-reachable endpoints = trivial takeover; unauthenticated read of internal state; CSRF-style state injection.
- **Fix:** default `apiKey` to `undefined` and refuse non-loopback bind without one; CORS allowlist from config (`*` only when bound to loopback); auth required on `/api/status`.
- **Test:** constructing server without apiKey + non-loopback host throws; `/api/status` without auth → 401.
- **Effort:** S

#### BUG-003 · HIGH · A04 · ☐ open
- **Location:** `src/cli/uccp.ts:425-439, 463-466, 516-519`
- **Issue:** `body += chunk` with no size cap, no `Content-Length` guard, no timeout on `readJsonBody`, `/mcp`, `/messages`.
- **Impact:** remote memory-exhaustion DoS (reachable since BUG-001); OOM crash.
- **Fix:** 1 MB cap → `req.destroy()` + 413; 30 s body timeout.
- **Test:** e2e 2 MB POST → 413, server alive.
- **Effort:** S

#### BUG-004 · MEDIUM · A09 · ☐ open
- **Location:** `src/cli/uccp.ts:548-594`, `src/control-plane/auth/auth.ts`
- **Issue:** auth failures return 401 JSON only — no log, no event, no alerting; `/api/token` has no rate limit.
- **Impact:** brute-force undetected; no forensic trail for state-corruption incidents.
- **Fix:** publish `governance:event_denied` on failures + `console.warn`; token-bucket per remote address (10/min).
- **Test:** 10 bad tokens → 11th → 429.
- **Effort:** M

#### BUG-005 · MEDIUM · A02 · ☐ open
- **Location:** `src/control-plane/secrets/secrets-store.ts:32-40`
- **Issue:** user key → `Buffer.from(key.padEnd(64,'0').slice(0,64),'hex')`: short/non-hex keys become near-zero or garbage silently; no KDF. Random key default makes persisted secrets undecryptable after restart unless the key is supplied every boot.
- **Impact:** silent secret loss; weak keys when users pass short phrases.
- **Fix:** `crypto.scryptSync(passphrase, salt, 32)`; document env-supplied key contract for persistence.
- **Test:** round-trip with passphrase; wrong passphrase → auth-tag failure; restart simulation.
- **Effort:** M

#### BUG-006 · LOW · A07 · ☐ open
- **Location:** `src/control-plane/auth/auth.ts:140-153, 165-168`
- **Issue:** `checkPermission(agentId, perm)` trusts caller-supplied agentId (no token context); API-key lookup is timing-revealing (`Map.get`).
- **Impact:** permission gate bypassable by any caller passing a valid agentId; marginal timing side-channel.
- **Fix:** `verifyTokenAndCheckPermission(token, perm)`; `timingSafeEqual` comparison.
- **Test:** denied with wrong-but-valid token.
- **Effort:** S

#### BUG-007 · MEDIUM · A06 · ☐ open
- **Location:** `projects/uch/package.json` (devDependencies); `.github/workflows/ci.yml` `security` job
- **Issue:** `npm audit`: 8 high (minimatch via eslint/@eslint/config-array/@eslint/eslintrc/glob/test-exclude/@vitest/coverage-v8 chains); CI runs audit with `continue-on-error: true`. Root workspace: 7 (1 moderate esbuild/vite dev-server advisory, 6 high).
- **Impact:** supply-chain risk during development; audit badge not enforced. No runtime-dep findings (runtime deps: `openai`, `@opentelemetry/api` only).
- **Fix:** upgrade dev toolchain to current majors; flip `continue-on-error: false`.
- **Test:** `npm audit --audit-level=high` exits 0.
- **Effort:** M

### 2.2 Security — filesystem & data integrity

#### BUG-201 (= BRA-ITEM-1.1) · HIGH · A01 · ☐ open
- **Location:** `src/coding/file-editor.ts:45-52`
- **Issue:** containment via `resolved.startsWith(rootResolved)` — prefix-collision escape (`root` + sibling prefix), Windows case-insensitivity, symlink/junction escape (no `realpath`).
- **Impact:** reflex-gate containment boundary void; writes/deletes/reads outside workspace root.
- **Fix:**
  ```ts
  const rel = path.relative(rootResolved, resolved);
  if (!this.config.allowOutsideRoot && (rel.startsWith('..') || path.isAbsolute(rel))) throw new Error(`Path escapes workspace root: ${filePath}`);
  // win32: realpathSync both sides (fallback null on ENOENT), case-folded containment check
  ```
- **Test:** new `src/__tests__/file-editor-containment.test.ts` — prefix sibling, case variant, symlink escape.
- **Effort:** S

### 2.3 Functional — crash & lifecycle

#### BUG-202 (= BRA-ITEM-1.2) · HIGH · ☐ open
- **Location:** `src/cognitive-plane/persistence/trace-persistence.ts:54-68`
- **Issue:** `createWriteStream` has no `error` listener → Node default throws on stream error (disk-full/EACCES) → process crash. `append()` ignores `write()` return → unbounded buffering on slow disks.
- **Fix:**
  ```ts
  open(): void {
    ...
    this.writeStream = fs.createWriteStream(this.filePath, { flags: 'a' });
    this.writeStream.on('error', (err) => { this.writeStream = null; this.lastError = err; });
  }
  append(trace): void {
    if (!this.writeStream) return;               // degraded: ledger still holds data
    const ok = this.writeStream.write(JSON.stringify(trace) + '\n');
    if (!ok) { this.writeStream.pause(); this.writeStream.once('drain', () => this.writeStream?.resume()); }
  }
  close(): Promise<void> { /* end(cb); await flush */ }
  ```
- **Test:** new `trace-persistence-failure.test.ts` (injected error, no throw, `lastError` set, subsequent append no-op).
- **Effort:** S

#### BUG-203 (= BRA-ITEM-1.3) · HIGH · ☐ open
- **Location:** `src/aether/aether-core.ts:74-76, 86-98`; `src/sleep_cycle/cycle.ts:185-187`
- **Issue:** `setInterval(async tick)` — overlapping ticks when tick > interval (no in-flight guard) → concurrent organ ticks with interleaved awaits; `stop()` doesn't drain the in-flight tick; `startNapCycle` interval never catches `nap()` rejections → **unhandled rejection crashes the process** on memory-source I/O failure.
- **Fix:** chained `setTimeout` + `ticking` guard + drain-on-stop; nap interval:
  ```ts
  this.napTimer = setInterval(() => {
    void this.nap().catch((err) => {
      void this.nervousSystem.emit(createSignal('error:occurred', 'sleep-cycle', { message: String(err) }, { interrupt: true, interruptLevel: 2 })).catch(() => {});
    });
  }, this.napIntervalMs);
  ```
- **Test:** new `aether-overlap.test.ts` (concurrent ticks ≤ 1, stop drains) + `sleep-nap-rejection.test.ts` (error → event, no crash).
- **Effort:** S

#### BUG-204 (= BRA-ITEM-1.4) · MEDIUM · ☐ open
- **Location:** `src/coding/file-editor.ts:211-230, 267-274`
- **Issue:** `backup()` stores `content ?? ''`; `undo()` checks `backup.content === null` (dead code) → undo of a file creation writes an empty file instead of deleting it.
- **Fix:** add `existed` flag; `undo` → `if (!backup.existed) fs.rmSync(resolved, { force: true })`.
- **Test:** create → undo → file absent.
- **Effort:** S

#### BUG-205 (= BRA-ITEM-1.5) · MEDIUM · ☐ open
- **Location:** `src/cognitive-plane/trace-engine/trace-recorder.ts:151` (activeSpans), `trace-ledger.ts:12` (traces Map), `nervous-system.ts:88/80` (activeInterrupts/energyEvents), `sleep_cycle/cycle.ts:142` (distilledSkills)
- **Issue:** spans never ended except session; ledger has no cap/compaction (every query O(n) sort/scan); interrupts never pruned; energyEvents unbounded; distilled skills accumulate. `traces.jsonl` grows without rotation; boot reads the whole file.
- **Fix:** end spans on paired events (`test:passed`→`test:started` etc.); cap activeSpans (LRU); prune handled interrupts; ring-buffer energyEvents; ledger max-traces + persistence rotation.
- **Test:** 10k events → caps respected.
- **Effort:** M

#### BUG-206 (= BRA-ITEM-1.7) · MEDIUM · ☐ open
- **Location:** `src/cognitive-plane/persistence/trace-persistence.ts:16-47`
- **Issue:** `loaded = true` set before read; read failure → ledger boots empty, retry blocked forever — silent cognitive-history wipe.
- **Fix:** set `loaded` after successful read; surface `error:occurred` on failure.
- **Test:** mocked EACCES → `loaded` stays false, error surfaced.
- **Effort:** S

#### BRA-ITEM-1.6 · MEDIUM · ☐ open
- **Location:** `src/exoskeleton/exoskeleton.ts:506-542`; `src/cognitive-core/cognitive-core.ts:192-213`
- **Issue:** start/stop are ordered sequences without try/finally: partial-failure leaves a half-started core (permanently unusable); any stop-step throw orphans the aether interval and open persistence (hang). `stop()` calls `core.stop()` unconditionally — the 04-03 injection seam must add the D-06 ownership guard in the same commit or suit detach kills shared cores.
- **Fix:** try/finally + best-effort shutdown; `ownsCore` guard landed atomically with the injection seam; `CognitiveCore.start()` clears failure state.
- **Test:** failure-injection start/stop; attach → detach keeps injected core running.
- **Effort:** M

#### BRA-ITEM-1.10 · MEDIUM · ☐ open
- **Location:** `src/sleep_cycle/cycle.ts:201-255`
- **Issue:** `nap()`/`deepSleep()` no in-flight guard — concurrent runs flip `_phase` mid-flight and double-consolidate episodes.
- **Fix:** single-flight guard; `aether.phase` restore in finally.
- **Test:** concurrent nap+deepSleep serialized, one report.
- **Effort:** S

#### BRA-ITEM-1.8 · MEDIUM · ☐ open
- **Location:** `src/event-bus/neural-event-bus.ts:292-320`; `src/nervous-system/nervous-system.ts:360-370`
- **Issue:** sequential await of handlers → head-of-line blocking (one slow handler stalls all delivery); empty `catch {}` swallows handler failures invisibly; module/protocol subs processed after type subs (implicit ordering).
- **Fix:** per-subscriber isolation with timeout or `Promise.allSettled` groups; dropped-handler metric + `error:handled` event; document ordering.
- **Test:** slow-handler test: later handlers still run within timeout; broken handler increments metric.
- **Effort:** M

#### BRA-ITEM-1.9 · MEDIUM · ☐ open
- **Location:** `src/aether/aether-core.ts:79/97` + `src/cognitive-core/cognitive-core.ts:198-202`
- **Issue:** same semantic event published on both channels (`aether:started` on bus and nervous system; reflex block → `governance:event_denied` + `error:occurred`); consumers wired to both get duplicates; wildcard subscribers receive module/protocol events.
- **Fix:** single routing table; wildcard opt-in for module/protocol; document the mapping in EVENT-GOVERNANCE.md.
- **Test:** one publish → exactly one trace span and one nervous-system delivery.
- **Effort:** M

### 2.4 Architecture (SOLID)

#### BUG-101 · MEDIUM · OCP · ☐ open
- **Location:** `src/event-bus/neural-event-bus.ts:1-87`; `src/cognitive-plane/trace-engine/trace-recorder.ts:21-49`; `src/nervous-system/signal.ts`
- **Issue:** adding an EventType requires editing 4 maps (union, EVENT_TO_SPAN, eventToTraceEventType, signalPriorityForType/computeDefaultEntropy). Consequence: 66 of ~90 event types never traced (`governance:event_denied`, `engineering:reviewed`, `prediction:made`, `runtime:*`).
- **Fix:** single typed `EVENT_META` map consumed by all three; trace-recorder subscribes to all types (unknown → diagnostic).
- **Test:** exhaustive compile-time check — every EventType has metadata.
- **Effort:** M

#### BUG-102 · MEDIUM · SRP · ☐ open
- **Location:** `src/cli/uccp.ts` (711 lines)
- **Issue:** one class owns HTTP routing, SSE, MCP JSON-RPC, auth, status aggregation → security fixes (BUG-001..004) all touch one function; high change-amplification.
- **Fix:** extract `requireAuth` + body-limiter middleware and a route table; decompose McpTransport / AuthGateway / StatusReporter.
- **Test:** existing e2e-server-flow tests unchanged.
- **Effort:** L

#### BUG-103 · MEDIUM · DIP · ☐ open
- **Location:** `src/cognitive-core/cognitive-core.ts:73-128`; `src/exoskeleton/exoskeleton.ts:164-210`
- **Issue:** constructor hardwires every organ concretely; only policies/auth/reflexEngine injectable.
- **Fix:** `organFactories?: Partial<Record<OrganName, () => Organ>>` merged over defaults.
- **Test:** construct core with stub kernel factory.
- **Effort:** L

#### BUG-104 · LOW · LSP · ☐ open
- **Location:** `src/cognitive-plane/trace-engine/trace-ledger.ts:64-67`
- **Issue:** `getSpanByTraceId(spanId)` actually takes a span id; `TraceRecorder.getSessionTraceparent` depends on the misnomer.
- **Fix:** rename to `getSpanBySpanId`; add true `getSpanByTraceId` via `traceRoot`.
- **Test:** multi-span trace lookups.
- **Effort:** S

#### BUG-105 · LOW · ISP · ☐ open
- **Location:** `src/exoskeleton/exoskeleton.ts:191-210`
- **Issue:** ~35 public members on CognitiveExoskeleton; fat dependency surface.
- **Fix:** cohesive accessor groups (`getOrgans()`, `getGovernance()`, `getRuntime()`) after phase-04; flat fields deprecated-but-present.
- **Test:** exoskeleton-organs tests unchanged.
- **Effort:** L

### 2.5 Low / observability

#### BRA-ITEM-1.11 · LOW · ☐ open
- **Location:** `trace-recorder.ts:21-49` — trace coverage gap (see BUG-101 for the systemic fix).
- **Fix:** covered by BUG-101.

#### BRA-ITEM-1.12 · LOW · ☐ open
- **Location:** `src/engineering-intelligence/analyzer.ts:58-117`
- **Issue:** dead `+++ b/` branch; renames uncounted; comments/strings counted as imports/loops/I/O → coupling-gate noise (advisory only).
- **Fix:** strip comments/strings before scanning; count `rename from`; delete empty branch.
- **Effort:** S

#### BRA-ITEM-1.13 · LOW · ☐ open
- **Location:** `src/reflex/gate.ts:51, 92` — `Date.now()` in `duration_ms` breaks bit-identical replay.
- **Fix:** `performance.now()` for durations.
- **Effort:** S

#### BRA-ITEM-1.14 · LOW · ☐ open
- **Location:** `src/cognitive-core/cognitive-core.ts:186-189` — connectome seeds emitted in constructor, before ledger load, via `void this.nervousSystem.emit(...)` → boot seeds never traced.
- **Fix:** move seeds to `start()` after persistence load; handle rejections.
- **Effort:** S

#### BRA-ITEM-1.15 · LOW · ☐ open
- **Location:** `src/cli/index.ts:571, 609, 763` — `process.exit(0)` without flushing persistence streams; dead `break`s after exit.
- **Fix:** finally-flushed shutdown helper.
- **Effort:** S

---

## 3. Fix Batches (deployable units)

| Batch | Contents | Status |
|---|---|---|
| **B1 — Network containment** | BUG-001, BUG-002, BUG-003 | ☐ not started |
| **B2 — Crash paths** | BUG-202, BUG-203, BUG-206 | ☐ not started |
| **B3 — Filesystem integrity** | BUG-201, BUG-204 | ☐ not started |
| **B4 — Observability + hardening** | BUG-004, BUG-005, BUG-006, BUG-007 | ☐ not started |
| **B5 — Architecture refactor** | BUG-101, BUG-102, BUG-103, BUG-104, BUG-105 | ☐ not started |
| **B6 — Concurrency/duplication** | BRA-1.6, BRA-1.8, BRA-1.9, BRA-1.10, BRA-1.11–1.15 | ☐ not started |

**Gate for every batch:** new regression tests green → full suite (`npm test`) → `npx tsc --noEmit` → `npm run lint` (no new errors).

---

## 4. OWASP Scorecard

| Category | Status | Findings |
|---|---|---|
| A01 Broken Access Control | FAIL | BUG-001, BUG-201 |
| A02 Cryptographic Failures | WARN | BUG-005 |
| A03 Injection | PASS | — (no SQL/HTML/command surfaces; execFile arg arrays) |
| A04 Insecure Design | FAIL | BUG-003 |
| A05 Security Misconfiguration | FAIL | BUG-002 |
| A06 Vulnerable Components | WARN | BUG-007 |
| A07 Auth Failures | PARTIAL | BUG-006 |
| A08 Data Integrity Failures | PARTIAL | — (GCM good; CSRF-equivalent gap via CORS `*` + no auth, covered by BUG-001/002) |
| A09 Logging Failures | FAIL | BUG-004 |
| A10 SSRF | PASS | — (no user-supplied URL fetch surfaces in UCH core) |

## 5. SOLID Compliance

| Principle | Status | Violations |
|---|---|---|
| SRP | FAIL | BUG-102; exoskeleton god-object (mitigated by phase-04, still 35 members) |
| OCP | FAIL | BUG-101 (4 maps per event type; 66/90 untraced) |
| LSP | PARTIAL | BUG-104; FileEditor.undo contract (BUG-204) |
| ISP | PARTIAL | BUG-105 |
| DIP | PARTIAL | BUG-103 |

## 6. Production Readiness

| Criterion | Status | Notes |
|---|---|---|
| SLI/SLO for key journeys | ❌ | none |
| Error budget policy | ❌ | none |
| DORA metrics monitoring | ⚠️ | CI gates exist; no deployment-frequency/change-failure tracking for UCH |
| Runbooks (top 5 failure modes) | ❌ | disk-full crash, port conflict, ledger corruption, timer overlap, auth lockout |
| Graceful degradation | ⚠️ | OTel no-op ✓, LLM optional ✓, persistence crash ✗ (BUG-202) |
| Secrets hygiene | ⚠️ | no secrets in git history ✓; `dev-key` default ✗ (BUG-002) |
| Durability | ⚠️ | single `traces.jsonl`, no rotation (BUG-205) |

---

## 7. Evidence & Verification Record

| Check | Result | Date |
|---|---|---|
| `npx vitest run` (UCH) | 133 files / 2,140 tests, 0 failures | 2026-07-31 |
| `npx tsc --noEmit` (UCH) | clean, 0 errors | 2026-07-31 |
| `npx eslint src/` (UCH) | 5 errors (unused vars in 3 test files) | 2026-07-31 |
| `npm audit` (UCH) | 8 high, dev-only toolchain | 2026-07-31 |
| `npm audit` (root) | 7 (1 moderate esbuild/vite, 6 high) | 2026-07-31 |
| git history secret scan (UCH) | clean (test fixtures + doc examples only) | 2026-07-31 |
| `.env` tracking check (UCH) | only `.env.example` tracked | 2026-07-31 |
| Workspace tests | 41/41 | 2026-07-31 |

---

## 8. Recommended Next Steps

1. **Now:** commit the untracked wave (reflex, EI, frameworks, cognitive-core, plans/skills/docs) — no git safety net exists for the audited code.
2. **Immediate:** Fix Batch B1 (loopback + fail-closed auth + body limits) — ~1 day.
3. **Next release:** B2 + B3 (crash paths, fs containment, undo).
4. **Planned:** B4 + B5 + B6 (audit trail, key hardening, event-metadata map, server decomposition, concurrency fixes).
5. **Before daemon/network deployment:** SLOs, runbooks, ledger rotation, blocking npm audit.
