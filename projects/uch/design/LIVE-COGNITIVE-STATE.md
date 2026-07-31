# LIVE-COGNITIVE-STATE.md — Mind State, Not Chat History

- **Status:** Approved design ([ADR-005](ADR-005-universal-cognitive-protocol.md))
- **Date:** 2026-07-31
- **Scope:** The first-class artifact that lets any agent join the organism instantly —
  current cognition, not history.
- **Companions:** [INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md) (the L3 artifact),
  [PROJECTIONS.md](PROJECTIONS.md) (per-grant filtering), [UNIVERSAL-INTEGRATION.md](UNIVERSAL-INTEGRATION.md)
  (hive event flow)

## 1. Thesis

> Don't synchronize conversations. Synchronize **mind state**. Conversation is history.
> Mind state is the present.

A new agent (or the same agent in a different host) should not replay 400 messages to
become current. It reads one small, universal, model-agnostic document: what the organism
is doing right now, with what confidence, against which obstacles, with which hypotheses
and decisions already made. This is the Cognitive Synchronization Engine: Codex instantly
knows what Claude was doing — not because chat was copied, but because the Brain already
knows.

## 2. The document (schema `uch.cognitive-state.v1`)

```yaml
schema: uch.cognitive-state.v1
workspace_id: string
host: string                      # host that produced this snapshot
native_session_id: string | null
episode_id: string | null         # protocol Episode (ADR-005 §3)
traceparent: string | null        # continuation lineage (ADR-002)
updated_at: ISO8601

goal:
  description: string
  status: string                  # active | blocked | done | abandoned
  started_at: ISO8601 | null

intent: string | null             # the user-visible objective, not hidden reasoning

confidence: number | null         # 0-1, calibrated (calibration engine / organic score)

obstacles:
  - description: string
    severity: string              # low | medium | high | critical
    opened_at: ISO8601

active_files: string[]            # paths currently in the working set
working_set:
  domain: string | null           # e.g. "authentication"
  files: string[]
  concepts: string[]              # connectome concept ids

hypotheses:                       # only explicit, articulated hypotheses
  - statement: string
    status: string                # active | rejected | confirmed
    evidence_ids: string[]

pending_decisions:
  - question: string
    options: string[] | null
    due: ISO8601 | null

decisions:                        # recent, from the decision log (bounded)
  - id: string
    title: string
    timestamp: ISO8601

known_bugs: string[]              # references into the mistake DB / issue store

risks:
  - description: string
    severity: string

verification:                     # last engineering gate outcome
  status: string                  # green | failing | unknown
  last_pass: ISO8601 | null
  last_fail: ISO8601 | null

energy:                           # metabolism, not metaphor
  budget_remaining_pct: number | null
  overspend: boolean

cognitive_load: number | null    # current load 0-1 (endocrine Cognitive Load signal / metabolism)
memory_pressure: number | null   # context/memory pressure 0-1 (compressor + kernel load)
architecture_drift: number | null # drift 0-1 between workspace graphs and code reality
learning_velocity: number | null  # learning rate (distillations per period / skill growth)
trust_score: number | null        # aggregate trust 0-1 (trust engine)

focus: string[]                   # areas the organism is attending to

lessons: []                      # recent lessons/mistakes (bounded, from memory filing)
```

Every field is optional; a producer fills what it knows, the schema is additive
(forward-compatible — the five extended fields `cognitive_load`, `memory_pressure`,
`architecture_drift`, `learning_velocity`, `trust_score` joined 2026-08-01 per
[ADR-005 Amendment A](ADR-005-universal-cognitive-protocol.md#amendment-a--2026-08-01)
without a version bump), and **no field may contain hidden chain-of-thought** (privacy
posture: EXOSYMBIOSIS §9, `PRIVACY-ERASURE.md`).

## 3. Lifecycle

```text
attach ──► compose (from resumeContext + decision log + health) ──► store ──► inject
                                                                        │
heartbeat / significant event ──► recompose ──► store ─────────────────┘
                                                                        │
any host: retrieve ──► projected copy ──► join instantly
```

1. **Produce** — on attach (from `resumeContext`, `src/cognitive-plane/replay/cognitive-replay.ts`),
   on session end, on heartbeat (periodic), and on significant events (decision made,
   test gate flipped, obstacle opened).
2. **Store** — as a `cognitive.state` HiveEvent in the hive ledger
   (UNIVERSAL-INTEGRATION §4); latest per `(workspace_id, episode_id)` wins. The event is
   append-only like everything else; the *view* is "latest wins".
3. **Consume** — pushed on session start (context injection, EXOSYMBIOSIS §5 Memory
   plane); pulled on demand via CIC `retrieve` (`input.target: "cognitive-state"`) and
   the MCP surface.
4. **Project** — every read is a projection filtered through the requester's grant
   (PROJECTIONS.md): a session scoped to task T sees only T-relevant state. No
   unfiltered dumps, ever (MANIFESTO §9.3).

## 4. Sources — all existing machinery

| Field | Source |
|---|---|
| goal / intent / hypotheses / pending decisions | TraceLedger + DecisionLog + executive-brain plans |
| decisions | `src/cognitive-plane/decisions/decision-log.ts` |
| obstacles / risks | `src/cognitive-plane/health-metrics/project-health-engine.ts` + mistake DB |
| active files / working set | trace ledger `file_read`/`file_write` events + workspace knowledge graph |
| confidence | calibration engine + OrganicScoreEngine |
| energy | metabolism budget |
| cognitive_load | EndocrineSystem `Cognitive Load` signal + metabolism load |
| memory_pressure | context compressor + kernel memory stats (retrieval load, compaction pressure) |
| architecture_drift | workspace architecture-graph vs knowledge-graph deltas (architecture-delta counter) |
| learning_velocity | sleep-cycle distillations per period + skill registry growth |
| trust_score | TrustEngine aggregate (`src/cognitive-plane/trust/trust-engine.ts`) |
| verification | `test:*` / `build:*` signals on the neural event bus |
| focus | connectome activation + recent trace names |
| lessons | memory filing (recent kernel episodes) + experience DB |

The existing `resumeContext` is the seed implementation; this document formalizes the
superset and the wire schema.

## 5. What it is not

- Not chat history — it is the *present*, derived from observable artifacts.
- Not a claim of consciousness — it is a bounded, inspectable state document
  (consistent with `research/interfaces/universal-cognitive-harness.md`).
- Not a memory dump — it is a projection, per grant, per policy.
