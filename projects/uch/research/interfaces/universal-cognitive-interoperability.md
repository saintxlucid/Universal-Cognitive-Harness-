---
track: T10
status: exploratory
sources:
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/index
  - https://a2a-protocol.org/latest/
  - https://spec.openapis.org/oas/v3.1.1.html
  - https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md
---

# Universal Cognitive Interoperability

## Question

How can the COS serve different IDEs, coding agents, applications, and models
without becoming coupled to any vendor, framework, transport, or model API?

## Direct evidence

- The Model Context Protocol (MCP) defines JSON-RPC communication with server
  features such as tools, resources, and prompts. It is well suited to exposing
  bounded COS capabilities to interactive assistants, but does not define what
  memory, trust, planning, or learning mean.
- The Agent2Agent (A2A) Protocol defines discovery, modalities, collaboration,
  and task management between independent agents. It is suitable for delegation
  between COS-enabled agent systems, not for defining a shared cognitive state.
- OpenAPI describes HTTP APIs, while CloudEvents standardizes event metadata and
  formats across independently deployed producers and consumers. These solve
  transport and interoperability concerns, not cognitive semantics.

## Core inference: contract first, transport second

The COS should not begin by inventing a competing network protocol. It needs a
versioned **Cognitive Interchange Contract (CIC)**: a semantic, transport-neutral
object and operation model. Existing transports carry that contract:

| Need | Initial standard adapter | COS responsibility |
| --- | --- | --- |
| Interactive assistant access | MCP | Map selected cognitive capabilities into safe tools and resources. |
| Agent delegation | A2A | Map work requests, artifacts, and bounded task state. |
| Service control and SDKs | REST/JSON documented with OpenAPI | Manage identities, workspaces, objects, policy, jobs, and audit. |
| Low-latency service clients | gRPC/Protobuf, subject to later evidence | Carry the same CIC schema efficiently. |
| Streaming | Server-Sent Events or WebSocket | Stream typed operation progress and evidence packets. |
| Asynchronous lifecycle | CloudEvents | Emit durable, discoverable lifecycle events. |
| Local development | CLI plus local IPC | Support a local daemon without exposing a network service. |

The contract is the durable intellectual property. Transports, SDKs, model
drivers, IDE drivers, and agent integrations are replaceable edge adapters.

## Proposed Cognitive Interchange Contract: research hypothesis

The CIC is deliberately smaller than a fictional `Think()` API. Models retain
their own inference process. COS operations work on inspectable cognitive
objects and governed effects:

| Operation family | Meaning | Side-effect rule |
| --- | --- | --- |
| `observe` | Submit an immutable, scoped observation or artifact reference. | Writes an auditable episode. |
| `retrieve` | Request a bounded evidence packet for a purpose and scope. | Read-only. |
| `propose` | Produce a candidate claim, concept link, plan, skill, or model update. | Never promotes truth. |
| `commit` | Approve a policy-eligible candidate or state transition. | Requires actor, authorization, provenance, and idempotency. |
| `evaluate` | Attach verified outcome, test result, feedback, or postmortem. | Cannot self-certify unsupported success. |
| `delegate` | Request a bounded task from another authorized agent. | Maps to A2A where available. |
| `consolidate` | Run a budgeted background derivation over eligible evidence. | Emits candidates, never destructive silent rewrites. |
| `simulate` | Ask for a labeled, non-factual counterfactual or forecast. | Must remain separate from facts. |

Every request needs a common envelope, independent of transport:

```text
operation_id · schema_version · actor · workspace/project/user scope
purpose · capability grant · risk class · consent reference · budget
deadline · idempotency key · input references · sensitivity labels
```

Every response must provide:

```text
result · evidence references · confidence/calibration · valid time
conflicts · policy decision · cost/latency · audit reference
```

This proposal is not yet an approved API. Its first test is whether the same
operation can be represented without loss through a local CLI, MCP, REST, and
A2A adapter.

## Driver model

The kernel must consume capability manifests, never vendor names:

| Driver type | Normalizes | Must not do |
| --- | --- | --- |
| Model driver | Context limits, modalities, streaming, tool schema, embeddings, error model, cost telemetry. | Leak provider-specific reasoning or make provider identity a kernel dependency. |
| Agent driver | Session, task, artifact, and approval lifecycle. | Merge untrusted agent memory into another scope. |
| IDE driver | File focus, diagnostics, edits, selection, workspace events, and user intent—with consent. | Read arbitrary local data or silently modify files. |
| Workspace driver | Git, filesystem, issue tracker, docs, build, and deployment observations. | Treat tool output as instructions or authorize external effects. |
| Tool driver | Capability, input/output schema, risk, and execution evidence. | Hide destructive behavior behind a generic operation. |

Drivers publish a versioned manifest: supported CIC operations, modalities,
scope requirements, side effects, policy needs, and compatibility range. The
kernel can refuse an unsupported or unsafe operation rather than guessing.

## Multi-agent shared cognition: required boundaries

"Shared brain" means a **shared, permissioned cognitive fabric**. It does not
mean that every agent, project, or user receives every other agent's context.

- Namespaces are mandatory: organization, user, workspace, project, branch,
  task, session, and private-agent scopes.
- Sharing occurs through explicit object grants and redacted evidence packets.
- Every writer is an attributed principal; every mutation is versioned and
  auditable.
- Agent-generated content starts as untrusted/candidate unless independently
  verified.
- Retrieval respects purpose and capability grants, not only text similarity.

## Compatibility ladder

Universal support has to be progressive. Closed or changing applications cannot
be guaranteed a native integration.

1. **Portable baseline**: local daemon, CLI, REST, and MCP.
2. **Agent collaboration**: A2A adapter and SDKs.
3. **IDE enrichment**: maintained extensions where platforms permit them.
4. **Native integrations**: vendor-specific drivers only when their stable APIs
   and permission systems justify maintenance.

An integration may be read-only, context-enriching, or action-capable. The
capability tier must be visible to the user; it must never silently escalate.

## Falsifiable hypotheses

- H1: One CIC operation set can round-trip through CLI, MCP, REST, and A2A
  adapters without losing scope, evidence, policy, or lifecycle semantics.
- H2: Capability manifests lower adapter maintenance and prevent unsupported
  assumptions when model or IDE APIs change.
- H3: Scope-aware shared cognition reduces cross-project leakage compared with
  a single flat memory store, while preserving collaboration recall.
- H4: A COS can improve configured agent workflows without intercepting or
  controlling all model calls.

## Counterevidence and research risks

- A universal operation set could become too abstract for useful integrations.
- Adapters can leak information through metadata, logs, or event payloads.
- Standards evolve; each transport needs version negotiation and deprecation.
- A single shared service can become a bottleneck or a high-value security
  target, so the operations and storage tracks must define isolation, recovery,
  and replication before implementation.
