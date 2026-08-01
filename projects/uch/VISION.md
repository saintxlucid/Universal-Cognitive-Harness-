# VISION.md â€” UCH as Open Cognitive Infrastructure

- **Status:** Living strategic document
- **Date:** 2026-08-01
- **Companions:** [MANIFESTO.md](MANIFESTO.md) (the organism),
  [SPEC.md](SPEC.md) (the runtime spec), [design/ADR-005](design/ADR-005-universal-cognitive-protocol.md)
  (the protocol), [design/GAP-CLOSURE-PLAN.md](design/GAP-CLOSURE-PLAN.md) (the delta)

## 1. The one-sentence vision

> **UCH is an open cognitive runtime specification that allows any AI agent, IDE, or
> autonomous system to attach to the same persistent organism through standardized
> drivers, cognitive protocols, and event semantics.**

And why â€” the purpose clause:

> **UCH exists to preserve and compound cognitive capital independently of any
> model, application, vendor, or human lifetime. It treats cognition as durable
> infrastructure rather than transient computation.**

The one-sentence vision states the **mechanism** (any tool attaches to one
persistent organism). The purpose clause states the **end**: engineering
judgment accumulates across models, teams, and years instead of leaving with
the session that produced it. A product may satisfy the mechanism and still
fail the purpose; the purpose is the acceptance test.

## 2. The strategic thesis

TCP/IP, POSIX, LLVM, Docker, Kubernetes â€” none of them won by having more features.
They won by becoming **the compatibility layer everyone else built on**.

- Nobody _installs_ TCP/IP. Everyone _implements_ it.
- Docker isn't the standard; **OCI** is.
- LLVM isn't Clang; it's the **IR**.
- POSIX isn't Linux; it's the **specification**.

The same move is available for AI coding tools â€” and the window is open precisely
because every vendor (VS Code Agent Host, Codex App Server, MCP, ACP) is currently
building _host-specific_ cognition rails, none of which persists across hosts.

**UCH is not competing to be the best AI coding tool. It is the cognitive
infrastructure that every AI coding tool can adopt.**

If Docker had tried to be the best Linux distribution, it would not have changed the
industry. It became infrastructure instead. That is the position UCH is closest to
occupying â€” provided it stays vendor-neutral, protocol-first, and grounded in official
integration points rather than private internals.

## 3. The five-product architecture

```text
UCH Specification        the constitution â€” protocols, schemas, Laws, driver
                         contracts, memory contracts, signal contracts, episode
                         contracts. No code. Versions independently of the runtime.
        â”‚
        â–¼
UCH Reference Runtime    the persistent organism â€” memory, signals, scheduler,
                         brains, genome, policies. The reference implementation
                         of the specification.
        â”‚
        â–¼
UCH SDKs                 Rust, TypeScript, Python, Go, C#, Java, Swift, C++ â€”
                         any application builds drivers against the spec.
        â”‚
        â–¼
UCH Drivers              per-host adapters (Claude, Codex, Cursor, Copilot,
                         OpenCode, JetBrains, Neovim...), composed from reusable
                         sensors (read) and effectors (act).
        â”‚
        â–¼
UCH Marketplace          governed distribution of skills, brains, knowledge,
                         policies, and cognitive packages.
```

## 4. What is already true in this repo (2026-08-01, verified)

The five-product split is not aspirational; four of the five layers exist:

| Product layer         | Current state                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specification**     | `spec/` â€” Laws, Constitution, Genome, ontology, CP. `design/` â€” ADR-001â€¦005, CIC v0.1 (transport-neutral contract), INTEGRATION-LEVELS, LIVE-COGNITIVE-STATE. Versioning boundary: pending (GAP-CLOSURE-PLAN Phase 3) |
| **Reference runtime** | `src/` â€” kernel, brains, organs, Mnemosyne, trace ledger, projection engine, sleep cycle, connectome, engineering intelligence, 2,200+ tests                                                                              |
| **SDKs**              | MCP surface (47 tools), CLI (`uch`), CIC transports (MCP/A2A/CloudEvents planned)                                                                                                                                           |
| **Drivers**           | `src/drivers/` â€” acp, agent, filesystem, git, ide, mcp, runtime + sensor/effector composition layer; per-host integration docs (`design/integrations/`)                                                                   |
| **Marketplace**       | Not built â€” requires Cognitive Packages first (GAP-CLOSURE-PLAN Phase 4)                                                                                                                                                  |

## 5. The compatibility-layer argument, concretely

VS Code's Agent Host already ships dedicated host, immutable session updates,
snapshots, reducers, JSON-RPC, multiple clients, reconnect, synchronization. UCH does
not replace that â€” **it plugs underneath it**: the Agent Host (and Codex App Server,
and MCP, and every future host) becomes a _driver_ attached to the same persistent
organism. One workspace, one organism, any tool.

The universal protocol (ADR-005) makes this concrete: every host's session concept
normalizes into an **Episode**; every observable artifact becomes a **Cognitive
Trace**; every handoff synchronizes **Live Cognitive State** (mind state, not chat
history); every host participates at the integration level it actually exposes
(L0â€“L4, graceful degradation, never privileged assumption).

## 6. The differentiators

- **Cognitive Time Machine** â€” "what did the organism believe on date X" answered by
  reconstructing the belief graph, not searching chats.
- **Cognitive Replay** â€” an engineering session replayed like a debugger, as the
  acceptance test of Law 12 (Reversibility).
- **Cognitive Merge** (research track) â€” the flagship: two engineers, two tools, six
  hours each, then merge _cognition_ â€” knowledge, lessons, beliefs, conflicts. The
  trivial slice (non-overlapping union) is buildable now; conflict resolution is an
  open research problem.

## 7. What this document does not decide

- Renaming UCH to "Universal Cognitive Substrate" mid-project â€” flagged open in the
  spec (ADR-005 chose to document the three-layer naming without renaming).
- The candidate Law ("No application shall own cognition") â€” proposed in
  `design/PROPOSED-LAW-OWNERSHIP-OF-COGNITION.md`, adoption belongs to the community
  process governing the Laws.
- Marketplace as a business â€” product roadmap, depends on Cognitive Packages.

## 8. The primitive-first principle

UCH's operating question is not "how do we build this feature?" but **"what new
primitive would make this feature unnecessary?"** Files, git objects,
containers, and LLVM IR changed computing because each introduced a primitive
that absorbed an entire class of problems. The same test applies here: every
proposal must state the primitive it introduces; features are acceptable only
when no primitive can absorb the problem.

The primitive candidates currently on the table are catalogued as idea notes in
`rfc/ideas/` (the 2026-08-01 intake, IDEA-0010â€¦0023): signal fabric, cognitive
physiology, the executable digital twin, cognitive manufacturing, the
observatory, engineering gravity, cognitive economics, reality synchronization,
cognitive silicon, cognitive operating contracts, cognitive units (COC), the
cognitive hypervisor, the architecture review board, and elemental cognitive
primitives. None of these is approved work â€” each is a candidate primitive
waiting for the spike discipline (SOP-08) to prove it absorbs a class of
problems before it earns implementation.

## 9. The discipline claim (2026-08-01 intake, round 6)

The next step past primitives is a discipline: **Cognitive Systems
Engineering** â€” deriving everything from Laws â†’ Mathematics â†’ Specifications â†’
Protocols â†’ Compilers â†’ Reference Implementations â†’ SDKs â†’ Applications, the
way TCP/IP, LLVM, POSIX, USB, OpenGL, Vulkan, and OCI are ecosystems rather
than software. Two consequences are recorded as _proposals_, not decisions:

- **Ambient endgame** â€” the runtime disappears; developers experience
  Workspace Intelligence through any viewport (the CDE â€” Cognitive
  Development Environment), the way TCP and virtual memory are invisible.
- **Roadmap revision** â€” the five products become Specification, Reference
  Runtime, Cognitive Engineering Suite (compiler, simulator, observatory,
  analysis, verification), Universal Driver Layer, and Cognitive Standard
  (conformance, certification, benchmarks, SDKs, governance) â€” replacing
  "Marketplace" with Engineering Suite + Standard.
