# COGNITIVE-MIDDLEWARE.md — The Cognitive Middleware: Pipeline and the Cognitive Image Cache

- **Status:** Approved design ([ADR-005](ADR-005-universal-cognitive-protocol.md) Amendment A)
- **Date:** 2026-08-01
- **Scope:** The governed pipeline between drivers (harnesses) and the brain — and the
  **Cognitive Image**: the read-optimized, per-grant cache that makes joining the
  organism an O(1) read instead of a recompute.
- **Prerequisites:** [COGNITIVE-TRACE.md](COGNITIVE-TRACE.md) (the payload),
  [EVENT-GOVERNANCE.md](EVENT-GOVERNANCE.md) (the gate), [PROJECTIONS.md](PROJECTIONS.md)
  (per-grant views), [LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md) (the present)
- **Companions:** [COGNITIVE-PACKAGES.md](COGNITIVE-PACKAGES.md) (what ships through the
  pipeline), [INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md) (what each driver may reach)

## 1. Purpose

Drivers emit 5C events; organs consume traces. Between them sits the **Cognitive
Middleware**: a deterministic, governed pipeline that normalizes, validates, gates,
persists, and synthesizes every cognitive signal — and maintains the **Cognitive
Image cache** so that any driver, in any host, joins the organism instantly.

> The middleware is the nervous-system trunk: no signal reaches the brain around
> it, and no augmentation leaves the brain around it.

It is never an LLM. Every stage is deterministic, auditable, and degradable
(Law 13: signals terminate at the lowest capable stage).

## 2. The pipeline

```text
driver rails ──► INGRESS ──► NORMALIZE ──► VALIDATE ──► GATE ──► PERSIST
 (hooks/plugs/  (spool, HTTP,   (5C event    (zod, id/   (provenance,  (Trace Ledger +
  tails/OTel)    tailers)       mapping)      hash)       policy,       Hive ledger)
                                                          grant, rate)
                                                                          │
   driver ◄── AUGMENT ◄── COMPOSE ◄── IMAGE ◄── SYNTHESIZE ◄──────────────┘
 (injection)   (coprocessor   (per-grant   (read-opt    (summarize,
               planes)        image)        cache)       decide, distill,
                                                         handoff)
```

