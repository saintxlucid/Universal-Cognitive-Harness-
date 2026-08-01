# IDEA-0098 — Universal Compatibility Matrix (UCM) + Certification Registry

- **Status:** Idea (SOP-08 stage 1, 2026-08-01 — no code)
- **Origin:** 2026-08-01 compatibility-layer intake (round 14) — "rather
  than hard-coding integrations, introduce a Universal Compatibility
  Matrix (UCM) as a first-class specification: every supported platform
  is evaluated against the same dimensions (MCP, CLI, SDK, Context
  Files, Skills, Subagents, Workspace Sync, Tool Calling, Streaming).
  The matrix becomes a living artifact of the project." Plus the
  certification claim: instead of "Supports Cursor", create **UCH
  Compatible / UCH Native / UCH Enterprise / UCH Verified / UCH
  Certified** — each requiring conformance testing — and a dedicated
  documentation repository (`uch-compatibility/` with providers, ides,
  sdk, protocols, examples, benchmarks, migration, reference,
  compliance; per platform: installation, authentication, adapter,
  capability mapping, limitations, performance, security model, example
  projects, certification status).
- **Related:** design/integrations/COMPATIBILITY-MATRIX.md v1.0
  (evidence layer, dated web research), design/ECOSYSTEM-
  COMPATIBILITY.md (strategy), src/drivers/compliance.ts (driver
  certification L0–L4: certified/partial/not-certified),
  src/protocol/conformance.ts (server-side certification), src/protocol/
  catalog.ts (op metadata), design/INTEGRATION-LEVELS.md (per-level
  conformance criteria), IDEA-0048 (consolidated normative spec),
  IDEA-0073 (contracts registry), WS-P package certification
  (certification-before-listing), IDEA-0058 (marketplace)

## Motivation

Compliance exists and is real: `scoreCompliance` certifies UCH's
**drivers** (Claude, Codex, OpenCode, VS Code) against CP ops and
declared integration levels — the UCH-to-host direction. The intake's
claim inverts the lens: **certify third-party products** against a
living compatibility matrix — the host-to-UCH direction. "UCH
Certified" on a product's page becomes a computed, conformance-tested
statement about _its_ surface (what it exposes: MCP? CLI? SDK? context
files? skills? subagents? workspace sync? tool calling? streaming?),
not a UCH marketing claim. The matrix is the one artifact that makes
"UCH is the compatibility layer every AI tool can target" testable:
any product can be scored against the same nine dimensions, and the
score is a living artifact updated as the ecosystem changes.

## The corpus cannot cover it because

- compliance.ts certifies **UCH's own drivers** with verdicts
  certified/partial/not-certified; nothing certifies an _external_
  product's compatibility surface. The five-brand ladder (Compatible →
  Native → Enterprise → Verified → Certified) has no definition, no
  conformance requirement mapping, no registry.
- COMPATIBILITY-MATRIX.md is evidence (who supports what, dated); it is
  not a **normative matrix spec** with a stable dimension set, a schema
  for machine-readable claims, and a conformance suite a product runs
  to earn a brand.
- The documentation-repo structure (installation, authentication,
  adapter, capability mapping, limitations, performance, security model,
  examples, certification status per platform) exists piecemeal across
  design/integrations/*.md; it is not a prescribed, uniform per-platform
  template that certification requires.

## Proposal sketch

- **UCM v1**: nine normative dimensions (MCP, CLI, SDK, Context Files,
  Skills, Subagents, Workspace Sync, Tool Calling, Streaming) each with
  a machine-readable claim schema (`uch.compatibility-claim.v1`:
  platform, version, dimension, level L0–L4 or transport T0–T4,
  evidence link, conformance result). The matrix = the set of claims +
  the conformance runner; it remains a living artifact (re-scored on
  ecosystem change, per the COMPATIBILITY-MATRIX evidence base).
- **Brand ladder**: UCH Compatible (dimension claims verified ≥ 1
  surface, e.g. MCP-only), UCH Native (first-class adapter per UCCL
  IDEA-0096 with the ten-method contract passing conformance), UCH
  Enterprise (Native + Green/Yellow zone declaration per CIP IDEA-0097
  and auditability), UCH Verified (conformance suite passes
  deterministically on a declared version), UCH Certified (Verified +
  published UCM claim + certification registry entry). Brands compose:
  Certified is the top, Enterprise and Verified are orthogonal
  qualifiers.
- **Registry**: WS-P-style certification registry (certificate =
  claim + conformance artifact hash + expiry/re-evaluation policy);
  certification-before-listing applies if UCH products reach a
  marketplace (IDEA-0058).
- **Docs**: uniform per-platform template (the nine sections above) as
  the required format for every certification entry, generated from the
  claim schema where possible.

## Risk assessment

- Certification theater: a brand with no test is a sticker — every
  brand must resolve to a deterministic conformance run (no LLM in the
  loop), mirroring driver compliance.
- Matrix churn: dimensions must be additive and versioned (the matrix
  itself gets a version; claims pin the version they scored against).
- Over-scoping: the registry certifies _compatibility claims_, not
  product quality — the Security model section documents the product's
  own model, it does not endorse it.

## Where it lands

- `spec/` (UCM.md + claim schema), conformance extension
  (src/drivers/compliance.ts or a sibling external-compliance module),
  certification registry (WS-P store), `docs/uch-compatibility/`
  template set.

## Code impact

- None until the spec is drafted; seeds are compliance.ts,
  conformance.ts, COMPATIBILITY-MATRIX.md, WS-P registry.

## Next stage

- Research: dimension definitions with evidence (the nine dimensions
  against the 23-harness evidence base), brand criteria; prototype:
  score two existing products (e.g. OpenCode and Cursor) against UCM
  v1 as first certification entries.
