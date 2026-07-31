# Phase 03: Engineering Physiology — Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Source:** User vision statement (Artificial Engineering Nervous System) + conformance audit of the existing UCH codebase + user selections (plan-phase, P1 prototype first, design doc)

<domain>
## Phase Boundary

Close the gap between "an AI with review gatekeepers" and "an engineering organism."
The conformance audit (2026-07-31) found the UCH project already ships ~70% of the
AENS vision:

| Vision | Already shipped |
|---|---|
| Reflex signal layers + interrupts | `src/nervous-system/` (peripheral→cortex, `blockOnMatch`, entropy reduction) |
| Instinctive action selection | `src/basal_ganglia/action-selector.ts` |
| Cortices | `src/cortex_kernel/` (attention/executive/understanding + meta-brain) |
| Engineering Judgment | `src/kernel/constitution/engineering-judgment.ts` (catches `UserManager2`, dependency-risk, missing-verification) |
| Organic Code Engine | `src/kernel/constitution/organic-score.ts` (15 metrics, >=90 gate, constitutional vetoes) |
| Constitution (14 laws) | `src/kernel/constitution/` (coding-principles, coding-guidelines, epistemology) |
| Memory taxonomy | `src/hippocampus/`, `src/mnemosyne/`, `src/cognitive-memory/` |
| Genome fingerprint | `src/workspace-graphs/workspace-dna.ts` (per-workspace sha256 + mutation tracking) |

The genuine delta this phase ships — six subsystems that do NOT exist:

1. **Reflex Gate (P1, prototype-first)** — hard pre-write interrupts on the
   coding path. Today the nervous system is signal infrastructure and
   organic-score runs at *review* time. Nothing hard-interrupts the write path
   (file-editor / command-runner / diff-review) *before* generation/application.
   The vision's core claim — "No model bypasses reflexes. Ever." — is absent.
2. **Counterfactual Engine (P2)** — five-futures evaluation of any proposed
   change (debt / security / scale / maintainability / preferred), scored by
   the existing engines plus deterministic heuristics.
3. **Taste Engine (P3)** — elegance scoring *learned from episodic outcomes*
   (accepted vs reverted PRs), not lint rules.
4. **Genome Evolution (P4)** — WorkspaceDNA extended so it *mutates from
   outcomes* (merge / bug / rollback / outage) and is *inherited* by connected
   agents through the existing projection mechanism.
5. **Pain Memory (P5)** — affect-weighted episodic records: production
   outages and hard failures become "traumatic events" that permanently bias
   reflex verdicts around the affected zones.
6. **Prediction Cortices (P6, cross-cutting)** — performance/security/product
   checks that run *before* code exists, as part of the reflex+judgment
   pipeline, not post-hoc scans.

All six must reuse the existing event bus, nervous-system signals, graph
stores, and branded types. No new runtime dependencies. The reflex layer is
LLM-free and deterministic (milliseconds); LLM scoring is allowed only above
the reflex layer (judgment/consciousness tiers).
</domain>

<decisions>
## Implementation Decisions

### D-01: Subsystem layout
- Create `src/reflex/` — the Reflex Gate: registry of deterministic checks,
  verdict types, and the gate itself.
- Create `src/physiology/` — the slow, strategic tier: counterfactual engine,
  taste engine, pain memory (affect-weighted episodic store).
- Genome evolution extends the existing `src/workspace-graphs/workspace-dna.ts`
  (`WorkspaceDNA`); do NOT create a parallel DNA module.
- Prediction cortices are compositors over reflex checks + judgment + taste,
  not new standalone engines with duplicate logic.
- Locked: one cohesive physiology layer; no spread across unrelated dirs.

### D-02: Reflex Gate is a HARD pre-write gate
- Interception points: `src/coding/file-editor.ts`, `src/coding/command-runner.ts`,
  `src/coding/diff-review.ts`, `src/coding/coding-skills.ts` (as applicable).
