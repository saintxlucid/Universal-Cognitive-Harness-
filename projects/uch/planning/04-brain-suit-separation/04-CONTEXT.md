# Phase 04: Brain/Suit Separation — Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Source:** User architectural vision (Tony Stark / Suit / JARVIS three-system split, Global Workspace Theory) + audit of the existing `CognitiveExoskeleton` god object + confirmed baseline (128 files / 2,090 tests; 9 pre-existing failures in untracked `src/__tests__/reflex-interception.test.ts`, out of scope)

<domain>
## Phase Boundary

The defining architectural inversion: **the Brain (JARVIS) is not the Exoskeleton (the Suit)**.

Today `src/exoskeleton/exoskeleton.ts` is a ~35-member god object: it constructs the
cognitive organs (workspace brain, kernel, executive, connectome, sleep cycle, immune,
endocrine, hippocampus, neocortex, cortex kernel), the trace/persistence layer, the
control plane, the drivers, the agentic engine, and the LLM adapter — all in one
constructor with one lifecycle. When the last client disconnects, the process exits and
the brain dies. The vision requires:

```text
CognitiveCore (JARVIS)      — persistent cognition, 24/7, zero LLM, zero drivers
CognitiveExoskeleton (Suit) — embodiment: drivers, control plane, agentic engine,
                              fast paths, code scorer, reflexes; hosts the Pilot (LLM)
Connected LLM (Pilot)       — swappable model adapters, attaches through the Suit
```

What already supports this vision (must be REUSED, not rebuilt):
- `src/aether/aether-core.ts` — the always-on tick loop (5s tick, subsystem registry)
- `src/workspace-brain/`, `src/kernel/`, `src/executive-brain/`, `src/connectome/`,
  `src/sleep_cycle/`, `src/exoskeleton/immune.ts` + `endocrine.ts`, `src/hippocampus/`,
  `src/neocortex/`, `src/cortex_kernel/`, `src/basal_ganglia/` — the organs
- `src/cognitive-plane/trace-engine/`, `src/cognitive-plane/replay/`,
  `src/cognitive-plane/persistence/` — the replayable ledger
- `src/control-plane/` — governance services (auth, policies, budgets, telemetry, lifecycle, plugins)
- `.uccp/persist/` + trace ledger — cross-process state restore

The genuine delta this phase ships:
1. **`src/cognitive-core/`** — a NEW standalone subsystem that owns all cognitive
   organs + the ledger + the aether loop, with a process-independent lifecycle and
   ZERO imports from `llm/`, `agentic/`, `drivers/`, `suit/`.
2. **The Suit refactored to compose** — `CognitiveExoskeleton` keeps its entire public
   API (every member delegates to `this.core.<member>`), loses no behavior, passes the
   existing 2,081 green tests unchanged.
3. **Detachment semantics** — a Suit can attach to an EXISTING core (injected via
   config); detaching the Suit never kills a core it does not own. This is the
   "brain continues when the pilot disconnects" guarantee, proven by test.
4. **`uch daemon`** — a standalone core process with no client attached: boot,
   tick, sleep-cycle on idle, clean stop. Zero LLM, zero drivers.
5. **Docs** — MANIFESTO §4 + design/ARCHITECTURE.md updated to the two-layer topology.

Explicitly OUT of scope this phase: new organs (attention/prediction/curiosity etc.),
the Digital Twin (Phase 02), the Reflex Gate (Phase 03 RED wave), multi-workspace
collective cognition, Windows service registration. This phase is the surgical
separation — the substrate every later phase attaches to.
</domain>

<decisions>
## Implementation Decisions

### D-01: Two-layer topology
- New subsystem `src/cognitive-core/` (engineering name: Cognitive Core; biological:
  JARVIS) = the persistent brain. Owns: event bus, nervous system, metabolism,
  consciousness, aether, kernel, workspace brain, executive brain, trace recorder,
  replay, signals, trace persistence, immune, endocrine, sleep cycle, action
  selector, connectome, hippocampus, neocortex, cortex kernel — plus ALL their wiring
  (metabolism component registrations, aether subsystem registrations, nervous-system
  consciousness feed, connectome seeds + auto-wiring subscription).
