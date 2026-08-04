# UCH Documentation Hub

Universal Cognitive Harness — a portable cognitive infrastructure layer
for AI agents. This hub indexes every reference in the project.

## The Five-Book Canon

UCH is specification-first, implementation-second. The canon is the
authoritative source for every future implementation; the runtime is its
first reference implementation.

| Book                  | File                                                                  | Contents                                                                                                                         |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **I — Genesis**       | [GENESIS.md](GENESIS.md)                                              | Product: why UCH exists — problem, vision, thesis, market, strategy (20 chapters)                                                |
| **II — Constitution** | `../spec/CONSTITUTION.md` + `../spec/LAWS_OF_COGNITIVE_PHYSICS.md`    | Immutable law: 32 laws in 5 families, cognitive rights/responsibilities, the kernel ABI                                          |
| **III — Blueprint**   | `../design/ARCHITECTURE.md` + `../design/STACK.md` + `../spec/CIR.md` | Engineering: kernel, memory, scheduler, signals, drivers, protocols, CIR                                                         |
| **IV — Standards**    | `../rfc/`                                                             | The RFC series — the source of truth for contracts (RFC-0000 governs the system)                                                 |
| **V — Ascension**     | [ROADMAP.md](ROADMAP.md)                                              | Scale: performance, quality, DX, commercialization, community, enterprise, platform evolution, and the production maturity model |

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

## Governance & adoption

UCH’s foundation posture is now documented alongside the technical spec and runtime material:

- [../design/ECOSYSTEM-COMPATIBILITY.md](../design/ECOSYSTEM-COMPATIBILITY.md) — compatibility posture, implementation milestones, and first-wave adapter plan
- [../design/UNIVERSAL-INTEGRATION.md](../design/UNIVERSAL-INTEGRATION.md) — the hive-mind architecture with the M0–M3 roadmap

- [../governance/README.md](../governance/README.md) — governance model, stewardship roles, and decision process
- [../governance/CONFORMANCE-AND-CERTIFICATION.md](../governance/CONFORMANCE-AND-CERTIFICATION.md) — conformance evidence and certification expectations
- [../governance/LICENSING-AND-USE.md](../governance/LICENSING-AND-USE.md) — adoption, licensing, and downstream obligations
- [../governance/ORGANIZATION-AND-STEWARDSHIP.md](../governance/ORGANIZATION-AND-STEWARDSHIP.md) — Foundation, Research Institute, and Labs organization model

## Reference

| Doc                                                                                              | Contents                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [CLI.md](CLI.md)                                                                                 | Every `uch` command with examples                                                   |
| [MCP.md](MCP.md)                                                                                 | MCP transports and the 47 cognitive tools                                           |
| [SKILLS.md](SKILLS.md)                                                                           | Skill catalog/import pipeline, provenance index                                     |
| [memory-filing-rules.md](memory-filing-rules.md)                                                 | MANDATORY rules for anything that writes to memory                                  |
| [../governance/README.md](../governance/README.md)                                               | Foundation governance and stewardship model                                         |
| [../governance/CONFORMANCE-AND-CERTIFICATION.md](../governance/CONFORMANCE-AND-CERTIFICATION.md) | Conformance and certification posture                                               |
| [../governance/LICENSING-AND-USE.md](../governance/LICENSING-AND-USE.md)                         | Adoption and licensing guidance                                                     |
| [extraction-map.md](extraction-map.md)                                                           | Provenance record: which external patterns map to which UCH modules                 |
| [organism-architecture.md](organism-architecture.md)                                             | High-level organism architecture and system topology                                |
| [organism-implementation.md](organism-implementation.md)                                         | `CognitiveOrganism` implementation reference, event bus wiring, harness integration |

## Design & Governance

