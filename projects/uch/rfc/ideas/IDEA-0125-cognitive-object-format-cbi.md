# IDEA-0125 — Cognitive Object Format (.cog) + Cognitive Binary Interface (CBI)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 cognitive-runtime-standard intake (round 18) —
  "LLVM has LLVM IR. WASM has WASM modules. ELF has executables. UCH
  needs its own artifact — a Cognitive Object (.cog)" containing
  Goals, Policies, Knowledge, Behaviors, Capabilities, Genome,
  Memory, Verification, and Relationships — portable, versioned,
  signed, reproducible; plus the round's headline: "a .cog package
  compiled against CBI v1.2 would run on any compliant Cognitive
  Virtual Machine, regardless of whether the execution engine
  underneath is GPT-5.5, Claude, Gemini, DeepSeek, or a future
  model. That shifts compatibility away from vendors and toward a
  stable execution contract."
- **Related:** IDEA-0045 (CVM — the interpreter of .cog programs),
  WS-P (uch.package.v1 — the distribution envelope; a .cog ships
  inside a package and passes the package gate), CIC (the runtime
  instruction envelope — .cog is the artifact, CIC is the message),
  IDEA-0095 (Cognitive ABI — the organ-level contract; CBI is the
  artifact-level binary contract), IDEA-0083 (specification
  repository — generated implementations are .cog sources),
  IDEA-0081 (engineering chain — build/verification evidence),
  ADR-002 (ledger — signed provenance for artifacts), driver
  compliance + conformance (UCH-to-host certification; CBI is the
  first artifact-to-VM compatibility contract), IDEA-0117
  (execution graph — the linked shape a CVM runs)

## Motivation

Formats create ecosystems: ELF + psABI made Linux, WASM + WASI made
portable execution, JAR/CARGO made package ecosystems. The corpus
has the distribution envelope (uch.package.v1: manifest, payload,
signature, governed gate) and the program IR (CIR, RFC-0004) but no
_executable artifact_ — a self-contained, versioned, signed
cognitive binary with sections (goals, policies, knowledge,
behaviors, capabilities, genome, memory, verification,
relationships) that any compliant CVM executes regardless of the
inference engine beneath. The .cog is the artifact; CBI is its
binary interface contract — the pinned surface (section schemas,
allowed CP-op surface, determinism class, energy/verification
metadata) between the artifact and the VM. That contract is what
moves model-dependence out of the artifact: a .cog built against
CBI v1.2 runs on GPT-5.5-backed or local-backed VMs alike.

## The corpus cannot cover it because

uch.package.v1 is a distribution envelope for drivers/skills/
policies/instruments — it has no cognitive sections, no executable
semantics, and no binary-interface contract with a VM. CIC is the
runtime instruction envelope; CIR is the program IR; neither is a
loadable artifact with a pinned binary contract ("compiled against
CBI v1.2 runs on any compliant CVM"). Driver compliance certifies
UCH's own drivers (UCH-to-host); nothing certifies artifacts
(artifact-to-VM). Signed, versioned, reproducible artifact
semantics exist in pieces (WS-P signature + hash, WS-C versioning,
CIR reproducibility) but no one artifact binds them.

## Proposal sketch

- .cog = one binary artifact: declared sections (goals, policies,
  knowledge, behaviors, capabilities, genome, memory, verification,
  relationships), signed (ed25519 over section hashes), versioned
  (CBI major.minor), reproducible (deterministic build from the
  same inputs per the build-system claim).
- CBI = the binary interface: section schema versions, the CP-op
  surface the object may call, determinism class (replayable
  subset vs opaque inference — the CVM's instruction classes),
  energy/verification metadata from the instruction catalog.
- Distribution: a .cog ships inside a WS-P package; the package
  gate validates signature + hash + closure before link/load
  (IDEA-0126) and execution (IDEA-0045).

## Risk assessment

- Format theater: a format without a CVM to execute it is a zip
  file with opinions. Sequence this wave with the CVM promotion
  (IDEA-0045) and the linker/loader (IDEA-0126); the deterministic
  subset is the first section family.
- Duplication: must not re-skin uch.package.v1 — the package is
  the envelope, .cog is the payload with executable semantics.

## Where it lands

- Extends WS-P + IDEA-0045; design doc `design/COGNITIVE-OBJECT-FORMAT.md`.

## Code impact

- None until the CVM promotion; the WS-P package gate becomes the
  .cog signing/validation path.

## Next stage

- Define the section schema + CBI versioning for the deterministic
  subset; prototype a .cog from CIR program sections.
