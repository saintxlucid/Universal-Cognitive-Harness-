/**
 * Domain registry — the tier catalog for the Engineering Intelligence
 * Layer. Wave 1 shipped Tier I (CS), Tier III (Systems), Tier V
 * (Economics); Wave 2 adds Tier II (SE), Tier VII (Patterns), Tier IV
 * (Product), Tier VIII (Failure), Tier X (Unknown-Unknowns) per
 * ADR-003 priority.
 */

import { DomainStore } from './base.js';
import { tier01CSConcepts } from './tier-01-cs.js';
import { tier02SEConcepts } from './tier-02-se.js';
import { tier03SystemsConcepts } from './tier-03-systems.js';
import { tier04ProductConcepts } from './tier-04-product.js';
import { tier05EconomicsConcepts } from './tier-05-economics.js';
import { tier07PatternsConcepts } from './tier-07-patterns.js';
import { tier08FailureConcepts } from './tier-08-failure.js';
import { tier10UnknownConcepts } from './tier-10-unknown.js';

export class DomainRegistry {
  private stores = new Map<string, DomainStore>();

  constructor() {
    this.register(new DomainStore('tier-01-cs', 'Computer Science Intelligence', tier01CSConcepts()));
    this.register(new DomainStore('tier-02-se', 'Software Engineering Intelligence', tier02SEConcepts()));
    this.register(new DomainStore('tier-03-systems', 'Systems Thinking', tier03SystemsConcepts()));
    this.register(new DomainStore('tier-04-product', 'Product Thinking', tier04ProductConcepts()));
    this.register(new DomainStore('tier-05-economics', 'Engineering Economics', tier05EconomicsConcepts()));
    this.register(new DomainStore('tier-07-patterns', 'Architectural Patterns', tier07PatternsConcepts()));
    this.register(new DomainStore('tier-08-failure', 'Failure Engineering', tier08FailureConcepts()));
    this.register(new DomainStore('tier-10-unknown', 'Unknown-Unknown Discovery', tier10UnknownConcepts()));
  }

  register(store: DomainStore): void {
    if (this.stores.has(store.tier)) {
      throw new Error(`Domain store already registered: ${store.tier}`);
    }
    this.stores.set(store.tier, store);
  }

  get(tier: string): DomainStore | null {
    return this.stores.get(tier) ?? null;
  }

  list(): DomainStore[] {
    return [...this.stores.values()];
  }

  concept(id: string): { store: DomainStore; concept: import('../types.js').EngineeringConcept } | null {
    for (const store of this.stores.values()) {
      const concept = store.get(id);
      if (concept) return { store, concept };
    }
    return null;
  }

  get totalConcepts(): number {
    let n = 0;
    for (const store of this.stores.values()) n += store.size;
    return n;
  }
}

export function createDomainRegistry(): DomainRegistry {
  return new DomainRegistry();
}

export { DomainStore } from './base.js';
export { TIER_01_CS_CONCEPTS } from './tier-01-cs.js';
export { TIER_02_SE_CONCEPTS } from './tier-02-se.js';
export { TIER_03_SYSTEMS_CONCEPTS } from './tier-03-systems.js';
export { TIER_04_PRODUCT_CONCEPTS } from './tier-04-product.js';
export { TIER_05_ECONOMICS_CONCEPTS } from './tier-05-economics.js';
export { TIER_07_PATTERNS_CONCEPTS } from './tier-07-patterns.js';
export { TIER_08_FAILURE_CONCEPTS } from './tier-08-failure.js';
export { TIER_10_UNKNOWN_CONCEPTS } from './tier-10-unknown.js';
