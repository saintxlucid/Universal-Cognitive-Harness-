---
name: organ-code-governance
description: "Code Governance Gate (Constitution): pre-landing gate for code changes — Clean Code Covenant audit (SOC/DRY/KISS/DYC/YAGNI). Hard violations block, moderate violations defer to review, clean changes pass. Use before landing any code change."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [governance, organ, constitution, code-review, clean-code, covenant, gate]
  related_skills: [frameworks-code, frameworks-overview, organ-productivity, organ-signal-fusion]
---

# Code Governance Gate (Constitution)

Stateful organ engine: the pre-landing gate for code changes. Delegates the
principle audit to the clean-code framework engine (SOC/DRY/KISS/DYC/YAGNI
with explicit trade-offs) and adds the constitutional enforcement layer:
hard violations (a principle below the floor) block outright, moderate
violations defer to review, clean changes pass.

## When to Use

- Before landing a code change (pre-commit / pre-merge)
- Routing borderline changes to the judgment tier
- Measuring governance discipline: block rate, review rate, revision loops

## Engine Workflow

1. **Review** — `gate.review({ change, target, intent? })` audits the change
   description or diff snippet against the five principles.
2. **Verdict** — `allow` (clean), `review` (moderate), `block` (hard
   violation) — derived from principle scores, never from content.
3. **Record** — evidence carries principle ids + flags only (never file
   content); emits `governance:code_reviewed` when wired.

## Benchmarks

- Block rate (hard violations caught before landing)
- Review rate (changes routed to the judgment tier)
- Revision-loop rate (repeated failures in the same scope)

## Event Wiring

When constructed via `createWiredCodeGovernanceGate(bus)` (organ-wiring.ts),
every review becomes a `governance:code_reviewed` bus event.

## Capability Registration

Registered in the standard capability registry (`attach.ts` →
`createStandardCapabilityRegistry`) as `code-governance` with authority
operations `observe`, `retrieve`, `evaluate`. Capability absent from a
grant → gate verdicts are outside the client's projection (default deny).

## Verify

`uch governance "<change description>"` prints verdict, score, and evidence.
