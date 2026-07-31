---
name: systematic-debugging
description: "4-phase root cause debugging: understand bugs before fixing. Iron law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST. Use for any technical issue â€” test failures, production bugs, unexpected behavior."
version: 1.1.0
author: UCH
license: MIT
metadata:
  tags: [debugging, troubleshooting, root-cause, investigation, problem-solving]
  related_skills: [test-driven-development, plan]
---

# Systematic Debugging

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue: test failures, production bugs, unexpected behavior, performance problems, build failures, integration issues.

Use ESPECIALLY when under time pressure, when "just one quick fix" seems obvious, or after previous fixes didn't work.

## Phase 1: Root Cause Investigation

1. **Read error messages carefully.** Stack traces contain the solution. Note line numbers, paths, error codes.
2. **Reproduce consistently.** If not reproducible, gather more data â€” don't guess.
3. **Check recent changes.** Git diff, recent commits, new dependencies, config changes.

## Phase 2: Formulate and Test Hypotheses

1. List every plausible root cause with evidence supporting it.
2. Rank hypotheses by likelihood and testability.
3. For each: design a discriminating test that distinguishes it from alternatives.
4. NEVER skip testing a hypothesis because it seems unlikely.

## Phase 3: Fix Confirming Root Cause

1. Fix the identified root cause â€” not the symptom.
2. Make the smallest change that addresses the root cause.
3. Verify the fix: the original failing case now passes AND no regressions.

## Phase 4: Verify and Learn

1. Run the full test suite, not just the failing test.
2. Add a regression test that captures the root cause.
3. Check for other locations with the same root cause pattern.

## Checklist

- [ ] Root cause identified with evidence BEFORE any fix
- [ ] Fix addresses root cause, not symptom
- [ ] Full test suite passes
- [ ] Regression test added
