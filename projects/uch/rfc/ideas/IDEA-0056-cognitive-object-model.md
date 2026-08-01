# IDEA-0056 — Cognitive Object Model (COM)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Phase Ω platform infrastructure) —
  "Windows has COM; UCH needs something similar. Everything becomes
  Memory, Belief, Knowledge, Thought, Decision, Task, Project,
  Architecture, Requirement, Experiment, Simulation, Genome, Skill —
  everything follows the same lifecycle"
- **Related:** WS-D transactional cognition (propose → verify → commit),
  Storable persistence, MANIFESTO §6 (organ contracts), IDEA-0019
  (operating contracts), IDEA-0049 (storage engine), IDEA-0057 (CQL —
  the query surface over the object model), src/neural-fs
  (version-store), ADR-006 (persistence primitive)

## Motivation

Every cognitive object class today has its own store, its own lifecycle,
its own identity scheme: decisions live in a journal, concepts in the
connectome, artifacts in workspace graphs, memories in episodic stores,
the genome in GENOME.md. The claim: one uniform object model — a single
identity scheme, a single lifecycle (observe → propose → verify → commit →
evolve → archive), uniform mutation, versioning, and provenance rules —
shared by every cognitive object class. CQL (IDEA-0057) then queries one
object space instead of a zoo of stores.

## The corpus cannot cover it because

Storable covers per-type persistence; organ contracts cover organs;
WS-D covers transactional state. Nothing unifies the *object* level:
identity, lifecycle states, mutation rules, and provenance fields differ
per class, so no uniform access surface and no cross-class operations
exist.

## Proposal sketch

- COM = identity (stable URN, traceparent-linked), lifecycle state
  machine (proposed → verified → committed → evolved → archived, per
  WS-D semantics), mutation rules (committed objects are immutable and
  versioned; evolution writes new versions with provenance edges),
  uniform access surface.
- Object classes map onto existing stores through the IDEA-0049 storage
  contract; the fabric (IDEA-0050) and UER (IDEA-0047) render the
  cross-object edges.

## Risk assessment

- Abstraction overhead: COM must add value over typed stores, not
  re-skin them. One class (Decision) run through the full lifecycle
  before any breadth, or the model is ceremony.

## Where it lands

- Design doc `design/OBJECT-MODEL.md`; extends IDEA-0049 + WS-D.

## Code impact

- None until identity + lifecycle states are specified.

## Next stage

- Define identity and lifecycle states; run Decision objects through
  propose → verify → commit → evolve → archive end-to-end.
