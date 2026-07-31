# Privacy and Erasure Behavior v0.1

- **Status:** Draft specification
- **Date:** 2026-07-30
- **Scope:** Data privacy, retention, deletion, and consent model for UCH cognitive state
- **Requires:** CIC-SPECIFICATION.md (§2 namespace isolation)

## 1. Principles

1. **Data Minimization**: UCH stores only what is explicitly observed or derived under a declared purpose. It does not silently record ambient inputs.
2. **Purpose Binding**: Retrieved evidence is used only for the declared purpose and scope of the originating operation.
3. **Consent Before Collection**: An attached driver must have an active consent grant before publishing observations to the event ledger.
4. **Right to Erasure**: Any principal may request deletion of their cognitive state within the bounds of policy and audit requirements.
5. **Retention Limits**: Every cognitive object carries a retention policy; expired objects are candidates for deletion or archival.

## 2. Consent Model

### 2.1 Consent Grants

Before an attached driver may write observations, the principal must grant consent:

```text
consent_grant = {
  grant_id: string,
  principal_id: string,
  scope: { organization?, workspace?, project? },
  permitted_observation_types: string[],   // event type patterns
  data_classes: string[],                  // e.g. ["file_path", "git_metadata", "tool_output"]
  retention_days: number,
  granted_at: ISO8601,
  expires_at?: ISO8601,
  revocable: boolean,
}
```

### 2.2 Consent Lifecycle

```
requested → granted → active → (revoked | expired)
                                    ↓
                              data_erasure_scheduled
                                    ↓
                              erasure_completed
```

- A revoked consent does not retroactively erase data created while consent was active — it prevents new observations.
- Expiration transitions all associated objects to archival with a deletion timer.
- Silently collecting data after consent expiry is a policy violation.

### 2.3 Observation Consent Check

Before `observe` commits an episode, the kernel validates:

1. The source driver has an active consent grant for the observation type
2. The scope of the observation is within the grant's scope
3. The data class is permitted
4. The retention period is respected

If consent is missing or expired, the observation is rejected with `status: "rejected"` and `reason: "consent_missing"`.

## 3. Data Classification

Every cognitive object is tagged with a sensitivity class:

| Class | Examples | Default retention | Deletion behavior |
|---|---|---|---|
| `public` | Open source repo metadata, public API docs | Indefinite | N/A |
| `internal` | Project architecture, team conventions | Project lifetime | Bulk erase on project close |
| `sensitive` | API keys (hashed), proprietary logic references | 90 days | Secure erase + audit tombstone |
| `pii` | User names, email addresses, personal data | 30 days | Secure erase + audit tombstone |
| `credential` | Tokens, secrets, passwords | 0 days (never stored) | Rejected at ingest |
| `ephemeral` | Session context, working memory | Session lifetime | Released on detach |

### 3.1 Classification Rules

- Classification is assigned at ingest time by the source driver, not inferred by the kernel.
- The kernel may refuse to store an object whose classification exceeds the scope's permitted maximum.
- Downstream derived objects inherit the most restrictive classification of their source evidence.

## 4. Erasure Operations

### 4.1 Soft Delete (Default)

Marks objects as `status: "deleted"` with a tombstone record. The tombstone preserves:

- `original_id` (hashed)
- `deleted_at` timestamp
- `deleted_by` principal
- `policy_reference` (consent or retention rule)

The tombstone is retained for the audit retention period (default: 90 days), then permanently removed.

### 4.2 Hard Delete

Permanently removes the object and all derived references. Only available under explicit hard-deletion grants. No tombstone is preserved. The operation is logged in the audit ledger with an irreversible flag.

### 4.3 Delete Propagation

When an object is deleted:

1. All directly derived objects (summaries, concepts, beliefs sourced from the object) are marked for review and may be soft-deleted if they have no other supporting evidence.
2. Cross-references (edges, links, mentions) are removed.
3. The deletion is recorded in the event ledger as a `data:erasure` event.
4. If the object is in a `core` or `archival` tier, the deletion must clear a policy gate.