- Verdicts: `allow | block | defer`. `block` rejects the change before any
  write; `defer` routes to the judgment/consciousness tier.
- The gate honors an explicit escape hatch (env/config + named override) for
  emergencies, but the default is on and violations are recorded, not
  silently skipped.
- Locked: reflex verdicts emit `nervous-system` signals and are recorded to
  the event bus (observability + learning).

### D-03: Reflex checks are LLM-free and deterministic
- Duplicate abstraction: query the existing `WorkspaceDecisionGraph` /
  `WorkspaceKnowledgeGraph` (node + edge lookups, ownership boundaries).
- Dependency duplication: dependency inventory vs graph artifacts.
- Complexity threshold: cyclomatic/line thresholds (no model).
- Ownership/boundary: `WorkspaceManifest` grant + `ProjectionEngine` scopes.
- Style/pattern drift: constitutional pattern registry.
- Locked: zero model calls in the reflex path; every check returns a
  deterministic verdict with evidence (node ids, rule id, threshold hit).

### D-04: Reuse existing infrastructure
- Signals + interrupt levels from `src/nervous-system/signal.ts`
  (`blockOnMatch`, `InterruptLevel`).
- Events from `src/event-bus/neural-event-bus.ts` — no new event types.
- Persistence via `Storable`/`writeSnapshot`/`readSnapshot` from
  `src/cognitive-plane/persistence/persistence-engine.ts`.
- Branded types from `src/shared/branded-types.ts`.
- Locked: no new runtime dependencies (runtime dep count stays exactly 1: `openai`).

### D-05: Counterfactual Engine — five futures
- Each future (debt / security / scale / maintainability / preferred) is
  scored by existing deterministic engines first (organic-score metrics,
  judgment rules, security rule set, complexity metrics, constitution
  alignment).
- Output: `FutureVerdict[]` with scores + evidence + a recommended future.
- LLM futures are optional and gated above the reflex tier; determinism is
  the contract for the default path.
- Locked: the engine never generates one answer — it always explores the
  five futures and picks by constitution alignment, not by likelihood alone.

### D-06: Taste Engine — learned elegance
- Scores elegance (0-100) alongside the organic score.
- Learns from episodic outcomes: accepted PRs raise weights for their
  patterns; reverted/regressed changes lower them.
- Cold-start mode: deterministic heuristics (naming quality, abstraction
  balance, structure symmetry) until enough episodes exist.
- Locked: taste weights persist via `Storable` and are workspace-scoped.

### D-07: Genome evolution + inheritance
- `WorkspaceDNA` gains outcome-driven mutation: merge → +stability alleles;
  bug/rollback/outage → +caution alleles (increased reflex strictness in the
  affected zones).
- Genome versioning: each mutation increments a version; snapshots are
  retained (evolution history).
- Inheritance: connected agents receive the current genome through the
  existing `attach`/projection path (`src/workspace-manifest/attach.ts`),
  NOT a new channel.
- Locked: DNA fingerprint remains the identity; alleles are an additive
  layer, never a fork.

### D-08: Pain memory — affect-weighted episodic store
- Records "trauma events" (production outage, data loss, security incident,
  hard test regressions) with a decay-resistant affect weight.
- Reflex checks consult pain memory: zones with high affect weight get
  stricter thresholds permanently (e.g., file under outage zone blocks new
  unverified writes).
- Locked: pain memory is part of `src/physiology/`, persisted via `Storable`,
  and read by the reflex layer WITHOUT model calls.

### D-09: P1 Reflex Gate ships first as the prototype
- Plan 03-01 is the Reflex Gate prototype: end-to-end thin slice (gate →
  one real check → one interception point → signal + record) proven before
  the full check registry is built.
- User decision: prototype first, then broaden; the other plans depend on
  the gate's shape proven in 03-01.
- Locked: 03-01 must be independently verifiable (its own tests) and must
  not require any other plan to be implemented first.

