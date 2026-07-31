# UCH — Universal Cognitive Harness

> **Separate cognition from inference.**
> The workspace owns the intelligence. The agent borrows it.

UCH is a **cognitive runtime and open specification** — a persistent
substrate that any IDE, coding agent, or AI runtime can attach to and
inherit memory, knowledge, skills, policies, and learned judgment. Models,
sessions, and editors are transient; the cognition is not.

It is not a memory library, not an agent framework, and not an MCP server.
It is a new layer in the AI computing stack — the layer that owns
**persistent, governed cognition**.

[Book I — Genesis (product)](docs/GENESIS.md) ·
[Book II — Constitution (law)](spec/CONSTITUTION.md) ·
[Book III — Blueprint (engineering)](design/ARCHITECTURE.md) ·
[Book IV — Standards (RFCs)](rfc/) ·
[Book V — Ascension (scale)](docs/ROADMAP.md) ·
[Manifesto](MANIFESTO.md)

| | |
| --- | --- |
| **Status** | Active — 565 source files, 55 subsystems, 154 test files / 2,436 test cases |
| **Runtime** | Node.js 18+ (ESM, TypeScript strict) · 3 runtime dependencies |
| **Interfaces** | CLI · MCP (STDIO/SSE) · HTTP · IPC · A2A · agent boot module |
| **Contracts** | CP v1.0 (cognitive ABI, stable) · CIC envelope · `uch.manifest.v1` · W3C traces |
| **Governance** | Specification-first · RFC lifecycle (RFC-0000) · 32 Laws · Constitution |
| **License** | MIT |

## The inversion

Every AI tool today reconstructs the same intelligence and throws it away.
UCH inverts ownership:

```text
Applications / Agents
        ↓
Harness Drivers          ← Claude Code · Codex · Cursor · VS Code · OpenCode · future pilots
        ↓
UNIVERSAL COGNITIVE RUNTIME (UCH)   ← the persistent substrate
        ↓
Cognitive Kernel · Memory · Signals · Governance · Metabolism
        ↓
Cognitive ISA (CP v1)    ← the ABI that must not break
        ↓
Inference Engines        ← replaceable — LLMs are a resource, like a GPU
        ↓
Hardware
```

The LLM sits near the bottom because it is a *transient pilot*. Cognition —
identity, memory, decisions, skills, judgment — lives in the substrate and
survives every pilot replacement (Law 32 — Persistence, Law 19 — Cognition
Ownership).

## The Five Books

The specification is the source of truth, not the conversation. Every
normative change passes the RFC lifecycle before it touches the corpus.

| Book | File | Purpose |
| --- | --- | --- |
| **I — Genesis** | [docs/GENESIS.md](docs/GENESIS.md) | Product — problem, vision, computing thesis, market, strategy (20 chapters) |
| **II — Constitution** | [spec/CONSTITUTION.md](spec/CONSTITUTION.md) · [spec/LAWS_OF_COGNITIVE_PHYSICS.md](spec/LAWS_OF_COGNITIVE_PHYSICS.md) | Immutable law — 32 laws in five families, cognitive rights, kernel ABI |
| **III — Blueprint** | [design/ARCHITECTURE.md](design/ARCHITECTURE.md) · [design/STACK.md](design/STACK.md) · [design/CIR.md](design/CIR.md) | Engineering — kernel, memory, scheduler, signals, drivers, CIR |
| **IV — Standards** | [rfc/](rfc/) | RFC series — contracts: Identity, Signals, Memory, governance |
| **V — Ascension** | [docs/ROADMAP.md](docs/ROADMAP.md) | Scale — epochs, performance, certification, ecosystem |

## Quick start

```bash
cd projects/uch
npm install
npm run build

# System status:
node dist/cli/index.js status

# Run as an MCP server (default):
node dist/cli/index.js
#   → UCH MCP Server — 25 cognitive tools

# Attach to this workspace (manifest discovery + grants + projections):
node dist/cli/index.js attach

# First memory (with OPENAI_API_KEY set for embeddings):
node dist/cli/index.js remember "UCH is a cognitive substrate"
node dist/cli/index.js recall "cognitive"
```

