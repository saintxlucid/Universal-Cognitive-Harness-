# ADR-001: Workspace-Owned Cognitive Runtime

- **Status:** Accepted for Phase I research and reference-runtime planning
- **Date:** 2026-07-30
- **Scope:** Product topology and integration boundaries

## Context

Coding agents and IDEs reconstruct a repository independently: they discover files, infer architecture, load instructions, rebuild task context, and retain isolated histories. This duplicates work and makes cross-agent continuity fragile. The problem is not solved by replacing Cursor, Claude Code, Codex, OpenCode, Copilot, OpenHands, or future clients. It is solved by giving a workspace a persistent, governed intelligence substrate that clients can attach to.

MCP exposes server resources, prompts, and tools with lifecycle and capability negotiation; it does not define persistent workspace cognition. Agent Client Protocol connects editors and agents. OpenClaw's ACP facility can supervise external coding harnesses while the selected harness still owns its native provider login, filesystem behavior, and native tools. These protocols and runtimes are valuable adapters, not the owner of shared cognitive state.

## Decision

UCH will be defined as a **workspace-owned cognitive runtime**. COS is the cognitive substrate inside that runtime. Agents, IDEs, model runtimes, and operational tools are temporary, permissioned clients.

```text
Applications and clients
  IDEs | coding agents | model runtimes | CI | tools
                         |
             UCH attachment and driver plane
       discovery | capability negotiation | policy enforcement
                         |
                    Workspace runtime
  identity | event bus | project graph | capability registry | policy
                         |
                    COS cognitive substrate
  memory | knowledge | models | learning proposals | evaluations
                         |
                       Storage
  event ledger | graph | vector index | structured store | artifacts | cache
```

The runtime is the source of truth only for its own derived cognitive objects, decisions, policies, capability manifests, and event ledger. It does **not** replace authoritative systems:

| Authoritative system | Retains authority for |
| --- | --- |
| Filesystem | File content and metadata |
| Git | Version history and branch state |
| CI/CD | Build, test, deployment, and release outcomes |
| Database or cloud service | Its application records and control plane |
| User and project governance | Goals, consent, policy, and final approval |

## Consequences

### Positive

- A session can reuse scoped workspace knowledge instead of rediscovering it.
- Drivers become uniform integration points for IDEs, agents, Git, filesystems, terminals, CI, Docker, browsers, databases, cloud, and future systems.
- A dynamic capability registry lets an attached client discover available memory, planning, retrieval, analysis, review, testing, research, and operational functions without hard-coded vendor branches.
- Event-driven updates can refresh a project graph, knowledge index, affected capability views, and task state after a permitted observation.

### Constraints

- Automatic attachment is manifest discovery plus negotiated activation. It is never hidden interception of every request or filesystem operation.
- Every view must be scoped by principal, workspace, project, task, purpose, time, and policy; a client never receives an unrestricted workspace memory dump.
- Drivers publish normalized observations, not unquestioned truth. Events need provenance, idempotency, time, scope, and source authority.
- Capability discovery and invocation are separate. A capability declaration does not grant action authority.
- Private chain-of-thought and raw model inner dialogue are excluded. The runtime may preserve inspectable decision provenance, inputs, evidence, alternatives, uncertainty, outcomes, and evaluations.
- The initial runtime must remain local-first, explicit about storage and erasure, and useful when no optional driver is installed.

## Attachment lifecycle

```text
workspace opened
  -> manifest discovered
  -> runtime endpoint located or started under local policy
  -> client identity and driver capability negotiated
  -> authorized workspace-state projection materialized
  -> observations, queries, proposals, and actions audited
  -> session detached; durable state remains with workspace policy
```

The runtime may notify an attached client of changes only within the negotiated session and scope. A client that cannot or will not attach still operates normally.

## Alternatives considered

| Alternative | Decision |
| --- | --- |
| Build a replacement IDE or coding agent | Rejected: it duplicates mature client ecosystems and centralizes the wrong layer. |
| Treat MCP alone as the cognitive architecture | Rejected: MCP is an excellent transport and capability surface, but does not specify persistent cognitive objects, learning, or workspace ownership. |
| Use a remote global brain by default | Rejected: it creates unnecessary privacy, availability, cost, and cross-workspace contamination risks. |
| Build bespoke plugins for every client first | Rejected: vendor integrations are valuable but must sit above a stable manifest, driver, and semantic contract. |

## Phase-I acceptance criteria

No implementation is approved until the design can demonstrate:

1. A versioned workspace manifest and local discovery contract.
2. A capability registry with machine-readable scopes, authority, cost, and retention semantics.
3. At least one driver event path that is provenance-linked, idempotent, policy-checked, and observable.
4. Two independently implemented clients receiving different authorized projections of the same workspace state.
5. A client decline or detach path that leaves its native workflow intact.
6. Tests for cross-project isolation, deletion propagation, stale-event handling, and unauthorized action denial.

## Evidence and limits

The decision is supported by evidence that harness choice can affect coding-agent token use, latency, and oversight even when the underlying model is unchanged. The cited study is preliminary and does not validate UCH; it motivates treating the harness as an independently evaluated engineering layer. OpenClaw's ACP documentation supports the narrower claim that it can manage external coding-harness sessions while retaining separate ownership boundaries. MCP supports lifecycle, capability negotiation, and server-side resources, prompts, and tools; it does not imply a universal memory model.

Sources: [The Scaffold Effect](https://arxiv.org/abs/2607.22585), [OpenClaw ACP agents](https://docs.openclaw.ai/tools/acp-agents), [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-06-18/basic/index), and [Agent Client Protocol](https://github.com/agentclientprotocol/agent-client-protocol).
