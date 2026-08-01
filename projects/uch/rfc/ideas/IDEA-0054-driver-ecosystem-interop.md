# IDEA-0054 — Driver Ecosystem + Interoperability Certification

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Foundations 2 and 19) — "every
  IDE gets its own driver: VSCode, Cursor, Codex, Claude, OpenCode,
  JetBrains, Zed, Neovim, Windsurf — every driver implements the same
  Cognitive ABI. The Universal Driver Architecture should become one of
  the largest parts of UCH"; "every release must certify against
  VSCode/Cursor/Codex/Claude Code/OpenCode/JetBrains/Gemini CLI/Neovim/
  Zed/GitHub/GitLab/Azure/Linux/Windows/macOS — automatic compatibility"
- **Related:** src/drivers (acp, agent, filesystem, git, ide, mcp,
  runtime + sensors/effectors), CIC v0.1 (driver contract),
  src/drivers/compliance.ts (L0–L4 certification),
  conformance.ts (server-side certification), design/integrations/,
  ADR-005 (universal protocol), CI/CD (GitHub Actions matrix)

## Motivation

The driver architecture and the CIC contract exist; compliance
certification exists per driver. The claim: make the driver ecosystem
a first-class product surface — a per-host adapter catalog (every IDE
and CLI listed above implements the same Cognitive ABI) and an
*automated interoperability lab*: every release runs a certification
matrix (hosts × OSes) as a CI gate, so compatibility is proven, not
claimed.

## The corpus cannot cover it because

Per-IDE adapters beyond the existing core set are not built; no
automated cross-host certification matrix exists in CI; third-party
driver contribution has no add-to-catalog process.

## Proposal sketch

- Driver SDK: golden tests + compliance scaffolding so a new host
  adapter ships with its certification suite.
- Interoperability lab: CI release gate running conformance +
  compliance matrices per host/OS; a "certified" badge per driver
  release (echoes driver compliance.certificateLine()).

## Risk assessment

- Maintenance sprawl: without a driver SDK and golden tests, per-host
  certification becomes unmaintainable; automation is the constraint.

## Where it lands

- Extends design/integrations/ + compliance.ts; design doc
  `design/DRIVER-ECOSYSTEM.md`.

## Code impact

- None until the certification matrix is specified; first step is
  running existing drivers through a mock matrix.

## Next stage

Define the certification matrix over existing drivers; prototype the
driver SDK contract with one golden test suite.
