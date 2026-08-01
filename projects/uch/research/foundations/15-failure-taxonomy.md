---
track: reliability
status: research-draft
version: 0.1.0
sources:
  - https://landing.google.com/sre/sre-book/chapters/effective-troubleshooting/ (Google SRE — troubleshooting discipline: classify the failure before acting)
  - https://www.rfc-editor.org/rfc/rfc7807 (RFC 7807 — problem details: structured error type + instance, not just a message)
  - https://arxiv.org/abs/2503.22625 (MIT CSAIL — AI code failure modes; error-masking as a failure class)
  - https://www.usenix.org/conference/osdi16/technical-sessions/presentation/lepsch (Efficient fault-tolerant systems — failure classification taxonomy)
  - https://www.rfc-editor.org/rfc/rfc5424 (RFC 5424 — syslog severity levels as a canonical severity ladder)
---

# Cognitive Failure Taxonomy — G1 evidence register (IDEA-0074)

Evidence register for `rfc/ideas/IDEA-0074-cognitive-failure-taxonomy.md`:
an exception says *what* failed; a taxonomy says *which faculty* failed,
*why that class is different*, and *how to respond*. The prototype
implements: ten faculty failure classes with detection signals,
severity, canonical responses, ledger event types, a conservative
tagger, and failure-rate SLO hooks.

## 1. Classification precedes response

| Evidence | Source |
| --- | --- |
| Effective troubleshooting starts by classifying the failure (symptom vs cause, one component vs many) before choosing an action | Google SRE book, effective troubleshooting |
| Mature systems ship a failure taxonomy because generic retry is wrong for most failure classes | Failure classification literature (e.g. Lepsch et al.) |

**Corpus anchor:** RFC-0005 classifies *physics* failures (4 families,
instability veto) and tier-08 catalogs engineering failure concepts —
but errors surface as generic exceptions with no faculty tag. The
prototype's `recordFailure` produces the full record (faculty, response,
severity, event type) that every failure should carry on the signal bus.

## 2. Structured error identity, not messages

| Evidence | Source |
| --- | --- |
| Problem details (RFC 7807) standardize a machine-readable error type + instance so consumers can key policy off the type | RFC 7807 |
| Syslog's severity ladder gives errors a canonical ordering, not ad-hoc wording | RFC 5424 |

**Corpus anchor:** the prototype maps each faculty to a canonical
ADR-002-compatible event type (`failure:reasoning`, `failure:memory`,
`failure:constitution`, ...) — the type, not the message, is what
recovery policy consumes.

## 3. Response is per-faculty, and some classes never retry

| Evidence | Source |
| --- | --- |
| A reasoning failure is handled by reverification; a memory failure by quarantine and re-ingestion; a constitution failure by veto — never by retry | Corpus discipline (organic-score vetoes, integrity checklist, immune organ) |
| Error-masking (retrying what must not be retried) is a documented AI-code failure mode | MIT CSAIL; GitClear error-masking +47% |

**Corpus anchor:** `neverRetries('constitution')` is structural — the
constitution veto remains the one response that bypasses generic retry,
mirroring the OrganicScoreEngine's constitutional vetoes.

## 4. Conservative tagging

| Evidence | Source |
| --- | --- |
| Misclassification delivers the wrong response; the tagger must default to the *safe* class, and every tag must be auditable | Prototype claim; corpus risk notes |
| When in doubt, reverify — aggressive quarantine is the harmful error direction | IDEA-0079 (conservative hygiene); immune organ discipline |

**Corpus anchor:** `classifyFailure` matches declared signals only and
defaults unmatched text to the reasoning class (reverification is the
safe response) — never aggressive quarantine on ambiguity.

## Prototype claims

- Ten faculty classes, each with detection signals, severity, canonical
  response, and ledger event type.
- Conservative tagger: unmatched → reasoning (reverify), never
  aggressive quarantine.
- Constitution failures never retry.
- `failureRateByClass` computes the SLO observables of IDEA-0071
  (hallucination rate = evidence-failure rate, etc.).
