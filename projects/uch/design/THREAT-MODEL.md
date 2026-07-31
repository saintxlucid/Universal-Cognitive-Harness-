# UCH Threat Model v0.1

- **Status:** Approved specification v1.0
- **Date:** 2026-07-30
- **Gate closure:** All 14 threats identified and classified. Mitigations designed for all; 3 implementation items deferred to next iteration (T06, T07, T13). Security testing requirements documented.
- **Scope:** Security threat identification and mitigation for the Universal Cognitive Harness

## 1. Threat Scope

This threat model covers the UCH runtime, its drivers, transports, storage, and attached clients. It assumes the workspace host OS and filesystem are trusted; the network between UCH and remote clients is untrusted.

## 2. Threat Table

| ID | Threat | Source | Risk | Mitigation | Status |
|---|---|---|---|---|---|
| T01 | **Unauthorized memory access** — Agent A reads Agent B's cognitive state | Malicious or compromised agent | **Critical** | CIC namespace isolation (§2.3), scope enforcement on every retrieve operation, capability grant validation | Design |
| T02 | **Cross-project contamination** — Observations from Project A leak into Project B's semantic graph | Shared kernel with permissive scoping | **Critical** | Mandatory project-level namespace isolation; retrieve must declare purpose scope; graph is partitioned by `project_id` | Implementation |
| T03 | **Privilege escalation** — Read-only client performs a mutate operation | Weak capability grant validation | **High** | Capability grant enumerates permitted operations; kernel validates every operation against grant; grants are signed | Design |
| T04 | **Consent bypass** — Driver observes events without active consent grant | Missing consent check in observe pipeline | **High** | Consent check gate before episode commit; observation rejected with `consent_missing` if grant absent | Design |
| T05 | **Data exfiltration via retrieve** — Retrieve with broad scope returns more data than intended | Overly permissive retrieve queries | **High** | Retrieve is always bounded by scope + purpose; max_results cap; min_confidence floor; audit of all retrieves | Design |
| T06 | **Prompt injection via observation** — Attacker injects malicious content through observation payload that compromises downstream processing | Driver or event input | **High** | Observations are typed and validated at ingest; kernel does not execute instructions from observations; output encoding for derived objects | Implementation |
| T07 | **Denial of service via excessive observations** — Flood of events exhausts kernel memory or CPU | Attached driver or network | **Medium** | Rate limiting per driver/session; budget enforcement; ring-buffer history with max size; backpressure on event bus | Implementation (rate limiter exists) |
| T08 | **Replay attack** — Attacker replays a captured observation or operation | Network interception | **Medium** | Idempotency keys on all operations; timestamp validation ±5min window; operation_id uniqueness check | Design |
| T09 | **Consolidation poisoning** — Attacker injects false evidence that gets promoted to fact during consolidation | Compromised observations | **Medium** | Consolidation produces candidates, not facts; commit requires independent verification; confidence decay without corroboration | Design |
| T10 | **Retention policy bypass** — Objects persist beyond their retention period | Missing or broken sweep cycle | **Medium** | Hourly sweep cycle; audit trail of all deletions; retention pinned objects require administer grant | Design |
| T11 | **Hard-delete without audit** — Objects permanently removed without trace | Hard-delete abuse | **Medium** | Hard-delete requires explicit admin grant; operation logged in immutable audit ledger; original_id hashed in tombstone | Design |
| T12 | **Timing side channel** — Response time differences reveal existence of memory in different scopes | Retrieve latency variance | **Low** | Constant-time scope checks where feasible; noise injection in response timing (future) | Research |
| T13 | **Dependency confusion** — Malicious MCP adapter or plugin loaded instead of legitimate one | Plugin loader | **Medium** | Plugin manifest validation; cryptographic verification of plugin sources; capability restrictions on plugins | Implementation (plugin loader exists, verification pending) |
| T14 | **Session hijacking** — Attacker attaches to an active session and impersonates the client | Weak session binding | **High** | Session tokens tied to client identity; attachment requires re-authentication on transport reconnect; session timeout | Design |

## 3. Trust Boundaries

```text
[Attached Client] ← untrusted network → [Transport Adapter]
                                              |
                                         [CIC Gate] ← trust boundary
                                              |
                                     [Capability Validation]
                                              |
                                     [Scope Enforcement]
                                              |
                                    [Kernel Operations]
                                              |
                                    [Storage Layer]
                                              |
                                   [Filesystem / Database]
```

- **Boundary 1** (Transport → CIC Gate): All inputs are untrusted. Schema validation, type checking, size limits applied.
- **Boundary 2** (CIC Gate → Kernel): Only validated, authorized, scoped operations pass through. Grants are checked.
- **Boundary 3** (Kernel → Storage): Storage access is mediated by the kernel's policy layer. No direct storage access from outside.

## 4. Attack Surface

| Component | Attack surface | Exposure |
|---|---|---|
| MCP Transport | JSON-RPC input parsing, tool dispatch | Network (TCP/SSE) |
| REST API | HTTP request parsing, route dispatch | Network (HTTP) |
| CLI | stdin/stdout parsing | Local (pipe) |
| Plugin Loader | Plugin manifest parsing, code loading | Filesystem |
| Event Bus | Event type dispatch, handler execution | Internal |
| Memory Graph | Concept/edge creation, retrieval queries | Internal |
| Consolidation | Sleep cycle triggers, evidence promotion | Internal |

## 5. Security Assumptions

1. The host OS provides process isolation between UCH and other applications.
2. The filesystem ACLs are correctly configured for UCH storage directories.
3. The user has not intentionally granted admin capabilities to an untrusted agent.
4. Network-level attacks (MITM, DNS spoofing) are mitigated by TLS — out of scope for this document.
5. Physical security of the host machine is assumed — out of scope.
6. The MCP, REST, and other transport implementations use standard library parsers — parser vulnerabilities in those libraries are out of scope.

## 6. Security Testing Requirements

Before a production release, the following must be completed:

1. **Threat validation**: Each T01-T14 threat has a corresponding automated test that demonstrates the mitigation works.
2. **Fuzz testing**: MCP JSON-RPC parser, REST API input, CLI input — minimum 1M iterations each.
3. **Penetration testing**: Cross-scope retrieval attempts, privilege escalation, consent bypass — all must be rejected.
4. **Dependency scanning**: All runtime dependencies scanned for CVEs before each release.
5. **Audit verification**: Automated audit log integrity check — tampered logs must be detectable.
