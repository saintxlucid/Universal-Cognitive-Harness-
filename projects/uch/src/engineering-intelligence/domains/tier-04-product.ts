/**
 * Tier IV — Product Thinking.
 *
 * Instead of asking "how do I implement this?", the Product tier asks
 * "should this exist?" — user problem, simpler approach, discoverability,
 * business alignment, maintenance cost, opportunity cost.
 */

import type { EngineeringConcept, TierId } from '../types.js';

const TIER: TierId = 'tier-04-product';

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
  id: `product.${id}`,
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

const PM = ['Product management canon: problem-first framing (Marty Cagan, Inspired)'];

export const TIER_04_PRODUCT_CONCEPTS: EngineeringConcept[] = [
  C(
    'user-problem',
    'Problem-First Fit',
    'product-judgment',
    'Does this solve a real user problem? Features exist for problems, not for feature lists.',
    ['user problem', 'user need', 'pain point'],
    ['feature', 'user', 'request'],
    ['State the user problem before the solution; if the problem is not crisp, the feature is premature.'],
    ['Building the requested thing without the underlying problem; solutions in search of problems.'],
    PM,
  ),
  C(
    'simpler-approach',
    'Simpler Approach Check',
    'product-judgment',
    'Is there a simpler way to deliver the value? Every complexity budget spent is value not shipped.',
    ['simpler', 'minimal', 'alternative'],
    ['simple', 'just', 'quick'],
    ['Ask "what is the smallest thing that solves this?" and compare the chosen approach against it.'],
    ['Engineering-driven features that could be process, config, or a message instead.'],
    ['Lean software development: eliminate waste'],
  ),
  C(
    'discoverability',
    'Discoverability',
    'product-judgment',
    'If users cannot find the feature, it does not exist; discovery is a design property, not marketing.',
    ['discoverable', 'find', 'navigation'],
    ['feature', 'menu', 'hidden'],
    ['Design features into the existing mental model; the default action should surface the feature.'],
    ['Powerful features buried in settings; behavior triggered only by undocumented gestures.'],
    ['UI/UX canon: Nielsen heuristics'],
  ),
  C(
    'business-alignment',
    'Business Goal Alignment',
    'product-judgment',
    'Does this serve the business goal (revenue, retention, cost, risk)? Aligned features compound; others dilute.',
    ['business goal', 'alignment', 'kpi'],
    ['goal', 'objective', 'business'],
    ['Map the feature to the business goal it serves; if it serves none, its budget belongs elsewhere.'],
    ['Vanity features that satisfy internal politics, not outcomes.'],
    PM,
  ),
  C(
    'maintenance-burden',
    'Feature Maintenance Cost',
    'product-judgment',
    'Every feature is a liability: support, docs, fixes, and cognitive load on future product decisions.',
    ['maintenance', 'support burden', 'feature cost'],
    ['feature', 'support', 'deprecate'],
    ['Price the support and maintenance of the feature against its usage before adding it.'],
    ['Adding features to a system with no capacity to support them.'],
    ['Lean startup: the cost of features you do not build'],
  ),
  C(
    'opportunity-cost',
    'Opportunity Cost',
    'product-judgment',
    'Building X means not building Y; every roadmap choice is a portfolio decision.',
    ['opportunity cost', 'tradeoff', 'priority'],
    ['roadmap', 'priority', 'budget'],
    ['Name the forgone alternative explicitly before committing; compare options as a portfolio.'],
    ['Building everything in sequence without priority; never saying no.'],
    ['Economics canon: opportunity cost'],
  ),
  C(
    'usage-evidence',
    'Evidence of Demand',
    'product-judgment',
    'Build on evidence of demand (usage, requests, complaints), not on assumptions about demand.',
    ['evidence', 'usage data', 'requests'],
    ['feature request', 'analytics', 'usage'],
    ['Point to the evidence: data, requests, or validated pain — before scoping the build.'],
    ['Features justified by one internal voice; no measurement plan for adoption.'],
    ['Lean startup: validated learning'],
  ),
  C(
    'minimum-viable',
    'Scope Discipline',
    'product-judgment',
    'The smallest slice that delivers measurable value; scope is the primary lever on time-to-learning.',
    ['mvp', 'scope', 'slice'],
    ['scope', 'cut', 'milestone'],
    ['Define the smallest valuable slice and resist accretion; defer everything that does not change the learning.'],
    ['Gold-plating before validation; scope that grows with every review.'],
    ['Ries, The Lean Startup'],
  ),
];

export function tier04ProductConcepts(): EngineeringConcept[] {
  return TIER_04_PRODUCT_CONCEPTS.map((c) => ({ ...c }));
}
