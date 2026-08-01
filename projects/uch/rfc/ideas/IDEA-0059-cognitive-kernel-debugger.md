# IDEA-0059 — Cognitive Kernel Debugger

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "Breakpoints
  inside reasoning. Pause thinking. Inspect beliefs. Modify working
  memory. Continue."
- **Related:** ADR-002 trace ledger, `cognitive-replay.ts` (replayEvents /
  resumeContext / hydrate), `cognitive-time-machine.ts` (beliefsAt),
  IDEA-0014 (observatory), IDEA-0047 (UER), `kernel/process` (WS-A
  process model)

## Motivation

Every computing platform that became durable had a debugger. UCH has
full observability (traces, replay, time machine — all *after the fact*)
but no way to interrupt a running cognition, inspect live state, mutate
it, and resume. Trace inspection is `gdb -c core`; this is interactive
`gdb`. For a platform whose core claim is inspectable cognition, the
inspection surface stops exactly where the live organism begins.

## The corpus cannot cover it because

The trace ledger is write-once event capture; replay is deterministic
re-execution of recorded events; neither can pause an in-flight
reasoning graph, neither can modify live belief state, and neither can
step through the executor. The process model (WS-A) gives processes and
threads but no instrumentation contract. Grep confirms zero `breakpoint`
semantics anywhere in `src/` (only a prompt-injection test fixture).

## Proposal sketch

- Breakpoint contract on the CP executor: `pause_condition` matched
  against the reasoning graph (op, evidence threshold, belief id,
  contradiction trigger — mirrors reflex-gate interception).
- Session-level commands: pause / step (per CP op) / inspect (beliefs,
  working memory, pending transactions) / mutate (apply a belief
  override with provenance `debugger`) / continue / abort-to-checkpoint.
- Mutation must flow through WS-D transactions (a debugger edit is a
  propose→verify→commit like any other change) and leave provenance in
  the ledger so replayed runs are still bit-deterministic for the
  *unmodified* path.
- CLI surface: `uch debug <pid>` (process table from WS-A); MCP tool for
  IDE integration.

## Risk assessment

- A debugger is an unrestricted write path into cognition — the exact
  attack surface IDEA-0062 must contain. Design rule: debugger access
  requires a kernel-level grant; mutations are provenance-stamped and
  transaction-gated; remote debugging disabled unless explicitly bound.

## Where it lands

- Design doc `design/KERNEL-DEBUGGER.md`; extends `kernel/process`,
  `cognitive-plane/replay`, and the trace ledger.

## Code impact

- None until the pause contract and grant model are specified; the
  executor already funnels every op through `catalog.ts` (op metadata),
  which gives a natural interception point.

## Next stage

- Interception-point survey over `catalog.ts` + reflex-gate fast path;
  pause/step contract draft; grant + provenance rules per IDEA-0062.
