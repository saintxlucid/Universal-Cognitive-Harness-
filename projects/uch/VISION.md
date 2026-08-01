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

- Nobody _installs_ TCP/IP. Everyone _implements_ it.
- Docker isn't the standard; **OCI** is.
- LLVM isn't Clang; it's the **IR**.
- POSIX isn't Linux; it's the **specification**.

The same move is available for AI coding tools — and the window is open precisely
because every vendor (VS Code Agent Host, Codex App Server, MCP, ACP) is currently
building _host-specific_ cognition rails, none of which persists across hosts.

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

| Product layer         | Current state                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specification**     | `spec/` — Laws, Constitution, Genome, ontology, CP. `design/` — ADR-001…005, CIC v0.1 (transport-neutral contract), INTEGRATION-LEVELS, LIVE-COGNITIVE-STATE. Versioning boundary: pending (GAP-CLOSURE-PLAN Phase 3) |
| **Reference runtime** | `src/` — kernel, brains, organs, Mnemosyne, trace ledger, projection engine, sleep cycle, connectome, engineering intelligence, 2,200+ tests                                                                          |
| **SDKs**              | MCP surface (47 tools), CLI (`uch`), CIC transports (MCP/A2A/CloudEvents planned)                                                                                                                                     |
| **Drivers**           | `src/drivers/` — acp, agent, filesystem, git, ide, mcp, runtime + sensor/effector composition layer; per-host integration docs (`design/integrations/`)                                                               |
| **Marketplace**       | Not built — requires Cognitive Packages first (GAP-CLOSURE-PLAN Phase 4)                                                                                                                                              |

## 5. The compatibility-layer argument, concretely

VS Code's Agent Host already ships dedicated host, immutable session updates,
snapshots, reducers, JSON-RPC, multiple clients, reconnect, synchronization. UCH does
not replace that — **it plugs underneath it**: the Agent Host (and Codex App Server,
and MCP, and every future host) becomes a _driver_ attached to the same persistent
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
  hours each, then merge _cognition_ — knowledge, lessons, beliefs, conflicts. The
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
than software. Two consequences are recorded as _proposals_, not decisions:

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
already have ancestors executed or tracked: F0 spec stack; F1 CVM →
IDEA-0045; F2 driver architecture → `src/drivers/` + CIC + compliance;
F5 reality → IDEA-0017/0031 + sensors; F6/F16 simulation + twin →
IDEA-0012/0013; F7 benchmark → IDEA-0018 + EI benchmark runner; F8
observatory → IDEA-0014; F10 packages → WS-P + IDEA-0019; F13 research
→ IDEA-0033 Layer 9 + research registers; F15 manufacturing →
IDEA-0013 + organic-code gates; F17 economy → IDEA-0016 + budgets;
F18 evolution → IDEA-0008 + DNA; F20 civilization → CIC + attach +
merge + IDEA-0007; F14 graph → IDEA-0050). The user's deeper claim
holds: the missing material is infrastructure, not AI features.

The true delta is 8 proposals, tracked as idea notes IDEA-0048…0055:

| Foundation                | Idea      | Delta                                                                     |
| ------------------------- | --------- | ------------------------------------------------------------------------- |
| F0 Formal Specification   | IDEA-0048 | One normative doc set; timing/determinism/persistence specs missing       |
| F3 Storage Engine         | IDEA-0049 | Unified storage contract over pluggable backends                          |
| F4 + F14 Knowledge Fabric | IDEA-0050 | Cross-domain artifact graph; per-domain graphs exist, the fabric does not |
| F9 Engineering Database   | IDEA-0051 | Tradeoffs, meetings, successes, experiments as first-class records        |
| F11 Skill Compiler        | IDEA-0052 | Skill DSL → IR → optimizer → runtime; skills are prose today              |
| F12 Constitution Engine   | IDEA-0053 | Execute-time enforcement; checks exist at evaluation points only          |
| F2 + F19 Driver Ecosystem | IDEA-0054 | Per-IDE adapters + automated cross-host/OS certification matrix           |
| CEL                       | IDEA-0055 | Mission → CIR → CVM; makes UCH programmable, not configurable             |

The CEL claim is the round's headline: with CEL compiling through CIR
to the CVM, models become execution backends of user-written programs,
and UCH shifts from "an implementation" to "a programmable cognitive
platform" — the C-to-LLVM relationship for cognition. Like every
proposal here it stays at SOP-08 stage 1 until a spike proves it
absorbs the problem class.

