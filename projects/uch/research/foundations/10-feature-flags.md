---
track: protocol
status: research-draft
version: 0.1.0
sources:
  - https://martinfowler.com/articles/feature-toggles.html (Fowler 2010 — feature toggles: kill switches, progressive rollout)
  - https://continuousdelivery.com/ (Humble & Farley 2010 — feature toggles as a release technique)
  - https://docs.launchdarkly.com/guides/flags/rollouts (LaunchDarkly — percentage rollouts, sticky bucketing)
  - https://semver.org/ (SemVer 2.0.0 — semantic versioning for cognitive artifacts)
  - https://peps.python.org/pep-0387/ (PEP 387 — Python backward compatibility policy: announce → warn → remove)
  - https://nodejs.org/en/about/previous-releases (Node.js release/LTS lifecycle — deprecation schedules in practice)
---

# Feature Flags, Versioned Cognition & Deprecation — G1 evidence register (IDEA-0069)

Evidence register for `rfc/ideas/IDEA-0069-cognitive-feature-flags.md`:
every organ, neuron, skill, and accelerator individually enabled with
progressive rollout; semantic versioning extended from code to
cognition; graceful retirement of old reasoning.

## 1. Feature flags — progressive rollout and kill switches

| Evidence | Source |
| --- | --- |
| Feature toggles separate *release* from *deployment*: a capability ships dark, is enabled per-environment/per-user, and can be killed without redeployment | Fowler (2010); Humble & Farley (2010) |
| Percentage rollouts need *sticky* assignment — a given user sees a consistent state across requests — which is done by deterministic bucketing (hash of user key), not randomness | LaunchDarkly rollout documentation |
| Kill switches are the operational justification: the cost of a flag is tiny; the cost of a bad release without one is an outage | Fowler (2010), operational practice |

**Corpus anchor:** runtime knobs today are budgets and policy checks
(`src/control-plane/budgets`, the policy engine); grep confirms zero
feature-flag semantics in `src/`. The prototype supplies the flag
registry + deterministic bucketing.

## 2. Semantic versioning for cognition

| Evidence | Source |
| --- | --- |
| SemVer fixes when a change is breaking (major), additive (minor), or corrective (patch); the contract makes dependency ranges safe | SemVer 2.0.0 |
| The corpus already applies this to specs (spec/VERSION.md), genomes (WS-C VersionedStore), and laws (numbers immutable) | Corpus anchors |
| The claim: the same discipline applies to beliefs, skills, reasoning strategies, and memory schemas — a belief's version is part of its lineage (IDEA-0076) | Prototype claim |

**Corpus anchor:** `src/cognitive-plane/protocol/capability-protocol.ts`
has a `LifecycleStage` including `deprecated` and `retired`;
`src/workspace-brain/genome.ts` counts `deprecation_warnings`. The
prototype makes the lifecycle *enforced* rather than descriptive.

## 3. Deprecation — announce, warn, then remove

| Evidence | Source |
| --- | --- |
| Python's backward-compatibility policy: features are deprecated for a release, emit warnings, then are removed in a later major — removal is never silent | PEP 387 |
| Node.js LTS publishes deprecation schedules with end-of-life dates; consumers get warning windows | Node.js release lifecycle |
| The deprecation *window* is part of the contract: users must be able to migrate before removal, and removal must be replayable (ledger) | Prototype claim |

**Corpus anchor:** capability-protocol.ts and genome.ts carry
deprecation *state*; nothing executes a schedule (announce → warn →
migrate → remove). The prototype's deprecation engine is that missing
execution layer, with removal keeping a replayable record per
IDEA-0069's "old reasoning retires gracefully".

## Prototype claims

- Deterministic sticky bucketing: same agent + flag → same state across
  evaluations (hash-based, no randomness).
- Inheritance: a flag defaults from its parent namespace; overrides are
  explicit.
- Deprecation schedule: `active → deprecated (warn) → sunset (warn +
  countdown) → removed (disabled with migration hint)`, transitions
  validated in order, each journaled.
- Versioned cognition: capabilities carry semver; breaking changes
  require a major bump, and consumers negotiate (IDEA-0068) rather
  than silently break.
