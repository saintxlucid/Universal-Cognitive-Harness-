# IDEA-0053 — Constitution Engine

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Foundation 12) — "not policies:
  a constitution containing laws, rights, constraints, ethics,
  priorities, review process, voting, amendments. No subsystem can
  violate the constitution"
- **Related:** src/cognitive-plane/constitution/constitution.ts
  (enacted laws, integrity + covenant checks), integrity-checklist
  (inhibition gate), spec/CONSTITUTION.md (Articles IX–XI),
  RFC-0000 (governance: review, voting, amendments), organic-score
  vetoes, CIC enforcement, WS-G (event governance), law check
  prefixes (`integrity:`/`covenant:`)

## Motivation

Constitutional checks exist at evaluation points — the executive
brain's pre-commit filter, the integrity checklist, organic-score
vetoes, CIC instruction enforcement. The claim: a *Constitution
Engine* — a central enforcement point every subsystem action passes
through — declares its action type and payload, and is checked against
the Laws before approval, refusal, or escalation to review. Review
process, voting, and amendments stay under RFC-0000; the engine makes
violation structurally impossible rather than reviewable after the
fact.

## The corpus cannot cover it because

Enforcement is scattered across evaluation gates that must each be
wired; no central action-declaration surface exists for all
subsystems; refusal queues and escalation to the review process are
not defined.

## Proposal sketch

- Action declaration contract (type, payload, energy, provenance) for
  every subsystem action; fast-path constitutional check (reflex-style
  trie over law prefixes) with escalation to full review on complex
  actions.
- Refusal is recorded (ledger) with the violated law; amendments flow
  through RFC-0000 only.

## Risk assessment

- Bottleneck: enforcement must be a fast path with escalation, not
  serialized legal review of every action.

## Where it lands

- Extends constitution.ts + integrity-checklist; design doc
  `design/CONSTITUTION-ENGINE.md`.

## Code impact

- None until the action-declaration surface is specified.

## Next stage

Inventory subsystem action types; classify which require execute-time
checks vs evaluation-time checks.