## 12. The platform infrastructure intake (2026-08-01, round 9)

Verdict after repo-wide mapping of the Phase Ω corpus (cognitive
filesystem, bus, transactions, time machine, object model, query
language, package manager, marketplace, digital twin, genome, reality
engine, knowledge graph, universal replay, observatory, compiler,
hypervisor, scheduler, cache hierarchy, CHAL, microkernel): ~90% already
has ancestors executed or tracked — CFS → `src/neural-fs` (version-store,
mounts); CBUS → neural-event-bus + IDEA-0010; transactions → WS-D
transactional cognition; time machine → `cognitive-time-machine.ts`
(beliefsAt / beliefTimeline / diffBeliefs); package manager → WS-P;
twin → IDEA-0012; genome → IDEA-0008 + spec/GENOME.md + WorkspaceDNA;
reality → IDEA-0017/0031 + sensors/effectors; knowledge graph →
IDEA-0050; universal replay → IDEA-0047 + ADR-002; observatory →
IDEA-0014; compiler → RFC-0004 + IDEA-0055; hypervisor → IDEA-0021
plus the WS-A process model; kernel scheduler →
`src/accelerators/scheduler.ts` with IDEA-0034; cache hierarchy →
IDEA-0029 + vmem L0–Archive; CHAL →
ADR-004 virtual processors + IDEA-0046; microkernel → ADR-006 (accepted;
kernel shipping wave landed); evolution laboratory → IDEA-0008's
mutate → simulate → benchmark → constitution → approve → deploy →
observe pipeline.

The true delta is 3 proposals, tracked as idea notes IDEA-0056…0058:

| Phase Ω item             | Idea      | Delta                                                                  |
| ------------------------ | --------- | ---------------------------------------------------------------------- |
| Cognitive Object Model   | IDEA-0056 | One identity + lifecycle for every cognitive object class              |
| Cognitive Query Language | IDEA-0057 | Declarative language with confidence/importance/causal predicates      |
| Cognitive Marketplace    | IDEA-0058 | Governance-gated distribution of organs, genomes, constitutional packs |

The round's headline is the ecosystem trio: an object model everything
obeys, a query language everything answers, and a marketplace everything
distributes. CQL is the most novel primitive claim — a SQL-for-cognition
with causal operators appears in no surveyed agent-OS work; the
marketplace's governance constraint (a pack may never weaken a Law,
mirroring WS-P) is what keeps the ecosystem from becoming a security
hole. On the user's 40%/60% split, the round-9 verdict is: the Phase Ω
60% is real but ~90% already has ancestors; the missing material
remains infrastructure (3 surface primitives), not AI features.

## 13. The missing-infrastructure intake (2026-08-01, round 10)

Verdict after mapping 24 infrastructure claims (what OSes, databases,
compilers, distributed systems, CPUs, and biology have) against the
repo: **~85% already has ancestors executed or tracked**. The claims
land in four classes:

| Class      | Count | Items (terse; evidence in prose below)                                                           |
| ---------- | ----- | ------------------------------------------------------------------------------------------------ |
| Executed   | 11    | ABI, ISA, transactions, replay, cache, fs metadata, packages, drivers, DNA, ontology, scheduler  |
| Draft-only | 3     | compiler, IR, optimizer — one stack: CIR (RFC-0004), design-only                                 |
| Partial    | 9     | scheduler policies, hypervisor, GC, allocator, security, networking, consensus, profiler, design |
| Absent     | 2     | kernel debugger, formal verification                                                             |

Executed evidence: CP v1.0.0 is literally the syscall ABI of the
Cognitive OS (spec/CP.md, conformance-gated) with CIC v0.1 grants on
top; the user's 18-instruction ISA list (Observe…Rollback) maps to CP
ops plus WS-D rollback, compression accelerator, and cognitive merge;
WS-D transactional cognition is exactly "memory + knowledge + genome +
signals + beliefs commit together, rollback on failed verification";
replay spans the ledger, cognitive-replay, the time machine, and UER.
The user's closing stack (SDK → Runtime → Compiler → IR → VM → Kernel →
Microkernel → fabrics) has every rung present _in some form_ — which
makes the missing rungs more visible, not less.

The true delta is 9 proposals, tracked as idea notes IDEA-0059…0067:

| Proposal                        | Idea      | Gap it closes                                     |
| ------------------------------- | --------- | ------------------------------------------------- |
| Cognitive Kernel Debugger       | IDEA-0059 | Pause/step/inspect/mutate/resume live cognition   |
| Cognitive Garbage Collector     | IDEA-0060 | Unified reclamation across all object classes     |
| Cognitive Formal Verification   | IDEA-0061 | Model-check reasoning graphs against the Laws     |
| Cognitive Security Architecture | IDEA-0062 | One boundary for poisoning/injection/hijacking    |
| Cognitive Resource Allocator    | IDEA-0063 | Grants for attention/tokens/depth/confidence      |
| Multi-UCH Networking            | IDEA-0064 | Op-replication + conflict resolution between UCHs |
| Cognitive Consensus Layer       | IDEA-0065 | Calibrated voting, fusion, evidence weighting     |
| Cognitive Reasoning Profiler    | IDEA-0066 | Per-run token/depth/hit-rate/energy profiles      |
| Organ Design System             | IDEA-0067 | Organ lifecycle, signal archetypes, patterns      |

The round's headline: the intake's own framing — "these are missing
sciences" — is half right and half a promotion. The truly missing
sciences are **three**: the compiler stack (IR → optimizer → execution
graph, which the corpus has only as CIR draft), the **kernel debugger**
(grep confirms zero breakpoint semantics in src/), and **formal
verification**. The other twenty-one are either already executed (ABI,
ISA, transactions, replay, packages, drivers, DNA, ontology) or
partials whose delta is recorded above. The strategic consequence is
exactly the user's closing claim: the next major investment is not more
capabilities — it is promoting RFC-0004 (CIR) to Specification and
building the compiler reference implementation, because CVM, CEL,
instruction optimization, and formal verification are all stacked on
that one block.

## 14. The microscopic-infrastructure intake (2026-08-01, round 11)

Verdict after mapping the 15-category corpus (capability negotiation,
feature flags, versioned cognition, deprecation, health/watchdogs/
self-healing/quarantine/safe mode, cognitive SRE, universal lifecycle,
contracts, failure taxonomy, intent, lineage, human factors, cognitive
UX, memory hygiene, plugin governance, deterministic engineering,
taste, specification repository) against the repo: **~55% already has
ancestors executed or tracked** — but the intake's own framing holds:
these are not features, they are the microscopic layer that
distinguishes an OS from a framework, and the missing half is
infrastructure, not AI.

Executed/tracked evidence: capability negotiation already exists at
workspace level (`src/workspace-manifest/negotiation.ts` — version +
capability/driver negotiation at attach; the TLS analog at exactly one
level); versioning covers specs (spec/VERSION.md), genomes (WS-C
VersionedStore), and laws (numbers immutable) with a 'deprecated'
lifecycle state in capability-protocol.ts and deprecation warnings in
genome.ts; health has WS-E's 12 SMART metrics with band logic plus the
fast-path status/health/memory routines; quarantine is substantially
executed (WS-P package quarantine + immune-organ antibodies);
watchdogs exist only for transports (SSE/A2A heartbeats) and the
parahippocampal poisoning watchdog — not for organ liveness; metrics
are abundant but scattered (budgets, SMART, benchmark runners, ADR-004
profiles, the round-10 profiler IDEA-0066) with zero SLO semantics;
lifecycles exist but disjoint (SOP-08's 13 RFC stages, IDEA-0056
object lifecycle, IDEA-0067 organ lifecycle, WS-C versioning);
contracts exist as prose and verdicts (MANIFESTO §6, conformance,
compliance, IDEA-0019); failure classes exist for physics (RFC-0005's
four families) and engineering concepts (tier-08), not faculties;
intent has its IR half (CIR draft, CEL) but no intent envelope;
lineage fragments span ledger provenance, UER, the time machine, and
the decision journal; deterministic engineering is enforced as process
(organic-code 6-gate, DOE SOPs, GSD) with twin/benchmark/UER as
substrates; taste is already scored — the Organic Score rubric covers
six of the seven qualities; and the spec-first direction is a settled
platform decision (Platform Zero, conformance, spec-version gate,
IDEA-0048). Grep-proven absents: feature flags (0 matches), SLO/
service-level semantics (0), safe mode (0), deprecation _engine_ (only
a state and warnings), organ-level watchdogs, and machine-readable
specs.

The true delta is 16 proposals, tracked as idea notes IDEA-0068…0083:

| Category                                          | Idea      | Delta                                                                                                                 |
| ------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| Capability Negotiation & Discovery                | IDEA-0068 | Workspace-level negotiate exists; no cognitive-level handshake, no discovery queries                                  |
| Feature Flags + Versioned Cognition + Deprecation | IDEA-0069 | Zero flag semantics; versions cover specs/genomes/laws, not beliefs/strategies; deprecation is a state, not an engine |
| Organ Health, Watchdogs & Safe Mode               | IDEA-0070 | Diagnostics bands exist; no per-organ health machine, no liveness watchdogs, no safe-mode boot                        |
| Cognitive SLOs                                    | IDEA-0071 | Metrics scattered; no named-quantity catalog with targets, error budgets, escalation                                  |
| Universal Lifecycle Engine                        | IDEA-0072 | SOP-08/0056/0067/WS-C are disjoint machines; no Extinct terminal state, no lifecycle registry                         |
| Contracts Registry                                | IDEA-0073 | MANIFESTO §6 + conformance are prose/verdicts; no nine-field structured contract records                              |
| Failure Taxonomy                                  | IDEA-0074 | RFC-0005 classes physics failures; no ten-faculty runtime classes with per-class response                             |
| Intent Objects                                    | IDEA-0075 | CIR/CEL are the IR half; no intent envelope (goal/success/risk/evidence) compiling into them                          |
| Knowledge Lineage Service                         | IDEA-0076 | Ledger/UER/journal fragmentation; no uniform five-question answer surface                                             |
| Human Factors Model                               | IDEA-0077 | Anthropology models teams; no per-user workflow-optimization profile                                                  |
| Cognitive UX Charter                              | IDEA-0078 | Six felt properties unnamed, unmeasured, uncontracted; no interrupt protocol                                          |
| Memory Hygiene Engine                             | IDEA-0079 | Sleep/vmem/compressor exist per-organ; no orchestrated hygiene pipeline, no conflict policy                           |
| Plugin Trust Scoring                              | IDEA-0080 | WS-P is binary, marketplace certifies listings; no six-axis scorecard for the organism to decide                      |
| Deterministic Engineering Chain                   | IDEA-0081 | Discipline is process (organic-code/DOE/GSD); no chain contract with mandatory evidence artifacts                     |
| Engineering Taste                                 | IDEA-0082 | Organic Score already scores six of seven; rubric is code not spec; no taste accumulation                             |
| Specification Repository                          | IDEA-0083 | Platform Zero direction + prose spec/ + version gate; no machine-readable specs, no generated implementations         |

