# BOOK I — THE GENESIS

## Universal Cognitive Harness — Product Requirement Document

> **Book I of the Five-Book Canon.** This book answers one question:
> _Why should this exist?_ It is the philosophical, business, technical, and
> market vision of UCH. It is not a features list — it is the purpose.
>
> **Status:** Draft v0.1 (chapters 1–3 written; remaining chapters stubbed for
> progressive completion under RFC governance)
> **Related:** MANIFESTO.md (the engraved creed), design/STACK.md, docs/README.md

---

## Chapter 1 — The Problem

The problem is not AI coding. AI coding works.

The problem is that **every AI tool starts from zero, every time.**

- **Context fragmentation** — each agent, IDE, and session reconstructs the
  repository independently: discovers files, infers architecture, loads
  instructions, rebuilds task context.
- **Agent fragmentation** — Claude Code doesn't know what Codex learned.
  Cursor doesn't know what Copilot decided. The knowledge of one tool is
  invisible to the next.
- **Knowledge loss** — decisions, rejected alternatives, and engineering
  judgment leave with the session that made them.
- **Stateless inference** — every prompt is a fresh conversation with a
  model that remembers nothing.
- **Session death** — closing a session destroys its context. Continuation
  means re-explanation, re-discovery, re-inference.
- **Tool fragmentation** — ten tools, ten histories, ten permission models,
  ten ontologies for the same workspace.
- **Memory fragmentation** — "memory" features exist per-vendor, per-tool,
  per-account, per-subscription. None of them is the workspace's memory.
- **Vendor lock-in** — context, skills, and learned behavior are captured
  inside each product's ecosystem.
- **No persistent cognition** — no layer of the current stack accumulates
  engineering judgment across models, tools, teams, or years.
- **No engineering continuity** — when the architect leaves, the reasoning
  leaves. Companies accumulate code and docs but not judgment.

Every one of these is the same failure at a different layer: **the
intelligence is owned by the ephemeral tool, not by the durable workspace.**
The entire industry is optimizing the transient layer — better models, better
prompts, better agents — while the layer that could actually persist
cognition does not exist.

## Chapter 2 — Vision

> **Separate Cognition from Inference.**

One sentence. Everything else derives from it.

- Inference is a transient computation: a model, a call, a session, a pilot.
- Cognition is a durable asset: identity, memory, judgment, accumulated
  experience.
- Today they are fused: your intelligence is whatever your current tool
  remembers.
- UCH separates them. Cognition lives in the workspace — persistent,
  governed, portable. Inference is a replaceable pilot that borrows it.

When a pilot leaves, the cognition remains. When a model is deprecated, the
judgment remains. When a vendor dies, the knowledge remains.

## Chapter 3 — Computing Thesis

Every layer of computing emerged because a new resource became the
bottleneck:

| Era   | Bottleneck             | Layer created             | Platform                     |
| ----- | ---------------------- | ------------------------- | ---------------------------- |
| 1970s | Hardware               | Operating system          | Unix, Windows                |
| 1990s | Networking             | Internet stack            | TCP/IP, Web                  |
| 2000s | Compute virtualization | Container/VM layer        | Docker, K8s                  |
| 2010s | Developer productivity | Language/compiler layer   | LLVM, Rust                   |
| 2020s | **Machine inference**  | **Agent/assistant layer** | Claude Code, Cursor, Copilot |

Each new layer succeeded when it (1) owned a resource the layer above
couldn't, and (2) made the layer below replaceable. The agent layer is doing
exactly this to models — but nothing yet owns **cognition**: the accumulated,
verified, governed knowledge of a workspace across time.

The thesis:

> **Cognition is the new bottleneck.** Every agent, IDE, and model
> reconstructs the same intelligence and throws it away. The layer that owns
> persistent cognition — the Cognitive Substrate — is missing from the
> stack, and nothing in the current stack can grow into it, because every
> incumbent is structurally incentivized to keep cognition inside its own
> product.

The stack we propose:

```text
Applications
    ↓
Agents
    ↓
Harness Drivers        ← the ecosystem (Claude, Codex, Cursor, VS Code, ...)
    ↓
Universal Cognitive Runtime   ← UCH
    ↓
Cognitive Kernel
    ↓
Cognitive ISA (CP)     ← the ABI that must not break
    ↓
Inference Engines      ← replaceable
    ↓
Hardware
```

Notice the inversion: the LLM is near the bottom. Cognition is the enduring
layer; inference is a replaceable engine. This is the same inversion Docker
performed on the process (the container persists, the host is replaceable),
and LLVM performed on the compiler (the IR persists, the frontends and
backends are replaceable).

**The three properties a substrate must have** (and no agent product has):

