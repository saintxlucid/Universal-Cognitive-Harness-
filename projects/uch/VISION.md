# VISION.md — UCH as Open Cognitive Infrastructure

- **Status:** Living strategic document
- **Date:** 2026-08-01
- **Companions:** [MANIFESTO.md](MANIFESTO.md) (the organism),
  [SPEC.md](SPEC.md) (the runtime spec), [design/ADR-005](design/ADR-005-universal-cognitive-protocol.md)
  (the protocol), [design/GAP-CLOSURE-PLAN.md](design/GAP-CLOSURE-PLAN.md) (the delta)

## 1. The one-sentence vision

> **UCH is an open cognitive runtime specification that allows any AI agent, IDE, or
> autonomous system to attach to the same persistent organism through standardized
> drivers, cognitive protocols, and event semantics.**

And why — the purpose clause:

> **UCH exists to preserve and compound cognitive capital independently of any
> model, application, vendor, or human lifetime. It treats cognition as durable
> infrastructure rather than transient computation.**

The one-sentence vision states the **mechanism** (any tool attaches to one
persistent organism). The purpose clause states the **end**: engineering
judgment accumulates across models, teams, and years instead of leaving with
the session that produced it. A product may satisfy the mechanism and still
fail the purpose; the purpose is the acceptance test.

## 2. The strategic thesis

TCP/IP, POSIX, LLVM, Docker, Kubernetes — none of them won by having more features.
They won by becoming **the compatibility layer everyone else built on**.

- Nobody *installs* TCP/IP. Everyone *implements* it.
- Docker isn't the standard; **OCI** is.
- LLVM isn't Clang; it's the **IR**.
- POSIX isn't Linux; it's the **specification**.

The same move is available for AI coding tools — and the window is open precisely
because every vendor (VS Code Agent Host, Codex App Server, MCP, ACP) is currently
building *host-specific* cognition rails, none of which persists across hosts.

**UCH is not competing to be the best AI coding tool. It is the cognitive
infrastructure that every AI coding tool can adopt.**

If Docker had tried to be the best Linux distribution, it would not have changed the
industry. It became infrastructure instead. That is the position UCH is closest to
occupying — provided it stays vendor-neutral, protocol-first, and grounded in official
integration points rather than private internals.

## 3. The five-product architecture

```text
UCH Specification        the constitution — protocols, schemas, Laws, driver
                         contracts, memory contracts, signal contracts, episode
                         contracts. No code. Versions independently of the runtime.
        │
        ▼
UCH Reference Runtime    the persistent organism — memory, signals, scheduler,
                         brains, genome, policies. The reference implementation
                         of the specification.
        │
        ▼
UCH SDKs                 Rust, TypeScript, Python, Go, C#, Java, Swift, C++ —
                         any application builds drivers against the spec.
        │
        ▼
UCH Drivers              per-host adapters (Claude, Codex, Cursor, Copilot,
                         OpenCode, JetBrains, Neovim...), composed from reusable
                         sensors (read) and effectors (act).
        │
        ▼
UCH Marketplace          governed distribution of skills, brains, knowledge,
                         policies, and cognitive packages.
```

## 4. What is already true in this repo (2026-08-01, verified)

The five-product split is not aspirational; four of the five layers exist:

| Product layer | Current state |
|---|---|
| **Specification** | `spec/` — Laws, Constitution, Genome, ontology, CP. `design/` — ADR-001…005, CIC v0.1 (transport-neutral contract), INTEGRATION-LEVELS, LIVE-COGNITIVE-STATE. Versioning boundary: pending (GAP-CLOSURE-PLAN Phase 3) |
| **Reference runtime** | `src/` — kernel, brains, organs, Mnemosyne, trace ledger, projection engine, sleep cycle, connectome, engineering intelligence, 2,200+ tests |
| **SDKs** | MCP surface (25 tools), CLI (`uch`), CIC transports (MCP/A2A/CloudEvents planned) |
| **Drivers** | `src/drivers/` — acp, agent, filesystem, git, ide, mcp, runtime + sensor/effector composition layer; per-host integration docs (`design/integrations/`) |
| **Marketplace** | Not built — requires Cognitive Packages first (GAP-CLOSURE-PLAN Phase 4) |

## 5. The compatibility-layer argument, concretely

VS Code's Agent Host already ships dedicated host, immutable session updates,
snapshots, reducers, JSON-RPC, multiple clients, reconnect, synchronization. UCH does
not replace that — **it plugs underneath it**: the Agent Host (and Codex App Server,
and MCP, and every future host) becomes a *driver* attached to the same persistent
organism. One workspace, one organism, any tool.

The universal protocol (ADR-005) makes this concrete: every host's session concept
normalizes into an **Episode**; every observable artifact becomes a **Cognitive
Trace**; every handoff synchronizes **Live Cognitive State** (mind state, not chat
history); every host participates at the integration level it actually exposes
(L0–L4, graceful degradation, never privileged assumption).

