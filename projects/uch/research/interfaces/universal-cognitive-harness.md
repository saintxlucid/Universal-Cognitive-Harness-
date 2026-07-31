# Universal Cognitive Harness (UCH)

## Status and boundary

**Research specification v0.1.** The Universal Cognitive Harness (UCH) is a proposed compatibility and runtime-attachment layer. The Cognitive Operating System (COS) is the governed cognitive substrate and organism model beneath it. The Cognitive Interchange Contract (CIC) is the semantic contract between them and their drivers.

UCH must not be described as consciousness, a hidden omniscient observer, or a way to intercept every IDE or model request. An integration deliberately attaches, negotiates permissions, and selects a scope. "One brain" means a permissioned, namespace-isolated cognitive-state fabric, not unrestricted shared data.

## Layering hypothesis

```text
IDE / agent / model / workspace / tool driver
                 <-> UCH attachment facade
                 <-> CIC semantic contract
                 <-> COS cognitive kernel and governed state
```

MCP, Agent Client Protocol (ACP), A2A, REST, gRPC, local IPC, and event streams are transports or adapters, not the cognitive architecture. The acronym ACP is overloaded in the ecosystem; specifications must spell out the exact protocol and source rather than rely on the abbreviation.

## Shared cognitive-state virtualization

A **Workspace Cognitive State** is an attachable materialization of selected workspace evidence, task state, decision records, graph links, health signals, and recent event history. It is not a claim that a workspace is conscious.

Each view is derived using a principal, workspace, project, task, purpose, time horizon, and policy. The kernel may share a stable object identity while returning different authorized projections to different sessions. No driver receives a global memory dump by default.

## Harness operation surface

The initial semantic vocabulary is deliberately small:

| Operation | Meaning | Authority boundary |
| --- | --- | --- |
| `observe` | Submit an evidence-linked event or artifact reference | Write to declared intake scope |
| `understand` | Request a bounded interpretation or claim proposal | Cannot silently promote a fact |
| `remember` | Propose durable retention | Subject to policy, provenance, and review |
| `retrieve` | Request a scoped, cited recall projection | Read policy and budget enforced |
| `predict` / `simulate` | Produce calibrated, labelled forecasts | No direct execution authority |
| `plan` / `critique` / `reflect` | Create inspectable working artifacts | No hidden reasoning requirement |
| `learn` / `consolidate` / `sleep` | Propose governed updates or offline maintenance | Evaluation and rollback required |
| `execute` / `verify` | Act through an explicitly authorized tool and record outcome | Separate action policy |
| `compress` / `evolve` | Propose representation or policy changes | Versioned approval and audit required |

The public contract records inputs, outputs, evidence references, uncertainty, policy decisions, and outcomes. It stores decision provenance rather than private chain-of-thought or model inner dialogue.

## Driver model

Every integration is a manifest-driven driver in one of five families: IDE, agent/harness, model/runtime, workspace, or tool. A driver declares supported operations, event mappings, authentication method, scopes, rate/budget limits, and data-retention behavior. There are no vendor-specific kernel branches.

Attachment lifecycle:

```text
discover -> negotiate capabilities -> bind session to authorized scope
         -> observe / query / propose -> receive audited result -> detach
```

File saves, commits, test failures, deployments, and user feedback may be published as normalized events only after the attached driver has permission to emit them. Future delivery should evaluate a transactional-outbox and idempotency design for reliable event publication; this is an implementation hypothesis, not a present guarantee.

## Compatibility ladder

| Tier | Integration | Intended coverage |
| --- | --- | --- |
| 0 | Local daemon, CLI, documented HTTP API | Any environment able to invoke a process or API |
| 1 | MCP adapter | Tool-capable coding agents and IDEs |
| 2 | Agent Client Protocol adapter | ACP-compatible editors and coding agents |
| 3 | A2A adapter | Independent agent discovery and delegation |
| 4 | Native extension/SDK | Rich IDE or runtime-specific experiences |

This is progressive interoperability, not a promise of native support for every future IDE, agent, or model. A compatible runtime can always use a lower tier.

## Ecosystem position

OpenHands, OpenClaw's ACP bridge, Goose's ACP support, and compatibility-oriented harnesses show that portable agent runtimes and editor-agent protocols are useful. UCH is a complementary persistent cognitive substrate proposal: it should adapt those transports rather than attempt to replace them.

Relevant protocol and ecosystem sources: [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-06-18/basic/index), [Agent Client Protocol](https://github.com/agentclientprotocol/agent-client-protocol), [A2A](https://a2a-protocol.org/latest/), [CloudEvents](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md), [OpenHands](https://docs.openhands.dev/openhands/usage/architecture/runtime), [Goose architecture](https://goose-docs.ai/docs/goose-architecture/), and [OpenClaw ACP bridge](https://github.com/openclaw/openclaw/blob/main/docs.acp.md).

## Research gates

UCH may be implemented only after the CIC has capability and scope semantics; privacy and erasure behavior; threat modelling; deterministic conformance fixtures; failure and retry semantics; and a compatibility test matrix. The first reference implementation should prove an end-to-end attached session with policy isolation, provenance, and observable rollback before adding intelligent automation.
