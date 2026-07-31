# Workspace Manifest and Discovery Contract

- **Status:** Implemented (2026-07-31)
- **Scope:** ADR-001 Phase-I acceptance criterion #1
- **Module:** `src/workspace-manifest/`

## 1. Purpose

The workspace manifest is the cognitive configuration of a workspace, in the
spirit of `package.json` / `Cargo.toml` / `pyproject.toml` — but for the
cognitive runtime. It answers the question every client asks on open:

> "What is this workspace, what does it know, and what may I attach to?"

Discovery is the mechanism by which a workspace *wakes up* the harness — the
inversion of every agent reconstructing the workspace from scratch.

## 2. Manifest location and format

- File: `.uch/uch.manifest.json` (JSON)
- Schema version: `uch.manifest.v1` (`MANIFEST_SCHEMA_VERSION`)
- The `.uch/` directory is the cognitive configuration home of a workspace.

```json
{
  "schema_version": "uch.manifest.v1",
  "manifest_version": "0.1.0",
  "workspace": {
    "id": "optional-workspace-id",
    "name": "my-project",
    "purpose": "Workspace cognitive configuration"
  },
  "runtime": {
    "min_uch_version": "0.2.0"
  },
  "capabilities": [
    { "name": "memory", "enabled": true },
    { "name": "planning", "enabled": true }
  ],
  "drivers": [
    { "id": "filesystem", "enabled": true },
    { "id": "git", "enabled": true }
  ],
  "skills": ["skills/"],
  "policies": []
}
```

## 3. Discovery contract

`discoverManifest({ startDir?, stopAt? })` walks upward from `startDir`
(default cwd) to `stopAt` (default filesystem root), looking for
`.uch/uch.manifest.json` in each directory. The first manifest found defines
the workspace root.

| Case | Result |
| --- | --- |
| Manifest found | `{ workspaceRoot, manifestPath, manifest, warnings }` |
| No manifest | `null` — the workspace is not cognitively configured |

**A workspace without a manifest is not an error.** Clients operate normally;
the harness simply has nothing to attach to.

## 4. Attachment lifecycle (ADR-001 §Attachment lifecycle)

```text
workspace opened
  -> manifest discovered
  -> runtime version negotiated (runtime.min_uch_version vs UCH_RUNTIME_VERSION)
  -> capabilities and drivers negotiated against the runtime's registries
  -> per-agent grant issued (scope, operation families, constraints)
  -> authorized workspace-state projection materialized
  -> workspace:opened / agent:attached events emitted on the event bus
  -> session detached; grant revoked; durable state remains with workspace policy
```

`attach(options)` returns `AttachmentResult`:

| Field | Meaning |
| --- | --- |
| `attached` | Whether the client successfully attached |
| `reason` | Why attachment did not occur (no manifest / version mismatch) |
| `discovery` | The discovered manifest + paths |
| `version` | Version negotiation outcome (`required` vs `current`) |
| `capabilities` | Granted capability names |
| `drivers` | Started driver ids |
| `workspace_id` | From manifest `workspace.id` or `workspace.name` |
| `session_id` | Unique attachment session |
| `grant` | The `CapabilityGrant` issued to the attaching agent |
| `projection` | Authorized `WorkspaceProjection` of the provided `workspaceState` (absent when no state was provided) |

### Version negotiation

- Manifest `runtime.min_uch_version` is compared against the running runtime
  version (`UCH_RUNTIME_VERSION`).
- If the runtime is older than required, attachment is refused with the
  reason in `result.reason` and `result.version`.

### Capability negotiation

- The manifest's `capabilities` (name + enabled) are intersected with the
  runtime's `CapabilityRegistry`.
- A capability is granted only if the manifest requests it **and** the
  runtime provides it **and** it is enabled.
- Discovery and invocation are separate: a granted capability does not grant
  action authority (ADR-001). Authority comes from the `GrantEngine`
  (`src/cognitive-runtime/grants.ts`): every attach issues a per-agent
  `CapabilityGrant` binding the agent to a workspace scope, operation
  families, and optional constraints (ttl, rate limit, budget, retention).
  `detach()` revokes the grant.

