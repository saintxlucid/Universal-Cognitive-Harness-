# RFC-0001 — Identity

- **Status:** Accepted (specification in spec/GENOME.md; reference implementation in src/workspace-manifest/ + src/cognitive-plane/genome/)
- **Family:** Society (Identity)
- **Related:** Law 10 (Identity Persistence), spec/GENOME.md, design/WORKSPACE-MANIFEST.md, design/ADRs 001/006
- **Date:** 2026-08-01

## Summary

Every cognitive entity — workspace, organism, organ, process, session,
artifact — has an identity that is unique, persistent, verifiable, and
portable across pilots. Identity is what makes "the workspace owns the
intelligence" mechanically true rather than rhetorically true.

## Problem

Today's tools identify sessions, not cognition. When a pilot (IDE, agent,
model) leaves, its identity leaves with it, and with identity goes the
accumulated state. UCH inverts this: the organism carries identity, and the
pilot merely holds a time-limited grant to act on behalf of that identity
(Law 19).

## Normative requirements (current state)

1. **Uniqueness** — identity is a collision-resistant identifier, namespaced
   per entity kind. Implemented: workspace id in the manifest (`uch.manifest.v1`),
   PID namespace in `src/kernel/process/`, trace ids are W3C 32-hex.
2. **Persistence** — identity survives restart, migration, and pilot
   replacement. Implemented: `.uch/uch.manifest.json` + `.uccp/persist/`.
3. **Verifiability** — an identity can be verified by a third party without
   trusting the claimant. Partially implemented: grants and projections carry
   actor + scope; full public-key identity is an open item.
4. **Lineage** — identity carries provenance: an entity's causal history is
   traversable. Implemented: trace ledger, decision graph.
5. **Erasure** — identity can be erased on user demand (Privacy Erasure),
   with the erasure itself recorded. Implemented: design/PRIVACY-ERASURE.md.

## Five Gates verdict

| Gate | Verdict |
| --- | --- |
| G1 Scientific | Pass — identity and continuity are foundational in distributed systems (Lamport), OS process identity, and cognitive science accounts of self |
| G2 Architectural | Pass — Law 10, Law 19; Constitution Article IX §1 (Right to Persistence) |
| G3 Engineering | Pass — manifest schema is versioned; conformance-tested |
| G4 Biological | Pass — GENOME.md three-layer identity (workspace · organism · genome) |
| G5 Economic | Pass — identity is the precondition for every downstream product (certification, marketplace, continuity) |

## Open items

1. Public-key identity + signature verification for third-party claims.
2. Cross-workspace identity federation (collective intelligence horizon) —
   deliberately deferred; must not weaken workspace-local-first (Law 10).
3. Identity migration policy when a workspace is cloned or forked.

## Milestones

- [x] Manifest identity (`uch.manifest.v1`) — done
- [x] PID namespace (ADR-006 Phase A) — done
- [x] Trace identity (W3C trace/span ids) — done
- [ ] Public-key verification — open (G3: needs benchmark)
- [ ] Cross-workspace federation — open (G5: adoption-dependent)
