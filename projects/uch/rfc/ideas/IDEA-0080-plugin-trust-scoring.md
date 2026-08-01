# IDEA-0080 — Plugin Trust Scoring

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** 2026-08-01 microscopic-infrastructure intake (round 11) —
  "Plugins shouldn't be trusted automatically. Every plugin gets Trust
  Score, Quality Score, Security Score, Performance Score,
  Compatibility Score, Maintenance Score. Then the organism decides."
- **Related:** src/kernel/packages/ (WS-P — validation, sha256/hash,
  policy quarantine, tamper detection; no package may auto-modify the
  Constitution), IDEA-0058 (cognitive marketplace — certification
  before listing), src/engineering-intelligence/benchmark (evidence-
  driven evaluation), IDEA-0073 (contracts registry — verification
  verdicts as score inputs), IDEA-0027 (sociology — reputation from
  conformance evidence, not claims), IDEA-0022 (architecture review
  board — lens registry with evidence), src/cognitive-core/immune.ts
  (antibody promotion for detected infections), compliance
  certification (L0–L4)

## Motivation

Security is not "trusted or not" — it is a gradient with evidence.
Mature ecosystems (package registries, browser extensions, app stores)
score maintainers and packages on multiple axes so the *organism*
decides: a high-trust low-quality plugin and a low-trust high-quality
plugin need different treatment. WS-P already validates and quarantines;
the marketplace (IDEA-0058) already requires certification-before-
listing. What neither has is a *scorecard* — six axes (trust, quality,
security, performance, compatibility, maintenance) computed from
evidence and consulted at load time.

## The corpus cannot cover it because

WS-P's gate is binary (valid/invalid, quarantine/no) — there is no
graded score and no evidence history; IDEA-0058's certification is a
listing requirement, not a runtime consultation; compliance certifies
drivers against protocol levels, not plugins against quality; the
immune organ reacts to infections after they occur. Nothing computes
"this plugin is excellent but unmaintained — load with review" or
"this plugin is new but from a trusted genome — load with monitoring".

## Proposal sketch

- A six-axis scorecard: trust (provenance + signer reputation per
  IDEA-0027), quality (contract-conformance verdicts per IDEA-0073,
  review-board findings per IDEA-0022), security (WS-P validation +
  immune history + audit results), performance (benchmark results per
  ADR-003), compatibility (compliance level + capability negotiation
  per IDEA-0068), maintenance (commit/response cadence from the
  engineering database IDEA-0051).
- Load-time policy: scores gate loading with graded actions (allow /
  allow-with-monitoring / allow-in-sandbox / deny) and feed the
  organism's decision — the organism decides, per the intake.
- Scores are evidence-derived, versioned (IDEA-0069), and journaled;
  a plugin's score history is lineage (IDEA-0076).

## Risk assessment

- Score gaming: a score derived from self-claimed data is worthless.
  Every axis must source from *independent* evidence (verification
  runs, not declarations); the marketplace's certification-before-
  listing rule (IDEA-0058) remains the floor.

## Where it lands

- `design/PLUGIN-TRUST.md`; extends WS-P + IDEA-0058; consumes the
  contracts registry and benchmark runner.

## Code impact

- None until the scorecard schema and load-time policy are specified.

## Next stage

- Six-axis schema drafted; one real package scored as validation
  against WS-P's existing validation outputs.
