---
name: synthesis-gap-analysis
description: "Synthesize retrieved memory into an actual answer with citations and explicit gap analysis. Use when answering from memory/search results: what the brain knows, what it doesn't know yet, stale pages, contradictions. The gap analysis is the differentiator."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [synthesis, retrieval, gap-analysis, citations, reasoning]
  related_skills: [progressive-memory-search, deep-research]
---

# Synthesis with Gap Analysis

## The Principle

Search returns pages. A brain reads them and writes the answer — with every claim cited, and an honest note on what it doesn't know yet.

## Answer Structure

1. **The answer** — synthesized prose across retrieved results
2. **Citations** — every claim tied to a source ID
3. **Gap analysis** — explicit note on what the brain doesn't know:
   - Stale pages (older than threshold) — verify currency
   - Uncited claims — flag as unverified
   - Contradictions between sources — surface both sides
   - Holes — topics/terms with no coverage

## Rules

- Every claim must have a citation; uncited claims are explicitly flagged
- Never present absence of evidence as evidence ("no pages about X" means the brain doesn't know, not that X is false)
- When two pages contradict, present both with their sources
- When pages are stale, say so and suggest re-verification
- Confidence reflects coverage: thin coverage → low confidence

## Example Shape

```
<Answer with citations>
Sources: [id1, id2, ...]

Heads up: nothing has been added about <topic> since <date>.
Contradiction: id1 claims X, id2 claims not-X.
No pages mention: <terms>. May not be covered yet.
```

## Checklist

- [ ] Every claim cited
- [ ] Stale sources flagged with age
- [ ] Contradictions surfaced with both sides
- [ ] Gaps stated explicitly (not implied)
- [ ] Confidence calibrated to coverage