## 6. The differentiators

- **Cognitive Time Machine** — "what did the organism believe on date X" answered by
  reconstructing the belief graph, not searching chats.
- **Cognitive Replay** — an engineering session replayed like a debugger, as the
  acceptance test of Law 12 (Reversibility).
- **Cognitive Merge** (research track) — the flagship: two engineers, two tools, six
  hours each, then merge *cognition* — knowledge, lessons, beliefs, conflicts. The
  trivial slice (non-overlapping union) is buildable now; conflict resolution is an
  open research problem.

## 7. What this document does not decide

- Renaming UCH to "Universal Cognitive Substrate" mid-project — flagged open in the
  spec (ADR-005 chose to document the three-layer naming without renaming).
- The candidate Law ("No application shall own cognition") — proposed in
  `design/PROPOSED-LAW-OWNERSHIP-OF-COGNITION.md`, adoption belongs to the community
  process governing the Laws.
- Marketplace as a business — product roadmap, depends on Cognitive Packages.

## 8. The primitive-first principle

UCH's operating question is not "how do we build this feature?" but **"what new
primitive would make this feature unnecessary?"** Files, git objects,
containers, and LLVM IR changed computing because each introduced a primitive
that absorbed an entire class of problems. The same test applies here: every
proposal must state the primitive it introduces; features are acceptable only
when no primitive can absorb the problem.

The primitive candidates currently on the table are catalogued as idea notes in
`rfc/ideas/` (the 2026-08-01 intake, IDEA-0010…0023): signal fabric, cognitive
physiology, the executable digital twin, cognitive manufacturing, the
observatory, engineering gravity, cognitive economics, reality synchronization,
cognitive silicon, cognitive operating contracts, cognitive units (COC), the
cognitive hypervisor, the architecture review board, and elemental cognitive
primitives. None of these is approved work — each is a candidate primitive
waiting for the spike discipline (SOP-08) to prove it absorbs a class of
problems before it earns implementation.

## 9. The discipline claim (2026-08-01 intake, round 6)

The next step past primitives is a discipline: **Cognitive Systems
Engineering** — deriving everything from Laws → Mathematics → Specifications →
Protocols → Compilers → Reference Implementations → SDKs → Applications, the
way TCP/IP, LLVM, POSIX, USB, OpenGL, Vulkan, and OCI are ecosystems rather
than software. Two consequences are recorded as *proposals*, not decisions:

- **Ambient endgame** — the runtime disappears; developers experience
  Workspace Intelligence through any viewport (the CDE — Cognitive
  Development Environment), the way TCP and virtual memory are invisible.
- **Roadmap revision** — the five products become Specification, Reference
  Runtime, Cognitive Engineering Suite (compiler, simulator, observatory,
  analysis, verification), Universal Driver Layer, and Cognitive Standard
  (conformance, certification, benchmarks, SDKs, governance) — replacing
  "Marketplace" with Engineering Suite + Standard.
- **Repository restructure** into a platform layout (`specs/`, `math/`,
  `physics/`, `compiler/`, `isa/`, `abi/`, `runtime/`, `sdk/`, `drivers/`,
  `reference/`, `research/`, `compliance/`, `certification/`, `simulator/`,
  `benchmarks/`) — explicitly **not decided** here: it is a high-churn
  governance decision (build, tests, docs, tooling all key to `src/`), to be
  evaluated with a migration plan like the rename decision in §7.

The round-6 intake is tracked as idea notes IDEA-0024…0032 (CSE, ambient
cognition/CDE, cognitive mathematics, cognitive sociology, cognitive
motherboard, cache hierarchy, cognitive speculation, reality compiler,
consciousness levels). The eight-discipline ladder is recorded in
GENESIS.md chapter 3 as framing with corpus mappings.

## 10. The firmware-compute claim (2026-08-01 intake, round 7)

Verdict after repo-wide mapping: ~65% of the round-7 vision already has
ancestors executed or tracked — the firmware engines map onto integrity
laws + structuredFacts (truth), gatherer + sensors + IDEA-0017/0031
(reality sync), context compressor (context), sleep cycle + vmem
(memory), engineering-intelligence (architecture + refactoring),
OrganicScoreEngine (organic code), IDEA-0012 (simulation), meta-cognition
DBs (meta), IDEA-0016 (economics), IDEA-0008 (genetics), IDEA-0009
(time), IDEA-0014 (observatory), RFC-0004 + ADR-006 (CIR/microkernel),
ADR-004 (virtual processors). The genuine delta is 15 proposals, tracked
as idea notes IDEA-0033…0047.

