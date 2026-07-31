# The UCH Manifesto

**Level 0 — Purpose. Not amendable by policy; amendable only by the community that lives in this workspace.**

> **We are engineering the first Universal Cognitive Harness: a biologically inspired cognitive operating layer that gives every software workspace a persistent nervous system, adaptive brain, and shared intelligence. Any IDE, coding agent, or future AI runtime can attach to this cognitive substrate, inherit its memory, knowledge, skills, policies, and learned experience, and contribute back to its continual evolution.**

---

## 1. The Thesis

Coding agents and IDEs reconstruct every repository independently: they discover files, infer architecture, load instructions, rebuild task context, and retain isolated histories. This duplication is the bottleneck of modern AI-assisted development. It cannot be fixed by building a better agent — because the next agent will duplicate the next workspace just the same.

The fix is an inversion of ownership:

> **The workspace owns the intelligence. The agent borrows it.**

UCH is not a replacement for Cursor, Claude Code, Codex CLI, OpenCode, Copilot, or OpenHands. It is the persistent cognitive substrate those clients attach to. The IDE, the coding agent, and the LLM are temporary, permissioned clients of a living workspace runtime. When they leave, the intelligence remains — because it was never theirs to begin with.

This position is already formalized in [ADR-001](design/ADR-001-workspace-owned-cognitive-runtime.md), accepted 2026-07-30:

> "UCH will be defined as a **workspace-owned cognitive runtime**. Agents, IDEs, model runtimes, and operational tools are temporary, permissioned clients."

This manifesto is the public declaration of that decision, and the discipline it implies.

---

## 2. The Discipline

What we build is not agent engineering, not harness engineering, and not AI infrastructure. Those are subsets. We practice a distinct engineering discipline:

### Cognitive Infrastructure Engineering

> Engineering the persistent cognitive machinery that intelligent agents connect to — the workspace's artificial nervous system.

The hierarchy of disciplines:

```text
Artificial Intelligence
        ↓
Agent Engineering          — builds autonomous agents
        ↓
Harness Engineering        — builds agent runtimes and protocols
        ↓
Cognitive Infrastructure   — builds the persistent substrate agents attach to
Engineering
        ↓
Biotechnological Brain     — the biological metaphor, disciplined
Engineering                — by engineering contracts
```

Each layer builds on the one below. We work in the two deepest layers. Protocols such as MCP and ACP standardize how tools and runtimes communicate; they deliberately avoid prescribing a cognitive model. We prescribe one — and we give that model a home: the workspace.

---

## 3. What We Are Not

