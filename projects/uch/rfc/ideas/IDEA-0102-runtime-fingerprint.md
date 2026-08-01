# IDEA-0102 — Runtime Fingerprint (CPUID for Cognitive Runtimes)

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 abstraction-layer intake (round 15) — "instead
  of hardcoding support, fingerprint the runtime, like how CPUs expose
  CPUID. Every application has its own behavior: Claude Code exposes
  hooks/skills/agents/MCP/checkpoints; Cursor exposes rules/composer/
  agent mode/background tasks; GitHub Copilot exposes workspace/
  actions/PRs/issues/agent. These are no longer applications; they are
  miniature operating systems — integrate with their microkernels."
- **Related:** IDEA-0099 (capability scanner — the probing mechanism;
  the fingerprint is its output artifact), IDEA-0096 (UCCL — the
  fingerprint is what `capabilities()` and `discover()` in the
  ten-method contract answer), IDEA-0098 (UCM — fingerprint claims feed
  the matrix), design/INTEGRATION-LEVELS.md (per-rail level map — the
  fingerprint's semantic core), design/integrations/CLAUDE-CODE.md +
  OPENCODE.md + CODEX.md + vscode-copilot.md (hand-written per-runtime
  behavior catalogs — what the fingerprint automates),
  design/ECOSYSTEM-COMPATIBILITY.md (first-wave adapter table),
  ADR-005 (UCP), src/drivers/ (driver manifests with `level_claims`)

## Motivation

UCH knows its own drivers and their declared levels. What it does not
have is a machine-readable description of **the host's behavior
surface** — the exact set of extension points, session artifacts,
checkpoint mechanisms, background-agent capabilities, and context
files a given runtime exposes at a given version. Today that knowledge
lives in hand-written integration docs and per-runtime capture code.
The intake's claim: a runtime can be _fingerprinted_ — enumerated at
install time into a stable, versioned document that answers "what
behavior surfaces does this runtime expose, at what maturity" — the
way CPUID enumerates CPU features. Claude Code is not "supported";
its fingerprint (hooks ✓, skills ✓, subagents ✓, MCP ✓, checkpoints ✓,
slash commands ✓, IDE bridges ✓, background agents ✓) is read, and the
adapter + capture plan are derived from the fingerprint alone.

## The corpus cannot cover it because

- Driver manifests declare UCH's _claims about itself_ (`level_claims`);
  nothing enumerates the _host's_ actual surface from its on-disk and
  runtime artifacts into one stable document. INTEGRATION-LEVELS §6 is
  a hand-verified snapshot table; it is not a per-install,
  per-version enumerated artifact.
- design/integrations/*.md are prose catalogs written by humans per
  runtime; they encode the same information a fingerprint would encode,
  but as documentation to read, not data to consume. The scanner
  (IDEA-0099) probes surfaces; it has no schema for the _result_.
- The "miniature operating system" framing (each tool exposing hooks +
  skills + agents + MCP + checkpoints) is observed in the integration
  docs but never normalized: there is no taxonomy of behavior surfaces
  a fingerprint enumerates (extension-point family × capability ×
  maturity).

## Proposal sketch

- **Fingerprint document** `uch.runtime-fingerprint.v1`: `{runtime,
version, family, surfaces: [{kind (hooks/skills/subagents/rules/
composer/agent-mode/checkpoints/background-agents/slash-commands/
IDE-bridge/MCP/workspace-awareness/…), exposed (yes/no/partial),
mechanism (file/API/CLI/port), artifacts (paths, schemas),
maturity (per INTEGRATION-LEVELS L0–L4)}], extensions, models,
context-files, auth-model, fingerprint-hash}` — produced by the
  scanner (IDEA-0099) probing the installed runtime, validated against
  a behavior-surface taxonomy, and versioned per runtime version.
- **Consumption**: `discover()`/`capabilities()` of the UCCL contract
  (IDEA-0096) answer from the fingerprint; the adapter compiler
  (IDEA-0104) consumes it as its input manifest; UCM claims
  (IDEA-0098) cite it as evidence; capture rails (UNIVERSAL-
  INTEGRATION) select the tail per fingerprint rather than per
  hard-coded runtime.
- **Living artifact**: re-fingerprint on runtime update (continuous-
  understanding pattern); fingerprint deltas (v12 → v13) become
  compatibility-change signals for the UCM matrix.

## Risk assessment

- Fingerprint false confidence: a fingerprint enumerates _presence_,
  not _behavioral truth_ — every claim must be ratified by handshake
  at connect (Cognitive BIOS, IDEA-0103) before use; never assume
  from the document alone.
- Version churn: fingerprints must pin runtime versions and re-scan on
  change; a stale fingerprint is worse than none.
- Scope: fingerprinting reads public surfaces only (Green zone per
  IDEA-0097); it never probes private internals.

## Where it lands

- `src/drivers/fingerprint/` (taxonomy + schema + emitters per surface
  family), validated against the hand-written integration docs; UCM
  evidence feed.

## Code impact

- None until designed; seeds are the scanner probes (IDEA-0099),
  driver manifests, INTEGRATION-LEVELS table, integration docs.

## Next stage

- Prototype: emit `uch.runtime-fingerprint.v1` for one installed
  runtime (e.g. OpenCode: config + part-storage + MCP list + plugin
  events); assert the document reproduces the hand-written OPENCODE.md
  catalog.