### D-10: Testing contract
- All reflex/physiology tests are deterministic, LLM-free vitest tests in
  `src/__tests__/`, following the temp-dir lifecycle
  (`mkdtempSync` + close + rmSync) — zero filesystem residue.
- Every plan must encode its contracts in tests BEFORE implementation
  (TDD wave pattern established in phase 01).
- Gate checks: full suite + `tsc` + build must stay green; no test may be
  altered that is not in the plan's `files_modified`.
- Locked: no test may call a provider API; no fixture may contain secrets.

### D-11: Phase deliverable documents
- A design doc `projects/uch/design/ENGINEERING-PHYSIOLOGY.md` is produced
  in this phase (user decision: design doc alongside plans), describing the
  full physiology layer and its mapping onto the shipped subsystems.
- The vision-conformance doc is updated with the new claims.
- Locked: design doc precedes execution; it is the contract for the phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reflex + signal infrastructure
- `src/nervous-system/signal.ts` — Signal, InterruptLevel, NervousSystemLayer, blockOnMatch semantics
- `src/nervous-system/nervous-system.ts` — layer config, escalation, entropy reduction

### Write path interception points
- `src/coding/file-editor.ts` — write operations to gate
- `src/coding/command-runner.ts` — command execution to gate
- `src/coding/diff-review.ts` — diff acceptance to gate
- `src/coding/coding-skills.ts` — skill-level entry points

### Graphs + DNA (reflex evidence + genome)
- `src/workspace-graphs/workspace-dna.ts` — WorkspaceDNA, mutation tracking (P4 extension point)
- `src/workspace-graphs/` — knowledge/decision/task graphs (reflex evidence source)
- `src/workspace-manifest/attach.ts` — attach/projection path (P4 inheritance channel)

### Judgment + scoring engines (counterfactual/taste inputs)
- `src/kernel/constitution/engineering-judgment.ts` — EngineeringJudgmentEngine
- `src/kernel/constitution/organic-score.ts` — OrganicScoreEngine, 15 metrics, vetoes

### Persistence + events
- `src/cognitive-plane/persistence/persistence-engine.ts` — Storable, writeSnapshot, readSnapshot
- `src/event-bus/neural-event-bus.ts` — event types; no new event types (D-04)

### Prior phase context
- `planning/01-organism-organs/01-CONTEXT.md` — graph/DNA conventions this phase extends
- `planning/01-organism-organs/01-01-PLAN.md` — TDD plan format to mirror (frontmatter + must_haves + tasks)

</canonical_refs>

<specifics>
## Specific Ideas

- The vision's canonical reflex examples MUST be covered by real checks in
  the registry: `UserManager2` duplicate abstraction, duplicate dependency,
  400-line function complexity, ownership-boundary violation.
- "No model bypasses reflexes. Ever." — the gate is in the tool layer, so it
  applies regardless of which coding agent connects to the harness.
- Affective memory is not emotions; it is engineering pain: outage zones
  become permanently stricter.
- The five futures of the counterfactual engine map to: Technical Debt,
  Security Risk, Scale, Maintainability, Preferred (constitution-aligned).

</specifics>

<deferred>
## Deferred Ideas

- Emotional memory beyond pain (e.g., reward/celebration weighting) — later phase.
- Muscle memory (keystroke/navigation habit modeling) — requires an
  agent-integration channel; explicitly deferred.
- Cross-workspace collective genome (union/merge of genomes) — phase 04+ frontier.
- Full engineering-department org structure (18 failure-category specialist
  roles as agents) — existing skill catalog covers the knowledge; agent
  org wiring is deferred.
- Enforcement of counterfactual futures (auto-applying future E) — dry-run
  and recommendation only in this phase.
</deferred>

---

*Phase: 03-engineering-physiology*
*Context gathered: 2026-07-31 via user vision + conformance audit + user decisions*
