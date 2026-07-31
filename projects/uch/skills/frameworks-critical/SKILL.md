---
name: frameworks-critical
description: "Critical thinking evaluator: the 9 questions (needs, qualified source, currency, prejudice, fact vs opinion, propaganda, motivation, whole story, better sources) mapped to the 5 Information Integrity laws. Use before relying on any information, source, or claim."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [critical-thinking, information-integrity, verification, bias, misinformation]
  related_skills: [frameworks-overview, frameworks-research, security-reviewer]
---

# Critical Thinking Evaluator

Critical thinking is the cognitive operating system that governs whether
every other framework is used correctly. Information may be correct,
incomplete, biased, outdated, misleading, false, or manipulated.

## When to Use

- Before relying on retrieved knowledge, sources, or claims
- Auditing content for bias or manipulation
- As an inhibition gate before decisions built on evidence

## Engine Workflow (MCP `evaluate-info`)

Answer each of the 9 questions with a short phrase; the engine scores each
check and maps it to the integrity laws:

| # | Question | Integrity Law |
|---|---|---|
| 1 | Does it satisfy your needs? | — |
| 2 | Is the source qualified? | Qualified Source Required |
| 3 | Is it current? | — |
| 4 | Is there prejudice/unfairness? | No Prejudice as Evidence (inverted) |
| 5 | Are opinions presented as facts? | Objectivity Required (inverted) |
| 6 | Is this propaganda/advertising? | No Propaganda as Evidence (inverted) |
| 7 | What is the author's motivation? | — |
| 8 | Are you hearing the whole story? | Whole Truth Requirement |
| 9 | Are there better sources? | — |

Inverted questions pass only on denial ("no bias", "no propaganda").

## Rules

- Never rely on one source — truth strengthens through convergence
- Read opposing viewpoints; synthesize, don't confirm
- Treat conclusions as tentative; update when evidence changes
- Professional appearance ≠ truth

## Verify

`uch frameworks select "Is this claim reliable?" --family critical` returns
the critical family.
