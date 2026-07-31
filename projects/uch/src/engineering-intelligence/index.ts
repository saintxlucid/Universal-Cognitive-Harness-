/**
 * Engineering Intelligence Layer — public surface.
 *
 * The workspace-installed corpus of engineering domains that
 * continuously evaluates and influences any connected agent:
 *  - Tier I   Computer Science Intelligence
 *  - Tier II  Software Engineering Intelligence
 *  - Tier III Systems Thinking
 *  - Tier IV  Product Thinking
 *  - Tier V   Engineering Economics
 *  - Tier VI  Engineering Laws (reasoning primitives)
 *  - Tier VII Architectural Patterns (with when-NOT-to-use guidance)
 *  - Tier VIII Failure Engineering
 *  - Tier X   Unknown-Unknown Discovery
 * (Tier IX Taste reuses src/cognitive-plane/taste per ADR-003.)
 */

export * from './types.js';
export { analyzeTarget } from './analyzer.js';
export {
  DomainStore,
  DomainRegistry,
  createDomainRegistry,
  TIER_01_CS_CONCEPTS,
  TIER_02_SE_CONCEPTS,
  TIER_03_SYSTEMS_CONCEPTS,
  TIER_04_PRODUCT_CONCEPTS,
  TIER_05_ECONOMICS_CONCEPTS,
  TIER_07_PATTERNS_CONCEPTS,
  TIER_08_FAILURE_CONCEPTS,
  TIER_10_UNKNOWN_CONCEPTS,
} from './domains/index.js';
export {
  ENGINEERING_LAWS,
  LawRegistry,
  createLawRegistry,
} from './laws/engineering-laws.js';
export { EngineeringEvaluator } from './evaluator.js';
export type { EvaluatorConfig } from './evaluator.js';
export {
  ENGINEERING_BENCHMARK_CORPUS,
  type BenchmarkCase,
  type BenchmarkGroup,
} from './benchmark/corpus.js';
export {
  runEngineeringBenchmark,
  type BenchmarkCaseResult,
  type BenchmarkReport,
} from './benchmark/runner.js';
export {
  autoTarget,
  coerceFindings,
  engineeringFindingsFor,
} from './organic-hookup.js';
export {
  EngineeringEnrichment,
  ENGINEERING_WATCH_EVENTS,
  targetFromEvent,
  type EngineeringEnrichmentConfig,
} from './enrichment/engineering-enrichment.js';

import { DomainRegistry, createDomainRegistry } from './domains/index.js';
import { LawRegistry, createLawRegistry } from './laws/engineering-laws.js';
import { EngineeringEvaluator } from './evaluator.js';

export interface EngineeringJudgment {
  domains: DomainRegistry;
  laws: LawRegistry;
  evaluator: EngineeringEvaluator;
}

/** Factory: the full Engineering Judgment organ in one assembly. */
export function createEngineeringJudgment(): EngineeringJudgment {
  const domains = createDomainRegistry();
  const laws = createLawRegistry();
  const evaluator = new EngineeringEvaluator(domains, laws);
  return { domains, laws, evaluator };
}
