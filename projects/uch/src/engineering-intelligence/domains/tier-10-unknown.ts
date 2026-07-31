/**
 * Tier X — Unknown-Unknown Discovery.
 *
 * The invented feature: instead of only answering questions, the
 * harness actively searches for things nobody asked — hidden
 * assumptions, missing abstractions, silent debt, scalability limits,
 * security blind spots, dead code, duplicate concepts, inconsistent
 * terminology, migration risks.
 */

import type { EngineeringConcept, TierId } from '../types.js';

const TIER: TierId = 'tier-10-unknown';

const C = (
  id: string,
  name: string,
  family: string,
  definition: string,
  signals: string[],
  triggers: string[],
  guidance: string[],
  antiPatterns: string[],
  provenance: string[],
): EngineeringConcept => ({
  id: `unknown.${id}`,
  tier: TIER,
  name,
  family,
  definition,
  signals,
  triggers,
  guidance,
  antiPatterns,
  weight: 1,
  provenance,
});

const UNKNOWN = ['Unknown-unknown discovery canon: postmortem analysis, architecture review practice'];

export const TIER_10_UNKNOWN_CONCEPTS: EngineeringConcept[] = [
  C(
    'hidden-assumptions',
    'Hidden Architectural Assumptions',
    'discovery',
    'Beliefs the code depends on but nobody wrote down: single-writer, in-order delivery, no concurrency, local-only.',
    ['assumption', 'implicit', 'assumes'],
    ['assume', 'implicit', 'tacit'],
    ['Enumerate the invariants the design relies on and test the cost of violating each.'],
    ['Assumptions that become incidents on first real-world violation.'],
    UNKNOWN,
  ),
  C(
    'missing-abstractions',
    'Missing Abstractions',
    'discovery',
    'Repeated patterns that never became a named concept; the code speaks the pattern but no one can point at it.',
    ['duplicated logic', 'copy paste', 'repeated'],
    ['duplicate', 'copy', 'same pattern'],
    ['Find concepts repeated three times without a name; the abstraction is missing, not the discipline.'],
    ['Triplicated logic celebrated as "explicitness".'],
    UNKNOWN,
  ),
  C(
    'silent-debt',
    'Silent Technical Debt',
    'discovery',
    'Debt with no ticket, no owner, no expiry: the kind that never gets paid because nobody admitted taking it.',
    ['silent debt', 'untracked', 'unlisted'],
    ['temporary', 'hack', 'later'],
    ['Surface unrecorded shortcuts in review; every workaround needs a tracking issue.'],
    ['"We\u2019ll fix it later" with no record and no date.'],
    UNKNOWN,
  ),
  C(
    'scalability-limits',
    'Potential Scalability Limits',
    'discovery',
    'The load at which the design breaks, and whether that load is plausible — usually visible before it is real.',
    ['scalability', 'limit', 'max'],
    ['scale', 'max', 'cap', 'concurrency'],
    ['Estimate the breaking point (requests, rows, connections) and compare with plausible growth.'],
    ['"It won\u2019t matter" with no number attached.'],
    UNKNOWN,
  ),
  C(
    'security-blind-spots',
    'Security Blind Spots',
    'discovery',
    'Attack surfaces nobody modeled: trust boundaries that cross input, credentials in logs, unauthenticated internals.',
    ['security', 'auth', 'trust'],
    ['auth', 'token', 'input', 'trust'],
    ['Map the trust boundary and every input that crosses it; review for credential and PII leakage.'],
    ['Trusting internal interfaces; logging payloads with credentials.'],
    ['OWASP ASVS'],
  ),
  C(
    'dead-code',
    'Dead Code',
    'discovery',
    'Code nobody can reach or reference; it misleads readers, bloats review, and accumulates security risk.',
    ['dead code', 'unused', 'unreachable'],
    ['unused', 'legacy', 'never'],
    ['Remove unreferenced exports and branches; coverage reports help find the reachable, not the used.'],
    ['Keeping "just in case" code with no caller.'],
    UNKNOWN,
  ),
  C(
    'duplicate-concepts',
    'Duplicate Concepts',
    'discovery',
    'The same concept implemented twice under different names; divergence is inevitable and confusing.',
    ['duplicate', 'two implementations'],
    ['also', 'another', 'same'],
    ['Search for concept pairs (parsers, validators, config loaders) and consolidate or alias them.'],
    ['Second implementations "because the first is hard to change".'],
    UNKNOWN,
  ),
  C(
    'inconsistent-terminology',
    'Inconsistent Terminology',
    'discovery',
    'One concept, many words (order/invoice/purchase); one word, many concepts — the tax is paid in bugs.',
    ['terminology', 'naming', 'vocabulary'],
    ['name', 'term', 'call it'],
    ['Maintain a shared vocabulary; rename early when terms collide.'],
    ['Synonyms in the codebase for the same entity; the same term for different entities.'],
    ['Ubiquitous language practice (DDD)'],
  ),
  C(
    'migration-risks',
    'Future Migration Risks',
    'discovery',
    'Choices that will make a likely future move expensive: formats, vendors, and schemas with no exit ramp.',
    ['migration', 'exit ramp', 'future'],
    ['migrate', 'future', 'vendor'],
    ['Ask "what makes this hard to leave?" for each foundational choice and price the exit.'],
    ['Foundational lock-in discovered at migration time.'],
    UNKNOWN,
  ),
];

export function tier10UnknownConcepts(): EngineeringConcept[] {
  return TIER_10_UNKNOWN_CONCEPTS.map((c) => ({ ...c }));
}
