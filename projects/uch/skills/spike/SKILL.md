---
name: spike
description: "Time-boxed exploration of uncertain technical territory before committing to an approach. Use when facing unknown APIs, unclear feasibility, or multiple competing approaches. The deliverable is knowledge, not production code."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [spike, exploration, research, feasibility, prototyping]
  related_skills: [plan, deep-research]
---

# Spike Skill

## When to Use

- Unknown API behavior or unclear library capabilities
- Multiple competing approaches with no clear winner
- Feasibility questions ("can we even do X?")
- Risky integration points

## How to Run a Spike

### 1. Define the Question

State exactly what you need to learn. A spike answers ONE question.

### 2. Set a Time Box

Agree on a hard time limit (e.g., 30-90 minutes). Spikes are bounded exploration.

### 3. Build the Minimum Probe

- Write the smallest possible code that exercises the uncertainty
- Prefer throwaway scripts over production code
- Use the real API/library â€” docs alone are not evidence

### 4. Document Findings

Record:
- What works and what doesn't (with evidence)
- API behaviors discovered (signatures, edge cases)
- Performance or compatibility observations
- Recommendation: which approach to take, or what remains unknown

### 5. Decide

Convert findings into a decision: commit to an approach, run another spike, or abandon the idea.

## Checklist

- [ ] Single clear question defined
- [ ] Time box set and respected
- [ ] Probe used the real API, not just docs
- [ ] Findings documented with evidence
- [ ] Decision or next step made
