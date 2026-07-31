# ADR-006 — UCH is a Cognitive Microkernel: separating cognition from inference

- **Status:** Accepted — decision recorded; implementation phases tracked below
- **Date:** 2026-08-01
- **Scope:** Kernel/service boundary, the 12 kernel primitives, the Cognitive Process
  model, cognitive virtual memory, organism versioning, transactional cognition,
  mission statement amendment, standards strategy
- **Prerequisites:** ADR-001 (Workspace-Owned Cognitive Runtime), ADR-002 (OTel Trace
  Engine), ADR-005 (Universal Cognitive Protocol: Episodes, L0–L4, Live Cognitive
  State), [CIC-SPECIFICATION.md](CIC-SPECIFICATION.md), [COGNITIVE-MIDDLEWARE.md](COGNITIVE-MIDDLEWARE.md),
  [RETRIEVAL-SCALING.md](RETRIEVAL-SCALING.md), [MANIFESTO.md](../MANIFESTO.md)

## Context

The founding design conversation (2026-08-01) reconsidered the project's growth
strategy. Instead of making UCH bigger — more organs, more features, more of the
organism inside the runtime — the question was inverted:

> If Apple, Microsoft, Anthropic, OpenAI, Google DeepMind and NVIDIA all sat in one
> room to design the future AI runtime, what would survive for 20 years?

The answer: the layer between **inference** and **agents** — a persistent cognitive
substrate that does not compete with any existing standard and outlives every model
generation. The external protocol landscape (MCP: agent↔tool, A2A: agent↔agent, Agent
Protocol: client↔agent, UMP: agent↔memory, Open Context Protocol: context portability)
is **orthogonal**, not competitive. UCH should orchestrate them, not replace them.

The architectural reframe: UCH is not an operating system that contains the apps
(creativity, dreaming, reflection, planning, …). It is a **Cognitive Microkernel**:
it owns only the primitives that absolutely must be centralized, and everything else
becomes a replaceable service. Linux does not contain Chrome or LLVM; it provides the
primitives that let them exist. The kernel never knows about LLMs — inference engines
(GPT, Claude, Gemini, a future local model) are one execution backend for a small set
of **Cognitive Instructions** (OBSERVE, VERIFY, STORE, RECALL, COMPARE, PLAN, DIFF,
MERGE, REFLECT, … — already the CIC operation contract).

Much of this was already claimed by earlier decisions: ADR-001 (workspace-owned
runtime), ADR-005 (substrate runs drivers; Live Cognitive State; the Cognitive Image —
"the LLM only sees the image, never the Brain"), the CIC operation vocabulary, and
the manifesto's Level 0 purpose. What was missing is the **explicit kernel/service
boundary**, the **process model**, and a mission statement that says all of this in
one sentence.

## Decision

### 1. The Cognitive Microkernel boundary

The kernel owns exactly the primitives that must be centralized. Everything else is a
service the kernel schedules and isolates — replaceable without touching the kernel.

```text
UCH Microkernel — owns ONLY:

  Identity          Capability Registry
  Genome            Cognitive Clock
  Memory Manager    Event Journal
  Signal Router     Policy Engine
  Scheduler         Energy Manager
  Security          Persistence
```

Services (Planning, Critic, Creativity, Reflection, Learning, Verification, Dreaming,
Testing, Architecture, Documentation, …) run in the service plane, are addressable
through the kernel, and are hot-swappable. **The MANIFESTO §6 organs are redefined as
kernel services**: the organism is the *service topology*, not the kernel. This is a
boundary clarification, not a deletion — every organ keeps its contract, but no organ
may be required for kernel function.

**Kernel integrity rule:** a change that makes a service (or a new feature) a
requirement of kernel function violates this ADR and must be re-planned as a service.

### 2. Primitive status (verified against the tree, 2026-08-01)