1. **Ownership** — the substrate owns the cognition (Law 19).
2. **Persistence** — cognition outlives every carrier (Law 32).
3. **Governance** — cognition changes only through law, not through
   conversation (Constitution, RFC-0000).

---

### The Cognitive Universe — the layer model

A cognitive substrate, like an operating system, needs its own universe:
not software shaped like physics, but a layer model in which every lower
layer constrains the upper layers until behavior becomes inevitable rather
than designed. The model:

```text
Constants      what never changes — identity uniqueness, timestamp
               precision, trust/confidence ranges, energy units,
               priority levels, time units (candidate: FORMAL_FOUNDATIONS)
     ↓
Laws           what is impossible — the 32 Laws of Cognitive Physics in
               five families (Physics · Biology · Psychology · Society ·
               Computing); law numbers are permanent
     ↓
Physics        the mathematics — units, conservation, failure physics,
               calculus (RFC-0005, draft in FORMAL_FOUNDATIONS Part VIII)
     ↓
Matter         the ontology — everything that exists inherits properties
               from the laws (spec/COGNITIVE_ONTOLOGY.md)
     ↓
Life           the organs — memory, scheduler, nervous system,
               metabolism, governance; organs do not define behavior,
               they obey the universe (MANIFESTO §6)
     ↓
Civilization   the ecosystem — drivers (Claude, Codex, Cursor, Copilot,
               OpenCode, JetBrains), pilots living inside the universe
               (src/drivers/, design/integrations/)
```

The design test this implies: instead of asking "how do we build a memory
organ?", ask "given the laws of this universe, what is the inevitable
behavior of a memory organ?" Every organ should be derivable from the layers
below it; anything that cannot be derived is either a new law or a bug.

A compact summary of the same idea as five engines, each already present in
embryo:

| Engine       | Function                              | Current embryo                   |
| ------------ | ------------------------------------- | -------------------------------- |
| Physics      | runs the laws                         | constitution + trace ledger      |
| Evolution    | changes the organism under governance | sleep cycle + self-evolution DBs |
| Meaning      | maintains semantic coherence          | connectome + context compressor  |
| Civilization | coordinates multiple organisms        | CIC, attach, cognitive merge     |
| Reality      | synchronizes with the external world  | drivers, sensors, effectors      |