| We are not | Because |
|---|---|
| A replacement IDE or coding agent | It duplicates mature client ecosystems and centralizes the wrong layer ([ADR-001](design/ADR-001-workspace-owned-cognitive-runtime.md#alternatives-considered)) |
| "Just memory" | Memory is one organ among many; the substrate also owns knowledge, skills, policy, learning, and workspace state |
| "Just an MCP server" | MCP is an excellent transport and capability surface, but it does not define persistent cognitive objects, learning, or workspace ownership |
| "Just agent orchestration" | Orchestration is an executive function; the substrate outlives every orchestrator |
| A remote global brain | Local-first is a law ([Law 10 — Identity Persistence](spec/LAWS_OF_COGNITIVE_PHYSICS.md#law-10--identity-persistence)); a cloud brain is a privacy, availability, and contamination risk |

---

## 4. The Architecture

```text
──────────────────────────────────────
Applications (temporary clients)
──────────────────────────────────────
VS Code · Cursor · Claude Code · Codex CLI · OpenCode
Copilot · JetBrains · Neovim · OpenHands · Future Agents
──────────────────────────────────────
UCH — Universal Cognitive Harness
──────────────────────────────────────
Driver Plane            src/drivers/        ide · agent · mcp · git ·
                                            filesystem · acp · runtime
Control Plane           src/control-plane/  auth · policies · budgets ·
                                            limits · telemetry · monitor
Workspace Brain         src/workspace-brain/ identity · world-model ·
                                            architecture-graph · timeline
Cognitive Substrate     src/exoskeleton/ +  nervous system · metabolism ·
                        src/kernel/         memory · connectome · immune ·
                                            endocrine · sleep · evolution
Capability Registry     src/cognitive-runtime/capability-registry.ts
Event Bus               src/event-bus/
──────────────────────────────────────
Storage
──────────────────────────────────────
.uccp/persist · sessions · event ledger · knowledge graph · vector index
──────────────────────────────────────
External Systems
──────────────────────────────────────
Git · Filesystem · Docker · MCP Servers · ACP Harnesses
Cloud APIs · CI/CD · Databases
```

Two design documents specify this in full: [ARCHITECTURE.md](design/ARCHITECTURE.md) (the Cognitive Operating System) and [CIC-SPECIFICATION.md](design/CIC-SPECIFICATION.md) (the Cognitive Interchange Contract for clients).

### Automatic attachment

The user never says "load memory." The workspace wakes up:

```text
Workspace Opened
  → Identify Workspace
  → Locate Harness Manifest
  → Load Workspace Brain
  → Initialize Drivers
  → Load Skills
  → Load MCP Registry
  → Load Policies
  → Connect Event Bus
  → Expose Cognitive API
  → Notify Attached Agents
```

Attachment is **manifest discovery plus negotiated activation** — never hidden interception. A client that cannot or will not attach still operates normally ([ADR-001 §Attachment lifecycle](design/ADR-001-workspace-owned-cognitive-runtime.md#attachment-lifecycle)).

---

## 5. Everything Is a Driver, Everything Is a Capability

Every external component plugs into the kernel through drivers rather than bespoke integrations:

```text
IDE Driver · Agent Driver · Model Driver · Git Driver
Filesystem Driver · Docker Driver · Browser Driver
Terminal Driver · CI Driver · Database Driver · Cloud Driver
```

Rather than hard-coding features, the runtime publishes a dynamic capability registry. An attached client asks:

> "What capabilities does this workspace expose?"

and receives a machine-readable answer — scoped, permissioned, and costed ([CIC-SPECIFICATION.md](design/CIC-SPECIFICATION.md)).

---

## 6. The Organ Contract

Biological vocabulary is permitted — **required** — but only under an engineering contract. Every organ carries a dual name (engineering first, biological in parentheses), per the [Dual Naming Convention](spec/LAWS_OF_COGNITIVE_PHYSICS.md#dual-naming-convention), and must satisfy the rule that defines this project:

> **If an organ cannot be benchmarked independently, it is not an engineering component — it is a metaphor.**

| Engineering Name | Biological Metaphor | Engineering Contract | Module | Measurable By |
|---|---|---|---|---|
| Executive System | Prefrontal Cortex | Planning, decisions, inhibition | `src/executive-brain/` | Decision trace, plan completion rate |
| Memory System | Hippocampus | Episodic encoding, consolidation | `src/kernel/memory/`, `src/hippocampus/` | Retrieval precision, consolidation latency |
| Learning System | Neocortex | Pattern discovery, abstraction | `src/neocortex/` | Pattern generalization tests |
| Action Selection | Basal Ganglia | Routine selection, habits | `src/basal_ganglia/` | Selection determinism, habit hit rate |
| Routing System | Nervous System | Signal delivery, prioritization | `src/nervous-system/` | Routing latency, Law 13 compliance |
| Integration Kernel | Cortex Kernel | Cross-modal synthesis | `src/cortex_kernel/` | Fusion quality, signal coverage |
| Persistence Engine | Aether | 24/7 continuous operation | `src/aether/` | Uptime, state restore integrity |
| Signal Priority | Thalamus | Attention gating | `src/nervous-system/` | Escalation accuracy, novelty filter rate |
| Homeostasis | Brainstem | Vital regulation | `src/exoskeleton/`, `src/cognitive-plane/health-metrics/` | Health metric stability |
| Reflex Engine | Spinal Cord | Zero-LLM fast paths | `src/agentic/` | Reflex latency, cortex-offload ratio |
| Threat Detection | Immune System | Anomaly monitoring | `src/exoskeleton/immune.ts` | Threat precision/recall |
| Modulation | Endocrine | Global parameter adjustment | `src/exoskeleton/endocrine.ts` | Global-signal convergence |
| Offline Processing | Sleep Cycle | Consolidation, pruning | `src/sleep_cycle/` | Consolidation throughput, decay accuracy |
| Concept Store | Connectome | Relationship graph | `src/connectome/` | Graph integrity, query latency |
| Energy Budget | Metabolism | Resource allocation | `src/metabolism/` | Budget compliance, overspend rate |
| Governance | Constitution | Rules, separation of powers | `src/cognitive-plane/constitution/`, `spec/CONSTITUTION.md` | Policy violation rate, review latency |

The physiology is specified in [COGNITIVE_BIOLOGY.md](spec/COGNITIVE_BIOLOGY.md) (plasticity, homeostasis, metabolism, development, healing, sleep, evolution, immune response, endocrine regulation, thalamic gating). The invariants are specified in [LAWS_OF_COGNITIVE_PHYSICS.md](spec/LAWS_OF_COGNITIVE_PHYSICS.md) — sixteen laws, enforced by static analysis, runtime auditing, and constitutional review. The identity that outlives every organ is specified in [GENOME.md](spec/GENOME.md).

This discipline already exists in this repository: every organ above has source, most have tests, and the whole corpus is verified by 91 test files / 1,638 test cases. What the manifesto adds is the public claim: this is a field, not a feature.

---

## 7. Event-Driven Cognition

Nothing polls. Everything reacts:

```text
File Saved
  → Workspace Graph Updated
  → Architecture Delta Computed
  → Knowledge Index Updated
  → Affected Skills Invalidated
  → Reflection Scheduled
  → Project State Updated
  → Memory Consolidated
```

Every interaction between components is an immutable, causally attributed signal ([Law 1 — Signal Universality](spec/LAWS_OF_COGNITIVE_PHYSICS.md#law-1--signal-universality)). Every state change is replayable ([Law 12 — Reversibility](spec/LAWS_OF_COGNITIVE_PHYSICS.md#law-12--reversibility)). The event bus (`src/event-bus/`) is the substrate's heartbeat.

---

## 8. Current State and the Immediate Gap

**Implemented:** workspace-owned runtime topology ([ADR-001](design/ADR-001-workspace-owned-cognitive-runtime.md)), driver plane, control plane (auth, policies, budgets, limits, telemetry, event governance), capability registry with scopes/authority/cost/retention, grant engine (issue/authorize/revoke per agent), governed driver event path (provenance, idempotency, policy + grant checks, audit ledger), event bus, exoskeleton orchestrator with 20+ organs, workspace brain, kernel memory (episodic + semantic), 15 cognitive-plane stores, agentic runtime (tools, permissions, query loop, subagents), CLI + MCP STDIO (24 tools) + HTTP/SSE server + 5 transports, 91 test files / 1,600+ tests passing, and a governed specification corpus (Laws, Constitution, Biology, Ontology, Genome, Formal Foundations, CIC, Conformance).

**The defining gap — ADR-001 Phase-I criterion #1:**

> A versioned workspace manifest and local discovery contract.

**Implemented 2026-07-31.** A workspace now carries `.uch/uch.manifest.json`
(schema `uch.manifest.v1`) describing its cognitive configuration — identity,
runtime requirements, capabilities, drivers, skills, and policies. Any client
runs `uch attach` (or calls `attach()` from `src/workspace-manifest/`) and the
lifecycle runs: discover → negotiate version → negotiate capabilities and
drivers → issue a per-agent scoped grant → materialize an authorized
projection → emit `workspace:opened` and `agent:attached`. The workspace wakes
up the harness; the harness does not need to be pointed at the workspace. Full
contract: [WORKSPACE-MANIFEST.md](design/WORKSPACE-MANIFEST.md).

**ADR-001 Phase-I criterion #2 implemented 2026-07-31.** The capability
registry now carries machine-readable semantics — scope cascade, authority
(operation families), cost budgets, and retention — and the `GrantEngine`
(`src/cognitive-runtime/grants.ts`) enforces them at invocation time: issue,
authorize, revoke, scope containment, rate limits, budgets, and retention
checks, with per-agent grants issued on attach and revoked on detach. Discovery
still never implies authority.

**ADR-001 Phase-I criterion #3 implemented 2026-07-31.** Every driver
observation now passes through an `EventGovernance` gate
(`src/control-plane/event-governance.ts`): provenance chains, event_id
idempotency, policy checks, grant checks (scope isolation, budgets, rates),
staleness rejection, and a full audit ledger — with denials observable as
`governance:event_denied` bus events. The gate is wired into attachment and
returned as `result.governance`. Contract: [EVENT-GOVERNANCE.md](design/EVENT-GOVERNANCE.md).

**ADR-001 Phase-I criterion #4 implemented 2026-07-31.** Two clients
attaching to the same workspace now receive different authorized projections
of the same workspace state: `ProjectionEngine`
(`src/control-plane/projections.ts`) filters the containment tree through
each grant's scope (workspace → project → branch → task → session) and the
capabilities through the grant's operation families — discovery never
implies authority, and no state is ever projected unfiltered. `attach()`
accepts `grantScope` and returns `result.projection`. Contract:
[PROJECTIONS.md](design/PROJECTIONS.md).

All six ADR-001 Phase-I acceptance criteria are implemented.

---

## 9. Commitment

1. The workspace owns the intelligence; agents are temporary clients.
2. Every biological organ earns its name with a benchmarkable engineering contract — otherwise it is decorative and will be removed ([GENOME §4.1](spec/GENOME.md#41-biological-inspiration-engineering-justification)).
3. No client ever receives an unrestricted workspace memory dump; every projection is scoped by principal, workspace, project, task, purpose, time, and policy.
4. Attachment is discovery and negotiated activation, never hidden interception.
5. The substrate is local-first, explicit about storage and erasure, and useful even when no optional driver is installed.
6. Private chain-of-thought is excluded; decision provenance is preserved.
7. The runtime remains valid even when today's IDEs, protocols, and models are replaced — the intelligence belongs to the workspace, not to any of its current clients.

---

*Persistent cognition. Replaceable pilots.* — [GENOME.md](spec/GENOME.md)

*Drafted 2026-07-31. Grounds [ADR-001](design/ADR-001-workspace-owned-cognitive-runtime.md) in a public discipline claim; bound by [LAWS_OF_COGNITIVE_PHYSICS.md](spec/LAWS_OF_COGNITIVE_PHYSICS.md) and [CONSTITUTION.md](spec/CONSTITUTION.md).*
