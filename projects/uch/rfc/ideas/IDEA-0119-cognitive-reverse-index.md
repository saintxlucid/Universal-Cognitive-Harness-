# IDEA-0119 — Cognitive Reverse Index + Runtime Selection

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 cognitive-architecture intake (round 16,
  second half) — "a Cognitive Reverse Index: something I haven't seen
  anywhere. Instead of Application → Capabilities, build Capability →
  Applications. Example: Checkpointing → Claude → Codex → Cursor →
  VS Code. Now UCH chooses the best runtime. Not the user."
- **Related:** IDEA-0099 (capability graph — the FORWARD index: what
  each application exposes; the reverse index is its inverse query
  surface), IDEA-0118 (UCCD — the descriptor rows the index is built
  from), IDEA-0102 (runtime fingerprint — freshness pinning for index
  rows), IDEA-0098 (UCM — certification edges on index rows),
  IDEA-0107 (ecosystem twin — the index's topology home), IDEA-0068
  (capability negotiation — selection confirms via negotiation),
  ADR-004 (fabric routing — model/provider selection precedent for
  runtime selection), IDEA-0046 (accelerator catalog), IDEA-0075
  (intent objects — the selection query's input), IDEA-0120 (runtime
  composition — the reverse index is its routing substrate),
  IDEA-0071 (SLOs — ranking evidence), IDEA-0016 (economics — cost
  evidence), IDEA-0047 UER (cross-host evidence for selection
  outcomes), decision journal (selection decisions recorded)

## Motivation

Today the _user_ picks the runtime per tool; the intake's claim is
that capability-based reverse lookup lets UCH pick: "intent →
required capabilities → applications that have them → best verified
runtime". The corpus has the forward graph (0099: each app's
capability surface), descriptors (0118), fingerprints (0102), and
certification (0098) — but no inverse query surface and no selection
policy. Without the reverse index, "UCH chooses the best runtime"
is a slogan; with it, runtime selection becomes a query over
evidence — the same shape as ADR-004's provider routing, lifted from
compute to cognition.

## The corpus cannot cover it because

- The capability graph (0099) answers "what can app X do?" — the
  inverse question "which apps can do Y, and which is best
  evidenced?" is a different query surface with no owner.
- ADR-004 routes _calls_ across providers by cost/latency/tier; it
  does not select _runtimes_ for whole tasks by capability +
  certification + freshness evidence.
- Runtime choice is today a user decision (open Codex vs Claude vs
  Cursor manually); no mechanism records why a runtime was chosen or
  lets a task's requirements select one (0075 intents carry the
  requirements but have no routing target).

## Proposal sketch

- **Index**: capability → application rows built from UCCD (0118) +
  fingerprints (0102) + certification (0098) + ecosystem twin (0107)
  topology; a query view, not new storage — composed over 0099's
  graph and 0118's descriptors.
- **Selection**: intent (0075) → required capability set → candidate
  runtimes ranked by evidence (certification brand 0098, fingerprint
  freshness 0102, SLO health 0071, cost 0016, provenance from
  UER/ledger) → confirm via negotiation (0068) → dispatch.
- **Auditability**: every selection records its evidence chain in the
  decision journal (why this runtime, what ranked second, what
  evidence was honored) — selection is reviewable, not magical.
- **Honesty**: a runtime may be selected only for capabilities it
  serves at its _verified_ level (0105), never for claimed-but-
  unverified ones.

## Risk assessment

- Stale rows: a runtime's capabilities drift with versions —
  fingerprints (0102) must pin rows and trigger re-scan (0099).
- Evidence gaming: certification must be earned via conformance
  (0098), not self-reported; trust scoring (0080) applies to
  third-party descriptors.
- Selection surprise: the user must see _why_ (audit trail), and the
  reverse index must be a recommendation surface — override and
  pinning stay user-side.

## Where it lands

- `src/cognitive-runtime/` (index + selection), CLI `uch select
<intent>`; the decision journal records selection evidence.

## Code impact

- None until designed; seeds are runtime-discovery, capability-
  negotiation, the SLO catalog (0071), decision journal, ecosystem
  twin (0107).

## Next stage

- Prototype: build the index over 2-3 real runtime descriptors
  (OpenCode/Claude Code/Codex), assert that selection honors
  certification and fingerprint freshness, and that every selection
  writes an auditable evidence record.
