# SENSORS-EFFECTORS.md — Driver Decomposition Convention

- **Status:** Approved design ([ADR-005](ADR-005-universal-cognitive-protocol.md) driver triad)
- **Date:** 2026-08-01 (terminology per ADR-005 Amendment A: driver is the engineering term)
- **Scope:** The internal structure of Cognitive Drivers (Universal Cognitive Harnesses) —
  sensors read, effectors act, the composed driver wires them into the registry contract.
- **Companions:** [INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md) (L0–L4 ladder),
  [ADR-005](ADR-005-universal-cognitive-protocol.md) (observe / translate / augment),
  [UNIVERSAL-INTEGRATION.md](UNIVERSAL-INTEGRATION.md) (hive architecture)

## 1. Thesis

A driver per host is the wrong unit of reuse. A **sensor** per observation surface is
right: every host exposes git, but only some expose a debugger or LSP. If the driver is
the unit, the git logic is duplicated into every driver. If the sensor is the unit, the
git sensor is written once and composed into every driver whose host exposes git —
exactly the DRY/SOC discipline the Clean Code Covenant already demands.

```text
Git Sensor    ─┐
Session Sensor─┼──► composed Driver ──► Driver Registry ──► Cognitive Substrate
Tool Sensor   ─┤        │
Terminal      ─┘        │ effectors act on events, emit follow-ups
                 ┌──────▼──────┐
                 │  Effectors  │  (memory injection, policy enforcement,
                 └─────────────┘   suggestions — the motor neurons)
```

## 2. The contracts

### 2.1 Sensor (reads)

```ts
interface Sensor {
  readonly id: string;        // 'git-sensor', 'session-sensor', ...
  readonly surfaces: string[]; // 'git', 'session', 'terminal', 'mcp', 'lsp', ...
  observe(): SensorObservation[] | Promise<SensorObservation[]>;
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
}
```

A sensor emits **observations** (`source`, `type`, `payload`, `timestamp`) — the raw
material the driver translates into the Universal Cognitive Protocol. Observations are
normalized, never raw host dumps.

### 2.2 Effector (acts)

```ts
interface Effector {
  readonly id: string;           // 'memory-effector', ...
  readonly reactsTo: string[];   // event types this effector acts on
  apply(event: DriverEvent): DriverEvent[] | Promise<DriverEvent[]>;
}
```

An effector declares the event types it reacts to, applies, and may emit follow-up
events. Follow-ups are routed through the driver's `onObservation` hook so the organism
sees them as observations from the effector.

### 2.3 ComposeDriver (wires)

```ts
composeDriver({
  id, name,
  sensors: [gitSensor, sessionSensor],
  effectors: [memoryEffector],
  onObservation: (obs) => eventBus.publish({ type: obs.type, source: obs.source, payload: obs.payload }),
}) -> Driver   // registry-compatible: start / stop / handleEvent
```

Semantics:

- **start()** — starts every sensor, then drains one initial observation pass through
  `onObservation` (the host attach snapshot: where the world is *now*).
- **handleEvent()** — fans events out to every effector whose `reactsTo` matches, in
  registration order. **Effector failures are isolated** — one broken effector never
  blocks the fan-out.
- **stop()** — stops sensors in reverse order.

## 3. Shared sensors (built-in, host-agnostic)

| Sensor | Surface | Observation | Notes |
|---|---|---|---|
| `GitSensor` | git | `git.state` (branch, hash, changes) | Wraps `GitDriver`; works in any repo |
| `SessionSensor` | session | `session.lifecycle` (status, transitions) | Emits **only on status change**; host-agnostic via provider function |

## 4. Effectors (built-in, host-agnostic)

| Effector | Reacts to | Emits |
|---|---|---|
| `MemoryEffector` | `error:occurred`, `verification:failed`, `test:failed` | `memory.suggested` |

## 5. Rules

1. Sensors never act; effectors never read directly. The observation channel is the
   only read path, the event channel the only write path.
2. Sensors normalize. If a host's surface cannot produce the observation shape, the
   sensor reports nothing for that surface — it never invents data (L0–L4 graceful
   degradation, [INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md)).
3. Effectors are side-effect-safe: they may fail, and the driver isolates them.
4. A driver composes only the sensors whose surfaces its host actually exposes. A
   driver that assumes a surface exists is a bug.
5. Sensor/effector ids are stable strings — they appear in the observation stream and
   must not change across releases.

## 6. Status

Built 2026-08-01: `src/drivers/compose.ts`, `src/drivers/sensors/` (sensor, git-sensor,
session-sensor), `src/drivers/effectors/` (effector, memory-effector). 7 tests in
`src/drivers/__tests__/sensor-effector.test.ts`. Existing monolithic drivers
(`src/drivers/*/`) are untouched and remain valid — decomposition is additive, applied
to new drivers and future refactors.