- `src/exoskeleton/` stays the Suit: auth, secrets, policies, budgets, otlp, lifecycle,
  plugins, code scorer, reflex engine, fast-path router, fs/git drivers, agentic
  engine, LLM adapter, history, permissions, transports. It COMPOSES a
  `CognitiveCore` instance.
- Locked: one cohesive core; no organ kept in the suit "because it's small".

### D-02: Core import firewall (enforced by test)
- `src/cognitive-core/` MUST NOT import from `../llm/`, `../agentic/`, `../drivers/`,
  `../suit/`, or `../exoskeleton/`.
- Test asserts zero such imports by scanning `src/cognitive-core/*.ts` sources.
- Runtime dependency count unchanged (D-02 of Phase 02: `openai`,
  `@opentelemetry/api`).

### D-03: Injection seam for immune
- `CognitiveCoreConfig` gains OPTIONAL `policies?: PolicyEngine`, `auth?: Auth`,
  `reflexEngine?: ReflexEngine` (the immune system needs all three).
- Suit mode: exoskeleton passes ITS instances → immune sees exactly the same objects
  as today (behavior identical).
- Standalone mode: core creates fresh defaults (`new PolicyEngine()`, `new Auth()`,
  `new ReflexEngine()`) when absent.
- Locked: `CognitiveCore` exposes `policies`, `auth` as readonly (visibility + reuse),
  and `agentId?: string` config (default `'cognitive-core'`; the exoskeleton passes
  `'exoskeleton'` so kernel provenance is byte-identical to today).

### D-04: Public API preservation (surgical rule)
- `CognitiveExoskeleton` keeps EVERY public member name, type, and method. Cognitive
  members become readonly fields assigned in the constructor from the core
  (`this.kernel = this.core.kernel;` — same object references, so wiring between
  organs and suit drivers is unchanged).
- The constructor reorders internally (control plane + reflex engine BEFORE core,
  core BEFORE drivers — drivers need `core.eventBus`).
- All metabolism component names (`exoskeleton`, `aether`, `endocrine`, `immune`,
  `sleep-cycle`, `reflex`), aether registrations, and connectome seeds keep their
  exact strings — `getStats()`/`getState()` shapes must not change.

### D-05: Lifecycle choreography
- `CognitiveCore.start()`: open persistence + load ledger → start aether (all
  registered subsystems) → start metabolism → emit `aether:started` → observe boot
  thought.
- `CognitiveCore.stop()`: stop metabolism → stop aether → close persistence.
- `CognitiveExoskeleton.start()`: `await this.core.start()` FIRST, then
  `lifecycle.startAll()` (otlp, plugins, fs-driver, history), then emit
  `session:started`. `stop()` reverses: `session:ended` → detach transports →
  `lifecycle.stopAll()` → `core.stop()`.
- The OTLP exporter lifecycle entry LOSES its `dependencies: ['trace-persistence']`
  (the ledger is guaranteed loaded by `core.start()` before lifecycle runs).
- Locked: `session:started`/`session:ended` remain suit-level (client attachment
  events); `aether:started`/`aether:stopped` are core-level.

### D-06: Detachment semantics
- `ExoskeletonConfig.core?: CognitiveCore` — when provided, the suit attaches to the
  existing core instead of constructing one.
- Ownership rule: if the suit constructed the core, `suit.stop()` stops it; if the
  core was injected, `suit.stop()` leaves it RUNNING.
- Proven by test: core starts standalone → suit attaches → suit stops → core still
  running, memory/state intact → second suit attaches → inherits the same state.

### D-07: `uch daemon` command
- `uch daemon [--once] [--ticks N]`: boots `CognitiveCore` standalone (fresh default
  governance, no LLM, no drivers, no transports), starts it, runs (default: until
  SIGINT; `--once`: exactly N aether ticks then clean stop), prints status + stats
  JSON on exit.
- Zero new runtime dependencies. Env-driven config only (workspace id/name/root from
  cwd + `UCH_` env vars).

### D-08: Proof gates
- Existing suite: 128 files / 2,090 tests — 9 pre-existing failures in untracked
  `src/__tests__/reflex-interception.test.ts` (Phase 03 RED wave, NOT this phase's
  scope; must stay the SAME 9 — no new failures, none fixed accidentally).
