/**
 * Tier V — Engineering Economics.
 *
 * Almost completely absent from current AI coding agents: reasoning
 * about development cost, infrastructure cost, operational cost,
 * maintenance cost, lock-in, migration, risk-adjusted ROI, build vs
 * buy, and lifetime ownership.
 */

import type { EngineeringConcept, TierId } from '../types.js';

const TIER: TierId = 'tier-05-economics';

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
  id: `econ.${id}`,
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

const ECON = ['Software Engineering Economics — Boehm'];
const SRE_REF = ['Google SRE Book'];

export const TIER_05_ECONOMICS_CONCEPTS: EngineeringConcept[] = [
  C(
    'dev-cost',
    'Development Cost',
    'cost',
    'The cost of building: engineering time, tooling, review, testing, and the opportunity cost of the team.',
    ['development cost', 'engineering time', 'effort'],
    ['estimate', 'milestone', 'build'],
    ['Estimate build effort in engineer-months, not features; include review and test time.'],
    ['"It\u2019s just a wrapper" estimates that ignore integration and maintenance.'],
    ECON,
  ),
  C(
    'infra-cost',
    'Infrastructure Cost',
    'cost',
    'The cost of the machinery the system needs: compute, storage, network, and the people who run them.',
    ['infrastructure cost', 'provision', 'cluster'],
    ['deploy', 'cluster', 'server'],
    ['Quote infra in monthly totals with growth; compare self-host vs managed honestly.'],
    ['"Free" self-hosted systems with unstaffed operations.'],
    ['AWS pricing models; Boehm'],
  ),
  C(
    'cloud-cost',
    'Cloud Cost',
    'cost',
    'Variable consumption pricing: the bill follows request shape, data size, and retention — not your code size.',
    ['cloud cost', 'pricing', 'egress'],
    ['cloud', 'storage', 'lambda', 'request'],
    ['Model the unit economics per request (compute × duration + egress + storage × retention).'],
    ['Designing for cost after the architecture is fixed; ignoring egress.'],
    ['Well-Architected Cost pillar'],
  ),
  C(
    'operational-cost',
    'Operational Cost',
    'cost',
    'Running the thing: on-call, incident response, upgrades, and toil — a recurring tax on every feature.',
    ['operational cost', 'toil', 'on call'],
    ['runbook', 'oncall', 'maintenance'],
    ['Add operational load to every feature estimate; prefer self-healing and automated operations.'],
    ['Features shipped with no runbook; manual ops repeated monthly.'],
    SRE_REF,
  ),
  C(
    'maintenance-cost',
    'Human Maintenance Cost',
    'cost',
    'The dominant lifecycle cost: every line is read, understood, and modified many times by humans.',
    ['maintenance cost', 'readability', 'understand'],
    ['refactor', 'legacy', 'support'],
    ['Optimize for the reader\u2019s lifetime cost, not the writer\u2019s one-time cost.'],
    ['Cleverness that saves writing time and costs reading time forever.'],
    ['GitClear Maintainability Gap 2026; Boehm'],
  ),
  C(
    'vendor-lock-in',
    'Vendor Lock-In',
    'risk',
    'Switching costs that accumulate with proprietary APIs, formats, and managed services.',
    ['lock in', 'vendor', 'proprietary'],
    ['vendor', 'managed service', 'api'],
    ['Price the exit: can you leave in a week, a quarter, a year? Standard interfaces keep the option open.'],
    ['Proprietary formats for core data; managed services with no abstraction seam.'],
    ['DDIA'],
  ),
  C(
    'migration-cost',
    'Migration Cost',
    'risk',
    'The cost of moving: data, behavior parity, cutover, and dual-run — usually the hidden half of any rebuild.',
    ['migration cost', 'cutover', 'dual run'],
    ['migrate', 'rewrite', 'move'],
    ['Include data migration, parity testing, cutover, and rollback in any rebuild estimate; they routinely exceed the build.'],
    ['"Rewrite it better" with no migration plan; abandoning dual-run too early.'],
    ['Joel Spolsky, Things You Should Never Do'],
  ),
  C(
    'risk-roi',
    'Risk-Adjusted ROI',
    'risk',
    'Expected return discounted by probability and impact of failure — the honest frame for every investment.',
    ['roi', 'risk adjusted', 'expected value'],
    ['invest', 'roadmap', 'decision'],
    ['Score options as probability-weighted value; compare the risk-adjusted option, not the dream scenario.'],
    ['Best-case ROI; ignoring failure probability and recovery cost.'],
    ECON,
  ),
  C(
    'build-vs-buy',
    'Build vs Buy',
    'decision',
    'The oldest software economics question: buy is usually cheaper until the seams you need don\u2019t exist.',
    ['build vs buy', 'vendor', 'off the shelf'],
    ['license', 'library', 'vendor'],
    ['Cost the full buy path (integration, maintenance, lock-in) against the full build path (build, test, maintain, ops).'],
    ['"Not invented here" builds of commodity functionality; buy without exit-cost analysis.'],
    ECON,
  ),
  C(
    'lifetime-ownership',
    'Lifetime Ownership Cost',
    'cost',
    'Total cost over the system\u2019s life: build + run + maintain + migrate + decommission.',
    ['lifetime cost', 'total cost', 'tco'],
    ['architect', 'platform', 'decision'],
    ['Estimate 5-year TCO before platform decisions; the 10x cost is usually operations and change, not the first build.'],
    ['First-year cost as the decision metric; ignoring decommissioning.'],
    ['Boehm; TCO analysis canon'],
  ),
];

export function tier05EconomicsConcepts(): EngineeringConcept[] {
  return TIER_05_ECONOMICS_CONCEPTS.map((c) => ({ ...c }));
}
