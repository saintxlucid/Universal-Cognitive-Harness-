# STACK.md — The UCH Specification Stack

- **Status:** Accepted spec framing (2026-08-01, vision round 4)
- **Scope:** UCH is a **stack of independently versioned contracts**, not one
  protocol — the Internet model, not the single-protocol model. Each layer can
  evolve independently; a runtime may implement any subset of the stack.
- **Companions:** [CP.md](../spec/CP.md) (the syscall ABI),
  [COGNITIVE_ONTOLOGY.md](../spec/COGNITIVE_ONTOLOGY.md) (Layer 0),
  [ADR-005](ADR-005-universal-cognitive-protocol.md) (attachment),
  [CONFORMANCE.md](CONFORMANCE.md) (certification).

## 1. Why a stack

Every successful computing revolution standardized one contract: TCP/IP
(communication), POSIX (OS interface), LLVM (IR), OCI (containers), USB
(hardware), MCP (tools), A2A (agents), Git (version history). The AI ecosystem
is now fragmenting that insight — UMP (memory portability), OCP (context),
ARP (runtime), MACP (multi-agent) — each solving one axis.

UCH unifies them **without replacing them**: it is the stack those protocols
plug into. MCP remains the tool channel, A2A the agent channel, emerging
memory protocols the portability channel. UCH contributes only where there is
a genuine gap: persistent cognition, cognitive state, cognitive execution.

## 2. The layers

| Layer | Name | Contract | Lives in | Version |
|---|---|---|---|---|
| L0 | **UCOM** — Universal Cognitive Object Model | The ontology: everything is an object (episode, belief, knowledge, signal, skill, policy, goal, hypothesis, evidence, identity, genome, agent, workspace, project, package) | `spec/COGNITIVE_ONTOLOGY.md`, `spec/ontology/` | part of spec |
| L1 | **UCEP** — Universal Cognitive Event Protocol | Immutable, versioned, replayable events (MemoryStored, BeliefRevised, KnowledgePromoted, PolicyViolated…) | Event bus + OTel trace ledger (ADR-002), `design/EVENT-GOVERNANCE.md` | W3C trace ids, event schema versioning policy (GAP-CLOSURE-PLAN Phase 3, done 2026-08-01) |
| L2 | **UCMP** — Universal Cognitive Memory Protocol | Memory operations: remember, recall, consolidate, promote, forget, decay, replay, summarize, archive | Mnemosyne (episodic/semantic/procedural) + Sleep Cycle | implemented |
| L3 | **UCRP** — Universal Cognitive Runtime Protocol | Host attachment: handshake, capability negotiation, auth, genome/memory/workspace sync, live state, detach, sleep, resume | CP v1 (`spec/CP.md`) + Attachment lifecycle (ADR-005) + Live Cognitive State | CP 1.0.0 stable |
| L4 | **Driver SDK** | What Claude/Codex/Cursor/Copilot/OpenCode drivers implement | `src/drivers/` + sensor/effector composition + `design/SENSORS-EFFECTORS.md` | driver-versioned |
| L5 | **Runtime** | The persistent daemon (reference: TypeScript `src/`; Rust is an open alternative-runtime decision) | `src/` | package-versioned |

**Naming note:** these layer names are framing aliases for artifacts that
already exist — they do not introduce new protocols. The layer boundary is
the new thing: independent versioning per layer, per the Internet model.

## 3. The microkernel boundary

UCH is a **cognitive microkernel**: it owns only what must be centralized;
everything else is a service behind the kernel. The boundary list, with the
existing kernel service for each:

| Kernel-owned (centralized) | Existing service |
|---|---|
| Identity | species-genome, `identity` stores |
| Genome | `spec/GENOME.md`, `src/cognitive-plane/genome/` |
| Memory manager | Mnemosyne + neural-fs stores |
| Signal router | `src/nervous-system/signal.ts`, event bus |
| Scheduler | `src/accelerators/scheduler.ts` (schedules THINKING, frugality gate) |
| Security | `src/agentic/permissions/`, CIC capability grants, ProjectionEngine |
| Persistence | `.uccp/persist/`, Storable contracts |
| Capability registry | CIC capability-grant model, driver registry |
| Cognitive clock | `src/protocol/catalog.ts` monotonic tick (2026-08-01) |
| Event journal | Trace ledger (ADR-002, append-only, replayable) |
| Policy engine | Constitution + Governance + organic-score vetoes |
| Energy manager | Metabolism / energy budget |

Everything else — creativity, dreaming, reflection, critic, planning,
learning, reasoning, taste — is a **service** behind the kernel, replaceable
without touching the kernel. This is the Linux argument: the kernel doesn't
know about Chrome; it schedules processes.

## 4. Cognitive processes, threads, and the ISA

- **Processes:** a host attachment creates a **cognitive process** (the
  Episode, PID-equivalent). Another host joins the *same* process — nothing
  transfers, nothing syncs; it attaches to the same organism (Live Cognitive
  State + traceparent continuation, ADR-002/005).
- **Threads:** parallel work streams within a process = **child spans** of the
  trace tree. Claude owns Thread A, Codex Thread B — the ledger already
  models this (parent_span_id trees).
- **ISA:** CP v1 is the syscall ABI (`spec/CP.md`). The instruction catalog
  (`src/protocol/catalog.ts`) adds the assembly-table metadata: category,
  organ, energy cost, expected output, verification requirement — including
  the **constitutional gate** (evaluate/critique require the organic-score /
  constitution review before commit). Monotonic cognitive ticks order
  execution; wall clock never orders.
- **Transactional cognition:** CIC propose/commit + verification gates =
  Think → Verify → Commit with rollback. No hallucinated knowledge reaches
  long-term memory (organic-score vetoes + integrity checklist).

## 5. Certification (UCH Compliance)

`src/protocol/conformance.ts` certifies servers ("this server speaks CP v1").
`src/drivers/compliance.ts` certifies drivers: declared integration level
(L0–L4, ADR-005) + supported CP ops → protocol coverage %, level fidelity,
energy profile, verdict (`certified`/`partial`/`not-certified`). "Codex passes
100%" becomes a computed number. Driver certification is the ecosystem
surface: vendors certify their driver, users compare honestly.

## 6. Open governance decisions (not made here)

| Decision | Options | Dependency |
|---|---|---|
| Rename UCH (Harness → Computing Platform) | Keep UCH; document layers as aliases (chosen here); full rename is breaking | spec community |
| Three-repo split (Spec / Core / Drivers) | Do it when a first external driver exists — the split is a publishing boundary, not a folder change | external adoption |
| Rust daemon (Layer 5 alt-runtime) | CP conformance makes this possible without forking the spec | conformance suite as gate |
| Versioned organism rollback | Already have: ledger + version-store + Cognitive Time Machine; productize as `uch rollback --beliefs-at <t>` | CLI work |

## 7. What this document does not do

It does not add protocols, organs, or planes. It names, maps, and version-izes
what exists. The stack is the same organism, seen as infrastructure.
