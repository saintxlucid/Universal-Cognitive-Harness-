# IDEA-0126 — Cognitive Linker + Cognitive Loader

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 cognitive-runtime-standard intake (round 18) —
  "Don't load plugins. Link cognitive objects: Security.cog +
  Architecture.cog + Research.cog + Memory.cog → Running Organism.
  Exactly like a linker." And the loader: "When Claude opens a
  project, UCH doesn't load everything. It loads the required
  cognitive modules. Demand paging for intelligence."
- **Related:** IDEA-0125 (.cog + CBI — the objects to link and the
  compatibility contract checked at bind time), WS-P (package gate —
  validation precedes linking), IDEA-0019 (cognitive operating
  contracts — the surfaces satisfied at link), vmem WS-B + IDEA-0029
  (cache ladder — the paging policy for the loader), lazy organ
  getters (WorkspaceBrain — precedent for load-on-first-access),
  IDEA-0091 (morphogenesis — organs developed, not installed),
  IDEA-0045 (CVM — execution after load), IDEA-0117 (execution
  graph — the linked shape), IDEA-0083 (spec repository — object
  sources), IDEA-0058 (marketplace — object supply), ADR-002
  (ledger — governed link/load events)

## Motivation

Packages install; they do not bind. WS-P validates a package's
closure (signature, hash, dependency resolution) and then stops:
nothing turns Security.cog + Architecture.cog + Research.cog +
Memory.cog into one _running organism_. The claim: a link step that
resolves each object's requirements against others' contracts
(IDEA-0019), checks CBI version compatibility (IDEA-0125) at bind
time, binds the op surfaces, and records a governed link event with
provenance; and a load step that activates modules on demand —
"Claude opens a project" → only the required cognitive modules
load, demand-paged through the vmem tiers (hot/warm/cold/archive)
per the cache ladder, not the whole catalog.

## The corpus cannot cover it because

WS-P resolves the dependency closure for validation but has no link
semantics: no contract satisfaction between objects, no op-surface
binding, no CBI compatibility check at bind, no link record. The
plugin loader installs whole plugins. vmem pages _memory_, not
_modules_ — nothing demand-pages cognition itself (lazy organ
getters are per-organ, not per-module-catalog). No artifact binds
Security.cog + Architecture.cog into one organism with a recorded,
ledger-backed link event.

## Proposal sketch

- Link step: resolve requirements vs contracts (IDEA-0019), check
  CBI compatibility (IDEA-0125), bind CP-op surfaces between
  objects, emit a governed link event (provenance into the ledger);
  failed links revert with evidence (Law 12).
- Load step: demand-paged module activation per vmem tiers +
  IDEA-0029 ladder; load on first need, evict by policy, never
  load the whole catalog; the linked graph is the execution shape
  (IDEA-0117) the CVM (IDEA-0045) runs.

## Risk assessment

- Link theater: binding must be consumed — the CVM must execute the
  linked graph, or linking is ceremony. Keep the link record
  ledger-backed and replayable.
- Overlap: must not re-skin WS-P's gate — validation precedes link;
  link is binding, gate is admission.

## Where it lands

- Extends WS-P + IDEA-0125; design doc `design/COGNITIVE-LINKER.md`.

## Code impact

- None until .cog (IDEA-0125) and the CVM promotion; the loader
  reuses vmem eviction policy.

## Next stage

- Prototype binding two toy .cog sections (policy + knowledge) with
  contract satisfaction and a ledger link event; exercise a
  demand-paged load/unload cycle.
