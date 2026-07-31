# UCH Documentation Hub

Universal Cognitive Harness — a portable cognitive infrastructure layer
for AI agents. This hub indexes every reference in the project.

## The Five-Book Canon

UCH is specification-first, implementation-second. The canon is the
authoritative source for every future implementation; the runtime is its
first reference implementation.

| Book | File | Contents |
| --- | --- | --- |
| **I — Genesis** | [GENESIS.md](GENESIS.md) | Product: why UCH exists — problem, vision, thesis, market, strategy (20 chapters) |
| **II — Constitution** | `../spec/CONSTITUTION.md` + `../spec/LAWS_OF_COGNITIVE_PHYSICS.md` | Immutable law: 32 laws in 5 families, cognitive rights/responsibilities, the kernel ABI |
| **III — Blueprint** | `../design/ARCHITECTURE.md` + `../design/STACK.md` + `../design/CIR.md` | Engineering: kernel, memory, scheduler, signals, drivers, protocols, CIR |
| **IV — Standards** | `../rfc/` | The RFC series — the source of truth for contracts (RFC-0000 governs the system) |
| **V — Ascension** | *to be authored* | Scale: performance, quality, DX, commercialization, community, enterprise, platform evolution |

The canon rule: **the specification is the source of truth, not the
conversation.** Any normative change passes the RFC lifecycle
(`../rfc/RFC-0000-specification-governance.md`, `../design/DIRECTIONS.md`
SOP-08) before it may touch the corpus.

## Quick Start

```bash
cd projects/uch
npm install && npm run build
node dist/cli/index.js help        # CLI reference
node dist/cli/index.js status      # system health
node dist/cli/index.js             # MCP STDIO server (default)
```

## Reference

| Doc | Contents |
| --- | --- |
| [CLI.md](CLI.md) | Every `uch` command with examples |
| [MCP.md](MCP.md) | MCP transports and the 23 cognitive tools |
| [SKILLS.md](SKILLS.md) | Skill catalog/import pipeline, provenance index |
| [memory-filing-rules.md](memory-filing-rules.md) | MANDATORY rules for anything that writes to memory |
| [extraction-map.md](extraction-map.md) | Provenance record: which external patterns map to which UCH modules |
| [organism-architecture.md](organism-architecture.md) | High-level organism architecture and system topology |
| [organism-implementation.md](organism-implementation.md) | `CognitiveOrganism` implementation reference, event bus wiring, harness integration |

## Design & Governance

