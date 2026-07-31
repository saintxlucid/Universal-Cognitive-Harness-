---
name: frameworks-productivity
description: "Productivity OS: SMART goals, MIT, Eisenhower matrix, Pareto leverage, time blocking, Pomodoro, eat-the-frog, GTD capture, two-minute rule, task batching, 3-3-3 method. Use when planning work — productivity is a systems problem, not a motivation problem."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [productivity, planning, eisenhower, mit, gtd, time-blocking, pomodoro, pareto, smart]
  related_skills: [frameworks-overview, frameworks-strategy, frameworks-decisions]
---

# Productivity OS

A pipeline: define goals → choose priorities → schedule → focus → capture →
review. Each method solves a different bottleneck.

## When to Use

- Daily/weekly planning
- Task triage under competing demands
- Personal or team effectiveness

## Engine Workflow (MCP `plan-day`)

`planTasks` classifies every task and emits:

- **mostImportantTasks** — MIT: 1-3 critical tasks, not 50 small ones
- **eisenhower** — do / schedule / delegate / delete (urgency ≠ importance)
- **vitalFew** — Pareto: the 20% of tasks producing 80% of results
- **eatTheFrog** — the highest-resistance task, done first
- **timeBlocks** — every hour has a purpose; if work has no scheduled time it
  usually doesn't happen
- **twoMinuteActions** — do it immediately if it takes under two minutes
- **smartGoal** — gaps flagged: specific, measurable, achievable, relevant,
  time-bound

For the 3-3-3 structure (3 hours deep work + 3 urgent + 3 maintenance), use
`threeThreeThree`.

## Bottleneck Map

| Bottleneck | Method |
|---|---|
| Too many ideas in your head | GTD capture |
| Too many tasks | Eisenhower |
| Too many low-value tasks | Pareto |
| Don't know what's next | Time blocking |
| Overwhelmed by planning | 3-3-3 |
| Procrastinating | Eat the frog |
| Distracted | Pomodoro |
| Context switching | Task batching |

## Verify

`uch frameworks select "Plan my workday" --family productivity` returns the
productivity family.
