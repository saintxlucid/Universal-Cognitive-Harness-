# COGNITIVE-PROCESSES.md — The Cognitive Process Model (ADR-006 Phase A)

- **Status:** Approved design ([ADR-006](ADR-006-cognitive-microkernel.md) Phase A)
- **Date:** 2026-08-01
- **Scope:** The kernel-owned process model — PID namespace, process table,
  threads, and the rule that **attach = join a PID**.
- **Prerequisites:** [ADR-006](ADR-006-cognitive-microkernel.md) §4 (the
  centerpiece delta), [ADR-001](ADR-001-workspace-owned-cognitive-runtime.md)
  (attachment is negotiated activation), [ADR-005](ADR-005-universal-cognitive-protocol.md)
  (sessions, Episodes, Live Cognitive State), [WORKSPACE-MANIFEST.md](WORKSPACE-MANIFEST.md)
  (capability + driver negotiation), [PROJECTIONS.md](PROJECTIONS.md)
  (per-grant authority), [COGNITIVE-PACKAGES.md](COGNITIVE-PACKAGES.md)
  (packages activate only when a driver session attaches — the process is
  what they attach to)
- **Companions:** [LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md) (the
  process's public face), [EVENT-GOVERNANCE.md](EVENT-GOVERNANCE.md) (the
  governed event path processes publish through)

## 1. Purpose

Agents do not create sessions; they create (or join) a **cognitive process**
with a PID inside the kernel. A process contains working memory, goals, energy
budget, permissions, capabilities, open files, episode, signals, and context —
one continuously evolving unit of cognition that outlives every agent, every
tool, and every model generation.

Today, "attaching" a second tool to an ongoing engineering task means
synchronizing two chats. The process model makes multi-agent work *structural*:
Claude owns Thread A, Codex owns Thread B, and both are threads of the same
process — same working memory, same goals, same grant surface, no sync needed
because there is nothing to sync.

> **Attach = join a PID. Nothing transfers; nothing syncs. The driver simply
> becomes a thread of the existing process.**

## 2. The process

```text
CognitiveProcess
  pid           — kernel-assigned, unique in the namespace, never reused
  name          — human/agent-facing label
  ownerLabel    — the actor that spawned the process
  status        — running | suspended | draining | terminated
  workingMemory — Record<string, unknown>   (JSON-serializable by contract)
  goals         — string[]
  capabilities  — string[]               (granted surface)
  permissions   — string[]               (grant extensions)
  openFiles     — string[]
  episodeId     — the Episode (ADR-005) this process records into
  contextRef    — reference to the context image
  threads       — ProcessThread[]        (the attached drivers)
  pendingSignals— governed signal queue (drained in FIFO order)
  createdAt / updatedAt
```

A process is **state, not execution**. The kernel owns the record; services and
drivers act within it. Nothing in the process model executes code — execution
is what *threads* do while attached, under the grant they joined with.

## 3. The thread

A thread is one driver attached to one process:

```text
ProcessThread
  threadId    — kernel-assigned, unique within the process
  driverLabel — the attaching driver/agent ('claude', 'codex', 'opencode', …)
  attachedAt  — when the driver joined
```

- **Sessions map onto threads.** The substrate's existing session machinery
  (ADR-005) is the thread's driver-side record; the Episode remains the
  canonical recording unit of the process's history.
- A driver may hold many threads (many sessions) across many processes; within
  one process, one driver may hold several threads (parallel sessions).
- **Joining transfers nothing.** `attach(pid, driverLabel)` — the join
  operation — does not copy working memory into the thread, does not sync
  anything, and does not fork the process. The thread *is* a handle onto the
  process. If two drivers see the same working memory, it is because it is the
  same object — not because a sync ran.

## 4. The namespace and the table

