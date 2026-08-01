---
track: cognition
status: research-draft
version: 0.1.0
sources:
  - https://www.rfc-editor.org/rfc/rfc793 (Postel 1981, TCP — flow control, sliding window)
  - https://www.rfc-editor.org/rfc/rfc2697 (Heinanen & Guerin 1999, srTCM — single-rate three-color marker, token bucket)
  - https://www.rfc-editor.org/rfc/rfc2698 (Heinanen & Guerin 1999, trTCM — two-rate three-color marker)
  - https://www.reactive-streams.org (Reactive Streams specification — bounded queues + onBackpressure signals)
  - https://www.jcp.org/en/jsr/detail?id=332 (JSR-332?; see also Java Flow API JSR-331/Flow — java.util.concurrent.Flow, JDK 9)
  - https://www.cs.cornell.edu/courses/cs5414/2016fa/slides/17backpressure.pdf (backpressure in distributed stream processing — Apache Kafka design notes)
  - https://en.wikipedia.org/wiki/Little%27s_law (Little 1961 — queue bound: L = λW)
---

# Signal Flow Control — G1 evidence register (IDEA-0085)

Evidence register for the signal flow control proposal in
`rfc/ideas/IDEA-0085-signal-flow-control.md`: the signal fabric needs
producer-facing backpressure so no consumer is flooded, per-source
rate limiting so no organ monopolizes the fabric, and quality-floor
admission (throttle vs quarantine) tied to SLO error budgets.

The claim has four parts: (1) backpressure is a first-class protocol
mechanism; (2) token buckets are the standard rate-limiting primitive;
(3) emergency traffic must bypass bounded queues (priority lanes);
(4) silent loss is forbidden — every drop is ledgered.

## 1. Backpressure is a protocol mechanism, not a mitigation

| Evidence | Source |
| --- | --- |
| TCP's sliding window is flow control built into the protocol: the receiver advertises how much it can accept, and the sender *stalls* — the producer is throttled by consumer state | Postel (1981, RFC 793) |
| Reactive Streams / java.util.concurrent.Flow: `Subscription.request(n)` gives the consumer explicit control over the number of elements the producer may emit — backpressure is the contract | Reactive Streams spec; Java Flow API |
| Distributed stream processors (Kafka-style) propagate consumer lag to producers or buffer with bounded retention — unbounded buffering is a known failure mode | Stream-processing backpressure literature |

**Corpus anchor:** the only existing backpressure is trace-persistence's
`bufferedBytes` + drain reset — and it is *not* propagated to
producers (append() has zero callers in src/; the write loop is
unwired). The bus itself has no bounded ingress queues and no admission
policy. The fabric is fire-and-forget.

## 2. Token buckets are the standard rate-limiting primitive

| Evidence | Source |
| --- | --- |
| The single-rate three-color marker (srTCM): a token bucket of rate C + burst size B classifies traffic green/yellow/red — the canonical admission metering | Heinanen & Guerin (1999, RFC 2697) |
| The two-rate marker (trTCM) adds a committed rate and a peak rate — two buckets, per-flow shaping | Heinanen & Guerin (1999, RFC 2698) |
| Token buckets are work-conserving (unused tokens accumulate up to burst) — the right semantics for bursty-but-bounded organ traffic | Networking literature |

**Corpus anchor:** rate limiting is *absent* as a mechanism in the
corpus (rate-limit appears only as a failure *classification* in
failover tests). SLO budgets measure degradation after the fact;
nothing prevents the flood. The allocator's grants (IDEA-0063) are the
natural token-source: a chatty organ's token bucket is derived from
its grant, so admission is budget-consistent.

## 3. Priority lanes: emergencies bypass bounded queues

| Evidence | Source |
| --- | --- |
| Bounded queues cause head-of-line blocking: a full queue delays everything behind it — priority queueing with strict precedence (or preemption lanes) is the standard fix | Queueing theory; priority queueing in routers (DiffServ EF class) |
| Law 16 (interrupt hierarchy): higher-priority signals preempt lower-priority execution — the microarchitecture equivalent is that emergencies never queue behind background traffic | UCH Laws corpus |

**Corpus anchor:** SignalPriority 0–4 exists; `interrupt: true` exists;
what is missing is the *queueing discipline* that honors them —
preemption lanes are required, not optional.

## 4. Silent loss is forbidden

| Evidence | Source |
| --- | --- |
| Every dropped/delayed signal must be ledgered with a reason (backpressure/rate/quarantine) so replay preserves the full causal picture — this is the analogue of TCP's RST/retransmit accounting vs silent drops | RFC 793; UCH ADR-002 replay |
| The ledger is the replay source (Law 12); a drop that is not ledgered is an information loss that replay cannot reconstruct | UCH corpus |

**Corpus anchor:** the trace ledger records what *happened*, not what
was *refused*. The flow-control ledger (`signal:dropped` with reason)
is a new event class: refusal is itself a fact to be replayed.

## Verdict

G1-grounded: backpressure-as-contract (RFC 793, Reactive Streams),
token-bucket admission (RFC 2697/2698), priority lanes (queueing
theory, Law 16), ledgered refusal (ADR-002). The engineering novelty
is applying network-grade flow control to the *signal fabric*: bounded
per-consumer queues with producer-facing backpressure, per-source
token buckets derived from grants, throttle-vs-quarantine quality
floor, and a refusal ledger — binding the corpus's one unwired
backpressure (trace-persistence) into a real admission system.

## Special-case mapping (prototype scope)

| Corpus mechanism | Flow-control special case |
| --- | --- |
| trace-persistence bufferedBytes | the reference pattern; the prototype generalizes it to per-consumer queues |
| CIC circuit breaker (per-call, failure-triggered) | the *quarantine* fallback — after SLO exhaustion, flow control defers to breaker semantics |
| SLO error budgets (IDEA-0071) | the throttle-vs-quarantine decision input |
| Resource allocator grants (IDEA-0063) | token-bucket derivation: rate ∝ grant |
| SignalPriority 0–4 + Law 16 | preemption lanes over the bounded queues |

## Non-goals (kept out of this wave)

- No network transport changes — flow control is a nervous-system
  layer over the in-process bus.
- No rewrite of the allocator or SLOs — the prototype reads their
  *shapes* (grant magnitude, budget health) via injected values.
- Quarantine semantics in v0.1: quarantine falls back to refusal with
  a reason code; the full organ-health re-integration loop (IDEA-0070)
  is a later wave.