- **Repository restructure** into a platform layout (`specs/`, `math/`,
  `physics/`, `compiler/`, `isa/`, `abi/`, `runtime/`, `sdk/`, `drivers/`,
  `reference/`, `research/`, `compliance/`, `certification/`, `simulator/`,
  `benchmarks/`) â€” explicitly **not decided** here: it is a high-churn
  governance decision (build, tests, docs, tooling all key to `src/`), to be
  evaluated with a migration plan like the rename decision in Â§7.

The round-6 intake is tracked as idea notes IDEA-0024â€¦0032 (CSE, ambient
cognition/CDE, cognitive mathematics, cognitive sociology, cognitive
motherboard, cache hierarchy, cognitive speculation, reality compiler,
consciousness levels). The eight-discipline ladder is recorded in
GENESIS.md chapter 3 as framing with corpus mappings.

## 10. The firmware-compute claim (2026-08-01 intake, round 7)

Verdict after repo-wide mapping: ~65% of the round-7 vision already has
ancestors executed or tracked â€” the firmware engines map onto integrity
laws + structuredFacts (truth), gatherer + sensors + IDEA-0017/0031
(reality sync), context compressor (context), sleep cycle + vmem
(memory), engineering-intelligence (architecture + refactoring),
OrganicScoreEngine (organic code), IDEA-0012 (simulation), meta-cognition
DBs (meta), IDEA-0016 (economics), IDEA-0008 (genetics), IDEA-0009
(time), IDEA-0014 (observatory), RFC-0004 + ADR-006 (CIR/microkernel),
ADR-004 (virtual processors). The genuine delta is 15 proposals, tracked
as idea notes IDEA-0033â€¦0047.

The category claim: a capability hierarchy that gives every new feature a
home instead of another isolated module â€” **Laws** (immutable rules) â†’
**Kernel Services** (ADR-006 primitives) â†’ **Firmware** (permanent
cognitive behaviors; IDEA-0033) â†’ **Accelerators** (optimized execution
pipelines; IDEA-0046) â†’ **Organs** (specialized systems) â†’ **Skills**
(composable workflows) â†’ **Drivers** (host adapters) â†’ **Applications**.
Firmware is the new tier: behavior that changes how the organism
behaves, not what it knows.

The science claim: a Theory of Intelligence (IDEA-0034) â€” one decision
law (maximize Expected Utility + Information Gain under Energy + Risk +
Latency costs) from which planning, memory, learning, reflection,
scheduling, and verification derive as special cases â€” plus named
disciplines: Cognitive Information Theory (IDEA-0035), Topology
(IDEA-0036), Thermodynamics (IDEA-0037), Immunology (IDEA-0038),
Embryology (IDEA-0039), Jurisprudence (IDEA-0040), Anthropology
(IDEA-0041), Archaeology (IDEA-0042), Astronomy + Instruments
(IDEA-0043), law expansion (IDEA-0044), and the Cognitive Virtual
Machine (IDEA-0045) â€” CIR as the LLVM IR of cognition, CVM as the JVM,
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
knowledge â€” the acceptance test of Law 12 applied across tools.

## 11. The foundations intake (2026-08-01, round 8)

Verdict after repo-wide mapping: the "40% designed / 60% missing" split
is optimistic about the delta â€” roughly 70% of the 21 foundations
already have ancestors executed or tracked: F0 spec stack; F1 CVM â†’
IDEA-0045; F2 driver architecture â†’ `src/drivers/` + CIC + compliance;
F5 reality â†’ IDEA-0017/0031 + sensors; F6/F16 simulation + twin â†’
IDEA-0012/0013; F7 benchmark â†’ IDEA-0018 + EI benchmark runner; F8
observatory â†’ IDEA-0014; F10 packages â†’ WS-P + IDEA-0019; F13 research
â†’ IDEA-0033 Layer 9 + research registers; F15 manufacturing â†’
IDEA-0013 + organic-code gates; F17 economy â†’ IDEA-0016 + budgets;
F18 evolution â†’ IDEA-0008 + DNA; F20 civilization â†’ CIC + attach +
merge + IDEA-0007; F14 graph â†’ IDEA-0050). The user's deeper claim
holds: the missing material is infrastructure, not AI features.

The true delta is 8 proposals, tracked as idea notes IDEA-0048â€¦0055:

| Foundation                | Idea      | Delta                                                                     |
| ------------------------- | --------- | ------------------------------------------------------------------------- |
| F0 Formal Specification   | IDEA-0048 | One normative doc set; timing/determinism/persistence specs missing       |
| F3 Storage Engine         | IDEA-0049 | Unified storage contract over pluggable backends                          |
| F4 + F14 Knowledge Fabric | IDEA-0050 | Cross-domain artifact graph; per-domain graphs exist, the fabric does not |
| F9 Engineering Database   | IDEA-0051 | Tradeoffs, meetings, successes, experiments as first-class records        |
| F11 Skill Compiler        | IDEA-0052 | Skill DSL â†’ IR â†’ optimizer â†’ runtime; skills are prose today        |
| F12 Constitution Engine   | IDEA-0053 | Execute-time enforcement; checks exist at evaluation points only          |
| F2 + F19 Driver Ecosystem | IDEA-0054 | Per-IDE adapters + automated cross-host/OS certification matrix           |
| CEL                       | IDEA-0055 | Mission â†’ CIR â†’ CVM; makes UCH programmable, not configurable         |

The CEL claim is the round's headline: with CEL compiling through CIR
to the CVM, models become execution backends of user-written programs,
and UCH shifts from "an implementation" to "a programmable cognitive
platform" â€” the C-to-LLVM relationship for cognition. Like every
proposal here it stays at SOP-08 stage 1 until a spike proves it
absorbs the problem class.

## 12. The platform infrastructure intake (2026-08-01, round 9)

Verdict after repo-wide mapping of the Phase Î© corpus (cognitive
filesystem, bus, transactions, time machine, object model, query
language, package manager, marketplace, digital twin, genome, reality
engine, knowledge graph, universal replay, observatory, compiler,
hypervisor, scheduler, cache hierarchy, CHAL, microkernel): ~90% already
has ancestors executed or tracked â€” CFS â†’ `src/neural-fs` (version-store,
mounts); CBUS â†’ neural-event-bus + IDEA-0010; transactions â†’ WS-D
transactional cognition; time machine â†’ `cognitive-time-machine.ts`
(beliefsAt / beliefTimeline / diffBeliefs); package manager â†’ WS-P;
twin â†’ IDEA-0012; genome â†’ IDEA-0008 + spec/GENOME.md + WorkspaceDNA;
reality â†’ IDEA-0017/0031 + sensors/effectors; knowledge graph â†’
IDEA-0050; universal replay â†’ IDEA-0047 + ADR-002; observatory â†’
IDEA-0014; compiler â†’ RFC-0004 + IDEA-0055; hypervisor â†’ IDEA-0021
plus the WS-A process model; kernel scheduler â†’
`src/accelerators/scheduler.ts` with IDEA-0034; cache hierarchy â†’
IDEA-0029 + vmem L0â€“Archive; CHAL â†’
ADR-004 virtual processors + IDEA-0046; microkernel â†’ ADR-006 (accepted;
kernel shipping wave landed); evolution laboratory â†’ IDEA-0008's
mutate â†’ simulate â†’ benchmark â†’ constitution â†’ approve â†’ deploy â†’
observe pipeline.

The true delta is 3 proposals, tracked as idea notes IDEA-0056â€¦0058:

| Phase Î© item            | Idea      | Delta                                                                  |
| ------------------------ | --------- | ---------------------------------------------------------------------- |
| Cognitive Object Model   | IDEA-0056 | One identity + lifecycle for every cognitive object class              |
| Cognitive Query Language | IDEA-0057 | Declarative language with confidence/importance/causal predicates      |
| Cognitive Marketplace    | IDEA-0058 | Governance-gated distribution of organs, genomes, constitutional packs |