The round's headline is the intake's last claim: the **Specification
Repository**. The corpus chose spec-first (Platform Zero — "the
specification is the source of truth") but stopped at prose: specs are
markdown read by humans and enforced by tests, not machine-readable
data that implementations are generated from. That last step is the
keystone — contracts (0073), SLOs (0071), the failure taxonomy (0074),
lifecycles (0072), and the taste rubric (0082) all become data in the
repository — and it is also the natural continuation of round-10's
headline: promoting RFC-0004 (CIR) to Specification becomes the
repository's proof case, with the compiler _generated from the spec_
rather than handwritten. Verdict on the intake's own verdict: roughly
half is already in flight; the missing half is dominated by the
repository and the reliability layer (flags, health, SLOs, safe mode),
not by new organs.

## 15. The microarchitecture + physics intake (2026-08-01, round 12)

This intake makes two claims. **First, the microarchitecture claim**:
compare UCH to a CPU — the ISA (laws, organs, signals, governance) and
the operating system (kernel, runtime, memory, drivers) exist; what
remains is the _microarchitecture_: clocks, pulses, signal QoS/TTL,
locality, speculation, interrupts, backpressure, causal propagation,
lifecycle mechanics. "Everyone is still designing runtimes; very few
are designing the physics that govern those runtimes." **Second, the
science claim**: twelve disciplines — Cognitive Mathematics, Physics,
Chemistry, Biology, Ecology, Economics, Evolution, Genetics,
Embryology, Psychology, Sociology, Civilization — as universal
primitives from which future modules emerge. Closing framing: **The
Cognitive Constitution of Computing**, one foundational document
(POSIX/LLVM-IR role) that every implementation — TypeScript, Rust,
every IDE driver — implements.

**Verdict after corpus mapping (2026-08-01, verified):** the
microarchitecture is far more executed than the framing suggests —
the clock (catalog.ts `nextCognitiveTick`, tick-based scheduling in
15+ organs), pulse (health registry heartbeats + WS-E SMART metrics),
signal QoS (SignalPriority 0-4 + Law 16 preemption + ux-charter
interrupts), compression/dedup (sleep cycle + context compressor),
replay (ADR-002 + time machine + UER), forgetting (memory hygiene +
vmem archive + Law 5), residency/paging (vmem Hot→Warm→Cold→Archive +
retrieval ladder), snapshots/checkpoints (sessions + WS-D
transactions), pipelines (CIR 17-pass + accelerators + engineering
chain), speculation/branch prediction (IDEA-0030 + fast-path router),
circuit breakers (CIC + immune), provenance trees (lineage service +
UER ancestry), causal graph (UER) — all exist. The twelve disciplines
are ~90% anchored (Mathematics IDEA-0026/0005/0035; Physics RFC-0005,
the 32 laws, IDEA-0044; Chemistry IDEA-0002; Biology
COGNITIVE_BIOLOGY + IDEA-0007; Ecology IDEA-0007; Economics
IDEA-0016/0034; Evolution IDEA-0008; Genetics GENOME + IDEA-0008;
Embryology IDEA-0039, Sociology IDEA-0027/0064, Civilization
IDEA-0027 + attach/merge). The Constitution claim is anchored in
Platform Zero + CONSTITUTION + RFC-0000 + IDEA-0048/0083.

**The true delta is 11 ideas (IDEA-0084…0094)**, dominated by signal
lifecycle mechanics, belief semantics, the expression system, and the
constitution framing:

| Claim                                          | Idea      | Delta vs corpus                                                                                                |
| ---------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| Signal TTL / expiry / GC                       | IDEA-0084 | TTL is point-case only (availability, cache, hygiene); no signal-envelope freshness, no expiry→GC on the bus   |
| Signal noise filter / amplification            | IDEA-0084 | Cortex/retrieval gates exist; no signal-layer admission (attention earned), no repetition-amplification policy |
| Backpressure / rate limiting                   | IDEA-0085 | Persistence-write backpressure only; no producer-facing admission, no per-source limiters                      |
| Confidence / trust / contradiction propagation | IDEA-0086 | Activation propagates, belief does not; no support/attack graph, no ripple, no trust flow                      |
| Memory / knowledge locality                    | IDEA-0087 | Temporal paging exists; no concept-neighborhood placement or re-packing                                        |
| Semantic locks / extended transactions         | IDEA-0088 | WS-D is linear; no locks, savepoints, nesting, optimistic concurrency, version vectors                         |
| Capability leasing                             | IDEA-0089 | Grants static until revoked; lifecycle states not time-bounded; no renewal                                     |
| DNA expression / proteins / epigenetics        | IDEA-0090 | Genome is config read at boot; no expression step, no runtime proteins, no environment profiles                |
| Morphogenesis                                  | IDEA-0091 | Organs installed wholesale; embryology is workspace-level, not organ-level; no developmental program           |
| Cognitive Psychology                           | IDEA-0092 | Laws + AttentionCortex + fences exist; no mechanism catalog with compensation loops                            |
| Attention algebra                              | IDEA-0093 | Bottleneck + SLO + budgets unbound; no conserved-quantity axiom, no operator set                               |
| The Constitution of Computing                  | IDEA-0094 | All ingredients exist as a corpus; no single canonical document with the POSIX/LLVM-IR role                    |

**Verdict on the intake's verdict:** the framing (ISA vs OS vs
microarchitecture; physics of runtimes) is right and useful — the
intake's strongest claims are the ones that map onto existing organs
(the clock, QoS, replay, speculation, breakers are already built). The
genuinely new primitives are the **expression system** (genes →
proteins → behavior + epigenetics — genome becomes developmental, not
config) and **belief propagation** (confidence/trust/contradiction
flow — the semantic layer over UER's causal graph). The Constitution
is a real artifact gap, but its first deliverable is a boundary
decision against IDEA-0048 (doc set) and IDEA-0083 (repository), not
new prose. As with every prior round: SOP-08 stage 1, zero code, zero
spec edits.

## 16. The specification-layers intake (2026-08-01, round 13)

This intake makes two claims. **First, the layers claim**: UCH should
split into four specification layers — Constitution (ontology, RFC 0
role), Cognitive Physics (invariant laws), Cognitive ISA (instruction
set), and the Reference Runtime — instead of one monolithic
architecture, in the LLVM/POSIX pattern: "specification becomes the
stable foundation, while runtimes, IDE integrations, language
bindings, and future cognitive engines remain replaceable
implementations." The ISA list is named (OBSERVE, ATTEND, ENCODE,
ASSOCIATE, PLAN, SIMULATE, VERIFY, EXECUTE, REFLECT, CONSOLIDATE,
SLEEP, FORGET, SNAPSHOT, RESTORE, CHECKPOINT, FORK, MERGE, ROLLBACK).
**Second, the ABI claim**: an ISA is not enough; a platform needs a
Cognitive ABI — the contract that lets independently developed organs
and runtimes interoperate — with every organ exposing a six-method
interface (observe, process, checkpoint, restore, health,
capabilities), "analogous to POSIX for operating systems or LLVM IR
for compilers." The closing move: freeze a versioned specification set
(Constitution v1.0, Physics v1.0, Mathematics v1.0, ISA v1.0, ABI
v1.0, Microarchitecture v1.0) plus a Reference Microkernel as the
smallest executable implementation.

