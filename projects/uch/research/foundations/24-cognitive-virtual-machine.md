---
track: cross-cutting
status: research-draft
version: 0.1.0
sources:
  - https://docs.oracle.com/javase/specs/jvms/se21/html/index.html (Lindholm et al., JVM Specification)
  - https://www2.eecs.berkeley.edu/Pubs/TechRpts/1995/CSD-95-888.pdf (Leroy, bytecode verification)
  - https://www.w3.org/TR/wasm-core-1/ (WebAssembly Core Spec 1.0)
  - https://www.cs.rochester.edu/u/scott/papers/1993_TOCS_TM.pdf (Herlihy & Moss, transactional memory)
  - https://dl.acm.org/doi/10.1145/62138.62144 (LeBlanc & Mellor, replay debugging)
  - https://dl.acm.org/doi/10.1145/353981.353983 (Netzer & Miller, replay of concurrent programs)
  - https://dl.acm.org/doi/10.1145/1179522.1179524 (Bergan et al., DetTrace)
  - https://lamport.azurewebsites.net/pubs/time-clocks.pdf (Lamport, logical clocks)
---

# Cognitive Virtual Machine — G1 evidence register (IDEA-0045)

Evidence register for IDEA-0045: a Cognitive Virtual Machine — bytecode
over the CP 17-op ISA (spec/CP.md), executing CIR-compiled programs with
the kernel (scheduling, vmem, WS-D transactions, constitution gates) as
runtime facilities, so every model is one interchangeable _cognitive
processor_ behind a device interface. The JVM/WASM analogy, made
operational.

## 1. Bytecode VMs as portable execution platforms

| Evidence                                                                                                                                                 | Source                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| The JVM is a stack machine with a _typed_ instruction set; the bytecode verifier proves type safety at load time so a program cannot corrupt the runtime | Lindholm et al., JVM Specification; Leroy (2003) formalizes the verifier |
| WebAssembly defines a sandboxed, deterministic, portable bytecode: the same module executes identically on any host that implements the spec             | WebAssembly Core Specification 1.0                                       |
| Register-based VMs (Dalvik/ART, LuaJIT) show the instruction encoding can trade stack vs register discipline without changing the program's semantics    | (Dalvik/ART, LuaJIT literature)                                          |

**Corpus anchor:** CIR (RFC-0004, Accepted + reference implementation,
`11f5670`) is the IR the CVM compiles from; spec/CP.md v1 is the ABI the
bytecode encodes; the prototype (`src/cognitive-plane/cvm/bytecode.ts`)
defines the instruction-class table and the decode-time verifier.

## 2. Verification at decode time (Law enforcement point 1)

| Evidence                                                                                                                                             | Source                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| The JVM verifier runs _before_ execution — untrusted code is rejected at load, not during a run; verification is a separate pass over the class file | Lindholm et al.; Leroy (2003) |
| Proof-carrying code and typed assembly language make the same point: static checks at the instruction boundary are the cheapest security boundary    | (Necula 1997 PCC literature)  |

**Corpus anchor:** the CVM decodes every program before the first op
(`decodeProgram` throws a structured `CVMDecodeError` on unknown ops,
foreign CP majors, missing dependencies, invalid verify requirements) —
the IDEA-0053 Constitution-Engine hookup point. Unknown instructions
never reach execution.

## 3. Deterministic execution and replay

| Evidence                                                                                                                                              | Source                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Record/replay debugging (LeBlanc–Mellor) shows that capturing execution order + inputs is sufficient to re-run a computation deterministically        | LeBlanc & Mellor (1987) |
| Deterministic replay of concurrent programs requires ordering discipline; total replay order makes divergence detectable                              | Netzer & Miller (1991)  |
| DetTrace makes whole-program execution deterministic under a total order of shared events — the structural goal of a deterministic instruction subset | Bergan et al. (2010)    |
| Logical (Lamport) clocks provide tick-based ordering that is reproducible across executions — never wall-clock                                        | Lamport (1978)          |

**Corpus anchor:** the CVM executes perceptual/cognitive ops with pure,
input-derived results under a monotonic tick clock, records a trace, and
`replay()` re-executes and deep-compares results (determinism report).
This makes ADR-002/UER replay a _structural property of execution_
(IDEA-0117), not a property of the ledger.

## 4. Transactions as the execution context (Law enforcement point 2)

| Evidence                                                                                                                                      | Source                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Hardware transactional memory makes speculative execution atomic: a transaction commits only if verification holds, else rolls back wholesale | Herlihy & Moss (1993)                   |
| Software transactional memory extends the same semantics to any language runtime; the commit condition is a program-supplied predicate        | (STM literature, Shavit & Touitou 1997) |

**Corpus anchor:** WS-D (`src/kernel/transactional/`) is the commit
mechanism — every node result is a propose → verify (none/structural/
constitutional) → commit-or-rollback on the `TransactionalMemory` ledger;
failed verdicts roll back to the last committed cognitive state.

## 5. Devices as interchangeable processors

| Evidence                                                                                                                                         | Source                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| JDBC/ODBC define a driver contract so one application runs on any database — the database analogue of "any model behind one instruction surface" | (JDBC/ODBC specifications)      |
| CUDA separates kernel code from the device driver; a kernel compiles once and dispatches to any compatible device                                | (NVIDIA CUDA programming model) |

**Corpus anchor:** `ModelDevice` (`src/cognitive-plane/cvm/device.ts`)
declares tier, capabilities (ops served), energy, and latency profile;
dispatch requires `certifyDevice` (capability + finite energy + valid
latency), mirroring ADR-004 provider health and driver compliance
L0–L4. A device that cannot honor a budget is not scheduled.

## Verdict

The JVM/WASM analogy is valid and the corpus already had every substrate
(CIR, CP, WS-D, ADR-004, conformance); the missing artifact was the
bytecode envelope + interpreter + device boundary, now prototyped at
`src/cognitive-plane/cvm/` (24 tests green 2026-08-01).