- New tests: `src/__tests__/cognitive-core.test.ts` (core contracts + import
  firewall) and `src/__tests__/core-detachment.test.ts` (D-06) + daemon smoke test.
- `npm run typecheck` and `npm run build` exit 0. Lint clean on changed files.
- Temp-dir lifecycle everywhere (`mkdtempSync` + `close()` + `rmSync`); zero residue.

### D-09: Docs
- MANIFESTO §4 diagram + `design/ARCHITECTURE.md`: show `CognitiveCore` as the
  persistent layer beneath the Suit; note the "pilot comes and goes, the brain
  continues" guarantee.
- This CONTEXT file is the locked record; the phase SUMMARY.md closes the loop.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core source (extraction sources of truth)
- `src/exoskeleton/exoskeleton.ts` — THE god object being split (constructor lines
  123-218, wiring 264-426, lifecycle 445-490, stats 492-529)
- `src/exoskeleton/immune.ts` — `ImmuneSystem(policies, auth, reflexEngine)`
- `src/exoskeleton/endocrine.ts` — `EndocrineSystem(nervousSystem, consciousness)`
- `src/aether/aether-core.ts` — `AetherCore(eventBus, { tickIntervalMs: 5000 })`,
  `register(name, { tick, status })`
- `src/cognitive-plane/trace-engine/trace-recorder.ts`, `src/cognitive-plane/replay/cognitive-replay.ts`,
  `src/cognitive-plane/signals/signal-store.ts`, `src/cognitive-plane/persistence/trace-persistence.ts`
- `src/nervous-system/nervous-system.ts` — `subscribe`/`subscribeToAll`/`emitFromEvent`
- `src/sleep_cycle/cycle.ts` — `SleepCycle(nervousSystem, aether, memorySource, llm)`
  + `createKernelMemorySource`

### Test contracts (behavior to preserve)
- `src/__tests__/connectome-expansion.test.ts` — asserts `exo.nervousSystem.emit` →
  `exo.connectome` wiring, boot seeds, `exo.stop()` lifecycle (reference-sharing
  delegates keep this green)
- `src/__tests__/exoskeleton-organs.test.ts` — constructs exoskeleton, exercises
  organs
- `src/__tests__/workspace-graphs-knowledge.test.ts`, `src/neural-fs/__tests__/neural-fs.test.ts`
  — temp-dir lifecycle conventions

### Spec (must stay authoritative)
- `spec/GENOME.md`, `spec/LAWS_OF_COGNITIVE_PHYSICS.md` (Law 10 — Identity
  Persistence; Law 12 — Reversibility)
- `MANIFESTO.md` §4 (architecture diagram) + §6 (organ contract) — D-09 updates the
  diagram only; the organ contract table does NOT change (organs move module, not
  contract)
- `design/ARCHITECTURE.md` — Cognitive Operating System description

</canonical_refs>

<specifics>
## Specific Ideas

- The Iron Man framing is the product story: Tony Stark = LLM (Pilot), the Suit =
  exoskeleton (embodiment), JARVIS = CognitiveCore (persistent executive). The
  architecture must make "the Brain never sleeps" a PROCESS claim, not a metaphor.
- Naming: engineering-first per the Dual Naming Convention. Class names
  `CognitiveCore` (JARVIS), unchanged `CognitiveExoskeleton` (Suit).
- `src/suit/` already exists (code scorer = taste, reflex engine = instincts) —
  suit-side intelligence stays in the suit; do not move it into the core.
- The daemon's idle behavior must include at least one real sleep-cycle run to prove
  "thinking while nobody is connected" (sleep cycle already consolidates memories on
  `deepSleep()`).
</specifics>

<deferred>
## Deferred Ideas

- Windows service / systemd registration for `uch daemon` (deployment concern; the
  command itself ships here)
- Multi-workspace collective cognition (Phase frontier)
- New organs: attention engine, prediction cortices, curiosity, research cortex,
  experimentation lab, wisdom engine (Phase frontier — the separation is their
  prerequisite)
- Moving the control plane INTO the core (auth/policies/budgets as brain organs —
  a later refinement; D-03's injection seam keeps the option open)
</deferred>

---

*Phase: 04-brain-suit-separation*
*Context gathered: 2026-07-31 via user vision + code audit*
