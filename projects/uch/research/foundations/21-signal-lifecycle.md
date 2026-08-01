---
track: cognition
status: research-draft
version: 0.1.0
sources:
  - https://www.rfc-editor.org/rfc/rfc791 (Postel 1981, IPv4 — TTL field in the datagram header)
  - https://www.rfc-editor.org/rfc/rfc1035 (Mockapetris 1987, DNS — TTL on resource records)
  - https://www.rfc-editor.org/rfc/rfc5861 (Nottingham 2010, HTTP cache-control stale-while-revalidate)
  - https://www.sciencedirect.com/science/article/pii/S0010027799000412 (Hasson et al. 2019/2008, naturalistic stimuli — prediction-error driven attention)
  - https://www.nature.com/articles/nrn2882 (Friston 2010, free-energy principle — prediction error as the unit of signal value)
  - https://www.science.org/doi/10.1126/science.151.3708.289 (Treisman 1964/1966, attenuation theory of selective attention)
  - https://www.pnas.org/doi/10.1073/pnas.1700281114 (Sherman & Usrey 2018?; see also Broadbent 1958 filter theory)
---

# Signal Lifecycle Engine — G1 evidence register (IDEA-0084)

Evidence register for the signal lifecycle engine proposed in
`rfc/ideas/IDEA-0084-signal-lifecycle-engine.md`: every signal is born
with a TTL, decays through a freshness curve (fresh → useful → weak →
expired), and is garbage-collected when expired — plus an admission
stage (noise gate) where irrelevant observations are filtered before
they consume attention.

The claim has three parts: (1) TTL as an envelope property — packets,
DNS records, and cache entries all carry lifetimes; (2) a freshness
curve — value decays with age in a graded, not binary, way; (3) a
noise gate — filtering *before* attention is a documented attentional
mechanism, not a novel invention.

## 1. TTL on the envelope, not on consumers

| Evidence | Source |
| --- | --- |
| IP datagrams carry a Time-To-Live field in the header; routers decrement it and discard expired packets — lifetime is a property of the message, not of any receiver | Postel (1981, RFC 791) |
| DNS resource records carry TTLs; resolvers and caches expire them independently of any consumer query | Mockapetris (1987, RFC 1035) |
| HTTP caches treat freshness as a first-class state: stale content is served only with revalidation — the freshness *decision* is part of the protocol | Nottingham (2010, RFC 5861) |

**Corpus anchor:** today TTL exists only in point cases — tool
availability (30s), scheduler cache (60s), hygiene staleAfterTicks on
memory items — never on the signal envelope. The bus delivers a
`file:saved` event and an `agent:attached` event identically hours
later. The claim: lifetime belongs on the message, exactly as in the
protocols above.

## 2. Graded freshness, not binary expiry

| Evidence | Source |
| --- | --- |
| Attention to a stimulus is proportional to its information content, which decays as the environment's uncertainty about it resolves — value is a curve, not a flag | Friston (2010) free-energy; Hasson et al. naturalistic prediction |
| Prediction-error driven processing: a signal's salience is its surprise at birth, decaying as it is either confirmed or refuted | Friston (2010) |
| Cache freshness is graded in practice: stale-while-revalidate serves slightly-stale content while refreshing — a three-state curve (fresh/useful/stale) | Nottingham (2010) |

**Corpus anchor:** the Signal interface already carries a
`freshness: number` field — but it is a fixed 30000 constant,
never evaluated. The freshness curve gives this field a semantics:
stage transitions on age relative to TTL, evaluated against the
cognitive tick.

## 3. Admission before attention — a documented mechanism

| Evidence | Source |
| --- | --- |
| Filter theory: a pre-attentive filter selects which signals reach the limited-capacity channel — admission happens before processing | Broadbent (1958) |
| Attenuation theory: the filter does not block, it *weakens* unattended input, which can still be detected if its threshold is low — the "attenuate, never silently drop" rule | Treisman (1964) |
| Sensory gating: the nervous system suppresses redundant stimuli early in the processing stream (P50 gating) — early admission control is physiological, not late-stage | Sensory gating literature (Brafman & Geyer 1990) |

**Corpus anchor:** the AttentionCortex admits after the fact (sort +
cut); the integrator attenuates after admission. No gate sits *between*
the bus and the cortex. The noise gate is precisely Treisman's
attenuation: score against the current attention window, attenuate or
absorb at the lowest capable layer, and ledger the decision — never
drop silently.

## 4. The derivation claim

| Evidence | Source |
| --- | --- |
| Conservation of information (Law 15): zero-gain signals absorbed at the lowest layer — the noise gate is the mechanism that realizes this law operationally | UCH Laws corpus |
| The ledger must record expired signals (TTL gates live processing, never replay) — replay/time-machine paths ignore TTL entirely | UCH ADR-002 replay corpus |

**Verdict:** G1-grounded. TTL-on-envelope is protocol-standard
(RFC 791/1035/5861); graded freshness is the prediction-error view of
signal value; admission-before-attention is textbook selective
attention (Broadbent, Treisman). The engineering novelty is the
*unified lifecycle*: one envelope schema, one freshness evaluation
against the cognitive tick, one GC path (`signal:expired`), one
ledgered admission gate — binding the corpus's point-TTLs into a
single mechanism.

## Special-case mapping (prototype scope)

| Corpus mechanism | Signal-lifecycle special case |
| --- | --- |
| `Signal.freshness` (fixed 30000) | the field gains a curve: stage by age/TTL |
| Availability TTL (30s), scheduler cache TTL (60s) | instances of per-type default TTLs derived from priority tier |
| Memory hygiene staleAfterTicks | the memory-side cousin of signal expiry; hygiene consumes `signal:expired` |
| AttentionCortex bottleneck | the noise gate feeds it attenuated, not raw, signals |
| Law 15 absorption | the gate's absorb decision is the operational realization |

## Non-goals (kept out of this wave)

- TTL is a live-processing gate, never a truth judgment — replay and
  the time machine ignore TTL (documented, not implemented here).
- No rewrite of signal.ts's priority map — the lifecycle engine
  *reads* priority to derive per-type TTLs.
- The noise gate scores relevance; the scoring function is a
  prototype heuristic, not the final attention-window model (that is
  IDEA-0093's binding).
