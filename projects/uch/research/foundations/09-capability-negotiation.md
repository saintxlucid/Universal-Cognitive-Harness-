---
track: protocol
status: research-draft
version: 0.1.0
sources:
  - https://www.rfc-editor.org/rfc/rfc8446 (TLS 1.3 — RFC 8446, version negotiation with downgrade protection)
  - https://www.rfc-editor.org/rfc/rfc9110 (HTTP semantics — RFC 9110 §12 content negotiation)
  - https://www.rfc-editor.org/rfc/rfc8414 (OAuth 2.0 authorization server metadata — RFC 8414, discovery document)
  - https://www.usb.org/document-library/usb-20-specification (USB 2.0 — device/configuration/interface descriptors)
  - https://a2a-protocol.org/latest/specification/ (A2A protocol — agent cards, capability discovery)
  - https://modelcontextprotocol.io/specification/2025-06-18 (Model Context Protocol — tool/resource discovery at handshake)
  - https://fipa.org/specs/fipa00037/SC00037J.html (FIPA ACL message structure specification)
  - https://www.bluetooth.com/specifications/specs/core-specification-6-0/ (Bluetooth Core 6.0 — GATT service discovery)
---

# Cognitive Capability Negotiation — G1 evidence register (IDEA-0068)

Evidence register for `rfc/ideas/IDEA-0068-cognitive-capability-
negotiation.md`: two cognitive agents meet and agree on the protocol
dialect they share — exactly as TLS negotiates cipher suites and USB
negotiates descriptors — plus a discovery surface ("who can verify
this?"). The prototype implements: versioned capability descriptors
(semver), deterministic dialect negotiation with fallback, feature
intersection, and discovery queries.

## 1. Protocol-version negotiation — the TLS model

| Evidence | Source |
| --- | --- |
| TLS 1.3 negotiates the protocol version explicitly: the client offers `supported_versions`, the server selects one; a downgrade sentinel protects against version-rollback attacks; parameters (cipher suites, extensions) are negotiated in the same exchange | RFC 8446 §4.1.2–4.1.3 |
| Negotiation is a *choice of dialect*, not a discovery of truth: both endpoints keep operating rules for the selected version and no other | RFC 8446 (handshake semantics) |

**Corpus anchor:** `src/workspace-manifest/negotiation.ts` already
implements the workspace-level case — `negotiate()` intersects
requested capabilities/drivers with what the runtime provides, and
`negotiateVersion()` selects a compatible runtime version. IDEA-0068
generalizes this one level down (cognitive capabilities: memory
schemas, signal ABIs, genome versions) and one level up (dynamic
discovery queries).

## 2. Capability declaration — the USB descriptor model

| Evidence | Source |
| --- | --- |
| USB devices declare their capabilities as a tree of descriptors (device → configuration → interface); the host selects a configuration and the endpoints it supports; unknown capabilities are simply not used | USB 2.0 Specification §9.6 |
| GATT follows the same pattern at the service level: services and characteristics are discovered by UUID, and clients use only the subset they understand | Bluetooth Core 6.0 (GATT discovery) |

**Corpus anchor:** `src/cognitive-plane/protocol/capability-protocol.ts`
declares capabilities with id, version, signals, dependencies, and a
lifecycle stage — the descriptor model already exists in embryo; the
negotiation state machine does not.

## 3. Variant selection — HTTP content negotiation

| Evidence | Source |
| --- | --- |
| HTTP negotiation is deterministic selection among declared variants: the client states preferences (Accept headers), the server selects the best representation, or 406 with no acceptable variant | RFC 9110 §12 |
| The "no acceptable variant" case is a first-class outcome, not an error path | RFC 9110 §12.5.1 |

**Corpus anchor:** the prototype mirrors this with an explicit
`status: 'none'` outcome — negotiation failure is a verdict, and the
fallback rule (major-compatible dialects) corresponds to Accept-range
semantics.

## 4. Agent capability discovery — modern agent protocols

| Evidence | Source |
| --- | --- |
| A2A (agent-to-agent) defines an agent card: a machine-readable declaration of an agent's capabilities that clients fetch to decide whether and how to connect; discovery precedes negotiation | A2A Protocol Specification (agent card) |
| MCP servers advertise tools, resources, and prompts at handshake; the client discovers the server's surface before invoking anything | Model Context Protocol 2025-06-18 specification |
| FIPA ACL formalized communicative acts including propose/accept-proposal as first-class message types in agent communication | FIPA ACL (2002) |
| OAuth 2.0 servers publish a discovery document (issuer, endpoints, scopes) so clients can discover capabilities without out-of-band configuration | RFC 8414 |

**Corpus anchor:** discovery today is static registry lookup +
hardcoded routing (EI layer lookups, routeToExpert); the corpus has no
queryable "who can verify/optimize/simulate" surface. The prototype's
`findProviders` query (requires-features + domain tags) is the
declarative half; wiring it into the capability registry and CQL
(IDEA-0057) is the follow-up.

## 5. Authority semantics — capability-based security

| Evidence | Source |
| --- | --- |
| In capability-based systems, possession of a capability IS the authority; negotiation establishes *what dialect* two parties share, while grants establish *what the agent may do* — the two must not be conflated | Capability security model (ANSI capability; EROS/KeyKOS lineage) |
| Downgrade protection: a party must not silently fall back to an insecure dialect; fallback must be explicit and observable | RFC 8446 (downgrade sentinel) |

**Corpus anchor:** ADR-001 already separates discovery from action
authority ("discovery does not grant action authority") — the
negotiation prototype preserves this: a negotiated dialect confers no
grants; `src/cognitive-runtime/capability-registry` remains the sole
authority source.

## Prototype claims

- Deterministic: identical offers + supported sets produce identical
  outcomes (ledger-replayable).
- Monotone: adding a feature to a descriptor never removes a
  negotiated capability.
- Fallback: same-major dialects negotiate with `fallback` status;
  different-major yields `none` (explicit, never silent).
- Discovery: `findProviders` answers "who can X" declaratively.
