# PROPOSED-LAW-OWNERSHIP-OF-COGNITION.md — Candidate Law (Proposal)

- **Status:** Proposed — NOT enacted
- **Date:** 2026-08-01
- **Process note:** Per the manifesto's Level 0 rule, purpose and law changes are
  *"not amendable by policy; amendable only by the community that lives in this
  workspace."* This document is the proposal; adoption is a community decision, not a
  code change. The spec source explicitly required this routing rather than direct
  amendment.

## 1. The candidate law

> **No application shall own cognition. Applications own interfaces. Models own
> inference. UCH alone owns identity, memory, learning, and cognitive continuity.**

## 2. What it asserts

- Applications (Claude Code, Codex, Copilot, IDEs, agent frameworks) own their
  interfaces to the user; they are interchangeable consumers.
- Models own inference — the momentary act of generating a response.
- UCH owns everything that persists across models and applications: identity, memory,
  learning, and cognitive continuity. An application that accumulates memory or
  identity *is* a UCH implementation, whether it knows it or not.

## 3. Relationship to existing law and ADR-001

This is a restatement of ADR-001's thesis ("the workspace owns the intelligence; the
agent borrows it") and the manifesto's core purpose — it **conflicts with nothing**
already enacted. Verified against `spec/LAWS_OF_COGNITIVE_PHYSICS.md` and
`spec/CONSTITUTION.md` on 2026-08-01: no existing law asserts application ownership of
cognition (and none contradicts it).

| Existing law | Relationship |
|---|---|
| Law 1 — Signal Universality | Consistent: signals flow to the substrate, not to app-private stores |
| Law 12 — Reversibility | Consistent: continuity requires a single persistent state |
| Constitution integrity laws | Orthogonal: information integrity governs content, this governs custody |

## 4. What changes if adopted

- A hard boundary for the Driver Plane: drivers capture and translate; they never
  retain cognition locally by design.
- A yardstick for the "Cognitive Hypervisor" discussion: per-agent working state is a
  *borrowed* view, never an owned one.
- A marketing/positioning anchor for the spec-first packaging: the law is the product
  boundary between UCH and everything else.

## 5. What does not change

- No organ, plane, or schema changes. This is a law, not an architecture item.
- Nothing about what applications may do with their own user data; it constrains
  *cognition owned by the organism*, not application behavior in general.

## 6. Decision path

1. Review against `LAWS_OF_COGNITIVE_PHYSICS.md` by the community process that governs
   the Laws.
2. If adopted: add verbatim to the Laws with the adoption date and this proposal as
   provenance.
3. If declined or amended: record the decision here for the audit trail.
