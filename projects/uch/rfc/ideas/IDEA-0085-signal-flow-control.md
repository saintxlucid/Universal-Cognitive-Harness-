# IDEA-0085 — Signal Flow Control (Backpressure + Rate Limiting)

- **Status:** Prototype (2026-08-01) - G1 register + design doc +
  reference module with tests; NOT wired into any gate (SOP-08
  Prototype discipline).
- **Origin:** 2026-08-01 cognitive-microarchitecture intake (round 12) —
  "Cognitive Backpressure: If verification is overloaded, don't let
  reasoning flood the system. Cognitive Rate Limiting: Protect
  resources. Protect quality."
- **Related:** src/cognitive-plane/persistence/trace-persistence.ts
  (bufferedBytes backpressure on the write path — the only existing
  backpressure), src/control-plane/budgets (energy economics),
  src/engineering-intelligence/slo/cognitive-slos.ts (error budgets),
  src/accelerators/scheduler.ts, src/kernel/cic/circuit-breaker.ts
  (per-call breaker, not per-organ admission), IDEA-0071 (SLOs),
  IDEA-0063 (resource allocator — grants for attention/tokens/depth),
  tier-03 concepts ("bound every queue explicitly; propagate
  slow-consumer signals to producers instead of growing buffers")

## Motivation

Organism-wide, the fabric is fire-and-forget: an organ that publishes
signals has no idea whether consumers are keeping up. If the
verification organ is overloaded, reasoning keeps flooding it, queues
grow, and quality degrades — the exact failure tier-03's queue concept
warns about. The intake's claim: the signal fabric needs flow control
the way a network does — producer-facing backpressure so no consumer
is flooded, and per-source rate limiting so no single organ can
monopolize the fabric. This is separate from energy budgets (which
gate _cost_) and SLOs (which _measure_ quality); flow control gates
_volume_.

## The corpus cannot cover it because

Backpressure exists only at the persistence write stream
(bufferedBytes + drain reset) and is not propagated to producers; the
bus itself has no bounded ingress queues and no admission policy.
Rate limiting is absent as a mechanism (rate-limit appears only as a
failure _classification_ in failover tests and as a CIC concept).
Circuit breakers exist (CIC) but trigger on repeated failures of one
call path — they do not provide admission control for a busy-but-healthy
organ. SLO budgets detect degradation after the fact; nothing prevents
the flood.

## Proposal sketch

- Per-consumer bounded ingress queues with a configurable depth;
  when a queue saturates, a backpressure signal flows to producers
  (priority-aware: emergencies — Law 16 tier — bypass backpressure and
  preempt; background traffic is dropped-first).
- Per-source rate limiters: token buckets keyed by (source, signal
  type) so a chatty organ (e.g., a terminal watcher) cannot starve the
  fabric; limits are derived from the resource allocator's grants
  (IDEA-0063) so admission is budget-consistent, not arbitrary.
- Quality floor: SLO error budgets (IDEA-0071) determine whether a
  source is _throttled_ (budget healthy) or _quarantined_ (budget
  exhausted — organ health, IDEA-0070); quarantined organs fall back
  to circuit-breaker semantics until they recover.

## Risk assessment

- Head-of-line blocking: bounded queues must not delay emergency
  signals — preemption lanes are required, not optional.
- Silent loss: every dropped or delayed signal is ledgered with a
  reason (backpressure/rate/quarantine) so replay preserves the full
  causal picture.

## Where it lands

- `src/nervous-system/` (queues + token buckets + backpressure
  propagation), wiring into budgets + SLOs + health registry.

## Code impact

- None until the flow-control contract is specified; trace-persistence's
  backpressure is the reference pattern.

## Next stage

- Wire flow control into the bus with an artificially overloaded
  verifier consumer; assert reasoning stalls (not drops) and
  emergencies still preempt (Law 16).