The layer model and the five engines are conceptual framings, not new
components; they are recorded here so future features state which layer they
extend. The formalization of Constants and Physics is RFC-0005; the remaining
new disciplines are tracked as idea notes in `rfc/ideas/`: chemistry
(IDEA-0002), cells and ecology (IDEA-0007), genome evolution (IDEA-0008),
fields (IDEA-0006), cognitive time (IDEA-0009), the 2026-08-01 primitive
intake (IDEA-0010…0023): signal fabric, physiology, digital twin,
manufacturing, observatory, engineering gravity, cognitive economics, reality
synchronization, cognitive silicon, operating contracts, cognitive units
(COC), hypervisor, review board, elemental primitives; and the 2026-08-01
discipline intake (IDEA-0024…0032): cognitive systems engineering, ambient
cognition/CDE, cognitive mathematics, cognitive sociology, cognitive
motherboard, cache hierarchy, cognitive speculation, reality compiler,
consciousness levels; and the 2026-08-01 firmware-compute intake
(IDEA-0033…0047): cognitive firmware (a permanent-behavior tier in the
capability hierarchy Laws → Kernel → Firmware → Accelerators → Organs →
Skills → Drivers → Applications), the unified decision law (Theory of
Intelligence), cognitive information theory, topology, thermodynamics,
immunology, embryology, jurisprudence, anthropology, archaeology,
astronomy + instruments, candidate law expansion (32 → 50–100 laws), the
Cognitive Virtual Machine, the accelerator catalog, and Universal
Engineering Replay (one causal engineering graph across every host);
and the 2026-08-01 foundations intake (IDEA-0048…0055): the
consolidated normative specification, the cognitive storage engine,
the knowledge fabric + engineering intelligence graph, the
engineering database, the skill compiler, the constitution engine,
the driver ecosystem + interoperability certification, and the
Cognitive Engineering Language (CEL — missions compiled through CIR
to the CVM, making UCH programmable rather than configurable);
and the 2026-08-01 platform-infrastructure intake (IDEA-0056…0058):
the Cognitive Object Model (one identity and lifecycle for every
cognitive object class), the Cognitive Query Language (declarative
queries with confidence, importance, and causal predicates over every
store), and the Cognitive Marketplace (governance-gated distribution
of organs, genomes, and constitutional packs);
and the 2026-08-01 missing-infrastructure intake (IDEA-0059…0067):
the Cognitive Kernel Debugger (breakpoints inside reasoning — pause,
inspect, mutate, resume), the Cognitive Garbage Collector (unified
reclamation across memory, knowledge, graph, signal, skill, and
experiment classes), Cognitive Formal Verification (model-checking
reasoning graphs against the 32 Laws, with counterexample traces),
the Cognitive Security Architecture (one inspection boundary for
memory poisoning, prompt injection, identity hijacking, and false
evidence), the Cognitive Resource Allocator (grants for attention,
tokens, reasoning depth, confidence, and bandwidth), Multi-UCH
Cognitive Networking (op-replication, vector clocks, conflict
resolution between organisms), the Cognitive Consensus Layer
(calibrated voting, confidence fusion, evidence weighting), the
Cognitive Reasoning Profiler (per-run token flow, depth, hit-rates,
verification cost, energy), and the Cognitive Organ Design System
(canonical organ lifecycle, signal archetypes, pattern library);
and the 2026-08-01 microscopic-infrastructure intake (IDEA-0068…0083):
cognitive capability negotiation + discovery (TLS-style dialect
agreement over the CIC envelope), feature flags + versioned cognition +
a deprecation engine (every organ, skill, genome, belief, and reasoning
strategy individually enabled, versioned, and retired with grace),
organ health + watchdogs + safe mode (per-organ health states,
liveness probes, restart-restore-replay self-healing, recovery boot),
cognitive SLOs (named reasoning observables with targets and error
budgets), a universal lifecycle engine (Idea → Research → Prototype →
Experiment → Production → Legacy → Archive → Extinct for everything),
a cognitive contracts registry (nine-field behavioral contracts like
RFCs), a cognitive failure taxonomy (ten faculty failure classes, each
handled differently), intent objects (goal/constraints/success/
failure/priority/deadline/stakeholders/risk/evidence that everything
downstream compiles from), a knowledge lineage service (who created,
changed, verified — what depends on it), a human factors model
(workflow optimization, not profiling), a cognitive UX charter
(predictability, interruptibility, explainability, trust, calm,
transparency), a memory hygiene engine (duplicate/conflict detection,
aging, compression, normalization, summarization, evidence refresh,
relationship repair), plugin trust scoring (six-axis scorecards),
a deterministic engineering chain (plan → simulation → verification →
execution → validation → evidence → replay), engineering taste
(elegance and simplicity made measurable), and the Specification
Repository (machine-readable specs for every primitive, with
implementations generated from them — the shift from software project
to specification-first cognitive platform);
and the 2026-08-01 cognitive-microarchitecture + physics intake
(IDEA-0084…0094): the signal lifecycle engine (TTL, freshness, and a
noise gate where attention is earned, not assumed), signal flow
control (backpressure and rate limiting on the fabric), the belief
propagation engine (confidence, trust, and contradiction flow through
support edges — the semantic layer over the UER causal graph), concept
locality (related cognition placed physically together, traversed in
few pages), cognitive locking + extended transactions (semantic locks,
nested transactions, savepoints, optimistic concurrency, causal
ordering — cognition as a distributed database), capability leasing
(grants expire unless renewed), the expression system (genes express
proteins that produce behavior, plus epigenetics: same genome,
different expression per environment — production conservative,
development experimental), morphogenesis (organs grown from primitive
building blocks through a staged developmental program, not
installed), the psychology discipline (curiosity, habituation, bias
and dissonance detection — compensation, not imitation), attention
algebra (attention as a conserved resource that focuses, splits,
merges, diffuses, attenuates, amplifies), and the Cognitive
Constitution of Computing (one canonical foundational document — the
POSIX/LLVM-IR role — that every implementation, TypeScript or Rust,
every IDE driver, implements).

A third framing of the same universe is the **specification-layers
intake** (2026-08-01, round 13): four specification layers —
Constitution (ontology, RFC-0 role), Cognitive Physics (invariant
laws), Cognitive ISA (instruction set), and the Reference Runtime —
in the LLVM/POSIX pattern, where the specification is the stable
artifact and implementations evolve. ~90% of the claim maps to the
existing corpus (CONSTITUTION + COGNITIVE_ONTOLOGY, the 32 laws +
RFC-0005 + IDEA-0044, CP v1.0 + CIR + catalog, STACK.md, IDEA-0048/
0083); the true delta is **IDEA-0095 — the Cognitive ABI**, the
organ-level interoperability contract (observe/process/checkpoint/
restore/health/capabilities) that binds independently developed
organs and runtimes, the organ-side twin of driver compliance.

