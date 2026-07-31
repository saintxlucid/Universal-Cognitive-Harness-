# Cognitive Protocol (CP) — Versioned Contract

**Protocol ID:** `uch-cp`
**Version:** 1.0.0 (major 1)
**Status:** Stable — v1 is the syscall ABI of the Cognitive OS
**Conformance:** `src/protocol/conformance.ts` — green conformance is the
definition of "this server speaks CP v1."

---

## 1. Purpose

CP is the stable, transport-agnostic, model-agnostic, agent-agnostic
semantic instruction set of the Cognitive OS. Like the Linux syscall ABI,
it is the one surface that must not break. Transports (MCP, HTTP, gRPC,
in-process) are *bindings* of this contract; no protocol logic lives in a
binding.

The contract has three invariants:

1. **The envelope never changes shape** (protocol id, version, op,
   requestId, timestamp, payload).
2. **Ops are semantic, not mechanical** — `retrieve` is retrieval,
   regardless of the model or store behind it.
3. **Major-version compatibility is the gate** — any client speaking
   major `1` is served; any other major version is rejected with
   `UNSUPPORTED_VERSION`.

## 2. Envelope

### Request

```json
{
  "protocol": "uch-cp",
  "version": "1.0.0",
  "op": "retrieve",
  "requestId": "uuid-or-client-id",
  "timestamp": "2026-07-31T00:00:00.000Z",
  "payload": { "query": "deployment rollback procedure", "limit": 5 }
}
```

- `protocol` — must equal `uch-cp` (string).
- `version` — client's CP version; must share the server's major version.
- `op` — one of the ops in §3.
- `requestId` — optional; server generates one when absent.
- `timestamp` — optional; server stamps when absent.
- `payload` — op-specific object; never an array, never null.

### Response

```json
{
  "protocol": "uch-cp",
  "version": "1.0.0",
  "op": "retrieve",
  "requestId": "uuid-or-client-id",
  "success": true,
  "data": { "query": "...", "results": [], "count": 0 },
  "error": null,
  "meta": { "durationMs": 3 }
}
```

On failure, `success` is `false`, `data` is absent, and `error` carries a
machine-readable code (§4) plus a human-readable message.

## 3. Operation Set (v1)

Seventeen ops. Each maps to a kernel-backed handler by default; any op
can be replaced via `CPServer.register` without breaking the contract.

| Op | Description | Required payload | Notable response fields |
| --- | --- | --- | --- |
| `ping` | Liveness check | — | `{ pong: true }` |
| `list` | Supported ops and versions | — | `{ ops: [{ op, version, description }] }` |
| `status` | Kernel state: memory counts, sleep, neuromodulation | — | kernel stats object |
| `observe` | Record a perception into episodic memory | `text` (non-empty) | `{ id, summary, timestamp }` |
| `think` | Ground a prompt in memory, produce a thinking trace | `prompt` (non-empty) | `{ groundedIn, trace, conclusion }` |
| `retrieve` | Ranked retrieval (fusion + rerank) | `query` (non-empty) | `{ results: [{ id, score, content }], count }` |
| `remember` | Deliberately store content | `content` (non-empty) | episode brief |
| `learn` | Belief revision with evidence | `proposition`, `evidence` | `{ learned: true }` |
| `reflect` | Recent episodes + belief state | — | `{ episodes, beliefs }` |
| `consolidate` | Offline consolidation cycle | — | `{ sleep: report, stats }` |
| `dream` | Offline replay / pattern discovery | — | `{ replay: report, stats }` |
| `plan` | Goal decomposition grounded in memory | `goal` (non-empty) | `{ derivedSteps, grounding }` |
| `predict` | Beliefs as testable predictions | — | `{ horizonDays, predictions }` |
| `simulate` | Retrieval-based projection of a scenario | `scenario` (non-empty) | `{ projectedContext, confidence }` |
| `evaluate` | Self-evaluation: health + protocol identity | — | `{ stats, protocol }` |
| `critique` | Gap analysis for a query | `query` (non-empty) | gap report (`{ gaps }`) |
| `execute` | Executive hook — dispatch an action to an executor driver | `action` | `{ accepted, action, note }` |

Optional payload modifiers: `concepts` (string[]) on `observe`/`remember`,
`reliability` (number) on `observe`/`remember`/`learn`, `limit` (number) on
`think`/`retrieve`/`simulate`/`reflect`/`critique`, `horizon` (number) on
`predict`.

## 4. Error Codes

| Code | Meaning |
| --- | --- |
| `BAD_REQUEST` | Malformed envelope: not an object, wrong protocol id, payload not an object |
| `UNSUPPORTED_OP` | Unknown op (envelope rejected) or no handler registered (dispatch-time) |
| `UNSUPPORTED_VERSION` | Major version mismatch with the server |
| `HANDLER_ERROR` | The op handler threw (message surfaced as-is) |
| `INTERNAL_ERROR` | Reserved for future transport-level failures |

## 5. Versioning Policy

- Version string is SemVer (`major.minor.patch`).
- Compatibility is **major-only**: `isCompatibleVersion("1.x.y")` is true
  for any `1.*`, false otherwise.
- Adding an op within a major is allowed; removing or renaming one is a
  major bump.
- The envelope contract (§2) is frozen for the lifetime of major 1.

## 6. Conformance

`runConformance(server)` executes the full suite against any server and
returns a report; `assertConformance(report)` throws on any failure.

Coverage (v1): ping, list, status, observe, remember, retrieve, learn,
reflect, plan, predict, simulate, evaluate, critique, execute,
consolidate, unknown-op rejection, wrong-protocol rejection,
unsupported-version rejection, payload parsing. See
`src/protocol/conformance.ts` for the authoritative case list.

Run locally:

```bash
npm test -- src/protocol/__tests__/cp.test.ts
```

## 7. Bindings

| Binding | Surface | Location |
| --- | --- | --- |
| MCP (STDIO) | `cp.list`, `cp.invoke` tools | `src/mcp/stdio-server.ts` |
| HTTP (UCCP) | `GET /cp/v1` (route info), `POST /cp/v1/<op>` | `src/cli/uccp.ts` |
| In-process | `server.invoke(op, payload)` / `server.dispatch(request)` | `src/protocol/cp.ts` |

Bindings are thin: they parse/validate the envelope, dispatch, and
serialize the response. All protocol logic lives in `src/protocol/`.

## 8. Implementation Map

| Concern | Module |
| --- | --- |
| Envelope types, validation, server, default ops | `src/protocol/cp.ts` |
| Conformance suite | `src/protocol/conformance.ts` |
| MCP + HTTP bindings | `src/protocol/bindings/index.ts` |
| Public exports | `src/protocol/index.ts` |
| Contract tests | `src/protocol/__tests__/cp.test.ts` |
| End-to-end (MCP) tests | `src/__tests__/mcp-cp.test.ts` |
