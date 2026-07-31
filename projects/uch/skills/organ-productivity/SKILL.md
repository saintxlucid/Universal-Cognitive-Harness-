---
name: organ-productivity
description: "Productivity Kernel (Basal Ganglia): GTD capture, MIT selection, Eisenhower classification, time blocking, Pomodoro cycles, eat-the-frog ordering, two-minute rule, 3-3-3 structure. Use when turning goals into scheduled, prioritized, interruption-resistant execution units."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [productivity, organ, basal-ganglia, planning, execution, mit, gtd, eisenhower]
  related_skills: [frameworks-productivity, frameworks-overview, organ-signal-fusion, organ-code-governance]
---

# Productivity Kernel (Basal Ganglia)

Stateful organ engine: converts goals into scheduled, prioritized,
interruption-resistant execution units. Delegates the planning math to the
productivity framework engine and adds the organ state: session day
initialization, MIT tracking, capture-to-clarify latency, plan-to-execution
conversion, and interruption resistance.

## When to Use

- Planning a work session from a task list
- Capturing incoming work items (GTD) before they are lost
- Measuring plan-to-execution conversion and MIT completion

## Engine Workflow

1. **Capture** — `kernel.capture(name, durationMin)` adds to the inbox and
   emits `productivity:task_captured`.
2. **Clarify** — `kernel.clarify(id)` marks items actionable (latency
   benchmark: capture-to-clarify).
3. **Initialize the day** — `kernel.initializeDay(tasks)` selects MITs
   (frog-first, Eisenhower, Pareto), schedules time blocks + Pomodoro cycles,
   emits `productivity:day_planned`.
4. **Execute** — `kernel.execute(taskName)` tracks plan-to-execution
   conversion; interrupted execution is recorded, never silently dropped.

## Benchmarks

- Plan-to-execution conversion rate
- MIT completion rate
- Capture-to-clarify latency
- Interruption rate

## Event Wiring

When constructed via `createWiredProductivityKernel(bus)` (organ-wiring.ts),
every capture and day-plan becomes a `productivity:*` bus event
(fire-and-forget, default-off observability).

## Capability Registration

Registered in the standard capability registry (`attach.ts` →
`createStandardCapabilityRegistry`) as `productivity` with authority
operations `observe`, `retrieve`, `propose`, `consolidate`. Capability
absent from a grant → kernel activity is outside the client's projection
(default deny).

## Verify

`uch productivity` prints the kernel status (inbox, MIT, plan-execution rate).