| Doc                                                      | Contents                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../design/ADR-001-workspace-owned-cognitive-runtime.md` | Architecture decision record                                                                                                                                                                                                                                                    |
| `../design/ADR-002-otel-trace-engine.md`                 | OTel trace engine + cognitive replay decision record                                                                                                                                                                                                                            |
| `../design/ADR-003-engineering-intelligence-layer.md`    | Engineering Intelligence Layer decision record (Phase A)                                                                                                                                                                                                                        |
| `../design/ADR-004-cognitive-compute-fabric.md`          | Cognitive Compute Fabric — virtual processors + routing contract (Level 4)                                                                                                                                                                                                      |
| `../design/ADR-005-universal-cognitive-protocol.md`      | Universal Cognitive Protocol — substrate/driver naming, Episode canonicalization, L0–L4 ladder, Live Cognitive State, driver triad (+ Amendment A: terminology reconciliation, cognitive trace/middleware/packages)                                                             |
| `../design/ADR-006-cognitive-microkernel.md`             | Cognitive Microkernel — kernel/service boundary, 12 kernel primitives (status-verified), Cognitive Process model, cognitive vmem, organism versioning, transactional cognition, standards strategy (**Phases A–F implemented 2026-08-01** — see `COGNITIVE-KERNEL-SHIPPING.md`) |
| `../design/COGNITIVE-TRACE.md`                           | Cognitive Trace — schema (`uch.cognitive-trace.v1`), organ ownership, driver contract                                                                                                                                                                                           |
| `../design/COGNITIVE-MIDDLEWARE.md`                      | Cognitive Middleware — the governed pipeline + the Cognitive Image cache (per-grant, regenerable)                                                                                                                                                                               |
| `../design/COGNITIVE-PACKAGES.md`                        | Cognitive Packages — package format (`uch.package.v1`) + the package governance gate                                                                                                                                                                                            |
| `../design/ENGINEERING-INTELLIGENCE.md`                  | Engineering Intelligence Layer design — 10 tier domain stores, evaluator, wiring, phases                                                                                                                                                                                        |
| `../design/EXOSYMBIOSIS.md`                              | The UCH wearable — driver triad (observe/translate/augment), 5C cognition capture contract, sync planes, capture rails, hive-mind topology                                                                                                                                      |
| `../design/INTEGRATION-LEVELS.md`                        | The L0–L4 integration ladder — per-rail capability levels, conformance criteria, verified per-platform map                                                                                                                                                                      |
| `../design/LIVE-COGNITIVE-STATE.md`                      | Live Cognitive State — the mind-state artifact (schema, lifecycle, sources)                                                                                                                                                                                                     |
| `../design/UNIVERSAL-INTEGRATION.md`                     | Hive Mind — universal integration across VS Code/Copilot, OpenCode, Claude Code, Codex (capture matrix, HiveEvent schema, roadmap)                                                                                                                                              |
| `../design/integrations/VSCODE.md`                       | Standalone VS Code + Copilot Chat integration (extension: chat participant, LM tools, MCP provider, passive chat-journal ingest)                                                                                                                                                |
| `../design/integrations/OPENCODE.md`                     | Standalone OpenCode integration (plugin hooks incl. reasoning parts, custom tools, storage/SQLite ingest)                                                                                                                                                                       |
| `../design/integrations/CLAUDE-CODE.md`                  | Standalone Claude Code integration (hooks, transcript tail + COT, OTel export, MCP, SDK drive)                                                                                                                                                                                  |
| `../design/integrations/CODEX.md`                        | Standalone Codex integration (config.toml hooks, rollout tail + COT, OTel exporter, MCP, `codex exec` drive)                                                                                                                                                                    |
| `../design/integrations/COMPATIBILITY-MATRIX.md`         | UCH × AI ecosystem compatibility matrix v1.0 (2026-08-01) — 23 harnesses/apps, 9 IDEs, 24 providers, 14 SDKs, 6 protocols, gap list, resource catalog                                                                                                                           |
| `../design/ECOSYSTEM-COMPATIBILITY.md`                   | Short-form compatibility strategy, integration tiers, MCP bridge posture, and implementation roadmap                                                                                                                                                                            |
| `../design/WORKSPACE-MANIFEST.md`                        | Workspace manifest + discovery contract (implemented)                                                                                                                                                                                                                           |
| `../design/PROJECTIONS.md`                               | Workspace-state projections — scope containment + authority intersection (implemented)                                                                                                                                                                                          |
| `../design/EVENT-GOVERNANCE.md`                          | Provenance-linked, policy-checked driver event gate (implemented)                                                                                                                                                                                                               |
| `../design/ARCHITECTURE.md`                              | System architecture                                                                                                                                                                                                                                                             |
| `../design/COGNITIVE-MICROARCHITECTURE.md`               | The missing execution substrate: cognitive clock, signal freshness, residency, backpressure, checkpoints, speculation, leasing, and provenance propagation                                                                                                                      |
| `../design/CIC-SPECIFICATION.md`                         | Cognitive Interchange Contract specification (v0.1: capability grants, scope cascade, operation families, cognitive state document)                                                                                                                                             |
| `../design/CONFORMANCE.md`                               | Conformance criteria                                                                                                                                                                                                                                                            |
| `../design/FAILURE-RETRY.md`                             | Failure and retry model                                                                                                                                                                                                                                                         |
| `../design/PRIVACY-ERASURE.md`                           | Privacy and erasure guarantees                                                                                                                                                                                                                                                  |
| `../design/THREAT-MODEL.md`                              | Security threat model                                                                                                                                                                                                                                                           |
| `../design/STACK.md`                                     | The six-layer specification stack (UCOM/UCEP/UCMP/UCRP/Driver SDK/Runtime), microkernel boundary, open governance decisions                                                                                                                                                     |
| `../design/DIRECTIONS.md`                                | DOE (Direction-Oriented Engineering): 7 SOPs, 12 rules, quality gates, Debt Register (v1.0)                                                                                                                                                                                     |
| `../design/COGNITIVE-PROCESSES.md`                       | Cognitive Process model (ADR-006 Phase A) — PID namespace, threads, attach-joins-PID                                                                                                                                                                                            |
| `../design/COGNITIVE-VIRTUAL-MACHINE.md`                 | CVM design (IDEA-0045) — cognitive bytecode over the CP 17-op ISA; blocked on RFC-0004 (design only)                                                                                                                                                                            |
| `../design/COGNITIVE-KERNEL-SHIPPING.md`                 | Wave contract for ADR-006 Phases A–F + GAP leftovers (all 10 workstreams landed)                                                                                                                                                                                                |
| `../design/CONNECTOME.md`                                | Concept store design — cue-tag-content model, weighted edges, activation propagation                                                                                                                                                                                            |
| `../design/ENGINEERING-PHYSIOLOGY.md`                    | Reflex gate, counterfactual, taste, pain memory, genome evolution, prediction cortices                                                                                                                                                                                          |
| `../design/GAP-CLOSURE-PLAN.md`                          | Vision-to-repository gap closure plan (time machine, sensors/effectors, middleware, ECS)                                                                                                                                                                                        |
| `../design/ECS-SPIKE.md`                                 | Decision record — cross-type queries vs a Bevy-style ECS (evidence-driven verdict, no code)                                                                                                                                                                                     |
| `../design/PROPOSED-LAW-OWNERSHIP-OF-COGNITION.md`       | Candidate Law "No application shall own cognition" (proposal — not enacted)                                                                                                                                                                                                     |
| `../design/RETRIEVAL-SCALING.md`                         | Kernel memory scaling — HNSW/OPQ ladder behind RetrievalFusion                                                                                                                                                                                                                  |
| `../design/SENSORS-EFFECTORS.md`                         | Driver decomposition convention — sensors/effectors, composeDriver                                                                                                                                                                                                              |
| `../design/UNIVERSAL-ENGINEERING-REPLAY.md`              | UER design (IDEA-0047) — one causal engineering graph, influence-path/ancestry/change-point queries                                                                                                                                                                             |
| `../design/CIR.md`                                       | CIR historical design record (superseded 2026-08-01 — promoted to `../spec/CIR.md`)                                                                                                                                                                                             |

## Formal Specification

| Doc                                    | Contents                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `../SPEC.md`                           | Full cognitive system specification (legacy COS-era)                                         |
| `../spec/FORMAL_FOUNDATIONS.md`        | Formal foundations (logic, probability, semantics; Part VIII Cognitive Physics is normative) |
| `../spec/COGNITIVE_ONTOLOGY.md`        | The ontology: what facts, beliefs, knowledge mean                                            |
| `../spec/COGNITIVE_BIOLOGY.md`         | Biological mapping of the architecture                                                       |
| `../spec/CONSTITUTION.md`              | The Cognitive Constitution                                                                   |
| `../spec/GENOME.md`                    | Concept genome specification                                                                 |
| `../spec/LAWS_OF_COGNITIVE_PHYSICS.md` | Invariant laws of the cognitive substrate (32 laws, five families)                           |
| `../spec/CP.md`                        | Cognitive Protocol (CP) v1.0.0 — the syscall ABI of the Cognitive OS                         |
| `../spec/CIR.md`                       | Cognitive Intermediate Representation (normative, RFC-0004 Accepted)                         |
| `../spec/VERSION.md`                   | Specification corpus versioning & stability policy (0.5.1)                                   |

## Research

| Doc                                  | Contents                 |
| ------------------------------------ | ------------------------ |
| `../research/README.md`              | Research overview        |
| `../research/RESEARCH_PLAN.md`       | Plan and roadmap         |
| `../research/RESEARCH_GOVERNANCE.md` | How research is governed |
| `../research/EVIDENCE_REGISTER.md`   | Evidence provenance      |
| `../research/SYNTHESIS.md`           | Cross-domain synthesis   |

## Project Documents

| Doc                               | Contents                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `../MANIFESTO.md`                 | The public declaration: workspace-owned intelligence, the discipline claim, the organ contract |
| `../CHANGELOG.md`                 | Release history                                                                                |
| `../CONTRIBUTING.md`              | How to contribute                                                                              |
| `../UCCP-persist-load-SUMMARY.md` | Persist/load implementation summary                                                            |
| `../.env.example`                 | Environment template (copy to `.env`)                                                          |
