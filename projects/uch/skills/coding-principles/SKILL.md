---
name: coding-principles
description: "Four principles for reliable AI coding: think before coding, simplicity first, surgical changes, goal-driven execution. Load before any implementation task to avoid wrong assumptions, overcomplicated code, and orthogonal edits."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [principles, code-quality, assumptions, simplicity, surgical-changes, goals]
  related_skills: [plan, test-driven-development, requesting-code-review]
---

# Coding Principles

UCH's four core principles for reliable AI coding. They bias toward caution
over speed — for trivial tasks, apply them with judgment rather than ceremony.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask rather than guess.
- Present multiple interpretations. Don't pick silently when ambiguity exists.
- Push back when warranted. If a simpler approach exists, say so.
- Stop when confused. Name what's unclear and ask for clarification.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

**The test:** Would a senior engineer say this is overcomplicated? If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused. Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

| Instead of... | Transform to... |
|--------------|-----------------|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Refactor X" | "Ensure tests pass before and after" |

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## Working Checklist

- [ ] Assumptions are explicit; confusion was surfaced before coding
- [ ] No speculative abstractions, flexibility, or error handling
- [ ] Every changed line traces to the request; no drive-by edits
- [ ] Success criteria defined with a verification loop
