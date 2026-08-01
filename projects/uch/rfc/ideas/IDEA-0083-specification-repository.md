# IDEA-0083 — Specification Repository

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "The single biggest omission is a Specification Repository — machine-
  readable specifications for every primitive: every Law, Signal,
  Cognitive Instruction, Organ, Memory Type, Driver, ABI Contract,
  Runtime State, Lifecycle, Error Code, Event, Capability, Metric,
  Policy, Transaction, Permission. /specs /laws /signals /abi /isa
  /memory /drivers /runtime /governance /metrics /security /protocols
  /transactions. Every implementation — TypeScript today, Rust
  tomorrow, Python SDKs, VS Code drivers, Codex and Claude Code
  integrations — would be generated from those specifications, not
  handwritten. That one decision changes UCH from a sophisticated
  software project into a specification-first cognitive platform."
- **Related:** spec/ (CP.md, CONSTITUTION.md, LAWS_OF_COGNITIVE_
  PHYSICS.md, GENOME.md, FORMAL_FOUNDATIONS.md, COGNITIVE_ONTOLOGY.md,
  COGNITIVE_BIOLOGY.md, VERSION.md — prose, versioned),
  rfc/ series + SOP-08 lifecycle, src/interface/conformance.ts +
  src/drivers/compliance.ts (certification against specs),
  scripts/spec-version-check.mjs (version gate), IDEA-0048
  (consolidated normative specification — the POSIX-style doc set),
  Platform Zero decision ("the specification is the source of truth,
  not the conversation"), RFC-0004 (CIR — the first spec whose
  reference implementation is the round-10 headline), IDEA-0073
  (contracts — records that belong in the repository), IDEA-0082
  (taste rubric — spec promotion), ADR-002 (trace model — already
  normative)

## Motivation

POSIX, LLVM IR, WebAssembly, Kubernetes APIs, OpenAPI: the pattern is
always the same — the *specification* becomes the product and
implementations become replaceable. UCH already chose this direction
(Platform Zero: "the specification is the source of truth"; spec/
exists; conformance certifies against it; spec-version gates
changes) — but the specs are **prose markdown read by humans and
enforced by tests**. They are not *machine-readable data* that
implementations are *generated from*. The intake's claim is that this
last step — repository-as-product, implementations-as-generated-
artifacts — is what flips UCH from a sophisticated software project to
a platform.

## The corpus cannot cover it because

The spec corpus is human-targeted: LAWS/CONSTITUTION/CP/GENOME are
narrative documents; conformance tests encode behavior in code, not in
data; every implementation (TS kernel, CLI, MCP server, drivers,
future Rust/Python/IDE surfaces) is handwritten against the prose.
There is no machine-readable schema for a Law, a Signal, an
Instruction, an Organ contract, a Runtime State, a Lifecycle, an
Error Code, an Event, a Capability, a Metric, a Policy, a Transaction,
or a Permission — so there is nothing to generate from, and no way to
generate a driver or SDK without re-reading prose. IDEA-0048 proposes
the consolidated normative *document*; this intake proposes the
*database* the documents describe.

## Proposal sketch

- A machine-readable spec repository: `/specs` with one schema per
  primitive family (laws, signals, ABI, ISA/CP ops, memory types,
  drivers, runtime states, lifecycles, error codes, events,
  capabilities, metrics, policies, transactions, permissions), each
  entry validated (schema + conformance test reference), each family
  semantic-versioned (IDEA-0069).
- Generated implementations: code generators emit the TS reference
  types, CLI/MCP surface stubs, driver SDKs, and conformance checks
  from the specs — the handwritten corpus becomes the reference
  implementation of the generated one (mirroring RFC-0004's promotion
  path); a spec change regenerates and re-verifies.
- The repository is the venue where round-10's headline lands: CIR
  (RFC-0004) is promoted to Specification and its compiler is *the
  first generated-from-spec implementation*.
- Governance: specs are the normative layer (spec-version gate extends
  to schema changes); contracts (IDEA-0073), SLOs (IDEA-0071), the
  failure taxonomy (IDEA-0074), lifecycles (IDEA-0072), and the taste
  rubric (IDEA-0082) all live in the repository as data.

## Risk assessment

- Spec calcification: machine-readable specs that ossify block
  evolution — the repository must follow the RFC lifecycle (SOP-08)
  with versioned amendments, and the generator must never be the
  only consumer (human-readable docs remain generated too).
- Generator drift: if handwritten code diverges from generated code,
  the repository loses authority — conformance checks must be
  generated alongside the implementations they certify.

## Where it lands

- `/specs` repository + `design/SPEC-REPOSITORY.md`; extends
  IDEA-0048 + spec-version gate; first generation target is the CP
  instruction catalog and CIR.

## Code impact

- None until the schemas and first generator are specified; the CP
  catalog (src/protocol/catalog.ts) and CIR draft are the seed inputs.

## Next stage

- One primitive family (CP ops / instructions) extracted into
  machine-readable form with a stub generator; the CIR promotion
  (RFC-0004) becomes the proof case.