The round's headline is the ecosystem trio: an object model everything
obeys, a query language everything answers, and a marketplace everything
distributes. CQL is the most novel primitive claim â€” a SQL-for-cognition
with causal operators appears in no surveyed agent-OS work; the
marketplace's governance constraint (a pack may never weaken a Law,
mirroring WS-P) is what keeps the ecosystem from becoming a security
hole. On the user's 40%/60% split, the round-9 verdict is: the Phase Î©
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
| Draft-only | 3     | compiler, IR, optimizer â€” one stack: CIR (RFC-0004), design-only                               |
| Partial    | 9     | scheduler policies, hypervisor, GC, allocator, security, networking, consensus, profiler, design |
| Absent     | 2     | kernel debugger, formal verification                                                             |

Executed evidence: CP v1.0.0 is literally the syscall ABI of the
Cognitive OS (spec/CP.md, conformance-gated) with CIC v0.1 grants on
top; the user's 18-instruction ISA list (Observeâ€¦Rollback) maps to CP
ops plus WS-D rollback, compression accelerator, and cognitive merge;
WS-D transactional cognition is exactly "memory + knowledge + genome +
signals + beliefs commit together, rollback on failed verification";
replay spans the ledger, cognitive-replay, the time machine, and UER.
The user's closing stack (SDK â†’ Runtime â†’ Compiler â†’ IR â†’ VM â†’ Kernel â†’
Microkernel â†’ fabrics) has every rung present _in some form_ â€” which
makes the missing rungs more visible, not less.

The true delta is 9 proposals, tracked as idea notes IDEA-0059â€¦0067:

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

The round's headline: the intake's own framing â€” "these are missing
sciences" â€” is half right and half a promotion. The truly missing
sciences are **three**: the compiler stack (IR â†’ optimizer â†’ execution
graph, which the corpus has only as CIR draft), the **kernel debugger**
(grep confirms zero breakpoint semantics in src/), and **formal
verification**. The other twenty-one are either already executed (ABI,
ISA, transactions, replay, packages, drivers, DNA, ontology) or
partials whose delta is recorded above. The strategic consequence is
exactly the user's closing claim: the next major investment is not more
capabilities â€” it is promoting RFC-0004 (CIR) to Specification and
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
ancestors executed or tracked** â€” but the intake's own framing holds:
these are not features, they are the microscopic layer that
distinguishes an OS from a framework, and the missing half is
infrastructure, not AI.

Executed/tracked evidence: capability negotiation already exists at
workspace level (`src/workspace-manifest/negotiation.ts` â€” version +
capability/driver negotiation at attach; the TLS analog at exactly one
level); versioning covers specs (spec/VERSION.md), genomes (WS-C
VersionedStore), and laws (numbers immutable) with a 'deprecated'
lifecycle state in capability-protocol.ts and deprecation warnings in
genome.ts; health has WS-E's 12 SMART metrics with band logic plus the
fast-path status/health/memory routines; quarantine is substantially
executed (WS-P package quarantine + immune-organ antibodies);
watchdogs exist only for transports (SSE/A2A heartbeats) and the
parahippocampal poisoning watchdog â€” not for organ liveness; metrics
are abundant but scattered (budgets, SMART, benchmark runners, ADR-004
profiles, the round-10 profiler IDEA-0066) with zero SLO semantics;
lifecycles exist but disjoint (SOP-08's 13 RFC stages, IDEA-0056
object lifecycle, IDEA-0067 organ lifecycle, WS-C versioning);
contracts exist as prose and verdicts (MANIFESTO Â§6, conformance,
compliance, IDEA-0019); failure classes exist for physics (RFC-0005's
four families) and engineering concepts (tier-08), not faculties;
intent has its IR half (CIR draft, CEL) but no intent envelope;
lineage fragments span ledger provenance, UER, the time machine, and
the decision journal; deterministic engineering is enforced as process
(organic-code 6-gate, DOE SOPs, GSD) with twin/benchmark/UER as
substrates; taste is already scored â€” the Organic Score rubric covers
six of the seven qualities; and the spec-first direction is a settled
platform decision (Platform Zero, conformance, spec-version gate,
IDEA-0048). Grep-proven absents: feature flags (0 matches), SLO/
service-level semantics (0), safe mode (0), deprecation _engine_ (only
a state and warnings), organ-level watchdogs, and machine-readable
specs.

The true delta is 16 proposals, tracked as idea notes IDEA-0068â€¦0083:

| Category                                          | Idea      | Delta                                                                                                                 |
| ------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| Capability Negotiation & Discovery                | IDEA-0068 | Workspace-level negotiate exists; no cognitive-level handshake, no discovery queries                                  |
| Feature Flags + Versioned Cognition + Deprecation | IDEA-0069 | Zero flag semantics; versions cover specs/genomes/laws, not beliefs/strategies; deprecation is a state, not an engine |
| Organ Health, Watchdogs & Safe Mode               | IDEA-0070 | Diagnostics bands exist; no per-organ health machine, no liveness watchdogs, no safe-mode boot                        |
| Cognitive SLOs                                    | IDEA-0071 | Metrics scattered; no named-quantity catalog with targets, error budgets, escalation                                  |
| Universal Lifecycle Engine                        | IDEA-0072 | SOP-08/0056/0067/WS-C are disjoint machines; no Extinct terminal state, no lifecycle registry                         |
| Contracts Registry                                | IDEA-0073 | MANIFESTO Â§6 + conformance are prose/verdicts; no nine-field structured contract records                             |
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
Repository**. The corpus chose spec-first (Platform Zero â€” "the
specification is the source of truth") but stopped at prose: specs are
markdown read by humans and enforced by tests, not machine-readable
data that implementations are generated from. That last step is the
keystone â€” contracts (0073), SLOs (0071), the failure taxonomy (0074),
lifecycles (0072), and the taste rubric (0082) all become data in the
repository â€” and it is also the natural continuation of round-10's
headline: promoting RFC-0004 (CIR) to Specification becomes the
repository's proof case, with the compiler _generated from the spec_
rather than handwritten. Verdict on the intake's own verdict: roughly
half is already in flight; the missing half is dominated by the
repository and the reliability layer (flags, health, SLOs, safe mode),
not by new organs.

## 15. The microarchitecture + physics intake (2026-08-01, round 12)

This intake makes two claims. **First, the microarchitecture claim**:
compare UCH to a CPU â€” the ISA (laws, organs, signals, governance) and
the operating system (kernel, runtime, memory, drivers) exist; what
remains is the _microarchitecture_: clocks, pulses, signal QoS/TTL,
locality, speculation, interrupts, backpressure, causal propagation,
lifecycle mechanics. "Everyone is still designing runtimes; very few
are designing the physics that govern those runtimes." **Second, the
science claim**: twelve disciplines â€” Cognitive Mathematics, Physics,
Chemistry, Biology, Ecology, Economics, Evolution, Genetics,
Embryology, Psychology, Sociology, Civilization â€” as universal
primitives from which future modules emerge. Closing framing: **The
Cognitive Constitution of Computing**, one foundational document
(POSIX/LLVM-IR role) that every implementation â€” TypeScript, Rust,
every IDE driver â€” implements.

**Verdict after corpus mapping (2026-08-01, verified):** the
microarchitecture is far more executed than the framing suggests â€”
the clock (catalog.ts `nextCognitiveTick`, tick-based scheduling in
15+ organs), pulse (health registry heartbeats + WS-E SMART metrics),
signal QoS (SignalPriority 0-4 + Law 16 preemption + ux-charter
interrupts), compression/dedup (sleep cycle + context compressor),
replay (ADR-002 + time machine + UER), forgetting (memory hygiene +
vmem archive + Law 5), residency/paging (vmem Hotâ†’Warmâ†’Coldâ†’Archive +
retrieval ladder), snapshots/checkpoints (sessions + WS-D
transactions), pipelines (CIR 17-pass + accelerators + engineering
chain), speculation/branch prediction (IDEA-0030 + fast-path router),
circuit breakers (CIC + immune), provenance trees (lineage service +
UER ancestry), causal graph (UER) â€” all exist. The twelve disciplines
are ~90% anchored (Mathematics IDEA-0026/0005/0035; Physics RFC-0005,
the 32 laws, IDEA-0044; Chemistry IDEA-0002; Biology
COGNITIVE_BIOLOGY + IDEA-0007; Ecology IDEA-0007; Economics
IDEA-0016/0034; Evolution IDEA-0008; Genetics GENOME + IDEA-0008;
Embryology IDEA-0039, Sociology IDEA-0027/0064, Civilization
IDEA-0027 + attach/merge). The Constitution claim is anchored in
Platform Zero + CONSTITUTION + RFC-0000 + IDEA-0048/0083.

**The true delta is 11 ideas (IDEA-0084â€¦0094)**, dominated by signal
lifecycle mechanics, belief semantics, the expression system, and the
constitution framing:

| Claim                                          | Idea      | Delta vs corpus                                                                                                |
| ---------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| Signal TTL / expiry / GC                       | IDEA-0084 | TTL is point-case only (availability, cache, hygiene); no signal-envelope freshness, no expiryâ†’GC on the bus |
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
microarchitecture; physics of runtimes) is right and useful â€” the
intake's strongest claims are the ones that map onto existing organs
(the clock, QoS, replay, speculation, breakers are already built). The
genuinely new primitives are the **expression system** (genes â†’
proteins â†’ behavior + epigenetics â€” genome becomes developmental, not
config) and **belief propagation** (confidence/trust/contradiction
flow â€” the semantic layer over UER's causal graph). The Constitution
is a real artifact gap, but its first deliverable is a boundary
decision against IDEA-0048 (doc set) and IDEA-0083 (repository), not
new prose. As with every prior round: SOP-08 stage 1, zero code, zero
spec edits.

## 16. The specification-layers intake (2026-08-01, round 13)

This intake makes two claims. **First, the layers claim**: UCH should
split into four specification layers â€” Constitution (ontology, RFC 0
role), Cognitive Physics (invariant laws), Cognitive ISA (instruction
set), and the Reference Runtime â€” instead of one monolithic
architecture, in the LLVM/POSIX pattern: "specification becomes the
stable foundation, while runtimes, IDE integrations, language
bindings, and future cognitive engines remain replaceable
implementations." The ISA list is named (OBSERVE, ATTEND, ENCODE,
ASSOCIATE, PLAN, SIMULATE, VERIFY, EXECUTE, REFLECT, CONSOLIDATE,
SLEEP, FORGET, SNAPSHOT, RESTORE, CHECKPOINT, FORK, MERGE, ROLLBACK).
**Second, the ABI claim**: an ISA is not enough; a platform needs a
Cognitive ABI â€” the contract that lets independently developed organs
and runtimes interoperate â€” with every organ exposing a six-method
interface (observe, process, checkpoint, restore, health,
capabilities), "analogous to POSIX for operating systems or LLVM IR
for compilers." The closing move: freeze a versioned specification set
(Constitution v1.0, Physics v1.0, Mathematics v1.0, ISA v1.0, ABI
v1.0, Microarchitecture v1.0) plus a Reference Microkernel as the
smallest executable implementation.