### Driver negotiation

- The manifest's `drivers` (id + enabled) are matched against the runtime's
  `DriverRegistry`.
- Only registered drivers can start; a requested-but-unregistered driver is
  reported with an error and does not block attachment.
- Driver start failures are captured per-driver and do not fail the
  attachment.

## 5. Events emitted

| Event | When |
| --- | --- |
| `workspace:opened` | On successful attach, with workspace identity + session |
| `agent:attached` | After open, with granted capabilities + started drivers |
| `agent:detached` | On `detach()` |
| `workspace:closed` | After detach |

## 6. CLI

| Command | Behavior |
| --- | --- |
| `uch attach` | Discover + attach from cwd; prints the full result |
| `uch manifest init` | Creates `.uch/uch.manifest.json` (refuses to overwrite) |
| `uch manifest show` | Prints the discovered manifest or "no manifest found" |

## 7. Conformance to ADR-001 Phase-I criteria

| Criterion | Status |
| --- | --- |
| 1. Versioned workspace manifest + local discovery contract | **Implemented** — this document |
| 2. Capability registry with machine-readable scopes/authority | **Implemented** — `CapabilityRegistry` carries scope cascade, authority (operation families), cost, and retention; `GrantEngine` issues/authorizes/revokes per-agent grants with scope containment, rate limits, budgets, and retention checks; attach issues a grant per agent and detach revokes it |
| 3. Driver event path, provenance-linked, idempotent, policy-checked | **Implemented** — `EventGovernance` (see [EVENT-GOVERNANCE.md](EVENT-GOVERNANCE.md)) gates every driver observation: provenance chains, event_id dedupe, PolicyEngine checks, GrantEngine checks, staleness rejection, and an audit ledger; attach returns the session gate as `result.governance` |
| 4. Two independent clients with different projections | **Implemented** — `ProjectionEngine` (`src/control-plane/projections.ts`) projects the workspace state through each grant's scope (containment cascade) and operation families (authority intersection); `attach({ grantScope, workspaceState })` returns `result.projection`; see [PROJECTIONS.md](PROJECTIONS.md) |
| 5. Client decline/detach path leaves native workflow intact | Implemented — `attached: false` is a normal outcome; `detach()` stops drivers + emits events |
| 6. Cross-project isolation, deletion propagation, stale events, unauthorized denial tests | Implemented — unauthorized-action denial, cross-project isolation (out-of-scope events denied), deletion propagation (grant revocation denies subsequent events), and stale-event rejection are covered by grant + governance tests; projection-level isolation covered by projections tests |

## 8. Files

| File | Contents |
| --- | --- |
| `src/workspace-manifest/manifest.ts` | Schema, validation, version comparison, version negotiation |
| `src/workspace-manifest/loader.ts` | Parse/load/create/write manifest files |
| `src/workspace-manifest/discovery.ts` | Upward manifest discovery |
| `src/workspace-manifest/negotiation.ts` | Capability + driver negotiation |
| `src/workspace-manifest/attach.ts` | Attachment lifecycle, standard capabilities, per-agent grant issuance, detach |
| `src/cognitive-runtime/capability-registry.ts` | Scoped capability semantics (scope, authority, cost, retention) |
| `src/cognitive-runtime/grants.ts` | GrantEngine — issue, authorize, revoke, scope cascade, rate limit, budget, retention |
| `src/control-plane/event-governance.ts` | EventGovernance — provenance-linked, idempotent, policy-checked driver event gate (see [EVENT-GOVERNANCE.md](EVENT-GOVERNANCE.md)) |
| `src/control-plane/projections.ts` | ProjectionEngine — scope-contained workspace-state projections + capability authority intersection (see [PROJECTIONS.md](PROJECTIONS.md)) |
| `src/workspace-manifest/__tests__/workspace-manifest.test.ts` | 22 tests covering the full contract incl. grant issuance/revocation |
| `src/cognitive-runtime/__tests__/grants.test.ts` | 29 tests for GrantEngine + scoped registry |
| `src/control-plane/__tests__/projections.test.ts` | 14 tests: scope containment, authority intersection, `projectAll`, two-client attach wiring |