| Stage | Responsibility | Failure behavior |
|---|---|---|
| **Ingress** | Accept events from every rail (hooks, plugins, spool files, OTLP, protocol clients); dedupe on `(runtime, session, nativeEventId)` | Per-rail degradation; a dead rail never blocks live rails |
| **Normalize** | Native signal → 5C event + span mapping (COGNITIVE-TRACE §2); attach/accept `traceparent`; truncate + redact at the boundary | Unknown fields dropped, not guessed; parse errors logged, event rejected |
| **Validate** | Schema check (`uch.cognitive-trace.v1`); episode id/hash integrity; COT tier honesty | Invalid events rejected with a governed denial |
| **Gate** | EventGovernance: provenance chain, idempotency, policy, grant scope, budgets, rates, staleness; audit ledger | Denials emitted as `governance:event_denied`, never silent |
| **Persist** | Append to the Trace Ledger (span-keyed) and the Hive ledger; the source of truth | Write-through — nothing is acknowledged before persistence |
| **Synthesize** | Budgeted background derivations: summaries, decisions, distillations, handoffs (CIC `consolidate`) | Never rewrites source evidence; candidates only |
| **Image** | Maintain the Cognitive Image cache (§3) — the read-optimized projection of cognition per (driver, grant) | Stale images are regenerable; cache miss = recompute from ledger |
| **Compose** | Build the augmentation packet (genome, memory, decisions, lessons, Live Cognitive State, image digest) for the driver | Degrades per plane availability |
| **Augment** | Inject the packet into the host (the Cognitive Coprocessor's deterministic role, ADR-005 §6) | Read-only toward the brain; injection failure never corrupts a prompt |

Invariants: **nothing polls** (everything reacts to events — Law 1); **nothing
bypasses the gate** (all stages route through the governed path — Law 18); **the
ledger is the only authority** (every image, summary, and injection is derived).

## 3. The Cognitive Image cache

The Cognitive Image is the middleware's read-optimized materialization of "what the
organism knows about its current cognition" for exactly one (driver, grant) pair.

> Like a memory image in an operating system: a consistent snapshot of the
> organism's present, taken at attach time and kept coherent, so a driver joins
> with O(1) reads instead of recomputing the world from the ledger.

### 3.1 What an image contains

```yaml
schema: uch.cognitive-image.v1
driver_id: string
grant_id: string                    # image is scoped to a grant, always
workspace_id: string
episode_id: string
base_trace: trace_id                # the image derives from this ledger position
composed_at: ISO8601                # cache stamp, not truth
ttl_ms: number

cognitive_state: CognitiveStateV1   # Live Cognitive State, projected (LIVE-COGNITIVE-STATE.md)
trace_digest:                       # bounded digest of the episode's traces
  spans: number
  tools: string[]                   # recent tool names
  gates: { passed: number, denied: number }
  latest_traceparent: string | null
recall_packet:                      # top-k recalled episodes/decisions/lessons
  episodes: string[]
  decisions: string[]
  lessons: string[]
augment_planes:                     # the Compose stage's per-plane output
  genome: string | null
  memory: string | null
  skills: string[] | null
  policy: string | null
metrics:                            # fed from LIVE-COGNITIVE-STATE extended fields
  cognitive_load: number | null
  memory_pressure: number | null
  trust_score: number | null
```

Every field is a **derived view**: the image is regenerable from the ledger at any
time (Law 12), is scoped through the grant (PROJECTIONS.md), and never contains
hidden chain-of-thought.

### 3.2 Coherence rules

1. **Invalidation over mutation.** Images are immutable once composed; refresh =
   compose a new image from the current ledger position. Invalidation triggers:
   attach, heartbeat, significant events (decision recorded, gate flipped,
   obstacle opened), grant change, and TTL expiry (default 60 s, configurable).
2. **Projection at compose, not at read.** The image is composed *through* the
   grant once; reads from it need no further filtering. A grant change invalidates
   the image outright.
3. **Bounded.** One image per attached (driver, grant); evicted on detach; TTL
   eviction always. Images decay like any cache (Law 5).
4. **Never authoritative.** A stale image is a caching bug, never a truth claim.
   The trace ledger remains the sole source of truth; the image is a projection
   with a `base_trace` anchor.
5. **Consolidation-only visibility.** Raw session content is never copied into an
   image; what crosses the boundary is the synthesized digest (Constitution
   Art. III §6).

### 3.3 Why a cache at all

Attach today means recomputing context: recall queries, decision log reads, health
metrics, connectome activation, projections. That is latency and cost per attach —
and every host re-pays it. The image moves the cost to the middleware's idle
synthesis budget and makes attach, handoff, and cross-host joins cheap and
predictable. The Live Cognitive State is the *document*; the image is the *serving
mechanism* behind it.

## 4. Governance and degradation

- **Gate first, cache later.** No event reaches the image store without passing the
  gate (§2); a denied event refreshes only the `gates.denied` counter.
- **Cache invalidation is governed too.** Image refreshes are budgeted (CIC
  `consolidate` semantics); a driver cannot force recompute beyond its budget.
- **Degradation ladder:** image hit (fast path) → recompose (synthesis budget) →
  ledger read (correct, slow). A driver that cannot read the image still gets the
  honest ledger path — capture and join never die, they degrade (INTEGRATION-LEVELS
  §4 rule 4).

## 5. Verification

- Round-trip: attach → image compose → serve → event → invalidate → recompose,
  with `base_trace` advancing and no field diverging from ledger truth.
- Projection: two drivers with different grants never share an image; grant change
  evicts.
- Budget: refresh storms are rate-limited; TTL eviction is asserted.
- Privacy: no image contains raw session content, secrets, or COT above the
  declared tier; erasure removes images over the erased traces.
- Existing suite stays green — this document changes no code.
