import type { HealthInputs, HealthMetric, HealthStatus, HealthThreshold } from './types.js';

export type MetricProducer = (inputs: HealthInputs, now?: Date) => HealthMetric;

export function bandForLowerIsBetter(value: number, threshold: HealthThreshold): HealthStatus {
  if (value >= threshold.critical) return 'critical';
  if (value >= threshold.warn) return 'warn';
  return 'healthy';
}

export function bandForHigherIsBetter(value: number, threshold: HealthThreshold): HealthStatus {
  if (value <= threshold.critical) return 'critical';
  if (value <= threshold.warn) return 'warn';
  return 'healthy';
}

interface MetricProducerDef {
  id: string;
  label: string;
  threshold: HealthThreshold;
  higherIsBetter: boolean;
  hint: string;
  sample: (inputs: HealthInputs) => number | undefined;
}

// Missing inputs default to the healthy extreme (0 for lower-is-better, 1 for
// higher-is-better) so an unobserved signal never trips an alarm.
function producer(def: MetricProducerDef): MetricProducer {
  return (inputs: HealthInputs, _now?: Date): HealthMetric => {
    const value = def.sample(inputs) ?? (def.higherIsBetter ? 1 : 0);
    const status = def.higherIsBetter
      ? bandForHigherIsBetter(value, def.threshold)
      : bandForLowerIsBetter(value, def.threshold);
    return {
      id: def.id,
      label: def.label,
      value,
      status,
      threshold: def.threshold,
      remediationHint: status === 'healthy' ? undefined : def.hint,
    };
  };
}

export const produceMemoryFragmentation = producer({
  id: 'memory.fragmentation',
  label: 'Memory fragmentation',
  threshold: { warn: 0.4, critical: 0.7 },
  higherIsBetter: false,
  hint: 'Compact the memory stores; promote hot pages and defragment the paging hierarchy.',
  sample: (i) => i.memoryFragmentation,
});

export const produceReasoningDrift = producer({
  id: 'reasoning.drift',
  label: 'Reasoning drift',
  threshold: { warn: 0.35, critical: 0.6 },
  higherIsBetter: false,
  hint: 'Anchor reasoning back to the cognitive trace; re-verify conclusions that diverged from it.',
  sample: (i) => i.reasoningDrift,
});

export const produceKnowledgeEntropy = producer({
  id: 'knowledge.entropy',
  label: 'Knowledge entropy',
  threshold: { warn: 0.5, critical: 0.8 },
  higherIsBetter: false,
  hint: 'Distill the knowledge base; consolidate redundant beliefs through the sleep cycle.',
  sample: (i) => i.knowledgeEntropy,
});

export const produceContradictionRate = producer({
  id: 'contradiction.rate',
  label: 'Contradiction rate',
  threshold: { warn: 0.2, critical: 0.4 },
  higherIsBetter: false,
  hint: 'Run contradiction detection over the belief set and reconcile conflicting claims.',
  sample: (i) => i.contradictionRate,
});

export const produceEnergyEfficiency = producer({
  id: 'energy.efficiency',
  label: 'Energy efficiency',
  threshold: { warn: 0.6, critical: 0.35 },
  higherIsBetter: true,
  hint: 'Cut energy cost: serve cached answers and route work to the frugal provider tier (ADR-004).',
  sample: (i) => i.energyEfficiency,
});

export const produceLearningRate = producer({
  id: 'learning.rate',
  label: 'Learning rate',
  threshold: { warn: 0.3, critical: 0.1 },
  higherIsBetter: true,
  hint: 'Increase learning: ingest new episodes and run sleep-cycle distillation.',
  sample: (i) => i.learningRate,
});

export const produceSkillUsage = producer({
  id: 'skill.usage',
  label: 'Skill usage',
  threshold: { warn: 0.4, critical: 0.2 },
  higherIsBetter: true,
  hint: 'Activate relevant skills and route subtasks to the specialized organs.',
  sample: (i) => i.skillUsage,
});

export const produceArchitectureDrift = producer({
  id: 'architecture.drift',
  label: 'Architecture drift',
  threshold: { warn: 0.3, critical: 0.55 },
  higherIsBetter: false,
  hint: 'Reconcile changes against the architecture genome and trigger an architecture review.',
  sample: (i) => i.architectureDrift,
});

export const produceConfidence = producer({
  id: 'confidence',
  label: 'Confidence',
  threshold: { warn: 0.5, critical: 0.3 },
  higherIsBetter: true,
  hint: 'Recheck low-confidence beliefs and gather evidence before acting on them.',
  sample: (i) => i.confidence,
});

export const produceBiasSignal = producer({
  id: 'bias.signal',
  label: 'Bias signal',
  threshold: { warn: 0.45, critical: 0.75 },
  higherIsBetter: false,
  hint: 'Audit the bias signal sources; reweight provenance and diversify evidence.',
  sample: (i) => i.biasSignal,
});

export const produceHallucinationRisk = producer({
  id: 'hallucination.risk',
  label: 'Hallucination risk',
  threshold: { warn: 0.5, critical: 0.8 },
  higherIsBetter: false,
  hint: 'Raise verification requirements; require evidence-backed claims before commit.',
  sample: (i) => i.hallucinationRisk,
});

export const produceVerificationCoverage = producer({
  id: 'verification.coverage',
  label: 'Verification coverage',
  threshold: { warn: 0.6, critical: 0.3 },
  higherIsBetter: true,
  hint: 'Add verification gates: more tests, integrity checks, and replay verification.',
  sample: (i) => i.verificationCoverage,
});
