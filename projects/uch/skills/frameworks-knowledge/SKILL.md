---
name: frameworks-knowledge
description: "Knowledge frameworks: DIKW transform (Data → Information → Knowledge → Wisdom with context as catalyst) and representation invariance checking (truth across representations). Use for sense-making, report elevation, and verifying that different descriptions agree on the same reality."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [dikw, knowledge, wisdom, representation-invariance, sense-making]
  related_skills: [frameworks-overview, frameworks-critical, progressive-memory-search]
---

# Knowledge Frameworks

Facts alone do not produce wisdom. Wisdom emerges by adding context,
relationships, interpretation, and purpose over time.

## When to Use

- Elevating raw observations into actionable understanding
- Sense-making after research or investigation
- Checking that multiple representations of a claim agree

## DIKW Transform (MCP `dikw`)

Each layer adds a transformation:

| Layer | Question | Added |
|---|---|---|
| Data | Who? What? When? Where? | isolated observations |
| Information | Who? What? (organized) | structure and relationships |
| Knowledge | How? | models, mechanisms, experience |
| Wisdom | Why? | judgment, priorities, purpose |

The engine takes data points plus optional relationships, rules, and
judgment, and reports which layers are missing — accumulating data does not
automatically produce wisdom.

## Representation Invariance

The "Truth" axiom: radically different-looking descriptions can represent the
same underlying reality. `checkRepresentationInvariance(claim,
representations)` scores how much each independent representation confirms
the claim's substance:

- ≥80% — high convergence, robust across representations
- 50-79% — partial convergence, verify the differences
- <50% — conflicting representations; treat as unverified

A map isn't the territory — but it can point toward it.

## Verify

`uch frameworks show dikw` lists the four stages; feeding data + priorities
through MCP `dikw` returns wisdom with judgment.