**Verdict after corpus mapping (2026-08-01, verified):** the layers
claim is ~90% already executed — the Constitution layer is
spec/CONSTITUTION.md (Articles I–XI, Immutability of the Core) +
COGNITIVE_ONTOLOGY.md + RFC-0000 (governance); the Physics layer is
the 32 laws + RFC-0005 (normative) + IDEA-0044 (candidate-law
register 32→50–100); the Mathematics layer is IDEA-0026 + the
operator sets (attention algebra IDEA-0093, belief algebra IDEA-0086,
closed forms IDEA-0005); the ISA layer is spec/CP.md v1.0.0 (17 ops —
observe/remember/retrieve/learn/think/simulate/reflect/critique/
consolidate/…, most of the named list already present) + the CIR
instruction model (RFC-0004) + src/protocol/catalog.ts metadata; the
layering itself is design/STACK.md (six independently versioned
layers, the Internet model) + IDEA-0048 (consolidated normative spec)

- IDEA-0083 (spec repository). The discipline claim (Computational
  Cognitive Science as a layer between Distributed Systems and Cognitive
  Operating Systems) is IDEA-0024. The freeze-and-order recommendation
  is the Platform Zero decision already in force (spec-first, spec-
  version gate, conformance-as-certification).

**The true delta is 1 idea (IDEA-0095)** — the Cognitive ABI, the one
artifact the corpus does not have:

| Claim                                      | Idea      | Delta vs corpus                                                                                                                                                                                                                                       |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cognitive ABI (six-method organ contract)  | IDEA-0095 | CP is kernel-facing (ops), CIC is transport-facing (envelope), compliance certifies drivers; no versioned, certifiable organ surface that binds observe/process/checkpoint/restore/health/capabilities into one contract third-party organs implement |
| ISA instruction list                       | —         | ~all named ops already in CP v1.0 (OBSERVE→observe, SIMULATE→simulate, VERIFY→critique, REFLECT→reflect, CONSOLIDATE→consolidate, SNAPSHOT/RESTORE/CHECKPOINT/ROLLBACK→WS-D semantics, FORK/MERGE→IDEA-0088)                                          |
| Layer 2 operator semantics                 | —         | Attention algebra IDEA-0093, belief algebra IDEA-0086, closed forms IDEA-0005 already define operators with semantics; pre/postcondition contracts fold into IDEA-0095's method contracts                                                             |
| Six microarchitecture engines              | —         | Temporal/Signal/Memory/Execution/Knowledge/Adaptation = a cataloging taxonomy over IDEA-0084…0094 (round 12), not new primitives                                                                                                                      |
| Biological stack + developmental computing | —         | IDEA-0090 (genes→proteins→behavior, epigenetics) + IDEA-0091 (morphogenesis program) already cover it                                                                                                                                                 |
| Versioned spec freeze                      | —         | Platform Zero + spec/VERSION.md gate + IDEA-0048/0083; the freeze is a governance action already in flight                                                                                                                                            |

**Verdict on the intake's verdict:** the layers framing is a
restatement of the STACK.md Internet model with cleaner names, and
the ISA is already v1.0 — the genuinely new artifact is the **Cognitive
ABI**: the kernel-to-organ boundary contract, the organ-side twin of
driver compliance. It is a natural Phase-02 candidate: WS-D
checkpoint/restore, the health registry, the capability registry, and
driver compliance are its seeds, so a prototype (one organ certified
against the six-method contract) is cheap. As with every prior round:
SOP-08 stage 1, zero code, zero spec edits.
