# Failure and Retry Semantics v0.1

- **Status:** Approved specification v1.0
- **Date:** 2026-07-30
- **Gate closure:** Error taxonomy defined with 13 client/server error codes. Retry policies, circuit breaker, failure recovery, timeouts, and health check model all specified. Implementation pending in `kernel/cognitive-kernel.ts`.
- **Scope:** Error classification, retry policies, circuit breakers, and failure recovery for UCH operations

## 1. Error Classification

Every error response carries a machine-readable `code` and a human-readable `message`:

### 1.1 Client Errors (4xx-style)

| Code | HTTP analogue | Meaning | Retryable |
|---|---|---|---|
| `invalid_request` | 400 | Malformed envelope, missing required field | No (fix request) |
| `unauthorized` | 401 | Missing or invalid identity | No (fix credentials) |
| `forbidden` | 403 | Capability grant does not cover operation or scope | No (acquire grant) |
| `not_found` | 404 | Referenced object, scope, or grant does not exist | No |
| `consent_missing` | 403 | No active consent grant for the observation type | No (acquire consent) |
| `budget_exhausted` | 429 | Operation budget (tokens/cost/rate) exceeded | Yes (after budget reset/refill) |
| `conflict` | 409 | Idempotency key collision or state conflict | No (check state) |
| `rate_limited` | 429 | Per-session or per-driver rate limit exceeded | Yes (after backoff) |
| `scope_too_broad` | 400 | Retrieve scope would return too much data | No (narrow scope) |

### 1.2 Server Errors (5xx-style)

| Code | Meaning | Retryable | Default backoff |
|---|---|---|---|
| `internal_error` | Unexpected kernel error | Yes | 1s, 2s, 4s, exponential |
| `storage_unavailable` | Storage backend unreachable | Yes | 500ms, 1s, 2s, exponential |
| `timeout` | Operation exceeded deadline | Yes | Immediate (1 retry only) |
| `consolidation_busy` | Sleep cycle already running | Yes | 5s fixed |
| `transport_error` | Transport adapter failure | Depends on transport | Varies |
| `component_unavailable` | Required subsystem not started | Yes | 2s, 5s, 10s, exponential |

## 2. Retry Policy

### 2.1 Default Retry Behavior

| Operation | Max retries | Backoff strategy | Idempotent |
|---|---|---|---|
| `observe` | 3 | Exponential (1s, 2s, 4s) + jitter | Yes (via idempotency_key) |
| `retrieve` | 3 | Exponential (500ms, 1s, 2s) + jitter | Yes |
| `propose` | 3 | Exponential (1s, 2s, 4s) + jitter | Yes |
| `commit` | 5 | Exponential (1s, 2s, 4s, 8s, 16s) + jitter | Yes |
| `evaluate` | 3 | Exponential (1s, 2s, 4s) + jitter | Yes |
| `delegate` | 2 | Fixed 5s | No (creates new task each time) |
| `consolidate` | 2 | Fixed 10s | No (triggers new cycle) |
| `simulate` | 1 | Immediate | Yes |

### 2.2 Jitter

All exponential backoff uses full jitter:

```
sleep = random_between(0, min(cap, base * 2^attempt))
```

### 2.3 Retry Budget

- Per-session retry budget: 20 retries per minute
- Per-driver retry budget: 100 retries per minute
- When budget is exhausted, operations fail with `rate_limited` until the next window

## 3. Circuit Breaker

Each transport adapter and storage backend has a circuit breaker with three states:

### 3.1 States

| State | Behavior | Transition |
|---|---|---|
| **Closed** | Normal operation. Failures are counted. | → Open when failure count > threshold in window |
| **Open** | Requests fail fast with `component_unavailable`. | → Half-Open after cooldown period |
| **Half-Open** | Probe request allowed. | → Closed if probe succeeds; → Open if probe fails |

### 3.2 Configuration

| Parameter | Default | Description |
|---|---|---|
| `failure_threshold` | 5 | Consecutive failures before opening |
| `cooldown_ms` | 30_000 | Time in Open state before transitioning to Half-Open |
| `half_open_max_requests` | 3 | Number of probe requests allowed in Half-Open state |

## 4. Failure Recovery

### 4.1 Kernel Crash Recovery

On kernel restart after an unclean shutdown:

1. **Event ledger** is replayed from last checkpoint to reconstruct in-memory state.
2. **Sleep cycle** state is reset (in-progress consolidation is lost but source episodes are preserved).
3. **Active sessions** are invalidated; clients must re-attach.
4. **In-flight operations** without a completed response are treated as failed.
5. **Storage layer** consistency check runs; orphaned references are quarantined.

### 4.2 Operation Rollback

For operations that partially completed before failure:

| Operation | Rollback behavior |
|---|---|
| `observe` | Episode may be duplicated on retry (idempotency key prevents this). |
| `retrieve` | No side effect; safe to retry. |
| `propose` | Candidate may be orphaned; sweep GC removes after 24h. |
| `commit` | Atomic — either fully applied or not. Check by idempotency key. |
| `consolidate` | Produces candidates; interrupted consolidation leaves partial candidates that are reaped on next cycle. |

## 5. Timeouts

| Component | Default timeout | Configurable |
|---|---|---|
| CIC operation (overall) | 30s | Yes |
| Storage read | 5s | Yes |
| Storage write | 10s | Yes |
| Consolidation cycle | 5min | Yes |
| A2A delegation | 60s | Yes |
| MCP tool call | 30s | Yes |
| REST endpoint | 30s | Yes |

## 6. Health Check

UCH exposes a health endpoint (via `UCHStatus`) that reports readiness:

```text
{
  "status": "healthy" | "degraded" | "unavailable",
  "components": {
    "kernel": "ok" | "degraded" | "down",
    "storage": "ok" | "degraded" | "down",
    "event_bus": "ok" | "degraded" | "down",
    "sleep_cycle": "running" | "stopped" | "error",
  },
  "uptime_seconds": number,
  "last_failure": ISO8601 | null,
  "circuit_breakers": {
    "storage": "closed" | "open" | "half-open",
    "mcp_transport": "closed" | "open" | "half-open",
  }
}
```

A `degraded` status means non-critical operations may fail but core functionality works. An `unavailable` status means the runtime cannot process requests.
