# Workspace-State Projections

- **Status:** Implemented (2026-07-31)
- **Scope:** ADR-001 Phase-I acceptance criterion #4
- **Module:** `src/control-plane/projections.ts` (+ attach wiring in `src/workspace-manifest/attach.ts`)

## 1. Purpose

A projection is what one grant holder may actually see of the workspace
state: the containment tree filtered through the grant's scope (CIC §2.2
cascade) and the capabilities filtered through the grant's operation
families.

> Discovery never implies authority — a capability whose operations are all
> outside the grant is absent from the projection.

Same workspace state, two grants → two projections. No state is ever
projected unfiltered. This satisfies ADR-001 Phase-I criterion #4: *two
independently implemented clients receiving different authorized projections
of the same workspace state*.

## 2. The workspace state model

`WorkspaceState` is a containment tree the runtime provides on attach:

```
workspace
  └─ projects    (workspace -> projects)
       └─ branches   (project -> branches)
            └─ tasks      (branch -> tasks)
                 └─ sessions   (task -> sessions)
```

| Field | Meaning |
| --- | --- |
| `workspace_id` | Workspace identity the state belongs to |
| `projects` | Project ids |
| `branches` | `projectId -> branch ids` |
| `tasks` | `branchId -> task ids` |
| `sessions` | `taskId -> session ids` |
| `capabilities` | Capability names the workspace runtime provides |

`attach({ workspaceState })` merges the caller's state over a stub keyed to
the discovered manifest's workspace id — the runtime never fabricates
containment.

## 3. Scope containment (`projectScope`)

`projectScope(grantScope, state)` returns the `ScopeProjection`:

```ts
{ projects: string[]; branches: string[]; tasks: string[]; sessions: string[] }
```

Containment rules:

- **Levels below the grant's pin** are fully visible within the pinned
  ancestor.
- **The pin level itself** is filtered to the granted values.
- **Levels above the pin** are projected only as the containing ancestors of
  what is visible.
- **A different workspace id** in the grant yields an empty projection.

Examples (from `src/control-plane/__tests__/projections.test.ts`):

| Grant scope | Visible |
| --- | --- |
| `{ workspace: 'ws-test' }` | All projects, branches, tasks, sessions |
| `{ project: 'proj-a', workspace: 'ws-test' }` | `proj-a` subtree only; `sess-4a` absent |
| `{ task: 'task-2', workspace: 'ws-test' }` | `proj-a` + `main-a` (ancestors) + `task-2` + `sess-2a` only |
| `{ session: 'sess-1b', workspace: 'ws-test' }` | `proj-a` + `main-a` + `task-1` (ancestors) + `sess-1b` only |
| `{ workspace: 'ws-other' }` | Empty projection |
| `{ session: '<unknown>', workspace: 'ws-test' }` | Empty projection — a pin unknown to the state projects nothing |

## 4. Capability authority intersection

`ProjectionEngine.project(grant, state)` returns a `WorkspaceProjection`:

| Field | Meaning |
| --- | --- |
| `actor` / `grant_id` | The grant holder and grant identity |
| `workspace_id` | The projected workspace |
| `scope` | The scope actually granted (never wider than the grant) |
| `operations` | Operation families granted to the client |
| `capabilities` | `{ name, operations, cost?, retention? }` for capabilities with **at least one** granted operation family |
| `visible` | The `ScopeProjection` from §3 |
| `projected_at` | When the projection was materialized |

Capability filtering is the authority intersection:

```
projected capability = workspace capability ∩ grant.operations
```

- A capability with no overlapping operation family is absent — the client
  cannot even see that it exists.
- Cost and retention are carried through from the registry so the client can
  plan within its budget without guessing.
- `projectAll(grants, state)` projects one view per grant holder — the
  multi-client shape required by criterion #4.

## 5. Attach wiring

`attach()` gains two surface changes:

- `AttachOptions.grantScope` — additional scope pins merged over the
  workspace scope when the per-agent grant is issued
  (`scope: { workspace, ...grantScope }`).
- `AttachmentResult.projection` — the `WorkspaceProjection` computed for the
  issued grant over the provided `workspaceState`; `undefined` when no
  `workspaceState` was provided (attachment still succeeds).

Two clients attaching to the same manifest receive different `grant_id`s and
different projections:

```ts
const a = await attach({ agent_id: 'client-a', startDir, workspaceState });
const b = await attach({ agent_id: 'client-b', startDir, workspaceState,
                         grantScope: { task: 'task-2' } });

a.projection.visible.sessions // full state
b.projection.visible.sessions // ['sess-2a'] only
```

## 6. Conformance to ADR-001 Phase-I criteria

| Criterion | Status |
| --- | --- |
| 4. Two independent clients with different projections | **Implemented** — this document; `ProjectionEngine` + attach wiring; 14 tests in `src/control-plane/__tests__/projections.test.ts` (containment, authority intersection, `projectAll`, two-client attach with containment + capability subset assertions) |
| 6. Projection-level isolation tests | **Covered** — same-state/two-grant containment (broad view ⊇ narrow view, narrow strictly smaller), per-client independence of grants and projections |

## 7. Files

| File | Contents |
| --- | --- |
| `src/control-plane/projections.ts` | `WorkspaceState`, `ScopeProjection`, `WorkspaceProjection`, `projectScope` (containment), `ProjectionEngine` (authority intersection, `project` / `projectAll`) |
| `src/workspace-manifest/attach.ts` | `grantScope` option, `result.projection`, state merge keyed to the manifest workspace id |
| `src/control-plane/__tests__/projections.test.ts` | 14 tests: scope containment (6), authority intersection (4), `projectAll` (1), attach wiring with two clients (3) |