| # | Kernel primitive | Current state | Anchor |
|---|---|---|---|
| 1 | Identity | ✅ implemented | `workspace-manifest/manifest.ts`, CIC session isolation (ADR-001) |
| 2 | Genome | ✅ implemented | `cognitive-plane/genome/species-genome.ts` |
| 3 | Memory Manager | 🟡 stores exist, no paging hierarchy | `cognitive-memory/`, `memory/`, `chunkers/` — see §5 |
| 4 | Signal Router | ✅ implemented | `event-bus/neural-event-bus.ts`, `nervous-system/signal.ts` |
| 5 | Scheduler | ✅ implemented | `accelerators/scheduler.ts`, `cognitive-plane/scheduler/task-scheduler.ts` |
| 6 | Security | ✅ implemented | `agentic/permissions/permissions.ts`, `kernel/cic/threat-mitigations.ts`, GrantEngine |
| 7 | Persistence | ✅ implemented | `Storable` + `.uccp/persist/` |
| 8 | Capability Registry | ✅ implemented | `cognitive-runtime/capability-registry.ts`, `grants.ts` (ADR-001 criterion 2) |
| 9 | Cognitive Clock | 🟡 partial — timestamps + recency decay, no monotonic cognitive clock | `trace-engine`, `kernel/retrieval/recency-decay.ts` |
| 10 | Event Journal | ✅ implemented | `cognitive-plane/trace-engine/` (OTel ledger, ADR-002) |
| 11 | Policy Engine | ✅ implemented | `cognitive-plane/constitution/constitution.ts`, `integrity-checklist.ts` |
| 12 | Energy Manager | ✅ implemented | `control-plane/budgets/budgets.ts` |

Deltas: Memory Manager paging (§5), Cognitive Clock formalization (§9), and the
process model (§4).

### 3. The kernel is LLM-agnostic (normative)

The kernel exposes **Cognitive Instructions** — the CIC operation vocabulary — as its
only inference surface. Inference engines are execution backends for those
instructions. The kernel may not depend on a provider's model names, capabilities, or
chain-of-thought (ADR-005 context: observable artifacts only). This is already
structurally true (`accelerators/fabric.ts` + per-call model override, CIC ops); this
ADR makes it a review criterion: any kernel module importing a vendor SDK violates
the boundary and must be moved to the service plane.

### 4. Cognitive Processes (the centerpiece delta)

Agents do not create sessions; they create (or join) a **cognitive process** with a
PID inside the kernel. A process contains working memory, goals, energy budget,
permissions, capabilities, open files, episode, signals, and context — one
continuously evolving unit of cognition.

- **PID namespace + process table** — kernel-owned; spawn, join, kill, signal.
- **Threads** — a process may have many threads; different drivers (Claude, Codex,
  Copilot, Cursor) attach to different threads of the **same** process for one
  engineering task (investigation, architecture, testing, docs).
- **Attach = join a PID.** Nothing transfers; nothing syncs. The driver simply
  becomes a thread of the existing process — strictly more powerful than
  synchronizing chats.
