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