The category claim: a capability hierarchy that gives every new feature a
home instead of another isolated module — **Laws** (immutable rules) →
**Kernel Services** (ADR-006 primitives) → **Firmware** (permanent
cognitive behaviors; IDEA-0033) → **Accelerators** (optimized execution
pipelines; IDEA-0046) → **Organs** (specialized systems) → **Skills**
(composable workflows) → **Drivers** (host adapters) → **Applications**.
Firmware is the new tier: behavior that changes how the organism
behaves, not what it knows.

The science claim: a Theory of Intelligence (IDEA-0034) — one decision
law (maximize Expected Utility + Information Gain under Energy + Risk +
Latency costs) from which planning, memory, learning, reflection,
scheduling, and verification derive as special cases — plus named
disciplines: Cognitive Information Theory (IDEA-0035), Topology
(IDEA-0036), Thermodynamics (IDEA-0037), Immunology (IDEA-0038),
Embryology (IDEA-0039), Jurisprudence (IDEA-0040), Anthropology
(IDEA-0041), Archaeology (IDEA-0042), Astronomy + Instruments
(IDEA-0043), law expansion (IDEA-0044), and the Cognitive Virtual
Machine (IDEA-0045) — CIR as the LLVM IR of cognition, CVM as the JVM,
CABI as the POSIX, Signal Fabric as the TCP/IP.

The utility-classes framing (14 classes: engineering, cognitive,
research, simulation, reality, intelligence, manufacturing,
verification, biological, executive, creative, evolution, observatory,
civilization) is recorded as a cataloging convention, not a new
component set: each class maps onto the existing CLI/MCP/skill/subagent
surface or an idea note.

The strongest differentiator is **Universal Engineering Replay**
(IDEA-0047): one causal engineering graph across every host (VS Code,
Claude Code, Codex, OpenCode, JetBrains, Copilot, terminal, git,
browser, MCPs), extending the ADR-002 trace ledger with cross-host
episode capture and influence-path/change-point queries. This is the
candidate category-defining primitive: it turns today's host-local
chat/edit silos into one evidence-attached causal graph of engineering
knowledge — the acceptance test of Law 12 applied across tools.

## 11. The foundations intake (2026-08-01, round 8)

Verdict after repo-wide mapping: the "40% designed / 60% missing" split
is optimistic about the delta — roughly 70% of the 21 foundations
already have ancestors executed or tracked (F0 spec stack; F1 CVM →
IDEA-0045; F2 driver architecture → `src/drivers/` + CIC + compliance;
F5 reality → IDEA-0017/0031 + sensors; F6/F16 simulation + twin →
IDEA-0012/0013; F7 benchmark → IDEA-0018 + EI benchmark runner; F8
observatory → IDEA-0014; F10 packages → WS-P + IDEA-0019; F13 research
→ IDEA-0033 Layer 9 + research registers; F15 manufacturing → IDEA-0013
+ organic-code gates; F17 economy → IDEA-0016 + budgets; F18 evolution
→ IDEA-0008 + DNA; F20 civilization → CIC + attach + merge + IDEA-0007;
F14 graph → IDEA-0050). The user's deeper claim holds: the missing
material is infrastructure, not AI features.

The true delta is 8 proposals, tracked as idea notes IDEA-0048…0055:

| Foundation | Delta |
|---|---|
| F0 Formal Specification | IDEA-0048 — one consolidated normative document set (POSIX-style) + normative timing/determinism/persistence sections; spec/ + STACK.md exist, consolidation does not |
| F3 Storage Engine | IDEA-0049 — unified storage contract over pluggable backends (file/sqlite/postgres/neo4j/vector/object/git); today stores are directly addressed |
| F4 + F14 Knowledge Fabric | IDEA-0050 — typed artifact nodes + cross-domain edges (conversation→decision→benchmark); per-domain graphs exist, the shared fabric does not |
| F9 Engineering Database | IDEA-0051 — typed artifact store (tradeoffs, meetings, successes, experiments as first-class records) |
| F11 Skill Compiler | IDEA-0052 — Skill DSL → Skill IR → optimizer → runtime; skills are prose today |
| F12 Constitution Engine | IDEA-0053 — central execute-time enforcement so no subsystem can violate the Laws (checks exist at evaluation points only) |
| F2 + F19 Driver Ecosystem + Interop Lab | IDEA-0054 — per-IDE adapter catalog + automated cross-host/OS certification matrix as a release gate |
| CEL | IDEA-0055 — a cognitive engineering language: mission → CIR → CVM; makes UCH programmable, not just configurable |

The CEL claim is the round's headline: with CEL compiling through CIR
to the CVM, models become execution backends of user-written programs,
and UCH shifts from "an implementation" to "a programmable cognitive
platform" — the C-to-LLVM relationship for cognition. Like every
proposal here it stays at SOP-08 stage 1 until a spike proves it
absorbs the problem class.