- Existing substrate already provides the hard parts: `state-virtualization/`
  (per-agent snapshots), `workspace-manifest/attach.ts` (per-agent scoped grants),
  `control-plane/projections.ts` (per-grant projections), Live Cognitive State
  (ADR-005 — the process's public face). **Delta:** the process table itself, PID
  semantics, and the thread model that lets multiple drivers own one process.
- Sessions (Claude Conversation, Codex Session, …) map onto process **threads**;
  the Episode (ADR-005) remains the canonical recording unit of a process's history.

### 5. Cognitive Virtual Memory Manager (delta)

Working memory is RAM; memory stores are disk. The kernel owns the paging hierarchy:

```text
Hot  →  Warm  →  Cold  →  Archive        (automatic promotion / eviction / compaction)
```

- Building blocks exist: `RETRIEVAL-SCALING.md` (HNSW/OPQ ladder behind
  `RetrievalFusion`), `context-compressor.ts`, 3-layer progressive search, the
  connectome's active-reconstruction model.
- **Delta:** a kernel primitive that pages the working set by recency + salience +
  energy, superseding ADR-005 §7's "deferred until trigger metrics" with a concrete
  contract (page-in/page-out, residency policy, compaction).
- A service must be able to page its own state without kernel changes.

### 6. Organism versioning (delta)

Everything the organism is becomes versioned — identity, genome, beliefs, policies,
skills — so the organism can be rolled back like a repository:

```text
Identity v204 · Genome v17 · Beliefs v98 · Policies v45 · Skills v14
```

- Read model exists: the Cognitive Time Machine (`beliefsAt(t)`, `diffBeliefs`,
  `beliefTimeline()`) over the trace ledger.
- **Delta:** versioned stores for the remaining organism state + a restore protocol
  (snapshot → verify → roll forward/back) as a kernel service, not a git shim.

### 7. Transactional cognition (formalize existing pieces)

Every thought is ACID: **think → verify → commit**, with rollback on failed
verification. No unverified knowledge reaches long-term memory.

- Pieces already exist: the integrity-checklist inhibition gate, ExecutiveBrain
  `evaluateChange`, constitutional vetoes (Organic Score, engineering gates), the
  trace ledger as the commit log.
- **Delta:** one kernel primitive (or policy-gate contract) that composes them —
  proposal → gate → commit → ledger entry, with rollback semantics.

### 8. Cognitive Filesystem + mount points

The kernel owns a filesystem for cognition, not SQLite-for-everything:

```text
/identity  /memory  /knowledge  /episodes  /beliefs  /goals  /projects
/workspaces  /skills  /genome  /thoughts  /architecture  /evidence  /history  /dreams
```

- `neural-fs/` exists; `.uccp/persist/` is the persistence home.
- **Delta:** formal mount semantics — attach mounts a driver at its scoped mount
  point (e.g. Claude at `/workspace`); grants project capabilities onto the tree
  (ProjectionEngine already intersects authority — the FS surface is the next
  formalization). CIC operations become the FS verbs.

### 9. Self-diagnosis (SMART for cognition) (delta)

A kernel service exposes organism health — memory fragmentation, reasoning drift,
knowledge entropy, contradiction rate, energy efficiency, learning rate, skill
usage, architecture drift, confidence, bias, hallucination risk, verification
coverage. Diagnostic organs and signal entropy exist; the health model with
thresholds + remediation hints is the delta.

### 10. Standards strategy (normative)

UCH does **not** standardize what others already own:

| Domain | Existing standard | UCH role |
|---|---|---|
| Agent ↔ Tool | MCP | Consume (MCP server implemented; CIC MCP adapter passes F01/F02/F05/F07) |
| Agent ↔ Agent | A2A | Consume/translate |
| Client ↔ Agent | Agent Protocol | Consume where applicable |
| Agent ↔ Memory | UMP / portable memory protocols | Align; contribute provenance/verification semantics |
| Context portability | Open Context Protocol | Consume |

UCH contributes standards **only where there is a genuine gap**: persistent
cognition, cognitive state, and cognitive execution — the CIC envelope, the
Episode, the Cognitive Trace, the Cognitive Image, the package contract. New
specifications are additive to that corpus, never redefinitions of existing ones.

### 11. Mission statement amendment (Level 0)

Proposed amendment to MANIFESTO Level 0 (to be ratified through the Level 0
community amendment path):

> **UCH is a Cognitive Microkernel and Open Specification for persistent machine
> cognition. It separates cognition from inference in the same way that operating
> systems separated software from hardware. Any AI agent, IDE, or autonomous
> system can attach to the kernel through standardized protocols, inherit a
> persistent cognitive identity, and execute within the same continuously
> evolving organism.**

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Keep growing the organism (status quo) | Every feature becomes load-bearing; nothing is replaceable; the runtime becomes the competitor instead of the substrate |
| Build a full cognitive OS containing all services | Exactly the failure mode of "bigger"; no service is swappable; 20-year survival depends on replaceability |
| Compete with / replace MCP, A2A, Agent Protocol, UMP, OCP | They are orthogonal; replacing them makes UCH one more isolated ecosystem |
| Rename the project (drop UCH) | Churn without value — the ADR-005 naming precedent applies |
| Expose models to the kernel | Couples the kernel to vendor churn; violates frugality routing (ADR-004) and portability (ADR-005) |

## Consequences

**Good:**
- The moat is the substrate: identity, continuity, knowledge, evidence, judgment,
  policies, memory, learning, governance — assets that outlive every model generation.
- Replaceability becomes the design law: anyone can replace Creativity without
  touching the kernel.
- The process model makes multi-agent work *structural* (Claude owns Thread A, Codex
  Thread B, same organism) instead of synchronized chat.
- The mission statement is one sentence, and the repo already matches most of it.

**Costs / risks:**
- Vocabulary shift (kernel vs organs vs services) — reuse ADR-005's reconciliation
  pattern (record, don't rewrite).
- Organs must be re-verified as non-kernel-required; a service that accidentally
  became kernel-required is a boundary violation to fix.
- The process model is a large delta; it must land in phases with the existing
  attach/projection/state-virtualization substrate as its base.
- Scope-creep risk back into "bigger OS" — the kernel checklist (§2) and the kernel
  integrity rule (§1) are the review gates.

## Implementation phases (tracked, not committed by this ADR)

| Phase | Delta | Base | Status |
|---|---|---|---|
| A | Cognitive Process model (PID table, threads, join/attach semantics) | `state-virtualization`, `attach`, `projections`, Live Cognitive State | ✅ `src/kernel/process/` (2026-08-01) + [COGNITIVE-PROCESSES.md](COGNITIVE-PROCESSES.md) (2026-08-01) |
| B | Cognitive Virtual Memory Manager (paging contract) | `RETRIEVAL-SCALING`, `context-compressor`, progressive search | ✅ `src/kernel/memory/vmem/` (2026-08-01) |
| C | Organism versioning (versioned stores + restore) | Cognitive Time Machine, trace ledger | ✅ `src/kernel/organism/` (2026-08-01) |
| D | Transactional cognition primitive (propose → gate → commit → rollback) | integrity-checklist, ExecutiveBrain gates, ledger | ✅ `src/kernel/transactional/` (2026-08-01) |
| E | Self-diagnosis health model (SMART metrics + thresholds) | diagnostic organs, signal entropy, budgets | ✅ `src/kernel/diagnostics/` (2026-08-01) |
| F | Cognitive Filesystem mount semantics | `neural-fs`, ProjectionEngine | ✅ `src/neural-fs/mounts.ts` (2026-08-01) |

### Phases A–F implementation status (2026-08-01, wave COGNITIVE-KERNEL-SHIPPING)

All six ADR-006 deltas landed as additive kernel services per the shipping contract
(`design/COGNITIVE-KERNEL-SHIPPING.md`, WS-A…WS-F). The process model is the only
delta with an explicit "large delta" warning — it landed self-contained
(`src/kernel/process/`) on top of the existing substrate without touching
`state-virtualization`/`attach`; exoskeleton wiring remains a follow-on. Full gate
results and the remaining parallel-wave blockers are recorded in
`.agent/memory/WORKSPACE-MEMORY.md` (2026-08-01).

## Verification

- §2 primitive table is verified against the live tree (2026-08-01); a change that
  moves a ✅ row back to 🟡/delta is a boundary regression.
- Kernel integrity rule: enforced in design review — services never become kernel
  requirements; kernel modules never import vendor SDKs.
- This ADR changes no code; the existing suite (141 files / 2,231 tests) stays green.
- Follow-on phases A–F tracked in the planning corpus with TDD waves; Phase A
  begins with the process table + PID namespace on top of `state-virtualization`.

*Persistent cognition. Replaceable pilots. — The agent is ephemeral; the cognition is
persistent.*