- **PID namespace**: kernel-owned monotonic counter; PIDs are unique for the
  lifetime of a table instance and are never reused (no pid recycling — a
  terminated process's pid is preserved for auditability, Law 12).
- **Process table**: `spawn`, `attach` (join), `detach`, `detachDriver`,
  `signal`, `drainSignals`, `kill`, `get`, `list`, `threadsOf`, `stats` — the
  only ways to touch process state. No direct mutation outside the table's
  methods.
- **Lifecycle**:

```text
spawn ──► running ──► (signal: pause) ──► suspended ──► (signal: resume) ──► running
              │
              └──► (signal: terminate) ──► draining ──► kill ──► terminated
```

  - `running` — attach allowed; threads may attach and detach freely.
  - `suspended` — attach denied; existing threads remain (no new execution).
  - `draining` — attach denied; active threads are being drained toward kill.
  - `terminated` — terminal; attach denied; threads drained; the record (with
    its signal queue) is preserved.

- **The process outlives its threads.** When the last thread detaches, the
  process keeps running — the cognition is persistent even with no driver
  attached. Only `kill` terminates a process.

## 5. Signals

Signals are the governed control surface (Law 12 — observable):

| Signal | Effect |
|---|---|
| `pause` | status → suspended; attach denied |
| `resume` | status → running; attach allowed |
| `terminate` | status → draining; attach denied; threads drain |
| `custom` | queued on the pending-signal queue; no status change |

Signals are appended to the process's `pendingSignals` queue (FIFO, drained
via `drainSignals`) and published on the neural event bus
(`process:signaled`) through the governed event path. `kill` is the terminal
signal: it drains the process (clears threads) and leaves the record in
`terminated` with its full signal queue intact.

## 6. Events

The process table publishes to the neural event bus when one is provided:

| Event | When |
|---|---|
| `process:spawned` | a process is created |
| `process:joined` | a driver becomes a thread |
| `process:detached` | a thread leaves |
| `process:signaled` | a signal is delivered |
| `process:killed` | a process reaches stopped |

These are governed, provenance-linked events (EVENT-GOVERNANCE.md) — the same
path every driver observation must pass. The audit ledger of process life is
the event history itself.

## 7. Persistence

The table is `Storable`-compatible (`persist(path)` / `load(path)`, ISO-8601
date round-trips), persisting to `.uccp/persist/processes.json` by convention.
Process state must be JSON-serializable by contract; the kernel enforces
nothing beyond that (same contract as the package store).

## 8. Attach = join (the integration)

`src/workspace-manifest/attach.ts` keeps its job — manifest discovery, version
negotiation, capability negotiation, grant issuance, projection — and gains a
process: `joinProcess()` (in `src/kernel/process/join.ts`) composes the
existing `attach()` with the process table.

```text
joinProcess({ pid?, agent_id, user_id, startDir, processTable, … })
  ├─ pid given   → attach the existing process (attach = join; nothing transfers)
  └─ pid omitted → spawn a fresh process, then join it (create-or-join)
       └─ attach() fails → the fresh process is rolled back (killed)
```

The result carries the process's thread and the full `AttachmentResult`
(grant, governance gate, projection, session). A driver that attaches twice to
the same workspace and pid therefore holds two threads of one process — the
same cognition, two handles. This supersedes the per-attachment "fresh
session" mental model without breaking it: a process with a single thread is
exactly what a single-session attachment was.

## 9. Relationship to existing machinery

- `state-virtualization/` snapshots are **read models of the process**, not the
  process itself — snapshots per agent continue to work, now derived from
  process state.
- `control-plane/projections.ts` projects per-grant authority; the process's
  capabilities are the projected surface its threads joined under.
- `COGNITIVE-PACKAGES.md` packages activate "only when a driver session
  attaches" — in process terms: a package is active while at least one thread
  of a process holds it attached (`PackageStore.attach`).
- The CP protocol (`protocol/cp.ts`) ops are the process's instruction
  vocabulary; `status`/`list`/`ping` are naturally process-scoped.

## 10. Verification

- **Tests** (`src/__tests__/process-model.test.ts` — shipping contract,
  `process-table-extended.test.ts` — this phase): spawn assigns monotonic
  unique pids; attach adds a thread without copying or syncing state (two
  drivers see the same working-memory object); attach on unknown,
  suspended, draining, or terminated pid fails; detach removes a thread and
  the process keeps running; reserved signals transition status while custom
  signals queue without effect; kill drains threads, queues `terminate`, and
  preserves the record; events fire for every transition; persist/load
  round-trips processes, threads, working memory, and dates.
- **Integration tests** (`src/__tests__/process-join.test.ts`): `joinProcess`
  with a real temp workspace manifest — attach-as-join yields one process with
  one thread per driver; two drivers on one pid share working memory; attach
  failure rolls back a fresh process but never an existing one; unknown pid
  fails cleanly.
- Existing suite stays green — the shipping-wave contract
  (`process-model.test.ts`) is untouched and passing.