A second framing of the same universe is the **discipline ladder** — the
eight formal disciplines from which every feature should be derivable:
Mathematics (definitions, operators, proofs) → Physics (movement, signals,
energy, time, entropy) → Chemistry (interaction, binding, transformation,
reaction, decay, catalysts) → Biology (cells, organs, evolution, metabolism,
immune, repair) → Ecology (competition, symbiosis, resource allocation,
emergent equilibrium) → Economics (attention, investment, opportunity cost,
expected value) → Sociology (trust, reputation, authority, negotiation,
consensus, organizations) → Civilization (standards, culture, institutions,
inheritance, collective memory). The ladder is a framing, not a new
component set: each rung maps to existing corpus work or an idea note
(Mathematics → FORMAL_FOUNDATIONS Part I + IDEA-0026; Chemistry → IDEA-0002;
Biology → IDEA-0007; Ecology → IDEA-0007; Economics → IDEA-0016; Sociology →
IDEA-0027; Civilization → ADR-005 + IDEA-0024).

---

## Chapter 4 — Market Analysis

_Stub. To be written under RFC governance. Scope: the current AI stack
(OpenAI, Anthropic, Cursor, Codex, Claude Code, VS Code, Copilot, MCP, A2A,
UMP, OCP, ARP), who owns what layer, where the gaps are. Reference:
arXiv 2410.06107 (AI-Native Software Engineering roadmap)._

## Chapter 5 — Competitive Analysis

_Stub. Scope: Mem0, Zep, Letta, Cognee, Graphiti, Claude Code, Cursor,
Codex, Copilot, CodeQL-class tools, cognitive-runtime.com — reverse-engineer
strengths, document limitations, and map each to the layer it occupies
(and cannot escape)._

## Chapter 6 — Unique Innovation

_Stub. Why UCH cannot be replaced by better prompting or better models:
governance, ownership, persistence, and the law layer — properties no model
or prompt can supply._

## Chapter 7 — Core Principles

_Stub. Philosophy, not architecture: Identity · Continuity · Evidence ·
Persistence · Governance · Homeostasis · Energy · Truth · Evolution. Each
principle maps to Laws 1–32._

## Chapter 8 — Product Definition

_Stub. The official definition: the Universal Cognitive Substrate, its
drivers, the CIC contract, what is in scope and — explicitly — what is not
(not an IDE, not an agent, not a memory library, not an MCP server)._

## Chapter 9 — Target Users

_Stub. Segments: Individual, Professional, Studio, Enterprise, Government,
Research, Education, Military, Healthcare. Per-segment: jobs-to-be-done,
adoption path, certification path._

## Chapter 10 — Use Cases

_Stub. Software Engineering, Research, Science, Medicine, Law, Architecture,
Creative, Autonomous Robotics, Knowledge Work. Per-case: the cognition that
must persist, and the current failure without a substrate._

## Chapter 11 — Success Metrics

_Stub. Not revenue: Engineering continuity, Knowledge retention,
Architecture quality, Defect reduction, Context reuse, Memory accuracy,
Recovery time, Reasoning consistency, Developer productivity. Each metric
needs a measurement instrument in the benchmark suite._

## Chapter 12 — Commercial Strategy

_Stub. Open core · Enterprise · Marketplace · Certification · Cloud ·
Self-hosted · On-prem · OEM · White-label · Managed runtime. The runtime is
MIT; the certification and marketplace are the commercial surface._

## Chapter 13 — Business Model

_Stub. Revenue flows: certification, marketplace fees, enterprise support,
managed runtime, OEM licensing. Unit economics per segment._

## Chapter 14 — Licensing

_Stub. MIT for the reference runtime; the specification corpus licensing;
trademark/certification policy ("UCH Certified" as a trust mark, like
"Open Source Initiative" or "Kubernetes Certified")._

## Chapter 15 — Risk Analysis

_Stub. Technical, market, legal, adoption, and single-point-of-failure risks
with mitigations. Includes the risk of the ecosystem building a competing
substrate (and why interoperability beats protection)._

## Chapter 16 — Future Vision

_Stub. The 10-year horizon: cognitive continuity as a standard expectation;
"which cognitive runtime are you running?" replacing "which model?"_

## Chapter 17 — User Stories

_Stub. The journey of an individual developer, a team, an enterprise, and a
government agency adopting UCH._

## Chapter 18 — Roadmap Alignment

_Stub. Maps the Epochs (Foundation → Kernel → Runtime → Ecosystem →
Platform) to the market and adoption strategy._

## Chapter 19 — Open Questions

_Stub. The questions the product must answer before 1.0: naming (UCH vs
substrate vs COS), three-repo split, Rust daemon, rollback productization._

## Chapter 20 — The Ask

_Stub. What the project needs to become a platform: contributors to the
specification, certification bodies, driver implementers, university
adoption, and a governance body independent of the reference runtime._

---

## Completion Protocol

- Chapters 4–20 are stubs and shall be filled under the Specification
  Governance System (RFC-0000, SOP-08): each chapter's content is an RFC or
  an amendment to this book.
- The Genesis is a living book; it is versioned like the corpus
  (spec/VERSION.md) and may be extended but never silently rewritten.
