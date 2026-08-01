# IDEA-0058 — Cognitive Marketplace

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Phase Ω platform infrastructure) —
  "People won't only share plugins. They'll share brains, genomes,
  personalities, engineering standards, constitutional packs,
  architecture packs, verification packs, organizational knowledge.
  Like Docker Hub. But for cognition"
- **Related:** WS-P cognitive packages (src/kernel/packages — validation,
  quarantine, tamper detection), IDEA-0019 (operating contracts),
  IDEA-0054 (driver ecosystem + certification), IDEA-0048 (spec-first
  packaging), IDEA-0053 (constitution engine), IDEA-0027 (sociology —
  trust and reputation), spec/GENOME.md

## Motivation

WS-P installs and quarantines local packages; the driver ecosystem
(IDEA-0054) certifies hardware. The claim: a *distribution* layer —
publish, discover, version, provenance, trust — for organs, genomes,
constitutional packs, architecture packs, and verification packs. This
is what turns "third parties may extend the platform" into an
ecosystem. Constitutional packs carry governance weight, so their
distribution must be governance-gated, not merely virus-scanned.

## The corpus cannot cover it because

WS-P has no publishing, no registry, no trust layer, and no distribution
of genomes or constitutional packs; IDEA-0019 certifies contracts but
does not distribute them; nothing lets a third party *share* a brain or
a pack with provenance and reputation.

## Proposal sketch

- Registry with signed packages (sha256 exists in WS-P), provenance
  chain (who published, which conformance/compliance verdicts the pack
  was certified against), trust + reputation per IDEA-0027.
- Certification precedes listing (interop lab, IDEA-0054/0019);
  constitutional packs must pass the constitution engine (IDEA-0053)
  on install — mirroring the WS-P rule that no package can
  auto-modify the Constitution, a pack may never *weaken* a Law.

## Risk assessment

- Governance erosion: a marketplace selling "relaxed constitutions" is
  a security hole. Certification-before-listing and constitution-gated
  install are non-negotiable; the registry must be reviewable.

## Where it lands

- Design doc `design/MARKETPLACE.md`; extends WS-P + IDEA-0054.

## Code impact

- None until the registry schema and certification rules are specified.

## Next stage

- Registry schema; signed provenance; certification-before-listing rule
  drafted against WS-P's existing validation.
