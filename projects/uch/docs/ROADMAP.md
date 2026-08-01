# UCH Roadmap — The Five Epochs

> **Book V — Ascension.** What it takes to become a computing platform:
> performance, quality, ecosystem, certification, and governance — not
> features. This roadmap is a living document, updated as RFCs land.

**Status legend:** ✅ landed · 🔶 in progress · ⬜ planned · 🚫 deliberately excluded

## Epoch I — Foundation (current)

_The specification is the source of truth. The discipline before the documents._

| Item                                                 | Status | Artifact                                                     |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------ |
| Manifesto (engraved creed)                           | ✅     | MANIFESTO.md                                                 |
| Constitution v2 — 32 laws, five families             | ✅     | spec/LAWS_OF_COGNITIVE_PHYSICS.md                            |
| Cognitive Rights / Responsibilities / Immutability   | ✅     | spec/CONSTITUTION.md (Articles IX–XI)                        |
| Ontology + Dual Naming Convention                    | ✅     | spec/COGNITIVE_ONTOLOGY.md                                   |
| Specification Governance System                      | ✅     | rfc/RFC-0000, design/DIRECTIONS.md SOP-08/09                 |
| Genesis PRD (20 chapters)                            | 🔶     | docs/GENESIS.md — ch. 1–3 written, rest under RFC governance |
| RFC-0001 Identity / 0002 Signals / 0003 Memory       | ✅     | rfc/ (accepted)                                              |
| RFC-0004 CIR (Cognitive Intermediate Representation) | ✅     | spec/CIR.md; RFC-0004 accepted; corpus certified             |

## Epoch II — Kernel

_The cognitive microkernel (ADR-006): 12 primitives, nothing else._

| Item                                                         | Status | Artifact                                                       |
| ------------------------------------------------------------ | ------ | -------------------------------------------------------------- |
| Identity / Genome                                            | ✅     | workspace-manifest, species-genome                             |
| Signal router / Event bus                                    | ✅     | neural-event-bus, nervous-system                               |
| Scheduler                                                    | ✅     | accelerators/scheduler, cognitive-plane scheduler              |
| Security / grants / CIC                                      | ✅     | cognitive-runtime, permissions, projections                    |
| Persistence                                                  | ✅     | Storable, .uccp/persist, neural-fs                             |
| Capability registry                                          | ✅     | cognitive-runtime/capability-registry                          |
| Event journal (OTel trace ledger)                            | ✅     | cognitive-plane/trace-engine                                   |
| Policy engine                                                | ✅     | constitution, integrity-checklist, policies                    |
| Energy manager                                               | ✅     | metabolism, budgets                                            |
| Memory manager (paging)                                      | ✅     | kernel/memory/vmem — Hot→Archive                               |
| **Cognitive process model** (PID, threads, attach-joins-PID) | ✅     | kernel/process                                                 |
| **Transactional cognition** (propose→verify→commit)          | ✅     | kernel/transactional                                           |
| **Self-diagnosis** (SMART metrics)                           | ✅     | kernel/diagnostics                                             |
| **FS mounts**                                                | ✅     | neural-fs/mounts                                               |
| **Cognitive packages** (signed, quarantined)                 | ✅     | kernel/packages, control-plane/packages                        |
| **Cognitive merge** (trivial slice)                          | ✅     | kernel/merge                                                   |
| **Replication** (14th kernel primitive, Ω-0)                 | ⬜     | IDEA-0130 — blocked on persistence write-path; zero impl today |
| **Recovery** (restore to consistent point, 15th primitive)   | ⬜     | IDEA-0130 — WS-E diagnoses, no restore primitive               |

## Epoch III — Runtime Standard

_The substrate as a platform: processes, hypervisor, drivers, instructions, and the contract that makes cognition portable._

| Item                                                                              | Status | Artifact                                                                                                                                                                  |
| --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CP v1 ABI (17 ops, stable)                                                        | ✅     | spec/CP.md, protocol/catalog.ts                                                                                                                                           |
| Conformance suite                                                                 | ✅     | protocol/conformance.ts                                                                                                                                                   |
| Driver certification                                                              | ✅     | drivers/compliance.ts                                                                                                                                                     |
| Cognitive time machine + replay                                                   | ✅     | cognitive-plane/replay                                                                                                                                                    |
| **CIR compiler + optimizer passes**                                               | ✅     | spec/CIR.md; src/cognitive-compiler; 71 benchmark cases green                                                                                                             |
| **CVM** ([design](../design/COGNITIVE-VIRTUAL-MACHINE.md))                        | 🔶     | prototype landed (4157188), 24 tests                                                                                                                                      |
| **Cognitive Binary Interface (CBI) / .cog artifact**                              | ⬜     | [design/COGNITIVE-RUNTIME-STANDARD.md](../design/COGNITIVE-RUNTIME-STANDARD.md)                                                                                           |
| **Cognitive Runtime Standard**                                                    | 🔶     | [design/COGNITIVE-RUNTIME-STANDARD.md](../design/COGNITIVE-RUNTIME-STANDARD.md), [design/COGNITIVE-ABI.md](../design/COGNITIVE-ABI.md)                                    |
| **Driver SDK** (official extension APIs, MCP, LSP — never undocumented internals) | ⬜     | RFC pending                                                                                                                                                               |
| **Universal Compatibility Initiative (UCI)**                                      | 🔶     | [docs/COMPATIBILITY-INITIATIVE.md](COMPATIBILITY-INITIATIVE.md) — adapter contract, first-wave integrations, and certification milestones                                 |
| **Observatory** (live physiology)                                                 | 🔶     | health-monitor/telemetry exist; observatory UI open                                                                                                                       |
| **Digital Twin** (what-if simulation)                                             | ⬜     | planning/02 — Phase 02 frontier                                                                                                                                           |
| **Cognitive profiler** (VTune for cognition)                                      | 🔶     | design/PROFILER.md — P1 landed (17 tests); CLI open                                                                                                                       |
| **Session-benchmark corpus** (every session an episode)                           | ⬜     | IDEA-0129 — blocked on UER P2 (uer-ingest)                                                                                                                                |
| **Cognitive microarchitecture + reference microkernel**                           | 🔶     | [design/COGNITIVE-MICROARCHITECTURE.md](../design/COGNITIVE-MICROARCHITECTURE.md) + [design/ADR-006-cognitive-microkernel.md](../design/ADR-006-cognitive-microkernel.md) |

