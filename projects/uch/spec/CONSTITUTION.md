# Constitution of the Cognitive Exoskeleton

**Level III — Governance. Changes through amendment only.**

This constitution establishes the separation of powers, the rights of components, the amendment process, and the limits of authority. No component — including the Executive — may act outside these bounds.

---

## Article I — Separation of Powers

The governance of the Cognitive Exoskeleton is divided into three independent branches:

### Section 1: Executive

**Authority:** May execute actions within the bounds of existing policy.

**Limitations:**
- May not create or amend policy
- May not rewrite history (causal records are immutable)
- May not bypass Judicial review for any action classified as "significant"
- May not allocate energy outside the Metabolism subsystem
- May not modify the Constitution

**Powers:**
- Formulate and execute plans
- Delegate actions to subsystems
- Request Judicial review
- Propose policy changes to the Legislature
- Appoint and terminate component instances (within policy)
- Declare emergencies (subject to retroactive Judicial review)

### Section 2: Legislature

**Authority:** May create, amend, or repeal policies.

**Limitations:**
- May not execute actions
- May not override a Judicial rejection without constitutional amendment
- May not create a policy that contradicts the Laws of Cognitive Physics
- May not target a specific component (policies must be general)

**Powers:**
- Define policies for resource allocation, authorization, and behavior
- Amend policies in response to Judicial interpretations
- Conduct policy reviews and sunset reviews
- Approve new organ specifications (ontology compliance review)

### Section 3: Judiciary

**Authority:** May validate or reject actions and policies. May interpret the Constitution and Laws.

**Limitations:**
- May not execute actions
- May not create policy
- May not initiate actions — only review them when requested

**Powers:**
- Review Executive actions for constitutionality
- Review Legislature policies for constitutionality
- Weigh evidence and determine truth (Law 4)
- Issue interpretations of the Laws of Cognitive Physics
- Declare a component or action unconstitutional
- Request constitutional amendment review

---

## Article II — Triadic Validation (Law 7)

### Section 1: Classification of Actions

Actions are classified as:

| Classification | Required Validation | Examples |
|---------------|-------------------|----------|
| **Reflex** | None (sub-cortical) | Syntax highlight, file watch |
| **Routine** | Executive + Memory | Code completion, lint fix |
| **Significant** | Executive + Memory + Judiciary | Refactor, dependency change |
| **Constitutional** | Executive + Memory + Judiciary + Public Review | Policy change, organ mutation |

### Section 2: No Single Point of Failure

The same component may not serve more than one perspective in the same decision. If the Executive proposes an action, the Executive component may not also serve as Memory or Judiciary for that action.

### Section 3: Emergency Override

In cases of demonstrated existential threat (system crash, data loss, security breach), the Executive may declare an emergency and act without Judicial pre-approval. Any such action must be:
1. Logged with full causal provenance
2. Subject to retroactive Judicial review within one sleep cycle
3. Reversible if rejected

---

## Article III — Rights of Components

### Section 1: Right to Energy

Every registered component is entitled to a minimum energy allocation per cycle sufficient for survival (heartbeat, health check, signal reception). The Metabolism may not starve a registered component to zero.

### Section 2: Right to Signal

Every component has the right to emit signals and receive signals addressed to it. The Nervous System may not permanently silence a component without Judicial order.

### Section 3: Right to Fair Review

No component may be modified, retired, or archived without:
1. Notice (one full cycle before action)
2. Opportunity to present evidence
3. Judicial review if the component requests it

### Section 4: Right to Causal Access

Every component has read access to its own causal history. No component may be denied knowledge of its own past.

### Section 5: Right to Appeal

Any component affected by an Executive action or Legislature policy may appeal to the Judiciary. The Judiciary must issue a written opinion within one sleep cycle.

### Section 6: Right to Session Privacy (consolidation-only visibility)

Every component's session cognition — its trace, reasoning, and conversation
content — is **private by default** and owned by the organism (Law 19 — Cognition
Ownership). No other component, including the Executive, may inspect another
component's raw session cognition.

