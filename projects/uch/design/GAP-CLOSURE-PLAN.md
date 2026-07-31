# GAP-CLOSURE-PLAN.md — Vision-to-Repository Gap Closure

- **Status:** Accepted plan
- **Date:** 2026-08-01
- **Scope:** The seven net-new items from the UCH Core Spec (cross-host cognition
  layer, rounds 1–3), mapped against what the repo already implements.
- **Source:** the strategic vision conversation (spec-first platform framing); the
  assessment that produced this plan verified each item against `spec/`, `design/`,
  and `src/` on 2026-08-01.

## 1. Baseline — what already exists (verified)

| Spec item | Where it landed | Status |
|---|---|---|
| Episode normalization contract (§2) | ADR-005 §3; `src/kernel/types/episode.ts`; Mnemosyne episodic store | Done |
| Cognitive Trace (§3) | ADR-002 OTel trace engine (`src/cognitive-plane/trace-engine/`) | Done |
| Integration Levels L0–L4 (§4) | `design/INTEGRATION-LEVELS.md` (two-axis: T0–T4 × L0–L4) | Done |
| Live Cognitive State (§5) | `design/LIVE-COGNITIVE-STATE.md` (`uch.cognitive-state.v1`) | Done |
| Session-scope privacy rule (§10.1) | CIC v0.1: "Session data is ephemeral unless explicitly promoted" | Done |
| Cognitive Image cache (§10.2) | Not built — deferred, see Phase 5 | Open |
| Cognitive Packages (§10.3) | Not built — see Phase 4 | Done 2026-08-01 (`src/kernel/packages/` offline core: manifest + registry, policy quarantine) |
| Candidate Law (§10.4) | Not adopted — see Phase 3 | Open (Laws community gate) |
| Spec-first packaging (§11.1) | Folder separation exists; versioning boundary not established | Done 2026-08-01 (`spec/VERSION.md` + `scripts/spec-version-check.mjs` + `check:spec-version` script) |
| Sensor/Effector decomposition (§11.2) | Built 2026-08-01 (`src/drivers/sensors|effectors`, `compose.ts`) | Done |
| Cognitive Instruction Set (§11.3) | CIC v0.1 operation vocabulary (8 ops, subset-adoption approach) | Done |
| Event schema versioning (§11.4) | Implied by Law 1/12; no explicit policy — see Phase 6 | Done 2026-08-01 (`design/EVENT-GOVERNANCE.md` §Event schema versioning policy) |
| ECS (§11.5) | Not adopted — design spike required (Phase 7) | Done 2026-08-01 (decision record `design/ECS-SPIKE.md`) |
| Replay Engine (§11.6) | `src/cognitive-plane/replay/cognitive-replay.ts` | Done |
| Cognitive Time Machine (§11.7) | Built 2026-08-01 (`cognitive-time-machine.ts`) | Done |
| Cognitive Merge (§11.8) | Correctly not built — research-grade; trivial union slice only | Done 2026-08-01 (`src/kernel/merge/cognitive-merge.ts` trivial slice) |

## 2. Sequencing principle

Order by (value ÷ risk ÷ dependency). Everything that is a **read model over existing
mechanisms** comes before anything that **adds a distribution or trust surface**.

## 3. Phase 1 — Done 2026-08-01: Time Machine + Sensors/Effectors

- **Cognitive Time Machine** (`src/cognitive-plane/replay/cognitive-time-machine.ts`):
  `beliefsAt(t)`, `beliefTimeline()`, `diffBeliefs(from, to)`; optional `ClaimSource`
  provider for Mnemosyne. 7 tests.
- **Sensor/Effector decomposition**: contracts, `composeDriver`, `GitSensor`,
  `SessionSensor`, `MemoryEffector`. 7 tests. Convention: `design/SENSORS-EFFECTORS.md`.
- **Gate:** vitest green, `tsc --noEmit` green, eslint green.

## 4. Phase 2 — Middleware pipeline + Cognitive Image (implementation)

- **Cognitive Middleware** (§7): explicit, orderable pipeline in the Executive System:
  intent → memory injection → identity/standards → evidence retrieval → risk check →
  skill injection → compression. Currently only `src/agentic/__tests__/middleware.test.ts`
  exists (no production implementation). Make it a named, testable module
  (`src/executive-brain/middleware/`) with stage registry + per-stage timing.
- **Cognitive Image** (§10.2): cache layer inside the pipeline — precompute the stable
  stages (identity, genome rules, standards) per attach; invalidate on Live Cognitive
  State change. Implement only after the pipeline exists.
- **Dependencies:** none.
- **Gate:** pipeline unit tests + one end-to-end executive-brain test; typecheck.

## 5. Phase 3 — Governance decisions (documents, community gate) — Done 2026-08-01

- **Candidate Law** (§10.4): `design/PROPOSED-LAW-OWNERSHIP-OF-COGNITION.md` written
  2026-08-01; decision on adoption belongs to the Laws process (not amendable by
  policy), not to this plan.
- **Spec versioning boundary** (§11.1): `spec/VERSION.md` (independent semver,
  initial 0.1.0, stability ladder, CI intent) + `scripts/spec-version-check.mjs`
  (deterministic mtime-vs-declared-date check, exits 1 on un-bumped spec changes) +
  `check:spec-version` npm script.
