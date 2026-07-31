---
name: frameworks-rca
description: "Root Cause Analysis: F.O.C.U.S. workflow (Focus, Organize, Create, Understand, Solve) plus Five Whys trace, Fishbone categories, and Pareto prioritization. Use when investigating failures — a problem is only solved when the system that produced it is corrected."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [rca, root-cause, five-whys, fishbone, pareto, diagnosis, focus]
  related_skills: [frameworks-overview, frameworks-problems, systematic-debugging]
---

# Root Cause Analysis

RCA is diagnosis: move from symptom → evidence → hypotheses → root cause →
system correction → verification → prevention.

## When to Use

- Recurring defects, system failures, quality investigations
- Any problem where quick fixes keep reappearing
- Before proposing solutions to a symptom

## F.O.C.U.S. Pipeline (MCP `rca`)

1. **F — Focus**: state the problem measurably ("login fails for 12% of users
   during peak traffic", not "the system is bad")
2. **O — Organize**: gather evidence (logs, metrics, timelines) — separate
   facts from assumptions
3. **C — Create**: generate candidate causes across categories (people,
   process, technology, materials, environment, management)
4. **U — Understand**: study interactions; root causes emerge from how
   components interact
5. **S — Solve**: correct the cause, not the symptom; implement ONE solution
   at a time to preserve causal clarity

## Diagnostic Tools

- `traceFiveWhys` — vertical descent; validate the result (never assume the
  first explanation is correct)
- `fishbone` — horizontal breadth; fill 3+ categories to avoid fixation
- `paretoPrioritize` — focus on the vital few causes

## Discipline Rules

- Never blame individuals — ask "why was this mistake possible?"
- Validate findings with experiments or controlled changes
- Document lessons so future diagnosis improves

## Verify

`uch frameworks select "Recurring production defects" --root-cause` returns an
rca-family framework.