**Verdict after corpus mapping (2026-08-01, verified):** the layers
claim is ~90% already executed â€” the Constitution layer is
spec/CONSTITUTION.md (Articles Iâ€“XI, Immutability of the Core) +
COGNITIVE_ONTOLOGY.md + RFC-0000 (governance); the Physics layer is
the 32 laws + RFC-0005 (normative) + IDEA-0044 (candidate-law
register 32â†’50â€“100); the Mathematics layer is IDEA-0026 + the
operator sets (attention algebra IDEA-0093, belief algebra IDEA-0086,
closed forms IDEA-0005); the ISA layer is spec/CP.md v1.0.0 (17 ops â€”
observe/remember/retrieve/learn/think/simulate/reflect/critique/
consolidate/â€¦, most of the named list already present) + the CIR
instruction model (RFC-0004) + src/protocol/catalog.ts metadata; the
layering itself is design/STACK.md (six independently versioned
layers, the Internet model) + IDEA-0048 (consolidated normative spec)

- IDEA-0083 (spec repository). The discipline claim (Computational
  Cognitive Science as a layer between Distributed Systems and Cognitive
  Operating Systems) is IDEA-0024. The freeze-and-order recommendation
  is the Platform Zero decision already in force (spec-first, spec-
  version gate, conformance-as-certification).

**The true delta is 1 idea (IDEA-0095)** â€” the Cognitive ABI, the one
artifact the corpus does not have:

| Claim                                      | Idea      | Delta vs corpus                                                                                                                                                                                                                                       |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cognitive ABI (six-method organ contract)  | IDEA-0095 | CP is kernel-facing (ops), CIC is transport-facing (envelope), compliance certifies drivers; no versioned, certifiable organ surface that binds observe/process/checkpoint/restore/health/capabilities into one contract third-party organs implement |
| ISA instruction list                       | â€”       | ~all named ops already in CP v1.0 (OBSERVEâ†’observe, SIMULATEâ†’simulate, VERIFYâ†’critique, REFLECTâ†’reflect, CONSOLIDATEâ†’consolidate, SNAPSHOT/RESTORE/CHECKPOINT/ROLLBACKâ†’WS-D semantics, FORK/MERGEâ†’IDEA-0088)                            |
| Layer 2 operator semantics                 | â€”       | Attention algebra IDEA-0093, belief algebra IDEA-0086, closed forms IDEA-0005 already define operators with semantics; pre/postcondition contracts fold into IDEA-0095's method contracts                                                             |
| Six microarchitecture engines              | â€”       | Temporal/Signal/Memory/Execution/Knowledge/Adaptation = a cataloging taxonomy over IDEA-0084â€¦0094 (round 12), not new primitives                                                                                                                    |
| Biological stack + developmental computing | â€”       | IDEA-0090 (genesâ†’proteinsâ†’behavior, epigenetics) + IDEA-0091 (morphogenesis program) already cover it                                                                                                                                             |
| Versioned spec freeze                      | â€”       | Platform Zero + spec/VERSION.md gate + IDEA-0048/0083; the freeze is a governance action already in flight                                                                                                                                            |

**Verdict on the intake's verdict:** the layers framing is a
restatement of the STACK.md Internet model with cleaner names, and
the ISA is already v1.0 â€” the genuinely new artifact is the **Cognitive
ABI**: the kernel-to-organ boundary contract, the organ-side twin of
driver compliance. It is a natural Phase-02 candidate: WS-D
checkpoint/restore, the health registry, the capability registry, and
driver compliance are its seeds, so a prototype (one organ certified
against the six-method contract) is cheap. As with every prior round:
SOP-08 stage 1, zero code, zero spec edits.

## 17. The compatibility-layer intake (2026-08-01, round 14)