- **Event schema versioning policy** (§11.4): appended to EVENT-GOVERNANCE.md —
  semver on event schemas, additive-only within minor, ≥2-minor deprecation
  windows, breaking changes require new event type names.
- **Sensor/effector catalogs**: `design/integrations/SENSOR-CATALOGS.md` — per-host
  catalogs (Claude 9 sensors / 8 effectors, VSCode 8 sensors) mapped to existing
  `src/drivers/sensors|effectors` implementations where present, else `future`.
- **Dependencies:** none.
- **Gate:** docs review — ✅ (plus `node scripts/spec-version-check.mjs` exits 0).

## 6. Phase 4 — Cognitive Packages (largest new surface, do not rush) — offline core Done 2026-08-01

- Package format: bundle of `SKILL.md`-format skills + policy additions + reference
  knowledge, versioned. `uch package install <name>@<version>`.
- **Hard rule:** no package auto-modifies the Constitution; policy additions route
  through the existing Governance review path.
- **Built (WS-P):** `src/kernel/packages/` — `manifest.ts` (validatePackage: name/
  semver/entry-hash/requires/no-absolute-path checks), `registry.ts`
  (`PackageRegistry`: install/verify/remove/list, offline, tamper detection by
  recomputed sha256; policy entries land in `policy-quarantine/` and are reported,
  never applied), aligned with `design/COGNITIVE-PACKAGES.md`.
- **Dependencies:** Phase 3 governance decisions (supply-chain posture precedes the
  distribution surface).
- **Gate:** package install/verify/remove lifecycle tests in an offline registry;
  security review (supply-chain) — ✅ install/verify/remove/tamper/quarantine
  tests green; CLI + distribution surface remain follow-on.

## 7. Phase 5 — Cognitive Image completion (if Phase 2 deferred)

- Only if middleware pipeline is not yet built: build the image as a standalone
  snapshot of Live Cognitive State + Genome rules with refresh-on-change semantics,
  then graft onto the pipeline when it lands.

## 8. Phase 6 — ECS spike (decide, don't assume) — Done 2026-08-01

- 2–3 day prototype: the actual query patterns (`find all open hypotheses across all
  Episodes touching this file`, cross-type projections) against the current model vs
  a Bevy-style ECS. Deliverable is a decision record (adopt / reject / hybrid), not
  code. Do not adopt on metaphor appeal.
- **Landed:** `design/ECS-SPIKE.md` — 5–8 concrete cross-type query patterns
  enumerated from the test corpus + kernel, current object-store assessed against a
  Bevy-style ECS, evidence-driven verdict, effort + risks. Recommendation line ready
  for the ADR process.

## 9. Phase 7 — Cognitive Merge: trivial slice only — Done 2026-08-01

- Build the trivial case now (non-overlapping knowledge unions cleanly: two episodes
  of disjoint facts → union, no conflicts). The hard case (genuine belief conflict
  resolution) is an open research problem — needs its own design document before any
  implementation. `diffBeliefs` (Phase 1) is the seed: it already detects belief-set
  changes between moments; merge conflict detection is the same operation across
  sessions.
- **Landed:** `src/kernel/merge/cognitive-merge.ts` — disjoint knowledge unions
  cleanly; genuine conflicts (|Δconfidence| > 0.15, verdict mismatch, evidence
  mismatch) are DETECTED and reported, never auto-resolved; deterministic, inputs
  never mutated. Full conflict-resolution design doc remains open.

## 10. Phase 8 — Done 2026-08-01: spec stack + instruction metadata + driver compliance

- **Spec stack framing** (`design/STACK.md`): the six-layer stack (UCOM/UCEP/UCMP/UCRP/
  Driver SDK/Runtime) mapped onto existing artifacts with independent versioning —
  the Internet model. Microkernel boundary table (12 kernel-owned services vs. all
  organs as replaceable services) verified against the repo.
- **CP instruction catalog** (`src/protocol/catalog.ts`): assembly-table metadata for
  all 17 CP v1 ops — category, owning organ, energy cost, expected output,
  verification requirement (incl. constitutional gate for evaluate/critique) + a
  monotonic cognitive clock (tick-based ordering, never wall-clock). 7 tests.
- **Driver compliance** (`src/drivers/compliance.ts`): POSIX-style certification —
  declared L0–L4 level + supported CP ops → protocol coverage %, level fidelity,
  energy profile, `certified/partial/not-certified` verdict + certificate line. 5
  tests.
- **Gate:** vitest green (scoped), eslint clean; full suite has only the 2 pre-existing
  parallel-wave failures.

## 11. Verification gates (every phase)

1. `npm test` scoped to changed modules + full suite at phase end.
2. `npx tsc --noEmit` — zero new errors (stash-prove when parallel waves are active).
3. `npx eslint src/` on changed files.
4. Organic Score ≥ 90 on any code produced (see `spec/GENOME.md`, organic skills).

## 12. Explicit non-goals

- Cognitive Marketplace as a business; Team/Enterprise organisms; Domain genomes —
  product roadmap, depend on Phase 4 existing first.
- Renaming UCH to "Universal Cognitive Substrate" mid-project — flagged open in the
  spec; not decided here.
