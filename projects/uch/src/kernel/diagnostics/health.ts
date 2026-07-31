import type { CognitiveHealthReport, HealthInputs, HealthStatus } from './types.js';
import {
  produceArchitectureDrift,
  produceBiasSignal,
  produceConfidence,
  produceContradictionRate,
  produceEnergyEfficiency,
  produceHallucinationRisk,
  produceKnowledgeEntropy,
  produceLearningRate,
  produceMemoryFragmentation,
  produceReasoningDrift,
  produceSkillUsage,
  produceVerificationCoverage,
} from './metrics.js';

const PRODUCERS = [
  produceMemoryFragmentation,
  produceReasoningDrift,
  produceKnowledgeEntropy,
  produceContradictionRate,
  produceEnergyEfficiency,
  produceLearningRate,
  produceSkillUsage,
  produceArchitectureDrift,
  produceConfidence,
  produceBiasSignal,
  produceHallucinationRisk,
  produceVerificationCoverage,
] as const;

function worstStatus(statuses: readonly HealthStatus[]): HealthStatus {
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warn')) return 'warn';
  return 'healthy';
}

export function diagnose(inputs: HealthInputs, now?: Date): CognitiveHealthReport {
  const metrics = PRODUCERS.map((produce) => produce(inputs, now));
  const remediations = metrics
    .filter((metric) => metric.status !== 'healthy')
    .map((metric) => metric.remediationHint)
    .filter((hint): hint is string => hint !== undefined);
  return {
    overall: worstStatus(metrics.map((metric) => metric.status)),
    metrics,
    remediations,
    generatedAt: now ?? new Date(),
  };
}