## Epoch IV — Ecosystem

_Every pilot becomes a driver. The runtime is never the agent._

| Item                                                          | Status | Artifact                                       |
| ------------------------------------------------------------- | ------ | ---------------------------------------------- |
| Agent boot modules (Claude Code, Codex, OpenCode)             | ✅     | src/agent                                      |
| Driver plane (IDE, agent, mcp, git, filesystem, acp, runtime) | ✅     | src/drivers                                    |
| Sensor/Effector decomposition                                 | ✅     | src/drivers/sensors, src/drivers/effectors     |
| Certified driver levels (I–III / Enterprise / Research)       | 🔶     | compliance.ts machine exists; levels to ratify |
| VS Code / Cursor / JetBrains / Neovim drivers                 | ⬜     | RFC + driver SDK first                         |
| **UCH Academy** (courses, certification program)              | ⬜     | post-Epoch IV                                  |

## Epoch V — Platform

_Independent implementations, certification bodies, a foundation._

| Item                                             | Status | Artifact                                                |
| ------------------------------------------------ | ------ | ------------------------------------------------------- |
| Marketplace (packages, drivers)                  | ⬜     | package-gate/registry machinery exists                  |
| Specification Council (multi-member)             | ⬜     | RFC-0000 — roles defined, single-member today           |
| Independent implementations                      | ⬜     | enabled by Books I–IV                                   |
| UCH benchmark suite (SPEC-CPU-style, per driver) | 🔶     | engineering-benchmark exists (17 cases); expansion open |
| Foundation governance                            | ⬜     | RFC-0000 amendment                                      |
| UCH Language (ontology discipline, vocabulary)   | ✅     | Dual Naming Convention, COGNITIVE_ONTOLOGY              |

## Cross-cutting programs

| Program                                             | Status | Pointer                                                                            |
| --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| ADR-006 phases A–F                                  | ✅     | design/ADR-006-cognitive-microkernel.md                                            |
| Gap-closure plan                                    | 🔶     | design/GAP-CLOSURE-PLAN.md                                                         |
| Engineering intelligence (150 concepts, veto gates) | ✅     | design/ENGINEERING-INTELLIGENCE.md                                                 |
| Security program (audit 2026-07-31: 8/8 fixed)      | ✅     | BUG-REPORT.md, design/THREAT-MODEL.md                                              |
| Cognitive middleware pipeline                       | 🔶     | design/COGNITIVE-MIDDLEWARE.md (in-flight wave)                                    |
| **Irreplaceability program**                        | 🔶     | [design/IRREPLACEABILITY.md](../design/IRREPLACEABILITY.md) — WS-1..8; WS-2 landed |

## The Irreplaceability Program

_Objective amendment (IDEA-0127): UCH is designed to be impossible to
reimplement — compatibility claims are only valid through the
conformance suite, and the suite, tooling, and compatibility
guarantees make adopting the standard cheaper than reimplementing it.
The moat is the corpus, not any single mechanism._

| WS   | Workstream                                                                              | Status |
| ---- | --------------------------------------------------------------------------------------- | ------ |
| WS-1 | Five-spec canon (Constitution → Physics → ISA → Runtime/ABI → Conformance, one version) | 🔶     |
| WS-2 | Certification corpus + gate — design/CONFORMANCE-CORPUS.md + certification-corpus.ts    | ✅     |
| WS-3 | Suite growth to certification — close G-1..G-4 partial gaps toward 3000+ gated cases    | ⬜     |
| WS-4 | Session-benchmark corpus (every session a replayable episode)                           | ⬜     |
| WS-5 | Cognitive Profiler — P1 landed (17 tests); P2 = span-level attribution + CLI            | 🔶     |
| WS-6 | Kernel Replication + Recovery (14th/15th primitives)                                    | ⬜     |
| WS-7 | RCE discipline naming (Runtime Cognitive Engineering)                                   | ⬜     |
| WS-8 | CADR — immutable, consulted-at-decision-time records                                    | ⬜     |

## 10-year north star

> Success is not adoption of the runtime. It is when people stop asking
> _"which model are you using?"_ and start asking _"which cognitive
> runtime are you running?"_ — and when UCH-compliant runtimes outnumber
> UCH the repository.

_Roadmap governed by RFC-0000: material changes to this document are
amendments, not edits._
