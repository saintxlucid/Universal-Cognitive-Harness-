---
name: requesting-code-review
description: "Prepare a change for review: self-review against criteria, then request review with context. Use before submitting any PR or handing work to a reviewer."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [code-review, quality, collaboration]
  related_skills: [coding-principles, test-driven-development]
---

# Requesting Code Review

## Before Requesting a Review

1. **Self-review the diff.** Re-read every changed line as a reviewer would.
2. **Run the checks.** Tests, lint, typecheck â€” nothing should be red.
3. **Verify scope.** Every changed line traces to the request (see coding-principles: surgical changes).

## What to Send the Reviewer

- The diff (or PR link)
- What the change does, in 2-3 sentences
- What you're unsure about (specific questions beat vague "please review")
- What you verified (tests run, checks passed)

## What NOT to Ask

- "Is this good?" â€” ask about specific decisions
- Reviewing code you already know is broken â€” fix it first

## After the Review

- Address each comment explicitly (fix, or explain why not)
- Thank the reviewer; re-request with a summary of changes

## Checklist

- [ ] Self-review completed line by line
- [ ] Tests, lint, typecheck all pass
- [ ] Scope verified against the request
- [ ] Specific questions included for the reviewer
