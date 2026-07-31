---
name: skill-creator
description: "Create a new SKILL.md skill from a spec: name, description, triggers, workflow sections, and checklist. Use when the agent identifies a repeated task pattern worth codifying."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [skills, authoring, automation, meta]
  related_skills: [progressive-memory-search]
---

# Skill Creator

## When to Create a Skill

- The same multi-step task has been performed 2+ times
- The task has a stable methodology (not exploratory)
- The skill would apply across sessions

## The SKILL.md Anatomy

```markdown
---
name: <kebab-case-name>
description: "<When to use + trigger phrases, 1-2 sentences>"
version: 1.0.0
metadata:
  tags: [relevant, tags]
  related_skills: [other-skills]
---

# <Title>

## Overview        â†’ what it does, core principle
## When to Use     â†’ trigger conditions, when NOT to use
## Workflow        â†’ step-by-step instructions
## Checklist       â†’ verification checklist
```

## Quality Rules

- `description` must include trigger phrases so the skill is discoverable
- Workflow steps must be actionable, not vague
- Include an explicit checklist for verification
- Prefer the coding principles: minimal, surgical, verifiable
- Name in kebab-case, directory named after the skill

## Checklist

- [ ] Trigger phrases in the description
- [ ] Steps are actionable and ordered
- [ ] Checklist included
- [ ] Version set to 1.0.0
