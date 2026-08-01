# IDEA-0104 — Universal Adapter Compiler

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 abstraction-layer intake (round 15) — "don't
  write adapters; generate them. Input: application, capabilities,
  events, SDK, CLI, MCP, extensions, authentication → Output: UCH
  adapter." The LLVM move applied to integration: if the fingerprint
  (0102) and scanner (0099) enumerate what a runtime exposes, and the
  UCCL contract (0096) fixes what an adapter must implement, then an
  adapter is _derivable_ — the last remaining bespoke artifact
  becomes a compilation target.
- **Related:** IDEA-0096 (UCCL — the compiler's output contract),
  IDEA-0099 (scanner — the compiler's front-end input), IDEA-0102
  (runtime fingerprint — the compiler's manifest), IDEA-0103 (Cognitive
  BIOS — the generated adapter's boot path), IDEA-0052 (skill compiler
  — prose→skill IR precedent), RFC-0004 CIR + IDEA-0106 (Context IR —
  the compiler's sibling for repository artifacts), IDEA-0098 (UCM —
  generated adapters are certified per brand), src/drivers/registry.ts
  and compose.ts + protocol-adapter.ts (seeds), design/EXOSYMBIOSIS.md
  (capture rails the generated adapter binds to)

## Motivation

Every integration today is written by hand: Claude hooks, Codex hooks,
OpenCode plugin, VS Code extension, plus per-runtime tails. The intake's
claim: given (a) a machine-readable fingerprint of the host (0102),
(b) a surface taxonomy and scanner output (0099), and (c) one normative
adapter contract (0096), the adapter is a **deterministic function of
those inputs** — generated, not authored. A new tool "doesn't need
bespoke support; it needs a fingerprint". The compiler is what makes
"infinite clients, one abstraction" operational: frontends are the
scanner probes per runtime family, the IR is the fingerprint +
capability graph, and backends emit adapters conformant to the UCCL
contract with the ten-method lifecycle and the boot sequence (0103)
wired in.

## The corpus cannot cover it because

- Adapters are hand-written per runtime (design/integrations/*.md
  document what was hand-crafted); no artifact derives an adapter
  from enumerated inputs. IDEA-0052 compiles skills; RFC-0004 CIR
  compiles instructions; neither compiles _integration code_.
- The driver registry and compose.ts wire pre-built drivers; there is
  no codegen step that produces a new driver from a manifest +
  fingerprint.
- The inputs exist only partially: the fingerprint (0102) and the
  scanner graph (0099) are themselves unbuilt — the compiler is the
  consumer that justifies both, and their absence is why adapters
  remain bespoke.

## Proposal sketch

- **Compiler pipeline**: fingerprint (0102) + scanner capability graph
  (0099) + adapter manifest (surfaces, events, SDK/CLI/MCP/auth
  bindings declared or probed) → intermediate adapter IR (normalized
  surface binding list) → codegen per runtime family → UCH adapter
  with the ten-method lifecycle, boot sequence (0103), capture rails,
  and level claims (per INTEGRATION-LEVELS) — plus the conformance
  harness stub (UCM, IDEA-0098).
- **Determinism rule**: same fingerprint + manifest → same adapter
  (byte-identical modulo version stamps); generated adapters are
  auditable (source map to probes) and re-generated on fingerprint
  change (continuous understanding).
- **Manual escape hatch**: generated adapters are a floor, not a
  ceiling — deep native integrations may extend them, but the
  extension must be declared as a delta over the generated baseline
  (never a silent fork), preserving the certification story.
- **Scope**: the compiler targets _integration scaffolding_ (surface
  binding, lifecycle, capture, conformance); deep platform-specific
  behavior stays in declared deltas — same rule as IDEA-0095's
  contract floor.

## Risk assessment

- Garbage-in: codegen quality is bounded by fingerprint/scanner
  quality — a wrong probe produces a wrong adapter; probes must carry
  evidence and overrides (scanner rule, IDEA-0099).
- Scope creep: generating deep native extensions is out of reach —
  the compiler must refuse (emit the delta stub) rather than generate
  partial behavior silently.
- Ecosystem shift: a runtime that changes its extension model
  invalidates generated adapters — re-fingerprint + re-generate must
  be the documented recovery path.

## Where it lands

- `src/drivers/codegen/` (adapter IR + emitters per family),
  fingerprint schema as the input contract, UCM certification harness
  generator.

## Code impact

- None until designed; seeds are registry.ts, compose.ts,
  protocol-adapter.ts, scanner (0099), fingerprint (0102).

## Next stage

- Prototype: generate an OpenCode adapter from its fingerprint +
  manifest; assert the generated adapter passes the UCCL conformance
  stub and boots per 0103.