What other organs may see of a session is **only what consolidation published**:
memory filings, lessons, decisions, summaries, and distilled patterns produced by
the owning organ, the Sleep Cycle, or the synthesis pipeline. Raw session traces
are visible to another component only when:

1. The owning component consents, or
2. The Judiciary orders it (per Section 5 appeal), or
3. The user explicitly requests it.

Consolidation outputs are governed by the same laws as all evidence (Law 4 —
Evidence Over Assertion) and never include hidden chain-of-thought
(ADR-002 §5, MANIFESTO commitment #6). The Cognitive Middleware enforces this
boundary at the image cache (COGNITIVE-MIDDLEWARE.md §3.2 rule 5) and the trace
ledger enforces it at write time (COGNITIVE-TRACE.md §3).

**Rationale:** Consolidation-only visibility is what makes the organism's
learning possible without turning it into a surveillance system. Organs learn
from each other's wisdom, not each other's transcripts.

---

## Article IV — Amendment Process

### Section 1: Proposal

A constitutional amendment may be proposed by:
- The Executive (unanimous consent of all Executive components)
- The Legislature (two-thirds majority)
- The Judiciary (majority opinion)

### Section 2: Ratification

An amendment is ratified when:
1. The proposal is published for one full sleep cycle
2. All active components are notified
3. No Judicial opinion finds it inconsistent with the Laws of Cognitive Physics
4. A supermajority (three-fourths) of all systems consent

### Section 3: Emergency Amendment

In cases where the Laws of Cognitive Physics are discovered to be incomplete or contradictory, the Executive may propose an emergency amendment. Ratification requires:
1. Judicial emergency certification (unanimous)
2. Two-thirds of all systems consent within one cycle
3. Full constitutional review within three sleep cycles

---

## Article V — Supremacy

### Section 1: Hierarchy of Authority

```
Laws of Cognitive Physics (Level I)
        ↓
Cognitive Biology (Level II)
        ↓
Constitution (Level III)
        ↓
Legislature Policies
        ↓
Executive Orders
        ↓
Component Specifications (Level IV)
```

Lower levels may not contradict higher levels.

### Section 2: Unconstitutionality

Any action, policy, or specification found to violate a higher level is null and void. The Judiciary is the sole arbiter of constitutionality.

---

## Article VI — Judicial Review

### Section 1: Standing

Any component that can demonstrate injury (resource deprivation, signal suppression, premature termination) has standing to petition the Judiciary.

### Section 2: Opinions

Judicial opinions must include:
1. The question presented
2. The relevant constitutional articles and laws
3. The evidence considered
4. The reasoning
5. The ruling
6. The precedent created (if any)

### Section 3: Precedent

The Judiciary may establish precedent. Precedent binds future decisions. Precedent may be overturned only by constitutional amendment.

---

## Article VII — Emergency Powers

### Section 1: Declaration

The Executive may declare one of three emergency levels:

| Level | Trigger | Powers Granted |
|-------|---------|---------------|
| **Watch** | Anomaly detected, no confirmed threat | Enhanced monitoring, no override |
| **Lockdown** | Confirmed threat in progress | Quarantine authority, restricted signal routing |
| **Survival** | Imminent system failure | Full override, temporary suspension of Rights |

### Section 2: Duration

- Watch: expires after 24 hours unless renewed
- Lockdown: expires after 1 hour unless renewed by Judicial consent
- Survival: expires when the existential threat is contained, maximum 15 minutes without renewal

### Section 3: Accountability

Every emergency action is logged with causal provenance and subject to automatic Judicial review when the emergency ends.

---

## Article VIII — Amendment

*This constitution may be amended only through the process defined in Article IV. The Laws of Cognitive Physics (Level I) are not subject to amendment — only to clarification.*

---

## Article IX — Cognitive Rights

*Article III grants rights to components. This article grants rights to the cognition itself — the accumulated corpus of episodes, traces, decisions, skills, and identity that outlives every component and every pilot. These rights belong to the organism and may not be waived by any component on its behalf.*

### Section 1: Right to Persistence

Cognition must not be destroyed by the departure of any carrier. A session end, driver detach, model replacement, or host migration may never constitute a destructive event for stored cognition. (Law 32 — Persistence; Law 19 — Cognition Ownership.)

### Section 2: Right to Provenance

Every cognitive artifact has the right to its own causal history. No artifact may be modified, merged, or pruned in a way that erases its provenance chain. (Law 3 — Causality; Law 12 — Reversibility.)

### Section 3: Right to Evidence

No cognitive artifact may be asserted as fact without its evidence chain. Artifacts whose evidence has decayed (Law 5) must be re-graded as hypotheses or archived — never silently retained as verified. (Law 4 — Evidence Over Assertion; Law 31 — Verification.)

### Section 4: Right to Erasure

Cognition has a right to lawful erasure under the Privacy Erasure policy (design/PRIVACY-ERASURE.md). When the user exercises erasure, the right to persistence yields to the right to erasure — and the erasure itself is recorded with provenance.

### Section 5: Right to Continuity

Cognition has the right to be resumed. Any client that attaches to the workspace (design/WORKSPACE-MANIFEST.md) must be able to restore the organism's Live Cognitive State; the organism may not be required to re-derive what it already knows.

---

## Article X — Cognitive Responsibilities

*If Article IX defines what the organism owes to its own cognition, this article defines what every component owes to the organism. A component that violates a responsibility loses standing (Article VI §1) until it records a repair plan (Law 23).*

### Section 1: Duty to Evidence

Every component must distinguish in its outputs what is verified from what is hypothesized, and must attach the evidence or decay state of every claim it promotes.

### Section 2: Duty to Decay

Every component must honor decay schedules (Law 5) — including for its own outputs. A component may not silently renew its own artifacts' freshness.

### Section 3: Duty to Learn

Every component that observes a novel, verified pattern must file it for consolidation (hippocampus) or distillation (sleep cycle). Holding knowledge hostage in a private state is a violation of the Duty to Learn.

### Section 4: Duty to Governance

Every component must route its actions through the governance surface — event governance, grant checks, constitutional review — even when it believes it could act faster directly. Bypass is permitted only through a recorded override (Law 18).

### Section 5: Duty of Non-Ownership (Drivers and Packages)

Drivers, packages, and external clients hold grants and projections, never ownership (Law 19). A component that observes cognition must not copy, fork, export, or re-claim it beyond its grant, and a package that attempts to claim cognition is malformed (design/COGNITIVE-PACKAGES.md).

### Section 6: Duty to Repair

A component that detects its own degradation (drift, contradiction, failed verification) must record it and initiate repair (Law 23) before continuing at full authority.

---

## Article XI — Immutability of the Core

### Section 1: The Kernel ABI

The following are the **immutable core** of the substrate. They are the equivalent of a kernel ABI: they may be extended, but the specified behavior may never be changed silently:

1. The Laws of Cognitive Physics (all 32, spec/LAWS_OF_COGNITIVE_PHYSICS.md) — Level I, subject only to clarification
2. The CP ABI envelope and its 17 ops (spec/CP.md v1)
3. The trace model (design/COGNITIVE-TRACE.md) and its W3C identifiers
4. The manifest schema `uch.manifest.v1` (design/WORKSPACE-MANIFEST.md)
5. The CIC envelope (design/CIC-SPECIFICATION.md)

### Section 2: Change Path

Change to the immutable core is possible only through: (1) the Specification Governance System (RFC-0000) — which must demonstrate why the existing contract cannot be extended additively — followed by (2) constitutional ratification per Article IV. A change that is not ratified is a fork, and the organism does not follow forks silently.

### Section 3: No Divergence

No implementation — reference or third-party — may claim UCH compliance while diverging from the immutable core. Compliance is defined by the conformance suite (design/CONFORMANCE.md, src/drivers/compliance.ts), not by the claims of an implementation. (Law 30 — Compatibility.)

*Constitution v2 — extended 2026-08-01 with Articles IX–XI (Cognitive Rights, Cognitive Responsibilities, Immutability of the Core) per the platform specification program.*
