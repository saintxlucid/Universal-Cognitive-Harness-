---
name: frameworks-research
description: "Research frameworks: 5-stage methodology validation (design, collection, analysis, sampling, ethics) and 8-type research gap analysis (knowledge, evidence, methodological, population, context, time, contradiction, theory). Use when designing studies or finding unanswered questions."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [research, methodology, gap-analysis, literature-review, study-design]
  related_skills: [frameworks-overview, frameworks-critical, deep-research]
---

# Research Frameworks

A methodology is a logical justification of what you did, how, and how it can
be reproduced. A research gap is the difference between what is known and
what still needs to be known.

## When to Use

- Designing a study, survey, or evidence-based project
- Literature reviews and dissertation topics
- Auditing a methodology before submission

## Methodology Validation (MCP `research-methodology`)

Five stages, each answering a fundamental question:

1. **Design** — How will I investigate the problem? (justify approach)
2. **Collection** — Where will the evidence come from? (specific methods)
3. **Analysis** — How will raw data become findings? (explain the process)
4. **Sampling** — Whose evidence is represented? (population + size + reason)
5. **Ethics** — Can this be trusted ethically? (consent, confidentiality,
   voluntary, data protection)

The verdict includes mistakes to avoid and the "before you finish" checklist.

## Gap Analysis (MCP `research-gap`)

Feed literature notes; the engine detects:

- **knowledge** — nobody knows (no studies)
- **evidence** — claims without evidence
- **methodological** — weak/outdated methods
- **population** — wrong people studied
- **context** — wrong setting studied
- **time** — old evidence, new reality
- **contradiction** — studies disagree
- **theory** — observations unexplained by current theory

The ranked output includes a drafted research question.

## Tips

- Be specific: narrow questions beat broad topics
- Evaluate study quality, not just count papers
- Mine "future research" sections — authors say what remains unanswered

## Verify

`uch frameworks select "Where should I research next?" --family research`
returns a research-family framework.
