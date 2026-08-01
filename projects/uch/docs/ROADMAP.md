# UCH Roadmap — The Five Epochs

> **Book V — Ascension.** What it takes to become a computing platform:
> performance, quality, ecosystem, certification, and governance — not
> features. This roadmap is a living document, updated as RFCs land.

**Status legend:** ✅ landed · 🔶 in progress · ⬜ planned · 🚫 deliberately excluded

## Epoch I — Foundation (current)

*The specification is the source of truth. The discipline before the documents.*

| Item | Status | Artifact |
| --- | --- | --- |
| Manifesto (engraved creed) | ✅ | MANIFESTO.md |
| Constitution v2 — 32 laws, five families | ✅ | spec/LAWS_OF_COGNITIVE_PHYSICS.md |
| Cognitive Rights / Responsibilities / Immutability | ✅ | spec/CONSTITUTION.md (Articles IX–XI) |
| Ontology + Dual Naming Convention | ✅ | spec/COGNITIVE_ONTOLOGY.md |
| Specification Governance System | ✅ | rfc/RFC-0000, design/DIRECTIONS.md SOP-08/09 |
| Genesis PRD (20 chapters) | 🔶 | docs/GENESIS.md — ch. 1–3 written, rest under RFC governance |
| RFC-0001 Identity / 0002 Signals / 0003 Memory | ✅ | rfc/ (accepted) |
| RFC-0004 CIR (Cognitive Intermediate Representation) | ✅ | spec/CIR.md normative, RFC-0004 Accepted, corpus certified (benchmark runner) |

## Epoch II — Kernel

*The cognitive microkernel (ADR-006): 12 primitives, nothing else.*

| Item | Status | Artifact |
| --- | --- | --- |
| Identity / Genome | ✅ | workspace-manifest, species-genome |
| Signal router / Event bus | ✅ | neural-event-bus, nervous-system |
| Scheduler | ✅ | accelerators/scheduler, cognitive-plane scheduler |
| Security / grants / CIC | ✅ | cognitive-runtime, permissions, projections |
| Persistence | ✅ | Storable, .uccp/persist, neural-fs |
| Capability registry | ✅ | cognitive-runtime/capability-registry |
| Event journal (OTel trace ledger) | ✅ | cognitive-plane/trace-engine |
| Policy engine | ✅ | constitution, integrity-checklist, policies |
| Energy manager | ✅ | metabolism, budgets |
| Memory manager (paging) | ✅ | kernel/memory/vmem — Hot→Archive |
| **Cognitive process model** (PID, threads, attach-joins-PID) | ✅ | kernel/process |
| **Transactional cognition** (propose→verify→commit) | ✅ | kernel/transactional |
| **Self-diagnosis** (SMART metrics) | ✅ | kernel/diagnostics |
| **FS mounts** | ✅ | neural-fs/mounts |
| **Cognitive packages** (signed, quarantined) | ✅ | kernel/packages, control-plane/packages |
| **Cognitive merge** (trivial slice) | ✅ | kernel/merge |

## Epoch III — Runtime

*The substrate as a platform: processes, hypervisor, drivers, instructions.*

| Item | Status | Artifact |
| --- | --- | --- |
| CP v1 ABI (17 ops, stable) | ✅ | spec/CP.md, protocol/catalog.ts |
| Conformance suite | ✅ | protocol/conformance.ts |
| Driver certification | ✅ | drivers/compliance.ts |
| Cognitive time machine + replay | ✅ | cognitive-plane/replay |
| **CIR compiler + optimizer passes** | ✅ | spec/CIR.md normative; src/cognitive-compiler (RFC-0004 Accepted, benchmark 71 cases green) |
| **Driver SDK** (official extension APIs, MCP, LSP — never undocumented internals) | ⬜ | RFC pending |
| **Observatory** (live physiology: memory, signals, latency, health, energy) | 🔶 | health-monitor/telemetry exist; observatory UI open (Phase 02) |
| **Digital Twin** (what-if simulation) | ⬜ | planning/02 — Phase 02 frontier |
| **Cognitive debugger / profiler** (live state, not logs) | ⬜ | RFC pending |

## Epoch IV — Ecosystem

*Every pilot becomes a driver. The runtime is never the agent.*

| Item | Status | Artifact |
| --- | --- | --- |
| Agent boot modules (Claude Code, Codex, OpenCode) | ✅ | src/agent |
| Driver plane (IDE, agent, mcp, git, filesystem, acp, runtime) | ✅ | src/drivers |
| Sensor/Effector decomposition | ✅ | src/drivers/sensors, src/drivers/effectors |
| Certified driver levels (I–III / Enterprise / Research) | 🔶 | compliance.ts machine exists; levels to ratify |
| VS Code / Cursor / JetBrains / Neovim drivers | ⬜ | RFC + driver SDK first |
| **UCH Academy** (courses, certification program) | ⬜ | post-Epoch IV |

## Epoch V — Platform

*Independent implementations, certification bodies, a foundation.*

| Item | Status | Artifact |
| --- | --- | --- |
| Marketplace (packages, drivers) | ⬜ | package-gate/registry machinery exists |
| Specification Council (multi-member) | ⬜ | RFC-0000 — roles defined, single-member today |
| Independent implementations | ⬜ | enabled by Books I–IV |
| UCH benchmark suite (SPEC-CPU-style, per driver) | 🔶 | engineering-benchmark exists (17 cases); expansion open |
| Foundation governance | ⬜ | RFC-0000 amendment |
| UCH Language (ontology discipline, vocabulary) | ✅ | Dual Naming Convention, COGNITIVE_ONTOLOGY |

## Cross-cutting programs

| Program | Status | Pointer |
| --- | --- | --- |
| ADR-006 phases A–F | ✅ | design/ADR-006-cognitive-microkernel.md |
| Gap-closure plan | 🔶 | design/GAP-CLOSURE-PLAN.md |
| Engineering intelligence (150 concepts, veto gates) | ✅ | design/ENGINEERING-INTELLIGENCE.md |
| Security program (audit 2026-07-31: 8/8 fixed) | ✅ | BUG-REPORT.md, design/THREAT-MODEL.md |
| Cognitive middleware pipeline | 🔶 | design/COGNITIVE-MIDDLEWARE.md (in-flight wave) |

## 10-year north star

> Success is not adoption of the runtime. It is when people stop asking
> *"which model are you using?"* and start asking *"which cognitive
> runtime are you running?"* — and when UCH-compliant runtimes outnumber
> UCH the repository.

*Roadmap governed by RFC-0000: material changes to this document are
amendments, not edits.*
