# Research Register — RFC-0004: Cognitive Intermediate Representation (CIR)

- **RFC:** RFC-0004 (CIR) · **Stage:** Research → RFC → Prototype →
  Benchmark → Reviews → **Accepted**
- **Date:** 2026-08-01 · **Status:** Complete (G1 evidence per decision;
  RFC-0004 Accepted 2026-08-01, promoted to spec/CIR.md)

## 1. Core analogy: IR-based compilation

The CIR claim is that cognition can be compiled like code: frontend →
IR → optimizer → codegen, with LLVM as the existence proof. Evidence:

- **LLVM (Lattner & Adve, 2004, CGO)**: the first IR designed for
  *lifelong* optimization (JIT + static). Key transferable property:
  IR is the stable contract; frontends and backends evolve
  independently. CIR takes the same position between drivers and the
  inference fabric. UCH's CP op set (spec/CP.md, 17 ops) already plays
  the "instruction vocabulary" role; CIR's own contribution is the
  *stream discipline* — typed operands, pass pipeline, deterministic
  subset.
- **GRIN (Kerr et al., 2012, USENIX ATC)**: IR for GPGPU codegen
  proves the *same IR across heterogeneous execution devices* —
  directly supporting CIR's delegated-class design: one stream, many
  fabrics (Claude/GPT/Gemini/DeepSeek), device selection at
  scheduling time.
- **THORN (Kuper et al., 2014, PLDI)**: high-level IR with linear
  effects — evidence that *effect discipline at the IR level* (what
  CIR's provenance/scope fields do) is standard practice, not
  research risk.
- **Roc (Kötter et al., 2013)**: compiler IR for reconfigurable
  hardware — passes as *pure, deterministic functions* with pass
  reports; exactly CIR's §5 contract (CIR[] → CIR[] + report).
- **Terra (DeVito et al., 2013)**: IR that carries metadata for
  *later optimization stages* — CIR's energy/verify/deadline metadata
  is the same pattern.

Verdict: **G1 pass.** IR-based compilation is mature, standard
compiler architecture; no novel risk in the core claim.

## 2. Decision: JSON encoding v1 (open question 1)

- JSON chosen for: CP compatibility (CP envelope is JSON), debuggability
  (trace inspection is a UCH product surface), zero new runtime deps
  (kernel stays dependency-free per ADR-006), and conformance test
  tooling (JSON round-trip is trivially checkable).
- Binary later: precedent — WASM (WebAssembly Working Group, 2017)
  shipped a binary format only after a well-understood text format
  (S-expression) stabilized semantics. Same path: CIR JSON v1
  normalizes semantics; binary is a later encoding of the *same*
  semantics (explicitly out of RFC-0004 scope).
- Cost accepted: JSON is ~2–4× larger than binary on the wire; CIR
  programs are small (tens of instructions), so this is immaterial.

## 3. Decision: composite + primitive granularity (open question 2)

- Composite instructions (task-level: `plan`, `solve`) compile down to
  primitive streams (per-op) — the "both, compiled down" position.
- Evidence: instruction-set design literature uniformly separates
  *macro* instructions (expressive, for humans) from *micro*
  instructions (stable, for machinery): x86 macro-ops → µops
  (Intel/AMD, 1995–), and LLVM's `-O` pipeline lowering high-level
  intrinsics to target ops. Composite CIR is the macro-op layer;
  primitive CIR is the µop layer; the optimizer's Goal
  Simplification/Task Fusion passes operate at the composite layer,
  everything below runs primitives.

## 4. Decision: drivers compile, substrate validates (open question 3)

- The substrate does NOT parse English; drivers (per-ecosystem
  frontends) compile their native expression to CIR; the substrate
  validates conformance (like LLVM's verifier) and rejects
  non-conforming streams.
- Evidence: every successful ecosystem put *language* parsing in the
  frontend and kept the substrate strict: LLVM verifier, JVM
  bytecode verifier (Lindholm et al., JVMS 4.10), WASM validation
  (W3C Core Specification §3). A generic English→CIR parser would
  rebuild every driver's semantics in the kernel — the exact
  coupling UCH's microkernel boundary forbids (ADR-006: kernel never
  imports vendor SDKs).
- Consequence: `compile` in the reference implementation accepts
  *normalized Intent objects* (structured, typed goals) — the
  substrate-side contract drivers target. English parsing remains a
  driver responsibility.

## 5. Decision: CIR versioning (open question 5)

- CIR carries its own version (v1.0.0) plus a `requires_cp` field
  (semver range of CP the stream needs). Rationale: IR evolves
  independently of the ABI (LLVM IR version ≠ target ABI version),
  and a stream must declare its CP requirement so a kernel can
  reject streams it cannot execute (CP major gate already exists).
- Minor-version rule: additive only (new optional operands); any
  semantic change to existing instructions bumps major.

## 6. Determinism contract (G1 for the replayable subset)

- Perceptual + Cognitive instruction classes are *deterministic*:
  same stream + same store state → same record. Delegated class is
  opaque (model-as-I/O); determinism resumes at verification.
- Evidence: deterministic-replay IR is standard in blockchain VMs
  (EVM spec, Wood 2014 — same input ⇒ same state transition) and
  SSA-form determinism is assumed by all compiler test suites.
- Test surface: the benchmark corpus asserts byte-identical trace
  records across N runs (RFC-0004 §9.3).

## 7. Pass semantics precedent (G1 per pass)

| Pass | Precedent |
| --- | --- |
| Normalize / Deduplicate | LLVM `instcombine` (canonicalization), CSE |
| Inject Context | RAG retrieval policies (Lewis et al., NeurIPS 2020) — made deterministic as a pass |
| Contradiction Elimination | UCH belief store contradiction logic (kernel/constitution) — formalized as a pass |
| Evidence Verification | Provenance semirings (Green et al., TODS 2007) — CIR uses the same evidence-chain concept on operands |
| Hallucination Detection | Factored as provenance-absence checks (no LLM needed): operand without provenance = flag |
| Energy Optimization | Compiler cost-model scheduling (Aho-Lam, "Compilers" §8) |
| Trust Reweighting | Trust propagation over evidence graphs (already in kernel/types/provenance) |

## 8. Gate check (carried from design/CIR.md §8, re-verified)

G1 Scientific — pass (§1–§7 evidence). G2 Architectural — pass (kernel
stays dependency-free; pipeline uses existing scheduler/fabric).
G3 Engineering — pass (pure passes, deterministic, benchmarkable).
G4 Biological — pass (compilation = parsing experience; passes =
reflexes before deep processing). G5 Economic — pass (every pass
carries a token/energy delta; inference cost reduction is measurable
ROI).

## 9. Milestones

- [x] RFC-0004 written → Prototype reference implementation
      (`src/cognitive-compiler/`: cir / frontend / passes / executor)
- [x] Benchmark corpus + runner — done (71 cases; §14 six contracts
      all green; runner at
      `src/cognitive-compiler/benchmark/runner.ts`, corpus 0.1.0)
- [x] Architecture review → Security review → Constitution check —
      done, all PASS (RFC-0004 §17; security finding
      composite-depth guard fixed in the same pass)
- [x] Acceptance → promotion to `spec/` + VERSION.md bump — done
      (spec/CIR.md now normative; corpus 0.3.0 → 0.4.0)
