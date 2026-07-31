# ADR-005 — Universal Cognitive Protocol: Episodes, Integration Levels, Live Cognitive State

- **Status:** Accepted
- **Date:** 2026-07-31
- **Amended:** 2026-08-01 ([Amendment A — terminology reconciliation + new mechanisms](#amendment-a--2026-08-01))
- **Scope:** Substrate/driver naming, the three-layer split, Episode canonicalization, the
  L0–L4 integration ladder, the Live Cognitive State artifact, and the driver triad
  (observe · translate · augment)
- **Prerequisites:** ADR-001 (Workspace-Owned Cognitive Runtime), ADR-002 (OTel Trace Engine),
  [EXOSYMBIOSIS.md](EXOSYMBIOSIS.md), [UNIVERSAL-INTEGRATION.md](UNIVERSAL-INTEGRATION.md)

## Context

The core purpose of UCH — clarified by the founding design conversation (2026-07-31) — is:

> UCH must never try to replace the coding agent. It is the persistent cognitive substrate
> that every coding agent temporarily wears. The individual agents remain interchangeable;
> the cognition, memory, identity, and accumulated engineering knowledge remain continuous.

The current ecosystem already exposes extension points everywhere (VS Code extensions,
MCP servers, CLI integrations, plugins, hooks, workspace context, skills, agent SDKs),
but none of them provides a persistent cross-agent identity, memory, or cognition. The
existing corpus (MANIFESTO, ADR-001, EXOSYMBIOSIS, UNIVERSAL-INTEGRATION, ADR-002, CIC)
already establishes: workspace-owned intelligence, the hive-mind capture rails, the OTel
trace model, and the operation contract. What is missing is the **Universal Cognitive
Protocol** — the single format everything is translated into — and the contracts that make
it self-classifying per platform:

1. No explicit three-layer naming: Cognitive Core / Harnesses / Universal Cognitive
   Protocol.
2. No canonical host-neutral unit for a cognitive session (Claude calls it a
   Conversation, Codex a Session, Copilot an Agent Run, OpenCode a Session — UCH must call
   all of them one thing).
3. No capability-level integration ladder. Not every platform exposes the same internals;
   a universal harness must gracefully degrade rather than assume privileged access.
4. No first-class "Live Cognitive State" artifact. The vision's core distinction is:
   synchronize **mind state**, not chat history. Conversation is history; mind state is
   the present.
5. No formal harness responsibility triad (observe / translate / augment) or its
   deterministic augmentation engine (the Cognitive Coprocessor).
6. No explicit scaling model for long-horizon cognition (Cognitive Virtual Memory —
   working-set paging).

Hidden chain-of-thought is intentionally unavailable across providers; every decision
below is built exclusively around **observable artifacts**: plans, tool calls, actions,
intermediate outputs, verification steps, and explicit summaries (consistent with
EXOSYMBIOSIS §4 COT tier ladder and the privacy posture of `PRIVACY-ERASURE.md`).

## Decision

### 1. Substrate runs Harnesses

The project name remains UCH, but the architecture is documented as:

```text
Universal Cognitive Substrate   — the persistent runtime (what exists today:
                                    kernel, brains, organs, memory, genome, ledger)
running Universal Cognitive Harnesses — per-ecosystem adapters (VS Code, Claude Code,
                                    Codex, Copilot, OpenCode, Cursor, future hosts)
```

The substrate is always alive; harnesses are adapters. This is a naming and boundary
clarification of ADR-001, not a rename of code.

### 2. The three-layer split

| Layer | Responsibility | Must never know |
|---|---|---|
| **Layer 1 — Cognitive Core** | Signals, thoughts, plans, actions, evidence, memory, skills, identity, genome | Any host (VS Code, Cursor, Codex, Claude, Copilot) |
| **Layer 2 — Harnesses** | Understand that application's APIs only; one per ecosystem | The substrate's internals |
| **Layer 3 — Universal Cognitive Protocol** | Translate everything into one format | Where the episode originated |

The Brain never cares where the episode originated.

### 3. Episode canonicalization

- The **Episode** is the canonical host-neutral cognitive session unit of the Universal
  Cognitive Protocol. Claude's Conversation, Codex's Session, Copilot's Agent Run,
  OpenCode's Session, and a future host's equivalent all map to **one Episode**.
- Episode identity: `episode_id = sha256(workspace_id | host | native_session_id |
  session_start_ts)` — stable, host-neutral, collision-resistant.
- Every Episode carries an **episode hash** — a content fingerprint over the episode's
  cognitive trace — for integrity verification and deduplication.
- Kernel `Episode` records (`src/kernel/types/episode.ts`) remain the fine-grained
  *memory* unit. The protocol-level Episode is the *session* unit. The two layers are
  explicit: one protocol Episode contains many kernel Episode records.
- A `handoff` event merges two protocol Episodes into one continuing cognition stream
  (the Cognitive Synchronization Engine: the Brain already knows, no chat copying).

### 4. Integration Levels L0–L4

Every platform participates at the level it actually exposes, per rail, with graceful
degradation — the full contract is [INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md):

| Level | Capability | Available almost everywhere |
|---|---|---|
| **L0 – Workspace** | Filesystem, Git, diagnostics, build/test events | Available almost everywhere |
| **L1 – Session** | Session lifecycle, prompts, explicit plans, checkpoints, accepted edits | Several IDE agents |
| **L2 – Tooling** | MCP tools, terminal commands, external integrations | Growing via MCP |
| **L3 – Cognition** | Structured cognitive traces (goals, decisions, evidence, verification, lessons) — provider-agnostic, created by UCH | Created by UCH itself |
| **L4 – Native** | Deep platform-specific integration (extensions, plugins, hooks, agent SDKs) | Vendor-dependent |

Levels are cumulative but **per-rail**: a platform may be L4 on hooks and L0 on COT.
Never assume a level; a harness declares what it achieves and degrades to the highest
declared level per capability.

### 5. Live Cognitive State

"Don't synchronize conversations. Synchronize **mind state**." The Live Cognitive State
is a first-class artifact: the current cognition of the organism (goal, intent,
confidence, obstacles, active files, working set, hypotheses, pending decisions,
decisions made, risks, verification status, energy, focus) with a continuation
traceparent. Any agent joins instantly. Full schema and lifecycle:
[LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md).

### 6. The harness triad and the Cognitive Coprocessor

Every harness has exactly three responsibilities:

1. **Observe** — everything the host exposes through official surfaces (hooks, plugins,
   transcripts, OTel, SDK events). Never scrape. Never hack. This keeps UCH durable as
   platforms evolve.
2. **Translate** — every native signal becomes a Universal Cognitive Event / Episode.
   The Brain only speaks the protocol.
3. **Augment** — inject back: genome, engineering standards, workspace memory, past
   architecture decisions, lessons, open hypotheses, active risks, taste, policies.

The **Cognitive Coprocessor** is the deterministic runtime that performs Augment — it
runs between the host's prompt and the model, asking internally ("Have we done this
before? Known mistakes? Standards? Security? Benchmarks?") and injecting only the useful
parts. It is never an LLM and never reads hidden chain-of-thought.

### 7. Cognitive Virtual Memory

Working-set paging is the scaling model for long-horizon cognition: only the current
working set is resident; everything else is paged, exactly like RAM. Design-level
guidance is added to [RETRIEVAL-SCALING.md](RETRIEVAL-SCALING.md); implementation is
deferred until trigger metrics are met (context pressure, page-in latency).

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Rename the project to "Universal Cognitive Substrate" | Churn without value; the distinction is documented, not branded |
| Capture full conversation logs as the primary memory | Chats are the least valuable artifact; intent + observable artifacts are the gold (consistent with ADR-002) |
| Build around hidden chain-of-thought | Not exposed by hosted providers; brittle and non-portable |
| One integration level per platform | Level must be per-rail; a platform is L4 on hooks and L0 on COT simultaneously |
| Harness as plugin/extension/MCP server | Those are carriers of the protocol, not the protocol itself |

## Consequences

- **Positive.** The M0–M3 hive roadmap (UNIVERSAL-INTEGRATION §8) becomes self-classifying:
  M0 achieves L0, M1 achieves L1–L2, M2 achieves L3, M3 achieves L4. The CIC gains the
  cognitive-state resource. Episode semantics unify hive session identity with kernel
  memory records. No code changes are required by this ADR itself.
- **Negative.** Adds a vocabulary layer (Episode vs session vs kernel episode) that must
  be used consistently in new docs and code; misuse is a review criterion.
- **Risk.** Hosts change their surfaces; the per-rail level table must be re-verified
  when a platform ships a new extension model (mitigation: the level declaration lives
  in the harness manifest, not in the substrate).

## Verification

- A harness may claim level Ln only when the per-level conformance criteria in
  INTEGRATION-LEVELS.md §5 pass for that rail.
- The Live Cognitive State round-trips: produce (attach/heartbeat) → store
  (`cognitive.state` event) → consume (retrieve/MCP/context injection), with projection
  per grant.
- Episode identity: the same native session re-attached from any host yields the same
  episode_id; a handoff merges episodes into one trace stream (ADR-002 lineage intact).
- The existing suite (141 files / 2,232 tests) stays green — this ADR changes no code.

*Persistent cognition. Replaceable pilots. — The agent is ephemeral; the cognition is
persistent.*

---

## Amendment A — 2026-08-01: Terminology reconciliation (harness → driver) and new mechanisms

### A.1 Terminology reconciliation

The engineering term for the per-ecosystem adapter is **Cognitive Driver**
(product/vision name in parentheses on first reference: "Cognitive Driver
(Universal Cognitive Harness)"). "Universal Cognitive Harness" remains the product
name (UCH) and the umbrella term for the wearable contract; *driver* is the
engineering term for the component, consistent with the existing driver plane
(`src/drivers/`, MANIFESTO §5, `research/interfaces/universal-cognitive-harness.md`
§Driver model).

Effect on the sections above (recorded, not rewritten):

| Earlier term | Now | Where |
|---|---|---|
| "Universal Cognitive Harness" (adapter) | **Cognitive Driver (Universal Cognitive Harness)** | Decision §1, §2 Layer 2 |
| "Substrate runs Harnesses" | Substrate runs **drivers** | Decision §1 |
| "harness triad" | **driver triad** (observe · translate · augment) | Decision §6, Consequences |
| "harness manifest" | **driver manifest** (level claims per rail in the `level_claims` field) | Decision §4, Consequences (Risk) |
| "a harness declares what it achieves" | a driver declares what it achieves | Decision §4 |

All downstream documents use driver terminology: [INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md),
[EXOSYMBIOSIS.md](EXOSYMBIOSIS.md) (reconciliation box), [MANIFESTO.md](../MANIFESTO.md),
[UNIVERSAL-INTEGRATION.md](UNIVERSAL-INTEGRATION.md), and the integration specs.

### A.2 New mechanisms (design documents)

| Mechanism | Document | Contract |
|---|---|---|
| **Cognitive Trace** | [COGNITIVE-TRACE.md](COGNITIVE-TRACE.md) | The canonical recording unit of an Episode: OTel-shaped schema (`uch.cognitive-trace.v1`), organ ownership, and the 8-point driver contract (traceparent propagation, 5C mapping, COT tier honesty, redaction, governance, level claims, retention) |
| **Cognitive Middleware + Cognitive Image** | [COGNITIVE-MIDDLEWARE.md](COGNITIVE-MIDDLEWARE.md) | The governed pipeline (ingress → normalize → validate → gate → persist → synthesize → image → compose → augment) and the Cognitive Image cache: a read-optimized, per-grant, regenerable projection that makes attach O(1) |
| **Cognitive Packages** | [COGNITIVE-PACKAGES.md](COGNITIVE-PACKAGES.md) | The distributable unit (driver/skill/policy/instrument) with manifest `uch.package.v1` and the package gate: signed, scoped, capability-intersected, vetoable, revocable, audit-logged install |

### A.3 Normative additions

- **Law 19 — Cognition Ownership** added to
  [LAWS_OF_COGNITIVE_PHYSICS.md](../spec/LAWS_OF_COGNITIVE_PHYSICS.md): the organism
  owns every cognitive artifact; drivers, packages, and hosts hold grants, never
  ownership. Enforced at the trace boundary (COGNITIVE-TRACE §3) and the package
  gate (COGNITIVE-PACKAGES §4).
- **Constitution Article III §6 — Session Privacy** added to
  [CONSTITUTION.md](../spec/CONSTITUTION.md): session cognition is
  consolidation-only visible; raw session traces are private except by consent,
  judicial order, or explicit user request.
- **Live Cognitive State extended fields** added to
  [LIVE-COGNITIVE-STATE.md](LIVE-COGNITIVE-STATE.md): `cognitive_load`,
  `memory_pressure`, `architecture_drift`, `learning_velocity`, `trust_score` —
  additive, forward-compatible (schema stays `uch.cognitive-state.v1`).
- **Driver manifest field** `level_claims` (per-rail integration levels) defined in
  [INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md) §4, extending the driver manifest
  contract.

### A.4 Verification (Amendment A)

- Grep consistency pass on harness/driver terminology across `design/`, `spec/`,
  and `docs/`: adapter usages read "driver"; "harness" remains only as the product
  name (UCH) and the umbrella wearable contract.
- The three new design documents link into the protocol corpus without circular
  dependencies; the index (docs/README.md, docs/UCH-COMPLETE-INDEX.md) lists them.
- No code changes are required by this amendment; the existing suite stays green.
