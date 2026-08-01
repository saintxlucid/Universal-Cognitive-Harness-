---
track: protocol
status: research-draft
version: 0.1.0
sources:
  - https://www.rfc-editor.org/rfc/rfc2119 (RFC 2119 — normative intent language; the goal/constraints pattern)
  - https://www.omg.org/spec/UML/2.5.1/ (UML — use cases and goals; success/failure scenarios as first-class)
  - https://en.wikipedia.org/wiki/Goal_modeling (Goal modeling — KAOS: goal, obstacles, agent responsibility)
  - https://docs.llvm.org/LangRef.html (LLVM IR — the intent→IR→runtime pattern the intake cites)
  - https://martinfowler.com/bliki/DefinitionOfDone.html (Definition of Done — success predicates as gates)
---

# Intent Objects — G1 evidence register (IDEA-0075)

Evidence register for `rfc/ideas/IDEA-0075-intent-objects.md`: a request
is not a prompt but a structured intent envelope — goal, constraints,
success, failure, priority, deadline, stakeholders, risk, evidence —
from which everything downstream compiles. The prototype implements:
the envelope with defaultable fields, normalization, a compile path to
decision-law parameters (IDEA-0034), and success-predicate verification.

## 1. Intent is the structured request

| Evidence | Source |
| --- | --- |
| Goal modeling treats a goal as a first-class object with success conditions and obstacles — not a free-text wish | KAOS / goal modeling literature |
| UML use cases formalize main success scenarios and failure scenarios for the same interaction | UML 2.5.1 |

**Corpus anchor:** CIR (RFC-0004) is a compiler design that *assumes*
intent exists but specifies no intent format; GSD tasks carry execution
fields, not the full envelope; the decision law (IDEA-0034) consumes
utility, risk, and latency but nothing *declares* them. The prototype's
`IntentEnvelope` is the missing frontend contract.

## 2. Everything downstream compiles from the envelope

| Evidence | Source |
| --- | --- |
| The intent→IR→runtime pattern: a compiler's frontend contract determines what the optimizer and backend can know | LLVM IR design |
| Definition of Done turns "success" from a feeling into a predicate a gate can check | Fowler, Definition of Done |

**Corpus anchor:** `compileIntent` maps the envelope onto the decision
law: success predicate → verification gate, deadline → latency
pressure, risk appetite → risk term weight, priority → utility weight,
evidence requirements → provenance expectations. This is the CIR
frontend's input contract (RFC-0004) and the CEL mission shape
(IDEA-0055).

## 3. Envelopes must degrade gracefully

| Evidence | Source |
| --- | --- |
| A mandatory nine-field form invites garbage; every field must be defaultable and the intent must still compile when under-specified | Corpus YAGNI law; prototype risk notes |
| Defaults must be *safe*: missing risk = organism default (balanced), missing success = "as specified" | Prototype claim |

**Corpus anchor:** `normalizeIntent` fills every defaultable field;
`isSuccess` treats the default predicate as "any non-empty outcome" —
an under-specified intent degrades to a prompt-shaped intent without
breaking the compile path.

## 4. Deadlines and risk feed the scheduler and the decision law

| Evidence | Source |
| --- | --- |
| Deadlines are scheduling inputs: the closer the deadline, the higher the latency pressure; expired deadlines are not "negative pressure", they are a state | Corpus scheduler (ADR-004); decision law |
| Risk appetite is a parameter of the utility function, not a policy afterthought | IDEA-0034 (risk term λr·R) |

**Corpus anchor:** `compileIntent` returns `latencyPressure` (0..1 from
deadline proximity, 0 when absent/expired) and `riskWeight` (1.0
conservative → 0.2 aggressive) — ready to seed the decision law.

## Prototype claims

- Nine-field envelope with every field defaultable (graceful
  degradation to prompt-shaped intent).
- Deterministic compile path to decision-law parameters.
- Success-predicate verification gate.
