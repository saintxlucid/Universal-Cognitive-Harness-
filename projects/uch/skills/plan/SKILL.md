---
name: plan
description: "Structured planning before implementation: create a detailed plan with phases, verification criteria, and risks. Use for any task with 3+ steps, architectural changes, or unknown unknowns."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [planning, architecture, execution, verification]
  related_skills: [coding-principles, spike, test-driven-development]
---

# Plan Skill

## When to Use

- Tasks with 3+ steps or multiple files
- Architectural or structural changes
- Tasks with unknown unknowns
- Refactoring or migrations
- Any task where failure is expensive

## How to Plan

### 1. Understand the Goal

- What does success look like? Define verifiable success criteria.
- What constraints exist (time, dependencies, compatibility)?

### 2. Decompose into Phases

Each phase:
- Has a single clear goal
- Ends with a verifiable checkpoint
- Can be executed independently if possible

### 3. Identify Risks

For each phase, list:
- Unknowns that could block it
- Dependencies on other phases
- Failure modes and rollback paths

### 4. Write the Plan

```
# Goal: <verifiable success criteria>

## Phase 1: <name>
- Steps: ...
- Verify: <check>

## Phase 2: <name>
- Steps: ...
- Verify: <check>

## Risks
- ...
```

## Checklist

- [ ] Success criteria are verifiable (tests, commands, checks)
- [ ] Each phase has a checkpoint
- [ ] Risks and rollback paths identified
- [ ] Plan is proportional to task complexity (no over-planning simple tasks)
