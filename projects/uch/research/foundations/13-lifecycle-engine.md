---
track: governance
status: research-draft
version: 0.1.0
sources:
  - https://standards.ieee.org/ieee/15288/5613/ (ISO/IEC/IEEE 15288 — system lifecycle processes)
  - https://en.wikipedia.org/wiki/Product_lifecycle (product lifecycle: introduction → growth → maturity → decline)
  - https://www.hup.harvard.edu/catalog.php?isbn=9780674245707 (Hopcroft & Ullman — finite automata and state machines)
  - https://martinfowler.com/articles/patterns-of-distributed-systems/ (corpus anchor: the corpus's own SOP-08 13-stage RFC lifecycle)
---

# Universal Lifecycle Engine — G1 evidence register (IDEA-0072)

Evidence register for `rfc/ideas/IDEA-0072-universal-lifecycle-engine.md`:
one lifecycle for everything — Idea → Research → Prototype → Experiment
→ Production → Legacy → Archive → Extinct — with SOP-08, IDEA-0056,
IDEA-0067, and WS-C as instances of one state machine.

## 1. Lifecycles are state machines

| Evidence | Source |
| --- | --- |
| A lifecycle is a finite state machine: defined states, defined transitions, and transition guards; systems with unbounded states are un-auditable | Hopcroft & Ullman (automata theory) |
| System engineering treats the full lifecycle (concept → development → production → utilization → support → retirement) as one governed process, not per-subsystem folklore | ISO/IEC/IEEE 15288 |
| Product lifecycles share the same shape across industries: introduction → growth → maturity → decline — the terminal stages (decline) are part of the contract, not an afterthought | Product lifecycle management literature |

**Corpus anchor:** the corpus already runs *several* lifecycles —
SOP-08's 13-stage RFC pipeline, IDEA-0056's object lifecycle
(observe → propose → verify → commit → evolve → archive), IDEA-0067's
organ lifecycle, WS-C's versioned organism store — each its own
machine with its own vocabulary. The prototype is the single machine
they all instantiate.

## 2. Terminal states are first-class

| Evidence | Source |
| --- | --- |
| Retirement/decline stages exist in every mature lifecycle (ISO 15288 "retirement"; PLC "decline"); a lifecycle without terminal states cannot be complete | ISO/IEC/IEEE 15288; PLC |
| Extinction must preserve lineage: even a removed object must answer "where did I come from" (IDEA-0076) — the record survives the object | Prototype claim; IDEA-0076 |

**Corpus anchor:** SOP-08 ends at "Stable"; IDEA-0056 ends at
"archive"; WS-C has "legacy". None has an Extinct terminal state with
a lineage stub — the prototype adds it.

## 3. Transitions are gated by evidence

| Evidence | Source |
| --- | --- |
| Stage gates (phase-gate models) require evidence before advancing: a gate without evidence criteria is a ceremony | Stage-gate product development (Cooper); ISO 15288 life-cycle reviews |
| SOP-08 already implements this for RFCs: Benchmark → Architecture Review → Security Review → Constitution Check → Acceptance before Specification | Corpus anchor (SOP-08) |

**Corpus anchor:** the prototype generalizes SOP-08's gate evidence to
every object class: advancing to Experiment requires a prototype;
advancing to Production requires verification + benchmark evidence.

## 4. Default-progressive, gate-conservative

| Evidence | Source |
| --- | --- |
| Bureaucracy kills adoption: early stages should auto-advance with evidence, while late stages block on configured gates | Corpus convention (YAGNI law; organic-code gates) |
| Rollback must be legal where reversible (production → experiment) and illegal where irreversible (extinct) | Prototype claim; WS-D transactional discipline |

## Prototype claims

- 8-stage machine with a declared transition table (including legal
  rollbacks and terminal Extinct).
- Evidence-gated transitions (per-stage required evidence kinds).
- A lifecycle registry answering "what stage is everything in", with
  a journal and lineage stubs for extinct objects.
