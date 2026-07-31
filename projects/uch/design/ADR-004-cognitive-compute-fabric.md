# ADR-004: Cognitive Compute Fabric — Virtual Processors and Model Virtualization

- **Status:** Accepted — Level 4 (model virtualization) implemented
- **Date:** 2026-07-31
- **Scope:** `src/accelerators/` (scheduler, fabric, virtual-processors)
- **Precedent:** ADR-001 (workspace-owned runtime), ADR-002 (trace model), ADR-003 (engineering intelligence)

## Context

The long-term architecture of UCH is a **Cognitive Computer**: the connected
LLMs are execution cores, the Exoskeleton is the hardware platform, the Brain
is the operating system, and the scheduler allocates cognition (see
`docs/` vision corpus). Level 2 — the cognitive scheduler — already existed
(`src/accelerators/scheduler.ts`): it decides the *execution strategy*
(deterministic / cached / small / large / multi-model / human approval) from a
cognitive profile.

What did **not** exist was Level 4 — model virtualization:

1. There was no **virtual processor namespace**. Requests could not say
   "route this to `reasoning.cpu`" or "this is a security question — use the
   security processor."
2. Provider selection was **health/latency-only**. The fabric picked the
   fastest healthy provider regardless of whether the task needed deep
   reasoning, cheap classification, or verification across independent
   models. No cognitive affinity, no capability tiers.
3. There was **no model-level control**. Each provider was bound to one model
   at construction; the kernel could not say "use the tiny model" vs "use the
   deep model."
4. Multi-model verification was advisory only — the scheduler never said
   *which* providers should be consulted.

## Decision

Adopt the **virtual processor model** as the fabric's routing contract:

1. **Virtual processor registry** (`src/accelerators/virtual-processors.ts`,
   pure and deterministic): ten virtual CPUs — `reasoning.cpu`, `memory.cpu`,
   `engineering.cpu`, `security.cpu`, `creativity.cpu`, `planning.cpu`,
   `research.cpu`, `reflection.cpu`, `classification.cpu`, `embedding.cpu`.
   Each declares an affinity vector over the cognitive profile, a minimum
   capability tier, and a default tier. `resolveVirtualCpu(profile)` performs a
   weighted affinity match; flat profiles land on `classification.cpu` (the
   frugal home).

2. **Capability tiers** (`tiny | standard | deep`) on both sides of the
   boundary: a profile demands a tier (`requiredTier` mirrors the scheduler's
   existing thresholds so strategy kind and tier never contradict), and each
   provider declares a **model roster** (`ProviderModel[]`) — the models it
   can serve per tier, with a cost rank. `tiny` = cheap/fast models, `deep` =
   strongest reasoning models.

3. **Deterministic provider selection** (`resolveProvider`): the cheapest
   healthy provider that serves the *exact* required tier wins; exact-tier
   providers outrank cheaper-but-wrong-tier ones; consecutive failures, cost
   rank, then latency break ties. Verification-demanding profiles
   (`verificationNeeded >= 0.6`) return up to **three independent providers**
   (Level 6 debate substrate). Empty/unhealthy rosters degrade deterministically
   to the existing fabric fallback — routing is a hint, never a hard failure.

4. **Per-call model override** end-to-end: `CompletionParams.model` flows
   through every driver (OpenAI, Anthropic, Google) and both fabric adapters
   (LLM client, OpenAI-compatible). The kernel's chosen model reaches the wire.

5. **Scheduler integration**: `CognitiveScheduler.plan()` now attaches
   `virtualCpu`, `tier`, `preferredProviderId`, `model`, and `providerCount` to
   every `ExecutionStrategy`. The strategy remains deterministic and
   serializable. `dispatch()` passes the routing decision to the fabric, which
   prefers the chosen provider but still fails over through health-ordered
   retries — preserving the existing resilience contract.

6. **No new runtime dependencies.** `openai` + `@opentelemetry/api` remain the
   only runtime deps (constraint C1).

## Consequences

**Good:**
- The fabric claim becomes real at the execution boundary: "deep reasoning"
   → `reasoning.cpu` → cheapest healthy deep-tier provider → deep model.
- Frugality is now structural: `tiny` profiles never touch deep-only
   providers; the router's primary key is cost, bounded by capability.
- Strategy outputs are auditable: every plan records *what* it thought and
   *where* it routed.
- Providers become hot-pluggable: a new vendor only registers a roster.

**Costs / risks:**
- Default rosters name concrete models (gpt-4o-mini, claude-3-5-haiku-latest,
  llama-3.3-70b, …). Model names churn; a stale name degrades to provider
  failure + fallback, never a crash. Rosters are per-provider data, not code.
- Multi-model `providerCount` is advisory: actual fan-out with merge is Level 5
  (parallel thinking) — deliberately out of scope here.
- `resolveProvider` trusts the roster snapshot; a lying provider
  (declares deep, answers shallow) is caught only by downstream evaluation
  (ADR-003 engineering intelligence, Organic Score).

## Alternative considered

**Expose models directly (status quo ante).** Rejected: couples callers to
vendor churn, kills frugality routing, and prevents capability-based placement.

**One LLMClient per model at registration.** Rejected: model-per-call override
is one optional field per driver; per-client registration multiplies probes,
health state, and warm-up cost.

## Status table

| Level | Status |
|---|---|
| L1 fabric, L2 scheduler, L3 coprocessors (accelerators) | ✅ pre-existing |
| **L4 virtual processors + routing (this ADR)** | ✅ implemented 2026-07-31 |
| L5 parallel fan-out with merge | ⏳ frontier — needs `providerCount` execution |
| L7 speculative thinking / L8 predictive compilation | ⏳ design sketch only (budget-gated) |
| L9–L17 | ✅ pre-existing (context compiler, cache, vmem, hypervisor, bus, kernel API, pipelines) |

## Verification

- `src/__tests__/virtual-processors.test.ts` — 26 tests: registry, affinity
  determinism, tier requirements, provider ranking (cost / exact-tier /
  failures / verification multi-provider), scheduler integration, dispatch
  routing, serializable strategies.
- Routing contract edge cases resolved during implementation:
  - An **empty profile** (no cognitive signal) routes to `classification.cpu`
    — the frugal default home — never to `reasoning.cpu` via default-profile
    affinity.
  - `memory.cpu` carries `knowledgeNeeded: 0.8` so knowledge-dominant
    profiles beat `research.cpu` (0.5 knowledge + 0.3 complexity pull from
    the default `complexity: 0.4`).
  - Explicitly all-zero profiles (guarded `bestScore <= 0`) also land on
    `classification.cpu`.
- Existing scheduler suite unchanged and green; full gate: vitest (141 files /
  2231 tests), `tsc --noEmit`, eslint — all exit 0.
