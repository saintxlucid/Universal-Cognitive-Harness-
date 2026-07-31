# Cognitive Interchange Contract (CIC) v0.1

- **Status:** Draft specification
- **Date:** 2026-07-30
- **Scope:** Transport-neutral semantic contract for all UCH operations
- **Prerequisite:** ADR-001 (Workspace-Owned Cognitive Runtime)

## 1. Purpose

The Cognitive Interchange Contract (CIC) is the **semantic, transport-neutral object and operation model** for the Universal Cognitive Harness (UCH). Every UCH operation — whether invoked via MCP, REST, CLI, local IPC, A2A, or CloudEvents — carries the same contract semantics. Transports are adapters; the CIC is the durable interface.

## 2. Capability and Scope Semantics

### 2.1 Capability Grants

Every operation requires a capability grant — an explicit authorization bound to an actor, scope, and operation family:

```text
capability_grant = {
  grant_id: string,
  schema_version: "cic.v0.1",
  actor: { type: "agent" | "user" | "system" | "service", id: string },
  scope: { organization?, workspace?, project?, branch?, task?, session? },
  operations: ["observe", "retrieve", "propose", "commit", "evaluate", "delegate", "consolidate", "simulate"],
  constraints: {
    rate_limit?: { max_per_second: number },
    budget?: { max_tokens?: number, max_operations?: number },
    retention?: { max_age_days: number },
    purpose?: string,
  },
  issued_at: ISO8601,
  expires_at?: ISO8601,
}
```

### 2.2 Scope Resolution

Scope is evaluated as an ordered cascade — from most granular to most broad:

1. **Session** — single attachment lifecycle
2. **Task** — active goal or work item
3. **Branch** — git branch, feature variant
4. **Project** — product boundary
5. **Workspace** — repository or development environment
6. **User** — natural person identity
7. **Organization** — tenant boundary

A grant at a broader scope does not automatically grant access to all narrower scopes unless the grant explicitly includes them. A retrieve operation must declare its purpose scope; the kernel may project different evidence sets per scope.

### 2.3 Data Namespace Isolation

Every cognitive object lives in an immutable namespace determined by its originating scope. Cross-scope references are explicit grants, not ambient access. The following isolations are mandatory:

- **User isolation**: User A cannot retrieve User B's cognitive state unless A holds an explicit cross-user grant.
- **Project isolation**: Project A's memory graph is invisible to Project B's sessions.
- **Agent isolation**: Agent A's private working memory is not visible to Agent B.
- **Session isolation**: Session data is ephemeral unless explicitly promoted to durable scopes.

## 3. Common Envelope

### 3.1 Request Envelope

Every CIC request must include:

```text
{
  cic_version: "0.1",
  operation_id: uuid,            // unique, idempotent
  operation: string,             // from operation family
  actor: { type: string, id: string },
  scope: {                       // at least one scope level
    organization?: string,
    workspace?: string,
    project?: string,
    branch?: string,
    task?: string,
    session?: string,
  },
  purpose: string,               // human-readable intent
  capability_grant_id: string,
  risk_class: "read" | "propose" | "mutate" | "delegate" | "administer",
  idempotency_key: string,       // client-generated, unique per operation_id
  input: Record<string, unknown>,
  input_references?: string[],   // links to evidence or artifact IDs
  sensitivity_labels?: string[], // e.g. ["pii", "credential", "internal"]
  deadline?: ISO8601,
  budget?: { max_tokens?: number, max_cost?: number },
}
```

### 3.2 Response Envelope

Every CIC response must include:

```text
{
  cic_version: "0.1",
  operation_id: string,          // echoed from request
  status: "succeeded" | "failed" | "rejected" | "pending",
  result?: unknown,
  evidence_references: string[], // IDs of created/queried cognitive objects
  confidence?: number,           // 0-1, for operations that produce claims
  valid_time?: ISO8601,          // temporal validity window
  conflicts?: string[],          // detected contradictions
  policy_decision: {
    granted: boolean,
    reason?: string,
    grant_id: string,
  },
  cost: {
    tokens?: number,
    duration_ms: number,
    operations?: number,
  },
  error?: {
    code: string,
    message: string,
    details?: unknown,
  },
  audit_reference: string,       // link to ledger entry
}
```

### 3.3 The Cognitive State Document

Attachment returns the organism's **Live Cognitive State** — mind state, not chat
history: the current goal, intent, confidence, obstacles, active files, working set,
hypotheses, pending decisions, decisions made, risks, verification status, energy, and
focus, with a continuation traceparent. Full schema (`uch.cognitive-state.v1`) and
lifecycle: [LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md) ([ADR-005](ADR-005-universal-cognitive-protocol.md)).

```text
negotiation_response = {
  ... §7 fields,
  cognitive_state?: CognitiveStateV1,   // projected through the grant
}
```

- The state document is **always a projection** — filtered by the requester's grant via
  the scope cascade (§2.2) and the projection engine ([PROJECTIONS.md](PROJECTIONS.md));
  no unfiltered dumps.
- It is refreshed on demand via `retrieve` with `input.target = "cognitive-state"` (§4.2).
- It is derived exclusively from observable artifacts (plans, tool calls, decisions,
  verification, health metrics) and **never contains hidden chain-of-thought**.

## 4. Operation Families

### 4.1 observe

Submit an immutable, evidence-linked observation. The kernel writes an auditable episode.

