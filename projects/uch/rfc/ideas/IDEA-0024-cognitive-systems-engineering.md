# IDEA-0024 — Cognitive Systems Engineering (CSE)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 — "stop building software; build Laws →
  Mathematics → Specifications → Protocols → Compilers → Reference
  Implementations → SDKs → Applications, exactly like TCP/IP, LLVM, POSIX,
  USB, OpenGL, Vulkan, OCI — an entirely new engineering discipline"
- **Related:** MANIFESTO, design/STACK.md, design/GAP-CLOSURE-PLAN.md §11.1
  (spec-first packaging), rfc/RFC-0000 (governance)

## Motivation

Every rival runtime (CognitiveOS, Agent libOS, KoLo, Cognitive Runtime,
h00.sh) converges on the same software architecture — runtime, memory,
scheduler, identity, tools, governance, persistence, lifecycle — because
those are necessary. The claim: the way past that convergence is not a
better runtime but a new **discipline** — Cognitive Systems Engineering —
in which everything in the repository is derived from laws, mathematics, and
specifications, and the repo is organized as a platform (`specs/`, `math/`,
`physics/`, `compiler/`, `isa/`, `abi/`, `runtime/`, `sdk/`, `drivers/`,
`reference/`, `research/`, `compliance/`, `certification/`, `simulator/`,
`benchmarks/`) rather than as a project (`src/`, `packages/`, `apps/`).

## The corpus cannot cover it because

The repo already has `spec/`, `design/`, `rfc/`, and `src/` separated
(spec-first packaging, GAP-CLOSURE Phase 3), and ADR-005 explicitly chose
not to restructure mid-project. What does not exist: the *discipline claim*
itself (a named engineering field with its own curriculum), the normative
derivation order (every artifact traceable upward through the layers), and
the platform-style layout. A restructure is a governance decision with
cross-cutting risk (build, tests, docs, tooling all keyed to `src/`), not a
feature.

## Proposal sketch

- Declare CSE as the discipline; record the derivation order (Laws → Math →
  Specs → Protocols → Compilers → Reference → SDKs → Applications).
- Restructure as an explicit governance proposal (like the rename decision):
  evaluate the platform layout with a migration plan and cost, not on
  metaphor appeal.
- Five-product roadmap revision: Specification, Runtime, Engineering Suite
  (compiler, simulator, observatory, analysis, verification), Universal
  Driver Layer, Standard (conformance, certification, benchmarks, SDKs,
  governance) — replaces "Marketplace" with Engineering Suite + Standard.

## Risk assessment

- Restructuring a working 154-file/2,400-test corpus is high-churn; the
  derivation order and the roadmap can be adopted first, the layout only
  with a measured migration plan.

## Where it lands

- Design doc `design/CSE.md`; roadmap revision in VISION.md.

## Code impact

- None until a restructure decision is made; the discipline claim itself
  changes no code.

## Next stage

Adopt the discipline claim + derivation order as framing; produce a
restructure proposal with migration cost estimate for the governance path.
