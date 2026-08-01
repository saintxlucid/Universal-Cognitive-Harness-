# IDEA-0095 — Cognitive ABI (Organ-Level Interoperability Contract)

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 specification-layers intake (round 13) — "an ISA
  isn't enough; a platform also needs an ABI — the contract that allows
  independently developed organs and runtimes to interoperate. Every
  organ would expose `interface CognitiveOrgan { observe(signal):
Observation; process(context): Effect[]; checkpoint(): Snapshot;
restore(snapshot): void; health(): HealthReport; capabilities():
CapabilityDescriptor[]; }` — analogous to POSIX for operating systems
  or LLVM IR for compilers: different implementations, one stable
  interface."
- **Related:** spec/CP.md (instruction set — the syscall ABI of the
  Cognitive OS), CIC-SPECIFICATION.md (transport envelope + operation
  families), src/drivers/compliance.ts (driver certification L0–L4),
  MANIFESTO §6 (organ contracts), IDEA-0019 (cognitive operating
  contracts — normative guarantees + conformance suite), health
  registry (health-report sources, WS-E SMART metrics), capability
  registry + grants (capability descriptors), WS-D transactional
  cognition (checkpoint/commit/rollback primitives), spec/STACK.md
  (L4 driver SDK layer), IDEA-0024 (CSE platform layout — the `abi/`
  repo directory), IDEA-0083 (specification repository)

## Motivation

CP is the instruction surface: the op table every runtime speaks. CIC
is the transport surface: the envelope that carries those ops across
processes and hosts. Compliance certifies drivers (Claude, Codex,
OpenCode…) against CP/CIC at L0–L4. What does not exist is the
_organ surface_: a stable, versioned, certifiable contract that any
independently developed organ — first-party or third-party, TypeScript
or Rust — implements so that the kernel, the runtime, and other organs
can treat it as interchangeable. The intake's claim: the ISA says what
the kernel can do; the ABI says what an organ is. Six methods capture
the organ contract: sensory intake (observe), deliberation (process),
state capture (checkpoint), state recovery (restore), liveness
(health), and surface (capabilities). This is the POSIX/LLVM-IR move
applied one layer down from drivers: drivers certify the runtime-to-
host boundary; the ABI certifies the kernel-to-organ boundary.

## The corpus cannot cover it because

CP ops are kernel-facing; an organ is a _client_ of CP, not an op.
CIC envelopes are transport-facing; they carry payloads but define no
organ lifecycle. Compliance certifies drivers against the protocol,
not organs against the kernel — an organ's contract is today an
internal TypeScript interface per organ family (sensor, effector,
memory, planner), with no shared shape: checkpoint/restore exist in
WS-D for transactions, health reports exist per-organ in the health
registry, capability descriptors exist in the capability registry,
but nothing binds them into one six-method contract that a third-party
organ can implement and be certified on. IDEA-0019 proposes contract
_guarantees_ (the what-is-promised layer) but explicitly leaves the
interface shape open; this note names the shape.

## Proposal sketch

- **The six-method contract** (v1): `observe(signal) → Observation`
  (perceptual intake with provenance tag), `process(context) →
Effect[]` (deliberation returning effects, never side effects
  directly), `checkpoint() → Snapshot` (full state capture, per WS-D
  semantics), `restore(snapshot) → void` (verified restore, refusal
  on mismatch), `health() → HealthReport` (WS-E SMART metrics),
  `capabilities() → CapabilityDescriptor[]` (grant intersection with
  the ProjectionEngine view).
- **Pre/postcondition semantics**: each method carries a normative
  precondition/postcondition pair (e.g. `restore` pre: snapshot id
  exists and is trusted; post: state equals snapshot, ledgered).
  This doubles as the executable form of the intake's "operators with
  preconditions and postconditions" (memory calculus / belief algebra
  become ABI methods with Hoare-style contracts).
- **Versioning + certification**: the ABI is versioned like CP; a
  conformance suite (mirroring `src/protocol/conformance.ts`) runs
  against organ implementations and issues the organ certificate —
  the organ-side twin of driver compliance L0–L4.
- **Fitness**: organs that do not need a method (an effector may not
  observe) declare the optional subset in their capability descriptor;
  the kernel requires only the methods the organ declares.

## Risk assessment

- Interface bloat: six methods must stay the floor, not the ceiling —
  organ-specific surfaces live behind capability descriptors, never in
  the ABI.
- Certification cost: conformance suites must be cheap to run
  (deterministic, no LLM in the loop) or third-party organs will not
  bother — mirror the driver compliance harness, not the CIR benchmark.

## Where it lands

- `spec/` (new `COGNITIVE_ABI.md`), `src/drivers/compliance.ts`
  (organ certificate alongside driver certificate), conformance suite.

## Code impact

- None until the contract is specified; seeds are WS-D checkpoint/
  restore, health registry, capability registry, driver compliance.

## Next stage

- Prototype: one organ (e.g. memory hygiene) implemented against the
  six-method contract, conformance suite passing, certificate issued;
  assert checkpoint/restore round-trip and capability intersection.