**User decision (vision intake, "start thinking like LLVM, Kubernetes,
or POSIX")**: the ecosystem is fragmenting but the integration patterns
are converging (MCP, SDKs, CLIs, skills/context files, agent configs,
tool APIs, extension APIs, workspace context). The move is not to write
adapters one by one but to define a **Universal Cognitive Compatibility
Layer (UCCL)** that every adapter implements - ten compatibility tiers
(providers, coding applications, IDEs, editor protocols, version
control, CI/CD, clouds, container platforms, memory providers, agent
standards), a Universal Cognitive Adapter contract (discover/connect/
authenticate/capabilities/observe/execute/synchronize/heartbeat/
checkpoint/disconnect), a Universal Compatibility Matrix (UCM) as a
first-class spec, five certification brands (UCH Compatible/Native/
Enterprise/Verified/Certified), and a ten-layer vertical integration
model (identity, shared cognitive state, intent sync, execution fabric,
cross-model cognition, universal memory, semantic git, universal
debugging, cognitive time travel, living architecture) - with the
Cognitive Hypervisor as the substrate claim ("virtualizes cognition the
way a hardware hypervisor virtualizes CPUs") and a Cognitive
Introspection Protocol (CIP) as the disciplined leap ("MCP standardizes
tool access; CIP standardizes cognitive state exchange; deep semantic
integration, not unrestricted access").

**Verdict after corpus mapping (2026-08-01, verified):** ~80% already
executed - the compatibility thesis is section 2 of this document plus
design/ECOSYSTEM-COMPATIBILITY.md ("one contract, many adapters"),
design/UNIVERSAL-INTEGRATION.md (hive + per-runtime capture matrix),
design/integrations/COMPATIBILITY-MATRIX.md v1.0 (23 harnesses / 9 IDEs
/ 24 providers / 14 SDKs / 6 protocols), and design/integrations/*.md
per-runtime specs; the levels claim is design/INTEGRATION-LEVELS.md
(L0-L4 + T0-T4 transports, per-rail, graceful degradation) + driver
compliance (src/drivers/compliance.ts) + conformance.ts; negotiation
exists (workspace-manifest negotiation + capability-negotiation +
attach + projections); the event bus and ledger exist (neural-event-bus
and ADR-002); the hypervisor is IDEA-0021; the bus is IDEA-0010; the
twin is IDEA-0012; observability is IDEA-0014 + IDEA-0071; networking
is IDEA-0064 + CIC; memory is the model-independent memory manager;
nine of the ten layers map to executed machinery (identity, live
cognitive state, intent objects, ADR-004 fabric, cross-model consensus,
universal memory, workspace graphs + UER + archaeology, ADR-002 replay
and time machine); providers are already interchangeable execution
backends (ADR-004 virtual processors); the ACP driver exists
(src/drivers/acp/); the CIP payload shape is literally
design/LIVE-COGNITIVE-STATE.md (uch.cognitive-state.v1) in the
outbound direction.

**The true delta is 6 ideas (IDEA-0096..0101)**:

| Claim                                                                                      | Idea      | Delta vs corpus                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UCCL: one normative adapter contract + tier classification + one-source context generation | IDEA-0096 | Adapter contracts are per-family (drivers, protocol-adapter, ACP/MCP); no single ten-method contract third-party adapters implement and get certified on; context generation for external agents (AGENTS.md/Claude Skills/Cursor Rules/Copilot/Gemini/OpenCode from one source) is unowned |
| CIP: voluntary cognitive state exchange + Green/Yellow/Red consent zones                   | IDEA-0097 | Live Cognitive State is UCH-produced/host-consumed (outbound); hive capture is bespoke per-runtime. CIP is the named inbound contract apps implement to publish state voluntarily, with zone declarations; the Red zone formalizes L3's never-hidden-COT rule as a negotiable contract     |
| UCM: first-class compatibility matrix + five certification brands + registry               | IDEA-0098 | compliance.ts certifies UCH's own drivers (UCH-to-host); nothing certifies third-party products (host-to-UCH) against a living matrix spec with deterministic conformance                                                                                                                  |
| UIA surfaces taxonomy + Universal Capability Scanner + capability graph                    | IDEA-0099 | discovery.ts resolves the UCH manifest; nothing enumerates an external app's surfaces (configs, manifests, CLI, MCP lists) into a traversable capability graph feeding negotiation                                                                                                         |
| Architectural Contracts: continuous invariant verification                                 | IDEA-0100 | EI/coupling/organic gates are advisory single-shot evaluations; no structural-invariant DSL (reachability/event-flow) continuously enforced over workspace-graphs with veto authority                                                                                                      |
| Living Architecture: per-node alive projection                                             | IDEA-0101 | The nine lower layers are executed; the fused per-node view (health + deps + decisions + tasks + risks + confidence) has no schema/renderer - the observatory's Phase-02 prescriptive frontier, claimed in read-only form                                                                  |

**Verdict on the intake's verdict:** the "think like an OS" framing is
the ADR-006 microkernel decision already in force, and "supports
Cursor" -> "UCH Certified" is the compliance direction the corpus
already certifies drivers in - the genuinely new artifact is **CIP**,
the inbound voluntary state-exchange twin of Live Cognitive State: it
is the one proposal that extends interoperability from "what tools can
I call" (MCP) to "what cognitive state can trusted systems
intentionally share" without crossing the Red zone, and it gives the
UCM/certification ladder (IDEA-0098) its enterprise-safe content.
UCCL (0096) is the consolidation move, the scanner (0099) is its
mechanism, architectural contracts (0100) and living architecture
(0101) are Phase-02 view/enforcement layers over executed substrate.
As with every prior round: SOP-08 stage 1, zero code, zero spec edits.

## 18. The cognitive-abstraction intake (2026-08-01, round 15)

**User decision (vision intake, "the opportunity is to invent what
operating systems invented for hardware")**: a Cognitive Abstraction
Layer (CAL) â€” HAL for cognition: every AI tool (Claude Code, Cursor,
Copilot, Gemini CLI, Codex, OpenCode, Continue, Aider, Cline,
Windsurf) behind one abstraction, infinite clients. The newest
generation of coding agents exposes _behavior surfaces_ (Claude Code:
hooks/skills/subagents/CLAUDE.md/MCP/IDE bridges/background agents/
checkpoints/slash commands; Cursor: rules/MCP/composer/agent mode/
background tasks/workspace awareness) â€” "these are no longer
applications, they are miniature operating systems: integrate with
their microkernels". Plus a Universal Introspection Engine (12
graphs: identity/capability/tool/plugin/memory/workspace/model/
runtime/security/permission/context/workflow â€” "not a connection, a
living map"), Runtime Fingerprinting (CPUID analogy), a Cognitive
BIOS (boot sequence: Identify â†’ Authenticate â†’ Enumerate â†’ Capability
Discovery â†’ Topology Scan â†’ Permission Negotiation â†’ Security Scan â†’
Memory Discovery â†’ Tool Discovery â†’ Ready, "exactly like USB
enumeration"), Universal Knowledge Extraction (a Knowledge Genome
per application), Session Synchronization (one cognitive timeline:
state, not chat history), the Universal Context Compiler ("Context IR
â†’ Compiler â†’ Cursor Rules/CLAUDE.md/AGENTS.md/Gemini/Codex/Copilot/
OpenCode â€” exactly like LLVM IR; might be the biggest opportunity"),
a Universal Session Recorder (observable execution replay, explicitly
_not_ chain-of-thought), a Universal Adapter Compiler (generate
adapters from a manifest), a Universal Integration Score
(compatibility becomes measurable), the Ecosystem Twin (a digital
twin of the AI ecosystem itself), and the closing recommendation:
define **CIR + CRP** â€” a Cognitive Intermediate Representation
(universal language for context/intent/goals/architecture/policies/
project knowledge) plus a Cognitive Runtime Protocol (universal
runtime protocol for sessions/capabilities/lifecycle/checkpoints/
permissions/observability). CRP is the round's headline: "MCP asks
what tools do you have; CRP asks what cognitive capabilities do you
expose â€” {identity, capabilities, context, session, workspace,
events, checkpoints, knowledge, observability, permissions}. This
describes an intelligence, not a tool."

**Verdict after corpus mapping (2026-08-01, verified):** ~65% already
executed or tracked - CAL is IDEA-0096 UCCL reframed (one contract,
infinite clients) on ADR-006's microkernel; the microkernels framing
is INTEGRATION-LEVELS' per-platform behavior map + design/
integrations/*.md catalogs; Universal Discovery is IDEA-0099; the
Session Recorder is ADR-002's ledger + L3's observable-execution-only
rule (the intake's explicit "not chain-of-thought" is exactly the
corpus's L3/EXOSYMBIOSIS discipline); Session Synchronization is
Live Cognitive State + attach + session handoff + UER; the
Integration Score is IDEA-0098's UCM dimensions (scores are a
normalization over its claim schema); the 12-graph Introspection
Engine is a cataloging convention over IDEA-0099's capability graph +
workspace-graphs + UER + connectome; the Knowledge Genome has
precedents in gatherer + WorkspaceDNA + IDEA-0031's pipeline (but the
per-application extraction artifact is new); the Context IR is
IDEA-0096's one-source context generation sharpened into a compiler
(and the intake's "CIR" name collides with RFC-0004's instruction
IR - a governance decision). The genuinely new artifacts are 7
(IDEA-0102..0108).

**The true delta is 7 ideas (IDEA-0102..0108)**:

| Claim                                                                                          | Idea      | Delta vs corpus                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime Fingerprinting (CPUID for cognitive runtimes)                                          | IDEA-0102 | Driver manifests declare UCH's claims about itself; nothing enumerates the host's behavior surface (hooks/skills/subagents/rules/composer/checkpoints/background agents) into a stable versioned document - INTEGRATION-LEVELS S6 is a hand-verified snapshot, not a per-install artifact |
| Cognitive BIOS (ten-stage boot: identify/authenticate/enumerate/discover/negotiate/scan/ready) | IDEA-0103 | Negotiation is one attach-time handshake; no ordered stage model with per-stage gates, failure semantics (retry/degrade/abort), and an evidence-producing boot report - connect() in the UCCL contract (0096) is unspecified                                                              |
| Universal Adapter Compiler (generate adapters, don't write them)                               | IDEA-0104 | Adapters are hand-written per runtime; no codegen path from fingerprint + capability graph + manifest to a conformant ten-method adapter - the compiler is the consumer that justifies the scanner (0099) and fingerprint (0102)                                                          |
| CRP - Cognitive Runtime Protocol ("what cognitive capabilities do you expose?")                | IDEA-0105 | Live Cognitive State is UCH's outbound doc; CIP (0097) is voluntary state exchange; nothing is a runtime self-description protocol - the ten-block descriptor (identity/capabilities/context/session/workspace/events/checkpoints/knowledge/observability/permissions) has no home        |
| Context IR (repository-artifact intermediate representation, LLVM move)                        | IDEA-0106 | IDEA-0096 proposes one-source generation without the IR architecture: no frontends absorbing existing AGENTS.md/CLAUDE.md/rules/skills, no round-trip conformance; naming collision with RFC-0004 CIR (instruction IR) needs governance resolution (proposed CX-IR)                       |
| Ecosystem Twin (living map of the AI ecosystem)                                                | IDEA-0107 | COMPATIBILITY-MATRIX is a dated human survey; per-app capability graphs (0099) don't aggregate across apps/providers/protocols/platforms into a traversable graph with version + certification edges                                                                                      |
| Knowledge Genome (per-application knowledge extraction)                                        | IDEA-0108 | WorkspaceDNA is a hash (identity); species genome is config (behavior); no pipeline extracts an application's concepts/architecture/patterns/rules/goals/commands into a versioned genome with per-fact provenance                                                                        |

**Verdict on the intake's verdict:** CAL is a reframing of UCCL
(0096) - the HAL analogy is the compatibility-layer claim stated as
architecture. The genuinely new material is the _formalization
layer_: fingerprint (0102), boot (0103), adapter compiler (0104),
CRP (0105), Context IR (0106), ecosystem twin (0107), knowledge
genome (0108) - each turns an existing mechanism (scanning,
negotiation, generation, state exchange, context collection) into a
named, versioned, certifiable artifact. CRP is the strongest
differentiator: MCP = tool access, CIP = voluntary state exchange,
CRP = runtime self-description - it is the protocol that makes the
CAL claim testable ("describe an intelligence, not a tool") and
composes with the UCM/certification ladder (0098) and the boot
sequence (0103). The Context IR (0106) is the highest-leverage
consolidation: it absorbs the ecosystem's accidental standardization
(AGENTS.md/CLAUDE.md/skills/subagents/llms.txt) instead of adding a
format. As with every prior round: SOP-08 stage 1, zero code, zero
spec edits.

## 19. The cognitive-host intake (2026-08-01, round 16)

**User decision (vision intake, "the Universal Cognitive Host")**: the
full architecture vision of UCH itself - agent runtimes are decoupled
from UIs (VS Code Agent Host with the open model-agnostic JSON-RPC
Agent Host Protocol - URI channels, state snapshots/deltas, first-party
Copilot/Claude/Codex adapters in one unified session view; Codex
app-server with threads/turns/items; Claude Code CLI/SDK agent loop);
UCH is "not another plugin but a standalone cognitive operating
system" - a Cognitive Core (kernel) under all assistants, thin
harnesses (I/O drivers that speak a Universal Cognitive Protocol UCP
in which every host session is an Episode with annotated events:
GoalCreated, ToolExecuted, FileRead, PatchApplied, TestsRun,
DecisionMade, VerificationPassed, MemoryRetrieval), a Cognitive
Hypervisor spinning up isolated virtual cognitive machines (VCMs)
sharing one identity/memory/genome, sensors + effectors for two-way
hookup, a Cognitive Compiler that compiles workspace state + memories

- policies into a "cognitive image" prompt, a Live Cognitive State
  twin ("a mind's Task Manager"), a Cognitive Event Bus, one persistent
  identity ("hive mind"), shared-memory scope control (per-user/per-
  project/per-team/hybrid), observable cognitive traces (explicitly not
  chain-of-thought: Goal/Intent/Actions/Evidence/Decision Points/
  Outcome/Confidence), a five-phase roadmap (harnesses → UCP → hypervisor
- sync → cognitive operating environment → ecosystem with package
  manager + marketplace + multi-device), and the immutable design law:
  **no application shall own cognition** - applications own interfaces,
  models own inference, UCH alone owns identity, memory, and continuity.

**Verdict after corpus mapping (2026-08-01, verified):** ~90% already
executed or tracked - this vision is a restatement of UCH's own
foundation documents. The decoupling observation is EXOSYMBIOSIS
S4.1 ("every platform now separates the agent runtime") + the AHP
client rail (vscode-copilot Rail C, P2) + INTEGRATION-LEVELS rows;
UCP + Episode + annotated events = ADR-005 + CIC v0.1 (executed,
including episode_id hashing); the Cognitive Core = ADR-006
microkernel + WS-A..F; the hypervisor + VCMs = IDEA-0021 + WS-A PID
namespace + IDEA-0045 CVM (design, previously blocked on RFC-0004 -
**blocker now cleared**: CIR Accepted with reference implementation,
11f5670); sensors/effectors = src/drivers/sensors + effectors +
compose.ts (executed); the cognitive compiler/image = RFC-0004 CIR
(17-pass optimizer) + context compressor + ADR-006's Cognitive Image;
Live Cognitive State = design/LIVE-COGNITIVE-STATE.md (executed);
event bus = neural-event-bus + signal priorities; hive identity =
workspace manifest + attach + ProjectionEngine isolation; memory
scopes = PROJECTIONS containment cascade (grant scope: workspace/
project/branch/task/session - the per-user/per-project/per-team/hybrid
taxonomy's mechanism); observable traces = ADR-002 ledger + L3 rule
(never hidden CoT) + COGNITIVE-TRACE; the design law =
design/PROPOSED-LAW-OWNERSHIP-OF-COGNITION.md (candidate, not enacted

- pending the Laws community process); roadmap phases =
  UNIVERSAL-INTEGRATION M0-M4; package manager/marketplace = WS-P +
  IDEA-0058; multi-device = IDEA-0064.

**The true delta is 1 idea (IDEA-0109)**:

| Claim                                                                        | Idea      | Delta vs corpus                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AHP as first external validation of the UCP session model + alignment target | IDEA-0109 | AHP is planned as a client rail (tail sessions); nothing positions it as the first third-party implementation of the UCP session model or runs the "UCP is a superset of existing agent schemas" test against a real shipping protocol (URI channels, snapshots/deltas, multi-client sync) - the unified-session-view pattern is the corpus's attach/hive pattern appearing in a vendor product, worth co-opting |

**Verdict on the intake's verdict:** the cognitive-host vision is
validation, not novelty - it independently re-derives the corpus's
own architecture (VISION S2 thesis + ADR-005/006 + INTEGRATION-
LEVELS + traces) from ecosystem evidence, which strengthens the
design but adds no new primitives. Two actionable consequences: (1)
IDEA-0109 - align with AHP as the first shipping UCP-adjacent
protocol (study + driver), the strongest external evidence the
Episode model has; (2) **IDEA-0045 CVM's blocker is cleared** (CIR
now Accepted with reference implementation) - the Cognitive Virtual
Machine is the natural next promotion to research/prototype (user
decision). The design law stays a candidate pending the Laws
community process per Level 0. As with every prior round: SOP-08
stage 1, zero code, zero spec edits.

## 20. The platform-effects intake (2026-08-01, round 17)

**User decision (vision intake, "the next improvements are no longer
adding capabilities - making UCH impossible to replace")**: seventeen
proposals (Ω-1..Ω-17) for the 10+ year platform, premised on the
observation that every modern agent platform converges on memory,
tools, planning, runtime, and governance, so the remaining
differentiator is platform effects, determinism, and engineering
infrastructure. Ω-1 the Cognitive Virtual Machine (the LLM compiles
cognition into an intermediate representation and never executes
directly - "the CVM executes it": deterministic execution, replay,
debugging, optimization, sandboxing, portability; the JVM/WASM
analogy). Ω-2 the Cognitive Execution Graph ("not chains, not
workflows - everything becomes a graph" of observe/research/
verification/simulation/planning/execution/reflection/learning that
can pause, checkpoint, resume, branch, merge, replay, optimize).
Ω-3 the Cognitive Data Fabric (one logical fabric, one cognitive
namespace above, many storage engines below: knowledge, memory,
signals, genome, projects, tools, users, logs, reasoning,
architecture). Ω-4 the Universal Entity Model (everything derives
from one base abstraction; every entity automatically has UUID,
provenance, lineage, confidence, timestamps, permissions, lifecycle,
relationships, evidence, version history - nothing is special).
Ω-5 the Universal Relationship Engine (typed edges: depends_on,
implements, contradicts, supports, derived_from, caused_by,
verified_by, supersedes, owns, references, belongs_to). Ω-6 the
Engineering Intelligence Layer ("not coding - engineering. Instead
of generating code, it critiques engineering": architecture smells,
technical debt, Conway's Law, DDD, SOLID, CAP, distributed systems,
compiler theory, database theory, networking, operating systems).
Ω-7 the Research Engine ("not web search - scientific reasoning":
question -> literature -> evidence extraction -> contradictions ->
consensus -> confidence -> knowledge; every research task leaves
structured knowledge). Ω-8 the Architecture Engine (requirements in;
alternatives, tradeoffs, scalability, maintainability, deployment
topology, failure analysis, migration plan out). Ω-9 the Simulation
Engine (everything simulated before execution - architecture,
migrations, deployments, refactors, performance, costs, failures;
"a digital twin for engineering decisions"). Ω-10 the Runtime
Observatory (mission-control observability: brain activity, signal
traffic, memory flow, reasoning graph, attention, energy, knowledge
growth, learning rate, architecture health, latency, risk,
confidence). Ω-11 Autonomous Benchmarking (am I getting faster, more
accurate, fewer tokens, fewer regressions, better architecture
quality - performance as a first-class feedback loop). Ω-12
Cognitive DevOps ("not CI/CD - CI/CT/CD": continuous evaluation,
memory optimization, ontology repair, benchmark execution, security
validation). Ω-13 the Runtime Evolution Lab (current strategy ->
experiment -> measure -> compare -> promote -> rollback; the runtime
evolves under governance). Ω-14 the Capability Genome Marketplace
(genomes, constitutions, engineering standards, memory policies,
reasoning strategies, verification packs, architecture packs).
Ω-15 the Self-Describing Platform (every subsystem answers: who am
I, why do I exist, what do I consume, what do I produce, what
depends on me, how healthy am I, how do I evolve, how do I fail -
a platform that documents itself). Ω-16 the Cognitive SDK Generator
(Rust/TypeScript/Python/Go/Java/C# SDKs generated from the
Constitution and ABI, not hand-written). Ω-17 the closing claim
that the last missing layer is not another runtime component but a
Cognitive Engineering Discipline - UCH defines engineering laws,
cognitive specifications, runtime RFCs, and ABI/signal/memory/
knowledge/governance/integration/testing/verification/performance
standards: "what POSIX became for Unix or LLVM IR for compilers".
Plus a ten-item reprioritized roadmap: (1) Cognitive Constitution,
(2) Cognitive Specification Repository, (3) Cognitive ISA/ABI/IR,
(4) Cognitive Virtual Machine, (5) Signal Fabric + Nervous System,
(6) Universal Entity & Relationship Model, (7) Memory/Knowledge/
Wisdom persistence, (8) Runtime Observatory & Deterministic Replay,
(9) IDE Drivers, (10) Capability Marketplace & Ecosystem. The
recurring lesson cited: "production-ready cognitive platforms fail
less because of missing reasoning and more because of missing
infrastructure - specification, governance, observability,
capability evolution, and deterministic runtime behavior."

**Verdict after corpus mapping (2026-08-01, verified):** ~90%
already executed or tracked - Ω-1 CVM is IDEA-0045 (design exists;
its blocker cleared when RFC-0004 CIR reached Acceptance with a
reference implementation, 11f5670) and the user's roadmap item 4
confirms it as the standing next promotion (round 16's decision);
Ω-3 data fabric is IDEA-0049 (one storage contract, pluggable
backends) + IDEA-0029 cache ladder + neural-fs; Ω-4 entity model is
IDEA-0056 (COM: one identity + one lifecycle for every object
class) with lineage (IDEA-0076), confidence (decision law +
calibration), permissions (grants), version history (WS-C); Ω-5
relationship types are exactly IDEA-0050's pending next stage
(artifact-kind + edge-type taxonomy) + IDEA-0086 belief propagation
(support/attack semantics) + UER's evidence-attached edges - extend
0050, do not duplicate; Ω-6 engineering intelligence is ADR-003
executed (150 concepts / 10 tiers, evaluator, enrichment, learning
loop, dream scan) - "critique engineering, not code" is the layer's
own thesis, and the Microsoft CCA observation aligns with it rather
than adding; Ω-7 research engine is the SOP-08 register pipeline
(Idea -> Research -> RFC with evidence registers) + the
research-with-evidence skill + structuredFacts/conflict/consensus/
confidence machinery - "every research task leaves structured
knowledge" is the register contract already; Ω-8 architecture engine
is IDEA-0022 (review board, lens registry, veto aggregation) +
ADR-003 Tier VII (13 patterns with when-not-to-use) + the architect
agent; Ω-9 simulation is IDEA-0012 (digital twin) + WS-D
propose->verify->commit (simulate before execute); Ω-10 observatory
is IDEA-0014 + IDEA-0071 (SLOs) + WS-E SMART metrics + health
registry (0070) - the mission-control list maps 1:1 onto existing
metric surfaces; Ω-11 autonomous benchmarking is the EI benchmark
runner (corpus, contract booleans, latency) + the learning loop
(taste reinforcement) + RFC-0005 calibration + SLO error budgets;
Ω-12 cognitive DevOps is IDEA-0013 (station contracts with gates) +
IDEA-0081 (engineering chain) + the organic-code 6-gate; Ω-13
evolution lab is IDEA-0032 (consciousness-level transitions governed
by policy) + IDEA-0008 (genome evolution) + WS-C (organism
versioning + rollback) + IDEA-0090 (expression: experiment/promote);
Ω-14 marketplace is IDEA-0058 (governance-gated distribution,
certification-before-listing, a pack may never weaken a Law); Ω-15
self-describing platform is IDEA-0105 (CRP runtime
self-description, honesty rule) + IDEA-0070 (health) + IDEA-0073
(consume/produce/dependents) + IDEA-0074 (how it fails) + IDEA-0072
(how it evolves); Ω-16 SDK generation is IDEA-0083 (specification
repository with generated implementations) + IDEA-0104 (adapter
compiler) + IDEA-0052 (skill compiler); Ω-17 the engineering
discipline is Platform Zero itself (five-book canon, RFC governance,
32 laws, CP v1 + CIR specs, conformance + certification) +
IDEA-0048/0094/0095 - "the POSIX/LLVM role" is the executed
direction, not a proposal.

**The true delta is 1 idea (IDEA-0117)**:

| Claim                                                                                                                   | Idea      | Delta vs corpus                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ω-2 Cognitive Execution Graph (pause/checkpoint/resume/branch/merge/replay/optimize as first-class execution semantics) | IDEA-0117 | Executors are linear pipelines (CIR passes, chain 0081, agentic loop) with atomicity bolted on (WS-D) and causality recorded afterwards (UER 0047); each graph capability exists in isolation (sessions, WS-D ledger, speculation 0030, merge WS-I, replay ADR-002) but no artifact binds them over a running cognition - the graph is the missing runtime shape the CVM (0045) interprets |

**Verdict on the intake's verdict:** the platform-effects framing
validates the executed direction rather than redirecting it - the
"impossible to replace" moat the user names (specification,
governance, observability, capability evolution, deterministic
runtime behavior) is exactly Platform Zero + ADR-006 + ADR-002 +
conformance/certification, and the convergence observation
("everyone converges on memory, tools, planning, runtime,
governance") is VISION sec 2's substrate thesis stated from market
evidence. The ten-item roadmap is 10/10 executed-or-tracked and its
ordering matches the corpus: CVM at #4 is the one open head item,
now unblocked - round 16 recorded the promotion decision, this
round confirms it (the CVM research+prototype wave is the standing
next action; the Ω-17 discipline claim and the arXiv "missing
layer" references restate Platform Zero's own premise). The one
structurally new primitive is the execution graph (IDEA-0117):
determinism, replay, branching, and merge currently live in
separate mechanisms (WS-D, ADR-002, IDEA-0030, WS-I); the intake's
claim is that they should be properties of one execution artifact -
the natural companion to the CVM promotion (its program shape),
which is why it is promoted to the delta rather than folded (the
parallel round-16 wave owns IDEA-0110..0116; this round's note is
IDEA-0117). The
relationship vocabulary (Ω-5) is IDEA-0050's pending stage, not a
new primitive. As with every prior round: SOP-08 stage 1, zero
code, zero spec edits.

## 21. The cognitive-architecture intake (2026-08-01, round 16 — second half)

**User decision (vision intake, "UCH stops looking like a better agent
framework and starts looking like a new layer of computer
architecture")**: the second half of the round-16 vision. The
headline: "everyone is standardizing communication (MCP, AHP, UCP);
nobody is standardizing cognition" — the move is a new layer below
all agents (Cognitive Hypervisor → Cognitive Operating Environment →
Harness → Application; "applications become clients, not hosts"),
plus the named proposals: (1) the **Universal Cognitive Capability
Descriptor (UCCD)** — every harness publishes a 19-field
self-description (identity, memory, reasoning, planning,
verification, tools, permissions, events, knowledge, sessions,
checkpoints, telemetry, filesystem, git, terminal, plugins, models,
extensions, policies); "not documentation, runtime discovery — think
PCI enumeration for cognition"; (2) the **Universal Runtime
Scanner** — "you don't connect, you fingerprint": executable →
runtime → SDK → CLI → IPC → WebSocket → MCP → AHP → extensions →
settings → workspace → memory → capabilities → graph; (3) the
**Application Genome** — every application's DNA with explicit
capabilities AND limitations (Cursor 2026.x: Supports MCP/Rules/
Agent/Composer/Background/Extensions/Native Terminal/Workspace;
Limitations: No Shared Memory, No Cross Session Identity, No
Universal Scheduler); (4) the **Cognitive Reverse Index** —
capability → applications (Checkpointing → Claude → Codex → Cursor →
VS Code), "UCH chooses the best runtime, not the user"; (5)
**Runtime Composition** — one engineering task split across runtimes
(Planning → Claude; Reasoning → GPT; Implementation → Codex;
Verification → Gemini; Security → OpenCode; Memory → UCH): "the
developer interacts with one organism, not six products"; (6) the
runtime **lifecycle** — "integration isn't with APIs anymore, it's
with behavior": Boot → Initialize → Authenticate → Discover → Observe
→ Execute → Learn → Checkpoint → Suspend → Resume → Shutdown, UCH
hooks every phase; (7) **Universal Runtime Telemetry** — 17 named
metrics (latency, context size, memory hits, prompt size,
compression, tool calls, file reads/writes, token budget, energy,
cost, verification, confidence, failures) = "Cognitive
Observability"; (8) the **Universal Context Compiler** — Context IR
"like LLVM IR" compiled to any app (the "biggest moat" claim); (9)
**Harness DNA** — "the adapter isn't written, it's expressed":
Genome → Capabilities → Proteins → Integration Behavior →
Synchronization → Optimization; (10) **Cognitive PCIe** — the
Universal Cognitive Bus (UCB): Claude/Cursor/Codex/Copilot/Gemini/
VS Code/JetBrains/Docker/Git/Filesystem plug into one bus (Event
Ledger, Identity, Memory, Scheduler, Context Compiler, Security,
Knowledge Graph, Observability, Capability Registry); "every
participant speaks one protocol, no point-to-point integrations";
and the virtualization thesis: "how do I make Cursor, Claude, Codex,
Copilot, Gemini all believe they are operating inside the same
persistent cognitive machine?" — the leap from direct hardware
programs to the virtual machine, applied to cognition.

**Verdict after corpus mapping (2026-08-01, verified):** ~80%
already executed or tracked — the stack/virtualization claims are
UCH's own thesis restated (ADR-006 microkernel, WS-A process model,
attach = the hypervisor; VISION §2; IDEA-0045 CVM now unblocked
per §19); Context IR = IDEA-0106 (CX-IR, name resolved against
RFC-0004) — the "biggest moat" claim is already tracked; the scanner
= IDEA-0099 (UIA 21-surface taxonomy); fingerprint/descriptor =
IDEA-0102/0105/0108; the bus = IDEA-0028 (motherboard), IDEA-0010
(signal fabric), IDEA-0096 (UCCL); composition = ADR-004 (model-
level routing) and IDEA-0046; lifecycle boot = IDEA-0103 (Cognitive
BIOS); telemetry = IDEA-0071 (SLO catalog), IDEA-0014 (observatory)
and IDEA-0035 (quantities); harness DNA = IDEA-0090 (expression
engine, executed) + IDEA-0104 (adapter compiler). The true delta is
the **formalization layer — 7 notes (IDEA-0118..0124)**:

| Claim                                                                                             | Idea      | Delta vs corpus                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Universal Cognitive Capability Descriptor + Application Genome ("PCI config space for cognition") | IDEA-0118 | Fingerprints (0102) and CRP (0105) exist but the normative descriptor schema is unowned — 19 fields, explicit limitations DNA, omission = unknown; the scanner (0099) has no canonical output format |
| Cognitive Reverse Index + runtime selection ("UCH chooses the best runtime, not the user")        | IDEA-0119 | Forward capability graph exists (0099); the inverse query (capability → applications) and an evidence-ranked selection policy with auditable decisions have no owner                                 |
| Runtime Composition (one task, many runtimes)                                                     | IDEA-0120 | ADR-004 routes calls across providers; nothing decomposes an intent into stages and executes stages on different harnesses with checkpoint handoffs + single-Episode lineage (UER)                   |
| Runtime lifecycle hooks (11 phases, boot → shutdown)                                              | IDEA-0121 | BIOS (0103) stops at Ready; Learn/Checkpoint/Suspend/Resume/Shutdown have no phase contract, no transition events, no UCH hook points                                                                |
| Universal Runtime Telemetry (17 named metrics)                                                    | IDEA-0122 | SLO catalog (0071) defines bands but no runtime-emission set with pinned units; the ledger records events, not comparable quantities; confidence/verification as telemetry is unowned                |
| Harness DNA (expressed adapters, not written ones)                                                | IDEA-0123 | The expression engine (0090) covers configuration behavior; the integration-protein vocabulary (adapter behavior expressed, not written) does not exist — 0104 codegens, it does not interpret       |
| Universal Cognitive Bus (Cognitive PCIe)                                                          | IDEA-0124 | Motherboard (0028) is per-function bus lanes; the neural-event-bus is kernel-internal; the single-bus topology rule (no point-to-point) with nine bus services + UCCD enumeration is new             |

**Verdict on §19's verdict:** the parallel wave's "true delta is 1
idea" covers only the architecture-survey half of the round-16
vision (AHP alignment, IDEA-0109); the second half carries the
round's genuinely new primitives — the **Cognitive Reverse Index**
(runtime selection by capability evidence, not user choice) and the
**Universal Cognitive Bus** (the no-point-to-point topology rule) are
the strongest; UCCD (0118) is the canonical schema 0102/0105/0099
currently lack, and Harness DNA (0123) applies the executed
expression engine (IDEA-0090) to the adapter surface — each of the 7
is a named/versioned/certifiable artifact over existing machinery,
the same delta shape as rounds 14-15. As with every prior round:
SOP-08 stage 1, zero code, zero spec edits; §19's files (IDEA-0109)
untouched; appended after §19 per coexistence rules.
