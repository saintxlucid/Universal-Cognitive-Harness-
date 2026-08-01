# IDEA-0100 — Architectural Contracts (Continuous Invariant Verification)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 compatibility-layer intake (round 14) — the
  "uncommon idea": "instead of only testing code: `Authentication must
never depend on UI` or `Payment must always emit audit event` — the
  runtime continuously verifies these architectural invariants." This
  is Layer 8 of the intake's own delta list, alongside the cognitive
  digital twin and continuous understanding.
- **Related:** IDEA-0073 (contracts registry — nine-field behavioral
  contracts, the what-is-promised layer), IDEA-0053 (constitution
  engine — central execute-time enforcement, unbuilt), src/cognitive-
  plane/constitution/constitution.ts (integrity/covenant laws, checked
  at evaluation points), src/engineering-intelligence/ (coupling gate:
  change-amplification + import fan-out — advisory; enrichment watchers
  on git:commit/file:saved — evaluation-on-event), src/kernel/
  constitution/code-governance-gate.ts + organic-score.ts (veto
  machinery), src/workspace-graphs/ (knowledge/decision/task graphs —
  the structural substrate), IDEA-0022 (architecture review board),
  IDEA-0012 (digital twin — the invariant checker's scenario host)

## Motivation

The corpus verifies _on events_: EngineeringEnrichment runs the
deterministic evaluator when a commit/file-save fires; organic-score
vetoes SPOF smells; the coupling gate warns at thresholds. All of
these are **advisory or single-shot evaluations of a snapshot**. The
intake's claim: architectural rules are _persistent properties_ — a
declared invariant ("auth must never depend on ui", "payment must
always emit audit event") holds _continuously_ across every change,
and violation is an enforced gate event, not a review finding. The
difference is the same as unit tests vs. type checking: one runs when
you remember, the other is a property of every edit.

## The corpus cannot cover it because

- IDEA-0073 registers behavioral contracts (guarantees about
  behavior), but there is no **structural-invariant DSL** and no
  checker that runs on the workspace graphs. "Auth must never depend
  on UI" is a _reachability property_ over the dependency graph
  (workspace-graphs knowledge graph): does a path exist from an auth
  node to a UI node? "Payment must always emit audit event" is an
  _event-flow property_ over the task/event graph: does every payment
  task produce the audit event? Neither query is specified or
  implemented.
- Enforcement is scattered (constitution evaluation points, EI
  enrichment, organic-score vetoes); there is no central gate where a
  declared architectural invariant escalates with the same authority
  as a constitutional veto (IDEA-0053's central enforcement point is
  the natural home — and it is unbuilt).
- The graphs exist but are query surfaces, not property-checked: no
  mechanism watches graph mutations for invariant violations and emits
  a first-class event.

## Proposal sketch

- **Invariant DSL (v1)**: two property classes — `reachability` (node
  kind A must/must never reach node kind B via `touches`/`depends_on`
  edges) and `event-flow` (event kind E must always follow action kind
  A within a declared window/tick budget). Declarations live in the
  contracts registry (IDEA-0073) with provenance (who declared, when,
  evidence) and an explicit veto-vs-advisory severity.
- **Continuous checker**: subscribes to graph mutations (file:saved,
  git:commit, task status changes) and re-verifies affected invariants
  deterministically (graph traversal, no LLM); violations emit a
  first-class event (`invariant:violated`) that escalates through the
  same machinery as organic-score vetoes (engineering veto list) —
  veto-grade invariants block, advisory-grade invariants surface in
  the observatory (IDEA-0014) and review board feed (IDEA-0022).
- **Scenario host**: the checker doubles as the digital twin's safety
  net (IDEA-0012) — what-if mutations are replayed against invariants
  before any proposal is accepted.
- **Calibration**: invariant violations are ledgered with evidence
  (trace ids, graph path), so false positives are auditable and the
  DSL can be tightened — deterministic, replayable, never LLM-judged.

## Risk assessment

- False positives are the killer: a reachability rule on a noisy
  dependency graph will fire constantly — the DSL needs explicit path
  depth limits, scopes (module/subgraph), and exclusion lists, and the
  first corpus of invariants must be curated from real violations.
- Performance: continuous checking must be incremental (only
  invariants touching mutated nodes re-run), mirroring the graph
  updates it watches.
- Authority: veto-grade invariants are powerful — declaration requires
  provenance and review (IDEA-0022), never silent self-declaration by
  an agent.

## Where it lands

- `src/contracts/invariants/` (DSL + checker over workspace-graphs),
  registry extension (IDEA-0073), escalation wiring (event bus +
  engineering veto list), observatory surface.

## Code impact

- None until designed; seeds are workspace-graphs, contracts registry,
  engineering enrichment, organic-score veto machinery.

## Next stage

- Prototype: two invariants over a real repo graph — "auth never
  reaches ui" (reachability) and "commit always emits test event"
  (event-flow) — with a curated false-positive pass and veto
  escalation test.
