# COGNITIVE-PACKAGES.md — Cognitive Packages: Format and Governance Rule

- **Status:** Approved design ([ADR-005](ADR-005-universal-cognitive-protocol.md) Amendment A)
- **Date:** 2026-08-01
- **Scope:** The distributable unit of the substrate — drivers, skills, policies,
  instruments — and the governance rule that makes installing one a governed act,
  never ambient execution.
- **Prerequisites:** [ADR-001](ADR-001-workspace-owned-cognitive-runtime.md)
  (attachment is negotiated activation, never hidden interception),
  [ADR-005](ADR-005-universal-cognitive-protocol.md) (the three-layer split),
  [COGNITIVE-TRACE.md](COGNITIVE-TRACE.md) (what a driver emits),
  [WORKSPACE-MANIFEST.md](WORKSPACE-MANIFEST.md) (capability + driver negotiation)
- **Companions:** [COGNITIVE-MIDDLEWARE.md](COGNITIVE-MIDDLEWARE.md) (the pipeline a
  package's events ride), [INTEGRATION-LEVELS.md](INTEGRATION-LEVELS.md) (level
  claims), [THREAT-MODEL.md](THREAT-MODEL.md) (T13 dependency confusion)

## 1. Purpose

Drivers (harnesses), skill packs, policy packs, and instrumentation ship as
**Cognitive Packages**: self-describing, versioned, signed units that the substrate
installs through a governed pipeline. A package is how new cognition enters the
organism without bespoke wiring — and how the substrate stays decidable about what
ran, when, under which grant, and with what authority.

> A Cognitive Package is never ambient code. It is a declared, signed, scoped,
> reviewable, and revocable capability.

## 2. Package kinds

| Kind | Contents | Installed by | Consumed by |
|---|---|---|---|
| `driver` | Per-ecosystem adapter (hooks config, plugin, extension shim, tailer) + manifest | `uch package install` | The middleware ingress rails |
| `skill` | SKILL.md bodies + triggers + provenance | `uch skill import` (existing pipeline) | The skill registry, augment planes |
| `policy` | Policy rules, permission stances, limits | governed policy load | `src/control-plane/policies.ts` |
| `instrument` | OTel exporters, telemetry schemas, dashboard packs | user-registered projection | OtelBridge / monitoring |

## 3. Package format (`uch.package.v1`)

A package is a directory (or signed archive) containing one manifest and payload
files. The manifest is the contract:

```jsonc
{
  "schema": "uch.package.v1",
  "name": "uch-driver-opencode",
  "version": "1.2.0",                    // semver
  "kind": "driver",                      // driver | skill | policy | instrument
  "entry": "src/index.js",               // driver main; null for pure-data kinds
  "level_claims": {                      // per-rail integration levels (INTEGRATION-LEVELS.md §4)
    "hooks": 4, "cot": 3, "otel": 0
  },
  "requires": {
    "substrate": ">=0.2.0",              // runtime version floor
    "packages": ["uch-skills-core@^1.0.0"]
  },
  "capabilities": ["observe:workspace", "retrieve:cognitive-state"],  // CIC operation families
  "permissions": ["read:session-digest"], // requested grant extensions — never implicit
  "retention": { "reasoning_days": 30 },  // defaults per PRIVACY-ERASURE.md
  "provenance": {
    "author": "…",
    "signature": "ed25519:<base64>",      // signature over the payload manifest (THREAT-MODEL T13)
    "source": "https://…/tarball/<sha256>",
    "published_at": "ISO8601"
  },
  "payload": ["src/…", "hooks/…", "SKILL.md", "policies/…"]
}
```

Rules of the format:

- **Everything is declared.** Entry points, capabilities, permissions, level
  claims, retention, and dependencies appear in the manifest or the package is
  malformed.
- **Capabilities are requests, not rights.** Installation intersects requested
  capabilities with the workspace manifest and the installing actor's grant
  (WORKSPACE-MANIFEST.md negotiation); discovery never implies authority.
- **No hidden execution.** A package has no post-install hooks; it becomes active
  only when a driver session attaches under a grant.
- **Signature and hash are mandatory** for anything that executes; data-only
  packages (policies, skills) require at least the content hash.

## 4. The governance rule

> **No Cognitive Package executes, augments, or persists until it has passed the
> package gate.** The gate is: signature verified, content hash matched, dependency
> closure resolved and clean, capability intersection granted, level claims
> consistent with the manifest and the host's declared levels, and no veto
> standing. Every install, update, and revocation is a governed event with
> provenance.

1. **Governed install.** `uch package install` runs the gate; installs are
   versioned and atomic (a failed gate leaves the previous version in place).
   Install/update/remove are audited events on the neural event bus.
2. **Intersection, not delegation.** A package's runtime authority is the
   intersection of (requested capabilities) × (grant) × (workspace manifest) —
   the same projection discipline as attachment (PROJECTIONS.md).
3. **Level claims are promises.** A driver package may claim L4 on a rail only
   when the INTEGRATION-LEVELS.md §5 conformance criteria pass for that rail; the
   substrate serves the highest *verified* level, never the claimed one.
4. **Veto and review.** Security, sovereignty (local-first law), and
   constitutional-review vetoes can block an install. Vetoes are recorded with
   evidence (Law 4) and are observable as `governance:package_denied` events.
5. **Revocability.** Any package can be revoked at runtime; revocation stops new
   execution and drains active sessions, with the event logged (Law 12).
6. **Cognition ownership (Law 19).** A package never owns the cognition it
   observes, translates, or augments. Its traces belong to the organism; its
   author holds no claim over workspace memory, episodes, or derived knowledge.
   A package that attempts to exfiltrate, fork, or claim cognition is malformed
   and its install is vetoed.
7. **Sovereignty of the ledger.** Packages may write only through the governed
   event path (EVENT-GOVERNANCE.md); direct ledger writes are structurally
   impossible for packages.

## 5. Relationship to existing machinery

- The **SkillPack** pipeline (`src/skills/skillpack.ts`, `skill-catalog.ts`) is the
  `skill` kind of this format; the package gate supersedes nothing, it
  standardizes provenance (`.import-index.json` precedent).
- The **plugin loader** (`src/control-plane/plugins/plugin-loader.ts`) becomes the
  `driver`-kind runtime for in-process plugins, behind the same gate.
- The **workspace manifest** (`uch.manifest.v1`) is where installed package
  references are recorded for negotiation — packages are a sourcing mechanism for
  drivers, skills, and policies, not a new identity layer.

## 6. Verification

- Gate fixtures: signed + clean → installed; unsigned → rejected; capability
  outside grant → rejected; level claim above verified capability → served at the
  verified level; veto → blocked with recorded evidence.
- Atomicity: a failing gate leaves the prior version byte-identical.
- Audit: every install/update/revoke emits a governed event; the audit ledger
  replays the full package history of a workspace.
- Threat T13 (dependency confusion): signature + source hash verification is
  asserted against a planted impostor package.
- Existing suite stays green — this document changes no code.
