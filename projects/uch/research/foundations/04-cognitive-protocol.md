---
track: T10
status: research-draft
version: 0.1.0
related: ../interfaces/universal-cognitive-interoperability.md
---

# Cognitive Protocol v0.1

## Purpose

The Cognitive Protocol is the semantic contract for communication among organs,
drivers, IDEs, agents, applications, and model adapters. It is not a new wire
transport. The existing interoperability note maps it onto MCP, A2A, REST/gRPC,
local IPC, streaming, and CloudEvents.

## Core rule: events for observation, commands for requested effects

An event reports something that happened and is immutable. A command requests a
policy-governed effect and produces a result event. Queries are read-only and
return bounded evidence packets. This separation prevents a loosely phrased
event from silently becoming an action.

### Canonical event families

```text
reality.observed                 cognition.interpretation_proposed
knowledge.claim_proposed         knowledge.claim_status_changed
connectome.relation_proposed     model.prediction_issued
goal.created                     plan.proposed
decision.committed               action.requested
action.completed                 outcome.evaluated
skill.promotion_proposed         consolidation.requested
consolidation.completed          policy.denied
budget.granted | budget.exhausted
```

### Event envelope

Every event carries the following minimum metadata:

```text
event_id · event_type · schema_version · occurred_at · recorded_at
actor · organism/workspace/project/branch/task/session scope
causation_id · correlation_id · trace_id · sensitivity · risk class
evidence references · capability grant reference · payload hash
```

Event payloads contain references to sensitive artifacts whenever possible,
rather than duplicating private contents in logs or transport metadata.

## Commands, queries, and result envelopes

| Interaction | Required semantics |
| --- | --- |
| `Observe` | Immutable episode ingestion with source, scope, sensitivity, and content reference. |
| `Retrieve` | Purpose-bound query returning a token-budgeted evidence packet, confidence, conflicts, and provenance. |
| `Propose` | Candidate claim, relation, plan, skill, model update, or consolidation with supporting evidence. |
| `Commit` | Explicit lifecycle transition, requiring authorization, policy result, idempotency key, and audit receipt. |
| `Evaluate` | Attaches a verifier result, user correction, test, metric, or postmortem. |
| `Delegate` | Sends bounded work and artifact references to an authorized agent; maps to A2A when present. |
| `Simulate` | Returns a clearly labelled forecast or counterfactual, segregated from factual memory. |

No `Think` command exists. The COS can request a model-backed reasoning service
through a model driver, but it records the decision inputs, evidence, output,
and verification—not private hidden reasoning.

## Cognitive Bus delivery semantics

- At-least-once delivery with idempotent consumers is the initial hypothesis.
- Commands use idempotency keys; events use stable identities and causal links.
- Consumers declare accepted schema versions and capability/scope requirements.
- Backpressure, deadlines, and budget propagation are mandatory.
- Policy denials are first-class results, not transport failures.
- An organ may subscribe to only authorized event types and scopes.

## Driver contract

Drivers are edge translators. A driver must publish a capability manifest with
supported operations, modalities, schemas, side effects, permissions, cost
telemetry, compatibility range, and deprecation status. The kernel never
contains a special case for a named IDE, model vendor, or agent framework.

Drivers cannot bypass the Cognitive Bus for authoritative state changes. They
may preserve native metadata in a namespaced extension field, but extensions
cannot change constitutional semantics.

## Protocol research tests

1. Round-trip one `Observe → Retrieve → Propose → Evaluate` flow through local
   CLI, MCP, REST, and A2A representations without loss of scope or evidence.
2. Inject duplicate events, late events, policy denials, and retries; verify
   idempotency, causal trace, and durable audit.
3. Confirm that a read-only IDE driver cannot cause a commit or action request.
4. Confirm that private-agent and project-scoped evidence cannot cross into a
   different retrieval packet merely because it is semantically similar.
5. Change a model driver capability manifest and verify that the kernel
   degrades explicitly rather than guessing a provider-specific behavior.
