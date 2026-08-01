# IDEA-0070 — Organ Health, Watchdogs & Safe Mode

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Every organ reports Alive / Healthy / Degraded / Recovering / Failed
  / Sleeping"; "If Reflection crashes: Restart. Restore state. Replay
  signals. Continue."; "Boot without learning, without plugins, without
  evolution. Recovery mode."
- **Related:** src/kernel/diagnostics/ (WS-E — 12 SMART metrics with
  band logic, higher-is-better inversion, worst-wins aggregation),
  design/FAILURE-RETRY.md, src/cognitive-core/immune.ts (conceptual
  infections → antibodies → quarantine), src/kernel/packages/ (WS-P
  policy quarantine, tamper detection), src/agentic/fastpath/
  fast-path-router.ts (builtin status/health/memory routines),
  ADR-002 replay (restore-and-replay substrate), src/mnemosyne/
  parahippocampal-gate.ts (poisoning watchdog — ASI06),
  src/control-plane/transport (SSE/A2A heartbeats), IDEA-0032
  (consciousness levels — boot stages)

## Motivation

Production systems win on observability and recovery: every subsystem
reports a health state, gets heartbeat monitoring, restarts with state
restoration when it crashes, and can boot into a safe mode that loads
nothing risky. The organism has fragments of all of these — SMART
diagnostics bands, a failure-retry design, an immune organ that
quarantines infections, package quarantine — but no *uniform* health
contract for organs, no watchdog that monitors subsystem liveness, no
safe-mode boot path, and self-healing is designed but not wired to
restart-and-replay.

## The corpus cannot cover it because

Grep: 'watchdog' appears only for transports (SSE/A2A heartbeats) and
the parahippocampal poisoning watchdog; 'safe mode' has zero matches.
Health exists as (a) the fast-path status/health/memory routines and
(b) WS-E diagnostic bands — neither is a per-organ lifecycle state
machine. Self-healing is documented (FAILURE-RETRY.md) and partially
implemented (immune organ) but has no restart → restore → replay-signals
→ continue loop over the ADR-002 ledger. Quarantine exists for packages
and conceptual infections, not for bad memories, skills, or genomes.

## Proposal sketch

- A per-organ health contract: `Alive → Healthy → Degraded →
  Recovering → Failed` + `Sleeping` (energy-aware suspension), reported
  on the signal bus with heartbeats (extend the existing transport
  heartbeat pattern to organs).
- A watchdog registry: each organ registers a liveness probe; missed
  beats escalate to restart with state restore from the ledger and
  signal replay (the self-healing loop the corpus already designs).
- Safe mode: boot flag that loads kernel + constitution only — no
  learning, no plugins, no evolution, no organs — with a recovery
  checklist surfaced to the operator (ties to IDEA-0032 dormant-state
  boot stages).
- Quarantine extension: memories/skills/plugins/genomes that fail
  integrity or trigger the immune organ become isolated containers,
  replayable but not loadable.

## Risk assessment

- False-positive watchdog restarts destroy live context; restarts must
  be journaled and rate-limited, and the restore must be
  transactional (WS-D) so a crashed organ cannot half-commit.

## Where it lands

- `design/HEALTH-WATCHDOGS.md`; extends WS-E diagnostics + fast-path
  routines + immune organ.

## Code impact

- None until the health contract and watchdog registry are specified;
  the fast-path health routine becomes the first probe.

## Next stage

- Health state machine drafted against WS-E band logic; watchdog
  prototype on one organ.
