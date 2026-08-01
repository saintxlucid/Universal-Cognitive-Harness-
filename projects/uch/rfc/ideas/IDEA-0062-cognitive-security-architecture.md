# IDEA-0062 — Cognitive Security Architecture

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 infrastructure intake (round 10) — "Not
  authentication. Cognitive security: memory poisoning, prompt
  injection, knowledge corruption, identity hijacking, hallucination
  infection, false evidence, reasoning attacks. Every signal inspected."
- **Related:** design/THREAT-MODEL.md (approved v1.0, 14 threats T01–T14),
  2026-07-31 security audit wave (8/8 bugs fixed: shell injection,
  denylist bypass, FS traversal), CIC capability grants, constitution +
  integrity laws, WS-P quarantine, IDEA-0038 (cognitive immunology —
  infection classes, antibody promotion), IDEA-0060 (GC as immune
  mechanism), IDEA-0053 (constitution engine)

## Motivation

UCH already has the *parts* of a security architecture — a threat
model, hardened tools, grants, quarantine, integrity laws — but they
are guardrails scattered across subsystems, exactly the pattern the
intake calls out. The claim: a single Cognitive Security Architecture
that inspects every signal at the boundary (inbound observation, tool
output, retrieved evidence, driver input, package install) and owns the
cognitive-threat classes end to end: memory poisoning, prompt
injection, knowledge corruption, identity hijacking, hallucination
infection, false evidence, reasoning attacks. Immunology (IDEA-0038)
named the classes; this promotes them from detection ideas to an
enforcement surface.

## The corpus cannot cover it because

THREAT-MODEL.md classifies and mitigates but 3 items are deferred (T06,
T07, T13) and mitigation is distributed per-subsystem; no single organ
owns: injection detection on inbound tool results (only command
denylists exist), poisoning detection on ingested episodes (retrieval
can return tampered memories), identity-hijack detection on grants,
or false-evidence detection in retrieval (provenance methods exist,
evidence-fabrication detection does not). The immunology idea (0038)
has no implementation surface; the audit wave fixed tool-level
vulnerabilities, not cognitive ones.

## Proposal sketch

- One boundary organ: every signal entering cognition passes
  inspection (observe/retrieve/tool-result/driver/package), tagged
  `inspected:` in provenance; suspicion feeds an infection score per
  IDEA-0038 with antibody promotion (quarantine, confidence
  suppression, re-derivation).
- Per-threat contracts mapped from THREAT-MODEL: T01–T03 → grants +
  namespace; injection → inspection + instruction-vs-data marking
  (CIR delegated class boundary is the natural enforcement point);
  poisoning/false evidence → evidence-mass accounting (RFC-0005
  instability I(b) is already the detector — promote to a standing
  monitor, not a benchmark gate).
- All verdicts ledgered; false positives are recoverable via replay
  (undo a quarantine is a transaction, WS-D).

## Risk assessment

- Over-inspection degrades throughput and can itself be weaponized
  (DoS via inspection load); inspection must be cheap, tiered, and
  fail-open on instrument error but fail-closed on clear positive.

## Where it lands

- New subsystem beside `kernel/` — the intake's "deserves its own
  subsystem" is accepted; design doc `design/SECURITY-ARCHITECTURE.md`
  superseding the scattered mitigation notes.

## Code impact

- New inspection organ + grant hardening; T06/T07/T13 closures from
  THREAT-MODEL become the first backlog.

## Next stage

- Close deferred threats; map each threat to an inspection point;
  draft the signal-boundary contract.