Use the package scripts: `npm test` (vitest), `npm run typecheck`
(`tsc --noEmit`), `npm run lint` (eslint), `npm run check:spec-version`.
Full walkthrough: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## What the substrate owns

| Domain | What exists |
| --- | --- |
| **Memory** | Episodic, semantic, procedural, scientific (takes/calibration), belief (time-machine), working (compression), vmem paging Hot→Archive; sleep-cycle consolidation + distillation |
| **Signals** | Immutable event bus with governance gate (provenance, idempotency, policy, audit); five-layer nervous system priority routing; zero-LLM reflex fast path |
| **Governance** | 32 Laws (five families) · Constitution (rights, responsibilities, immutability) · `EventGovernance` gate · grants + projections · Organic Score with constitutional vetoes · integrity checklist |
| **Identity & Attachment** | Workspace manifest (`uch.manifest.v1`), per-agent scoped grants, authorized projections, attach lifecycle, PID namespace, cognitive processes |
| **Inference fabric** | Virtual processors (10-CPU namespace), tier routing, cheapest-healthy-provider selection with verification failover, energy budgets |
| **Engineering intelligence** | 150-concept tiered domain catalog, deterministic evaluator with veto gates (SPOF, unrecovered failure, pathological complexity), labeled benchmark corpus |
| **Trace & replay** | OTel W3C trace ledger, `traceparent` continuation, cognitive replay, time machine (`beliefsAt`), cognitive diff |
| **Frameworks** | 34-framework Cognitive Frameworks Library (10 families) with selection, journal, calibration analytics |
| **Interfaces** | CLI (~40 commands) · MCP STDIO (25 tools) · HTTP/SSE · WebSocket · IPC · A2A · agent boot plugin (Claude Code / Codex / OpenCode) |

## Governance

- **32 Laws of Cognitive Physics** in five families — Physics · Biology ·
  Psychology · Society · Computing — enforced by static analysis, runtime
  auditing, and constitutional review.
- **The RFC lifecycle** ([RFC-0000](rfc/RFC-0000-specification-governance.md)):
  `Idea → Research → RFC → Prototype → Benchmark → Architecture Review →
  Security Review → Constitution Check → Acceptance → Specification →
  Reference Implementation → Certification → Stable`.
- **The Five Gates** — Scientific, Architectural, Engineering, Biological,
  Economic. A feature that fails any gate dies at the idea stage.
- **Certification** — driver conformance (`src/drivers/compliance.ts`),
  CP conformance suite, and the engineering benchmark corpus are the
  machinery that will certify UCH-compliant drivers and runtimes.

## Repository layout

```text
spec/        The normative corpus — laws, constitution, CP, ontology, biology
rfc/         The RFC series — contracts under governance
design/      ADRs, architecture, CIR, threat model, conformance, governance (DOE)
docs/        The canon hub — Genesis, getting started, CLI/MCP references, roadmap
src/         55 subsystems — kernel, cognitive-plane, agentic, drivers, control-plane…
research/    Research notes, evidence register, synthesis
skills/      40+ skill definitions ship with the substrate
planning/    Phase plans (organism organs → digital twin → physiology → brain/suit)
```

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) | Install, first run, attach, CLI tour |
| [docs/ROADMAP.md](docs/ROADMAP.md) | The five Epochs and their status |
| [docs/README.md](docs/README.md) | Docs hub — index of every reference |
| [docs/CLI.md](docs/CLI.md) | Every `uch` command with examples |
| [docs/MCP.md](docs/MCP.md) | MCP tools, transports, connection |
| [docs/SKILLS.md](docs/SKILLS.md) | Skill system: catalog, import, provenance |
| [docs/memory-filing-rules.md](docs/memory-filing-rules.md) | Mandatory rules for writing to memory |
| [SPEC.md](SPEC.md) | Legacy full-system specification (COS-era) |
| [VISION.md](VISION.md) | Strategic thesis — UCH as open cognitive infrastructure |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## Contributing

UCH is run as a standards project: the specification comes first, the
runtime is its reference implementation. Read
[CONTRIBUTING.md](CONTRIBUTING.md) (RFC lifecycle, Five Gates, DOE wave
discipline) and [SECURITY.md](SECURITY.md) (threat model, disclosure)
before opening an issue or pull request.

*Persistent cognition. Replaceable pilots.*