| Doc | Contents |
| --- | --- |
| `../design/ADR-001-workspace-owned-cognitive-runtime.md` | Architecture decision record |
| `../design/ADR-002-otel-trace-engine.md` | OTel trace engine + cognitive replay decision record |
| `../design/ADR-003-engineering-intelligence-layer.md` | Engineering Intelligence Layer decision record (Phase A) |
| `../design/ADR-004-cognitive-compute-fabric.md` | Cognitive Compute Fabric — virtual processors + routing contract (Level 4) |
| `../design/ADR-005-universal-cognitive-protocol.md` | Universal Cognitive Protocol — substrate/driver naming, Episode canonicalization, L0–L4 ladder, Live Cognitive State, driver triad (+ Amendment A: terminology reconciliation, cognitive trace/middleware/packages) |
| `../design/ADR-006-cognitive-microkernel.md` | Cognitive Microkernel — kernel/service boundary, 12 kernel primitives (status-verified), Cognitive Process model, cognitive vmem, organism versioning, transactional cognition, standards strategy (**Phases A–F implemented 2026-08-01** — see `COGNITIVE-KERNEL-SHIPPING.md`) |
| `../design/COGNITIVE-TRACE.md` | Cognitive Trace — schema (`uch.cognitive-trace.v1`), organ ownership, driver contract |
| `../design/COGNITIVE-MIDDLEWARE.md` | Cognitive Middleware — the governed pipeline + the Cognitive Image cache (per-grant, regenerable) |
| `../design/COGNITIVE-PACKAGES.md` | Cognitive Packages — package format (`uch.package.v1`) + the package governance gate |
| `../design/ENGINEERING-INTELLIGENCE.md` | Engineering Intelligence Layer design — 10 tier domain stores, evaluator, wiring, phases |
| `../design/EXOSYMBIOSIS.md` | The UCH wearable — driver triad (observe/translate/augment), 5C cognition capture contract, sync planes, capture rails, hive-mind topology |
| `../design/INTEGRATION-LEVELS.md` | The L0–L4 integration ladder — per-rail capability levels, conformance criteria, verified per-platform map |
| `../design/LIVE-COGNITIVE-STATE.md` | Live Cognitive State — the mind-state artifact (schema, lifecycle, sources) |
| `../design/UNIVERSAL-INTEGRATION.md` | Hive Mind — universal integration across VS Code/Copilot, OpenCode, Claude Code, Codex (capture matrix, HiveEvent schema, roadmap) |
| `../design/integrations/VSCODE.md` | Standalone VS Code + Copilot Chat integration (extension: chat participant, LM tools, MCP provider, passive chat-journal ingest) |
| `../design/integrations/OPENCODE.md` | Standalone OpenCode integration (plugin hooks incl. reasoning parts, custom tools, storage/SQLite ingest) |
| `../design/integrations/CLAUDE-CODE.md` | Standalone Claude Code integration (hooks, transcript tail + COT, OTel export, MCP, SDK drive) |
| `../design/integrations/CODEX.md` | Standalone Codex integration (config.toml hooks, rollout tail + COT, OTel exporter, MCP, `codex exec` drive) |
| `../design/WORKSPACE-MANIFEST.md` | Workspace manifest + discovery contract (implemented) |
| `../design/PROJECTIONS.md` | Workspace-state projections — scope containment + authority intersection (implemented) |
| `../design/EVENT-GOVERNANCE.md` | Provenance-linked, policy-checked driver event gate (implemented) |
| `../design/ARCHITECTURE.md` | System architecture |
| `../design/CIC-SPECIFICATION.md` | Cognitive Interchange Contract specification (v0.1: capability grants, scope cascade, operation families, cognitive state document) |
| `../design/CONFORMANCE.md` | Conformance criteria |
| `../design/FAILURE-RETRY.md` | Failure and retry model |
| `../design/PRIVACY-ERASURE.md` | Privacy and erasure guarantees |
| `../design/THREAT-MODEL.md` | Security threat model |

## Formal Specification

| Doc | Contents |
| --- | --- |
| `../SPEC.md` | Full cognitive system specification |
| `../spec/FORMAL_FOUNDATIONS.md` | Formal foundations (logic, probability, semantics) |
| `../spec/COGNITIVE_ONTOLOGY.md` | The ontology: what facts, beliefs, knowledge mean |
| `../spec/COGNITIVE_BIOLOGY.md` | Biological mapping of the architecture |
| `../spec/CONSTITUTION.md` | The Cognitive Constitution |
| `../spec/GENOME.md` | Concept genome specification |
| `../spec/LAWS_OF_COGNITIVE_PHYSICS.md` | Invariant laws of the cognitive substrate |

## Research

| Doc | Contents |
| --- | --- |
| `../research/README.md` | Research overview |
| `../research/RESEARCH_PLAN.md` | Plan and roadmap |
| `../research/RESEARCH_GOVERNANCE.md` | How research is governed |
| `../research/EVIDENCE_REGISTER.md` | Evidence provenance |
| `../research/SYNTHESIS.md` | Cross-domain synthesis |

## Project Documents

| Doc | Contents |
| --- | --- |
| `../MANIFESTO.md` | The public declaration: workspace-owned intelligence, the discipline claim, the organ contract |
| `../CHANGELOG.md` | Release history |
| `../CONTRIBUTING.md` | How to contribute |
| `../UCCP-persist-load-SUMMARY.md` | Persist/load implementation summary |
| `../.env.example` | Environment template (copy to `.env`) |
