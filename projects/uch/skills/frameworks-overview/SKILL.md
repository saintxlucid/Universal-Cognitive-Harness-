---
name: frameworks-overview
description: "Map of the Cognitive Frameworks Library: 10 families, 30+ codified frameworks (decisions, problems, rca, strategy, productivity, research, critical, knowledge, signals, code) plus the model-selection layer. Load first for any frameworks task, or when choosing how to approach a problem."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [frameworks, catalog, selection, methodology, decision-about-decisions]
  related_skills: [frameworks-decisions, frameworks-problems, frameworks-rca, frameworks-strategy, frameworks-productivity, frameworks-research, frameworks-critical, frameworks-knowledge, frameworks-signals, frameworks-code]
---

# Frameworks Library Overview

UCH codifies every reasoning framework as a deterministic engine. The central
thesis: *there is no one best model, only the right model for the moment* —
model selection itself is a decision.

## When to Use

- Any task that benefits from a structured methodology
- Choosing which approach fits a problem
- Explaining or auditing past decisions

## The 10 Families

| Family | Engines | When |
|---|---|---|
| decisions | matrix, cost-benefit, pareto, tree, SWOT, pre-mortem, six hats | choosing among alternatives |
| problems | IDEAL, five-whys, design-thinking, PDCA, OODA, kepner-tregoe | solving problems |
| rca | F.O.C.U.S., five-whys trace, fishbone, pareto | diagnosing failures |
| strategy | strategy-wheel, strategy-vs-plan | direction and positioning |
| productivity | planTasks, 3-3-3 | planning work |
| research | validateMethodology, detectGaps | method design + gaps |
| critical | assessInformation (9 questions) | verifying information |
| knowledge | dikwTransform, checkRepresentationInvariance | sense-making |
| signals | fuseSignals | multi-factor ranking |
| code | auditCodePrinciples | code review |

## Workflow

1. **List**: `uch frameworks` (or MCP `framework-catalog`)
2. **Select**: `uch frameworks select "<problem>" [--data 0.8] [--time 0.2]` (or MCP `framework-select`)
3. **Inspect**: `uch frameworks show <id>` for stages and selection metadata
4. **Run**: the family skill for that engine, or the MCP tool directly

## Selection Quick Guide

- Data-rich → decision-matrix / rational / cost-benefit / pareto
- Time-critical → intuitive / PMI / lean / ooda
- Strategic → swot / strategy-wheel
- Uncertainty & risk → decision-tree / pre-mortem
- Group consensus → delphi / nominal-group / multi-voting
- Root-cause → five-whys / fishbone / rca-focus
- Human-centered → design-thinking
- Continuous improvement → pdca
- Fast-changing → ooda
- High-stakes complex → kepner-tregoe

## Verify

`uch frameworks` lists 10 families; `uch frameworks show dikw` prints stages.
