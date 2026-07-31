---
name: frameworks-decisions
description: "Decision-making frameworks: 12 models (rational, intuitive, decision matrix, cost-benefit, pareto, SWOT, decision tree, pre-mortem, delphi, nominal group, stepladder, multi-voting, brainstorming, PMI, lean, six hats) with the model-selector layer. Use when choosing among alternatives."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [decisions, decision-matrix, cost-benefit, pareto, swot, decision-tree, premortem, selection]
  related_skills: [frameworks-overview, frameworks-problems, frameworks-rca]
---

# Decision-Making Frameworks

Twelve models organized by decision context: analytical, experience-based,
strategic, uncertainty, group, and rapid.

## When to Use

- Any choice among alternatives
- Resource allocation, prioritization, risk evaluation
- Group decisions and consensus building

## Engine Workflow

### 1. Classify the decision

Use `selectDecisionModel` or MCP `framework-select`:

```json
{ "problem": "Choose a vendor", "dataAvailability": 0.9, "timePressure": 0.2 }
```

### 2. Run the model (MCP `decide`)

- `decision-matrix`: weighted criteria scoring → winner
- `cost-benefit`: net value + ratio → adopt/reject/review
- `pareto`: vital few by cumulative impact
- `decision-tree`: expected-value rollback across branches
- `swot`: S-O / W-O / S-T / W-T cross-product synthesis
- `pre-mortem`: assume failure, rank causes, design mitigations

### 3. Risk-gate high-stakes decisions

Run `pre-mortem` before committing: "Assume the plan failed 6-12 months out. Why?"

## Quick Guide

| Context | Model |
|---|---|
| Fast decision | intuitive, PMI, lean |
| Lots of reliable data | matrix, cost-benefit, pareto |
| Group decision | delphi, nominal-group, stepladder, multi-voting |
| High uncertainty/risk | decision-tree, pre-mortem |
| Strategic choice | swot, six-hats |

## Verify

`uch frameworks select "Server is down, decide now" --time 0.95` returns a
rapid model (pmi/lean/intuitive/ooda).
