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
