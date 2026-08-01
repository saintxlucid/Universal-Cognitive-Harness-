# Signal Flow Control — design contract (IDEA-0085)

- **Status:** Prototype design (2026-08-01)
- **Idea note:** `rfc/ideas/IDEA-0085-signal-flow-control.md`
- **G1 register:** `research/foundations/22-signal-flow-control.md`
- **Prototype:** `src/nervous-system/flow-control.ts`
- **Seed anchors:** trace-persistence bufferedBytes (the reference
  pattern), CIC circuit breaker (quarantine fallback), SLO error
  budgets (quality floor), allocator grants (IDEA-0063, token source),
  SignalPriority 0–4 + Law 16 (preemption lanes).

## 1. Purpose

Flow control for the signal fabric, the way a network has it: bounded
ingress queues with producer-facing backpressure, per-source token
buckets, and a quality floor (throttle vs quarantine). Flow control
gates *volume*; energy budgets gate *cost*; SLOs *measure* quality.

## 2. Queues and backpressure

- Per-consumer bounded ingress queue (configurable depth).
- When a queue saturates: a backpressure flag is set for its
  producers; further low-priority traffic is refused (ledgered
  `backpressure`), emergency traffic (priority ≥ 3, Law 16) bypasses
  the queue entirely via a preemption lane.
- A queue drains on consume; the flag clears when occupancy drops
  below the release threshold.

## 3. Token buckets (per-source rate limiting)

- Keyed by `(source, signal type)`; capacity + refill rate derived
  from the source's grant magnitude (injected, not computed).
- A signal is **green** (admitted), **yellow** (deferred/queued), or
  **red** (refused with a `rate` reason) per RFC 2697 semantics.

## 4. Quality floor (throttle vs quarantine)

- Budget health (injected boolean/number) decides:
  - healthy budget → normal admission;
  - degraded → throttle (lower refill, more yellow);
  - exhausted → quarantine: refusal with `quarantine` reason,
    deferring to circuit-breaker semantics until recovery.

## 5. Refusal ledger

Every dropped or delayed signal is recorded with a reason code
(`backpressure` | `rate` | `quarantine`) and the tick — replay
preserves the full causal picture, including refusals.

## 6. Prototype scope

- Pure module: no bus wiring. A `submit()` entry point models one
  signal's journey: preemption lane → token bucket → queue → consume.
- The consumer is a caller-supplied function; an artificially
  overloaded consumer (the idea's next stage) is a test, not a
  runtime feature.
- Backpressure is consumer-driven (consume() reports occupancy), not
  a push pipeline.

## 7. Risk notes

- Head-of-line blocking: preemption lanes are structural (separate
  path), not best-effort.
- Silent loss: refusal is always ledgered; the ledger is the
  replay-complete record.