### 4.4 Deletion of Derived Objects

Derived objects (claims, concepts, summaries) that lose all supporting source evidence enter an `orphaned` state:

- **Immediate**: If confidence < 0.5 and sole-sourced, soft-delete.
- **Deferred** (24h grace): If confidence >= 0.5 or has multiple sources, re-evaluate. If still orphaned after grace period, soft-delete.
- **Preserved**: If the derived object has been independently verified (confidence >= 0.8 with multiple sources), it may survive with an `incomplete_provenance` flag.

## 5. Retention Policies

### 5.1 Default Retention by Scope

| Scope level | Default retention | Maximum retention |
|---|---|---|
| Session | Session lifetime | Session lifetime |
| Task | 7 days after task completion | 30 days |
| Branch | 90 days after branch merge/deletion | 1 year |
| Project | Project lifetime + 30 days | Indefinite (with consent) |
| Workspace | Workspace lifetime | Indefinite (with consent) |
| User | Until account deletion + audit window | 7 years (regulatory) |

### 5.2 Retention Enforcement

A background sweep process runs at configurable intervals (default: hourly) to:

1. Identify objects past their retention limit
2. Apply the appropriate erasure operation (soft-delete for most classes, hard-delete for ephemeral)
3. Log erasure actions to the audit ledger

The sweep respects the erasure budget — no more than N objects are erased per cycle to avoid performance impact.

### 5.3 Retention Override

A principal with an `administer` grant may override retention for specific objects:

- `pin` — extend retention indefinitely with reason
- `expedite` — schedule immediate erasure
- All overrides are logged with actor identity and reason

## 6. Audit Ledger

All privacy-relevant operations are recorded in the immutable audit ledger:

| Event | Fields |
|---|---|
| `consent:granted` | grant_id, principal, scope, permitted_types, retention |
| `consent:revoked` | grant_id, principal, revoker |
| `consent:expired` | grant_id, expired_at |
| `data:ingested` | object_id, classification, source, retention |
| `data:soft_deleted` | object_id, deleted_by, policy_reference |
| `data:hard_deleted` | object_id_hash (irreversible), deleted_by |
| `data:retention_extended` | object_id, new_retention, reason, authorized_by |
| `data:orphaned` | object_id, derived_from, action_taken |
| `sweep:cycle` | cycle_id, objects_deleted, objects_pinned, duration_ms |

The audit ledger is append-only. Its own retention is governed by regulatory requirements (minimum 1 year, default 3 years).

## 7. Cross-Scope Privacy

### 7.1 No Implicit Cross-Project Visibility

A retrieve operation scoped to Project A must never return evidence from Project B, even if the same user or agent operates in both. This is enforced by the namespace isolation from CIC-SPECIFICATION §2.3.

### 7.2 Cross-Project Grants

Explicit cross-project access requires:

1. A `delegate` operation from the requesting principal in Project A
2. A consent grant in Project B accepting the delegation
3. The response is limited to the minimum evidence needed for the declared purpose

### 7.3 Agent Isolation

Two agents operating in the same workspace receive separate cognitive projections. Agent A cannot see Agent B's private working memory, proposals, or reflection state unless Agent B explicitly shares it.

## 8. Compliance with Standards

| Standard | Relevant provisions | UCH mapping |
|---|---|---|
| GDPR | Right to erasure (Art 17), data minimization (Art 5), purpose limitation (Art 5) | §2 consent, §4 soft/hard delete, §1 data minimization |
| CCPA | Right to delete, right to know | §4 erasure, §3 data classification |
| SOC 2 | Privacy principle, access controls | §6 audit ledger, §2 consent model, §5 retention |
| OWASP Top 10 | A01:2021 (Broken Access Control) | §7 cross-scope isolation, §2.3 consent check |
