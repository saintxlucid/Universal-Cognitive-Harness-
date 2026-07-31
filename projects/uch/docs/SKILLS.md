# UCH Skill System

UCH treats skills as first-class, portable capability packages: a
directory containing `SKILL.md` (with YAML frontmatter) plus optional
reference files. Skills are discoverable, importable from external
repositories with provenance tracking, and optimizable from invocation
history.

## Skill Format

```
<skill-name>/
├── SKILL.md          # required — frontmatter + instructions
└── references/…      # optional — supporting material
```

`SKILL.md` frontmatter:

```yaml
---
name: skill-name
description: What it does and when to use it
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: UCH
  version: "1.0.0"
  domain: quality
  triggers: code review, PR review
  role: specialist
  scope: review
  output-format: report
  related-skills: other-skill
---
```

Minimum valid frontmatter is `name` + `description`; everything else is
optional. Files are parsed with BOM tolerance, so skills written by any
tooling on any platform import cleanly.

## Cataloging an External Repository

Point the scanner at a repo whose subdirectories contain `SKILL.md`
files (nested directories are searched recursively):

```bash
uch skill catalog "path/to/skill-library"
```

Output: a table of skill name, description, domain, reference count,
and related skills, plus warnings for unparseable files.

## Importing Skills

```bash
uch skill import "path/to/skill-library" skill-a skill-b [--force]
```

Behavior:

- Copies each named skill directory into `./skills/<name>/`
- `--force` overwrites an existing skill directory
- Records provenance in `./skills/.import-index.json`
- Fails loudly (no partial index writes) if anything goes wrong

### Provenance index

`.import-index.json` records, per imported skill:

| Field | Meaning |
| --- | --- |
| `sourceRepo` | Basename of the source repository |
| `sourcePath` | Absolute source path |
| `installedAt` | ISO timestamp of install |
| `files` | Installed file list |
| `force` | Whether it overwrote an existing install |

```bash
uch skill provenance   # human-readable view of the index
```

## Creating Skills

```bash
uch skill create <name> "<description>"
```

Scaffolds a template `SKILL.md` (with the standard UCH frontmatter)
into `./skills/<name>/`.

## Optimizing Skills

```bash
uch skill optimize
```

Analyzes recorded skill invocations and suggests improvements
(confidence, success rate, task compatibility).

## Imported Library

The `skills/` directory ships with native UCH skills
(`deep-research`, `coding-principles`, `plan`,
`progressive-memory-search`, `requesting-code-review`, `skill-creator`,
`spike`, `synthesis-gap-analysis`, `systematic-debugging`,
`test-driven-development`) and imported skills from external reference
collections (`portable-skill-library` — 17 skills, and
`andrej-karpathy-skills-main` — `karpathy-guidelines` with its
`EXAMPLES.md` reference).

Imported skills keep neutral provenance in the index; every file's
origin can be traced via `uch skill provenance`. Reference material is
used as inspiration and adapted to UCH conventions, never copied
verbatim into first-party modules — see `docs/extraction-map.md` for
the full pattern-to-module provenance record.
