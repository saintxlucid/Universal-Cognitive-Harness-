---
name: progressive-memory-search
description: "3-layer memory retrieval with token efficiency: search index â†’ timeline â†’ full observations. Use when querying past sessions or project history; start with compact results and fetch details only for relevant IDs (~10x token savings)."
version: 1.0.0
author: UCH
license: MIT
metadata:
  tags: [memory, search, retrieval, tokens, efficiency]
  related_skills: [synthesis-gap-analysis]
---

# Progressive Memory Search

## The 3-Layer Workflow

Layer 1 â€” **search**: get a compact index with IDs (~50-100 tokens/result).
Layer 2 â€” **timeline**: get chronological context around interesting results.
Layer 3 â€” **get observations**: fetch full details ONLY for filtered IDs (~500-1,000 tokens/result).

This ordering yields ~10x token savings by filtering before fetching details.

## Usage

```
Step 1: search(query="authentication bug", type="bugfix", limit=10)
        â†’ review the index, identify relevant IDs (e.g., #123, #456)

Step 2: timeline(id=123, before=5, after=3)
        â†’ see what was happening around that observation

Step 3: get_observations(ids=[123, 456])
        â†’ fetch full details for the relevant IDs only
```

## Rules

- Always batch IDs in get_observations â€” never one ID per call
- Use the timeline layer to reconstruct context before judging an observation
- Filter by type/date/project at the search layer when possible

## Privacy

Content wrapped in `<private>...</private>` is excluded from storage and search. Respect this contract â€” never force private content into retrieval.

## Checklist

- [ ] Started with the compact index (layer 1)
- [ ] Fetched details only for relevant IDs
- [ ] Batched ID lookups
- [ ] Timeline used when context matters
