---
name: frameworks-problems
description: "Problem-solving frameworks: IDEAL, Five Whys, Design Thinking, PDCA, OODA, Kepner-Tregoe — with guidance for matching the framework to the nature of the problem. Use when moving from a problem to a validated solution."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [problems, problem-solving, ideal, five-whys, design-thinking, pdca, ooda, kepner-tregoe]
  related_skills: [frameworks-overview, frameworks-rca, systematic-debugging]
---

# Problem-Solving Frameworks

Six complementary frameworks — each optimizes a different part of the
universal lifecycle: understand → analyze → generate → choose → implement →
evaluate → learn.

## When to Use

- Any problem that needs structured movement to a solution
- Match the framework to the problem type, not personal preference

## Framework Selection

| If your challenge is... | Use... |
|---|---|
| Well-defined problem, clear path | IDEAL |
| Recurring issue, unknown causes | Five Whys (see also rca family) |
| Product/service for users | Design Thinking |
| Improving an existing process | PDCA |
| Fast-moving, uncertain situation | OODA |
| High-stakes, multi-factor issue | Kepner-Tregoe |

## Engine Workflow (MCP `analyze-problem`)

- `ideal` — identify → define → explore → act → look back
- `five-whys` — descend the causal chain with whyAnswers until the mechanism
  appears; the root cause is rarely the first answer
- `pdca` — plan → do → check → act (continuous improvement loop)
- `ooda` — observe → orient → decide → act; shorten loop latency when the
  environment changes faster than you do
- `kepner-tregoe` — situation appraisal → problem analysis → decision analysis →
  potential problem analysis

## Verify

`uch frameworks select "Recurring defects, unknown cause" --root-cause` returns
five-whys/fishbone/rca-focus.
