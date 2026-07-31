---
name: frameworks-code
description: "Clean Code principles audit: SOC, DRY, KISS, DYC, YAGNI with the trade-off layer (DRY vs KISS, YAGNI vs SOC, docs vs self-documenting). Use before landing any code change or when reviewing designs — clean code is a strategy for reducing the long-term cost of change."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [code-quality, clean-code, soc, dry, kiss, dyc, yagni, code-review]
  related_skills: [frameworks-overview, coding-principles, requesting-code-review, organic-code]
---

# Clean Code Principles

Five principles that control complexity over time. Not aesthetic preference —
a strategy for keeping the hundredth change cheap.

## When to Use

- Before landing any generated or hand-written code
- Design and refactoring reviews
- Auditing a diff against the five principles

## Engine Workflow (MCP `code-audit`)

`auditCodePrinciples({ change, intent })` scores each principle 0-10 and
flags violations:

1. **SOC** — one primary responsibility per module/class/function; the
   foundation everything else depends on
2. **DRY** — every piece of knowledge has one authoritative representation
   (tax logic once, not in twenty files)
3. **KISS** — simplest solution that fully solves the problem; complexity is
   earned, not assumed (microservices, plugin frameworks, config engines and
   "just in case" machinery are flagged)
4. **DYC** — document intent (why), not behavior (what)
5. **YAGNI** — implement only what is required now; speculative features,
   extension systems, and hypothetical APIs are flagged

## The Trade-Off Layer

- **DRY vs KISS** — small duplication is sometimes preferable to a poor
  abstraction
- **YAGNI vs SOC** — design for categories of change, don't implement
  imaginary functionality
- **Docs vs self-documenting** — excellent names reduce comment needs

## Rules of Thumb

- Complexity carries a permanent cost
- Documentation preserves context code cannot
- Refactor toward extension categories, not speculative features

## Verify

`uch frameworks select "Review this design" --family code` returns the code
family; pair with `uch organic-score` for the full landing gate.
