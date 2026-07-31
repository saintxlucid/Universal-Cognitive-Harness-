---
name: test-driven-development
description: "Write the test first, watch it fail, then implement the minimal code to make it pass. Use for any new feature, bug fix, or refactor where behavior can be verified automatically."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [testing, tdd, quality, verification]
  related_skills: [systematic-debugging, coding-principles, requesting-code-review]
---

# Test-Driven Development

## The Cycle

```
RED â†’ GREEN â†’ REFACTOR
```

### 1. RED â€” Write a Failing Test

- Write a test that specifies the desired behavior
- Run it and confirm it FAILS for the right reason
- The failing test is the contract

### 2. GREEN â€” Minimal Implementation

- Write the smallest amount of code to make the test pass
- Don't add features the test doesn't require
- Resist the urge to overengineer

### 3. REFACTOR â€” Clean Up Safely

- Improve the code structure with tests as the safety net
- Re-run the full suite after each refactor step

## Rules

- One behavior at a time per test
- Tests must be deterministic
- Test behavior, not implementation details
- Never delete a failing test without understanding why it fails
- Bug fix â†’ first write a test that reproduces the bug

## Checklist

- [ ] Test written BEFORE implementation
- [ ] Test failed for the right reason
- [ ] Implementation is minimal
- [ ] Full suite passes after refactor