- **Risk class**: `propose`
- **Side effect**: Writes episode to event ledger within declared scope
- **Required**: `input.type` (event type), `input.payload` (structured event data)
- **Optional**: `input.source_artifact` (file path, git hash, tool output reference)

### 4.2 retrieve

Request a bounded, scoped evidence packet.

- **Risk class**: `read`
- **Side effect**: None (read-only)
- **Required**: `input.query` (text or structured query), `input.purpose`
- **Optional**: `input.max_results`, `input.min_confidence`, `input.time_range`
- **Special target**: `input.target = "cognitive-state"` returns the Live Cognitive
  State document (§3.3), projected through the requester's grant.

### 4.3 propose

Submit a candidate claim, concept link, plan, skill update, or model change. Proposals never promote truth unilaterally.

- **Risk class**: `propose`
- **Side effect**: Creates a candidate object with `status: "proposed"` that requires `commit` to promote
- **Required**: `input.proposal_type` ("claim" | "concept" | "plan" | "skill" | "mutation"), `input.content`

### 4.4 commit

Approve a policy-eligible candidate or state transition.

- **Risk class**: `mutate`
- **Side effect**: Transitions candidate to `status: "committed"`, creates audit trail
- **Required**: `input.proposal_id` (must reference a proposal or candidate object), `input.approval_evidence`

### 4.5 evaluate

Attach a verified outcome, test result, feedback, or postmortem to an existing object.

- **Risk class**: `propose`
- **Side effect**: Links outcome record to the target object; updates confidence/health metrics
- **Required**: `input.target_id`, `input.outcome` ("success" | "failure" | "partial"), `input.evidence`

### 4.6 delegate

Request a bounded task from another authorized agent or subsystem.

- **Risk class**: `delegate`
- **Side effect**: Creates task record; may map to A2A task message
- **Required**: `input.task_description`, `input.capability_requirements`

### 4.7 consolidate

Run a budgeted background derivation (consolidation, reflection, sleep cycle) over eligible evidence.

- **Risk class**: `mutate`
- **Side effect**: Produces candidates; never silently rewrites source evidence
- **Required**: `input.cycle_type` ("consolidation" | "reflection" | "sleep" | "evolution")
- **Optional**: `input.budget_override`

### 4.8 simulate

Produce a labeled, non-factual counterfactual or forecast.

- **Risk class**: `read`
- **Side effect**: None (must not be stored as fact without explicit `commit`)
- **Required**: `input.scenario`, `input.variants` (number of simulations)
- **Output**: Must be labeled `status: "simulated"` separately from verified facts

## 5. Identity and Authorization

### 5.1 Actor Types

| Actor type | Examples | Authentication method |
|---|---|---|
| `user` | Natural person | OAuth token, API key, SSH key |
| `agent` | Codex, Claude Code, OpenCode | Agent identity token, session JWT |
| `system` | CI/CD, workspace daemon | Local IPC socket ownership, environment proof |
| `service` | MCP client, webhook consumer | Mutual TLS, pre-shared key |

### 5.2 Identity Model

Every actor presents an identity envelope on attachment:

```text
identity = {
  id: string,
  type: "user" | "agent" | "system" | "service",
  display_name?: string,
  public_key?: string,
  capabilities: string[],       // supported CIC operations
  metadata: Record<string, unknown>,
}
```

### 5.3 Authorization Flow

```
1. Attach: actor presents identity + capability grant
2. Negotiate: kernel returns authorized operations + scopes
3. Operate: each request carries grant_id; kernel validates:
   a. Grant is valid (not expired, not revoked)
   b. Operation is within grant's operation set
   c. Scope is subset of grant's scope
   d. Budget is not exhausted
4. Audit: every operation is logged with grant_id, outcome, cost
5. Detach: session ends; ephemeral state is released
```

## 6. Transport Adapters

The CIC is transport-neutral. The following standard adapters are defined:

| Transport | CIC mapping | Status |
|---|---|---|
| MCP JSON-RPC | Each CIC operation → MCP tool; envelope → tool parameters; responses → tool results | Implemented in `cognitive-runtime/mcp-transport.ts` |
| REST/JSON (HTTP) | POST `/cic/v1/{operation}` with envelope body; response body | Planned |
| CLI (stdin/stdout) | JSON-line protocol over local process | Planned |
| Local IPC | Named pipe or Unix socket, same format as CLI | Planned |
| A2A | CIC `delegate` maps to A2A task; `observe`/`retrieve` map to A2A modality | Planned |
| CloudEvents | CIC lifecycle events → CloudEvents envelopes | Planned |

## 7. Version Negotiation

The client advertises supported `cic_versions` on attachment. The kernel responds with the highest mutually supported version. All envelopes carry `cic_version` for routing and schema validation.

```text
Client:  { attach: { cic_versions: ["0.1", "0.2"], identity: {...} } }
Kernel:  { attached: { selected_version: "0.1", session_id: "...", capabilities: [...] } }
```

## 8. Conformance Requirements (Research Gate Closure)

This specification closes the following research gates from `research/interfaces/universal-cognitive-harness.md`:

| Gate | Closure evidence |
|---|---|
| Capability and scope semantics | §2 defines the full capability grant model, scope cascade, and namespace isolation |
| Common envelope | §3 defines the request/response envelope with all required fields |

**Remaining gates** (not yet closed):
- Privacy and erasure behavior
- Threat modelling
- Deterministic conformance fixtures
- Failure and retry semantics
- Compatibility test matrix
