import { describe, it, expect } from 'vitest';
import { diagnose } from '../kernel/diagnostics/health.js';
import {
  bandForHigherIsBetter,
  bandForLowerIsBetter,
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
} from '../kernel/diagnostics/metrics.js';
import type { HealthInputs, HealthMetric } from '../kernel/diagnostics/types.js';

interface BandCase {
  producer: (inputs: HealthInputs) => HealthMetric;
  key: keyof HealthInputs;
  warn: number;
  critical: number;
}

const LOWER_IS_BETTER: BandCase[] = [
  { producer: produceMemoryFragmentation, key: 'memoryFragmentation', warn: 0.4, critical: 0.7 },
  { producer: produceReasoningDrift, key: 'reasoningDrift', warn: 0.35, critical: 0.6 },
  { producer: produceKnowledgeEntropy, key: 'knowledgeEntropy', warn: 0.5, critical: 0.8 },
  { producer: produceContradictionRate, key: 'contradictionRate', warn: 0.2, critical: 0.4 },
  { producer: produceArchitectureDrift, key: 'architectureDrift', warn: 0.3, critical: 0.55 },
  { producer: produceBiasSignal, key: 'biasSignal', warn: 0.45, critical: 0.75 },
  { producer: produceHallucinationRisk, key: 'hallucinationRisk', warn: 0.5, critical: 0.8 },
];

const HIGHER_IS_BETTER: BandCase[] = [
  { producer: produceEnergyEfficiency, key: 'energyEfficiency', warn: 0.6, critical: 0.35 },
  { producer: produceLearningRate, key: 'learningRate', warn: 0.3, critical: 0.1 },
  { producer: produceSkillUsage, key: 'skillUsage', warn: 0.4, critical: 0.2 },
  { producer: produceConfidence, key: 'confidence', warn: 0.5, critical: 0.3 },
  { producer: produceVerificationCoverage, key: 'verificationCoverage', warn: 0.6, critical: 0.3 },
];

function metricFor(bc: BandCase, value: number): HealthMetric {
  return bc.producer({ [bc.key]: value } as HealthInputs);
}

describe('metric bands (lower-is-better)', () => {
  it.each(LOWER_IS_BETTER)('$key healthy/warn/critical boundaries', (bc) => {
    expect(metricFor(bc, 0).status).toBe('healthy');
    expect(metricFor(bc, bc.warn - 0.01).status).toBe('healthy');
    expect(metricFor(bc, bc.warn).status).toBe('warn');
    expect(metricFor(bc, bc.warn + 0.01).status).toBe('warn');
    expect(metricFor(bc, bc.critical - 0.01).status).toBe('warn');
    expect(metricFor(bc, bc.critical).status).toBe('critical');
    expect(metricFor(bc, bc.critical + 0.01).status).toBe('critical');
    expect(metricFor(bc, 1).status).toBe('critical');
  });
});

describe('metric bands (higher-is-better)', () => {
  it.each(HIGHER_IS_BETTER)('$key healthy/warn/critical boundaries', (bc) => {
    expect(metricFor(bc, 0).status).toBe('critical');
    expect(metricFor(bc, bc.critical - 0.01).status).toBe('critical');
    expect(metricFor(bc, bc.critical).status).toBe('critical');
    expect(metricFor(bc, bc.critical + 0.01).status).toBe('warn');
    expect(metricFor(bc, bc.warn - 0.01).status).toBe('warn');
    expect(metricFor(bc, bc.warn).status).toBe('warn');
    expect(metricFor(bc, bc.warn + 0.01).status).toBe('healthy');
    expect(metricFor(bc, 1).status).toBe('healthy');
  });
});

describe('higher-is-better inversion', () => {
  it('treats high energy efficiency as healthy and high risk as critical', () => {
    expect(produceEnergyEfficiency({ energyEfficiency: 0.9 }).status).toBe('healthy');
    expect(produceEnergyEfficiency({ energyEfficiency: 0.6 }).status).toBe('warn');
    expect(produceEnergyEfficiency({ energyEfficiency: 0.35 }).status).toBe('critical');
    expect(produceEnergyEfficiency({ energyEfficiency: 0.1 }).status).toBe('critical');
    expect(produceHallucinationRisk({ hallucinationRisk: 0.9 }).status).toBe('critical');
    expect(produceHallucinationRisk({ hallucinationRisk: 0.1 }).status).toBe('healthy');
  });

  it('inverts every higher-is-better metric', () => {
    for (const bc of HIGHER_IS_BETTER) {
      expect(metricFor(bc, 1).status).toBe('healthy');
      expect(metricFor(bc, 0).status).toBe('critical');
    }
  });

  it('band helpers invert against each other', () => {
    expect(bandForLowerIsBetter(0.1, { warn: 0.4, critical: 0.7 })).toBe('healthy');
    expect(bandForHigherIsBetter(0.1, { warn: 0.4, critical: 0.7 })).toBe('critical');
  });
});

describe('diagnose aggregation (worst wins)', () => {
  it('reports healthy for all-healthy inputs', () => {
    const report = diagnose({});
    expect(report.overall).toBe('healthy');
    expect(report.metrics).toHaveLength(12);
    expect(report.remediations).toEqual([]);
  });

  it('reports warn when a single metric warns', () => {
    const report = diagnose({ memoryFragmentation: 0.4 });
    expect(report.overall).toBe('warn');
    const frag = report.metrics.find((m) => m.id === 'memory.fragmentation');
    expect(frag?.status).toBe('warn');
    expect(report.remediations).toEqual([frag?.remediationHint]);
  });

  it('reports critical when a single metric is critical', () => {
    expect(diagnose({ hallucinationRisk: 0.9 }).overall).toBe('critical');
  });

  it('critical dominates warn', () => {
    const report = diagnose({ contradictionRate: 0.5, learningRate: 0.05 });
    expect(report.overall).toBe('critical');
    expect(report.metrics.filter((m) => m.status === 'critical').length).toBe(2);
  });

  it('gathers remediations from every warn and critical metric', () => {
    const report = diagnose({ energyEfficiency: 0.1, verificationCoverage: 0.2, confidence: 0.8 });
    expect(report.overall).toBe('critical');
    expect(report.metrics.filter((m) => m.status !== 'healthy')).toHaveLength(2);
    expect(report.remediations).toHaveLength(2);
  });

  it('healthy metrics carry no remediation hint', () => {
    const report = diagnose({ memoryFragmentation: 0.1 });
    const frag = report.metrics.find((m) => m.id === 'memory.fragmentation');
    expect(frag?.status).toBe('healthy');
    expect(frag?.remediationHint).toBeUndefined();
    expect(report.remediations).toEqual([]);
  });
});

describe('determinism', () => {
  it('produces identical reports for identical inputs and clock', () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    const inputs: HealthInputs = {
      memoryFragmentation: 0.5,
      contradictionRate: 0.3,
      energyEfficiency: 0.2,
      verificationCoverage: 0.9,
      biasSignal: 0.8,
      confidence: 0.45,
    };
    expect(diagnose(inputs, now)).toEqual(diagnose(inputs, now));
  });

  it('metric order is stable', () => {
    expect(diagnose({}).metrics.map((m) => m.id)).toEqual([
      'memory.fragmentation',
      'reasoning.drift',
      'knowledge.entropy',
      'contradiction.rate',
      'energy.efficiency',
      'learning.rate',
      'skill.usage',
      'architecture.drift',
      'confidence',
      'bias.signal',
      'hallucination.risk',
      'verification.coverage',
    ]);
  });
});

describe('generatedAt clock injection', () => {
  it('uses the injected clock', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(diagnose({}, now).generatedAt).toBe(now);
    expect(diagnose({}, new Date('2025-06-15T06:30:00.000Z')).generatedAt.toISOString()).toBe(
      '2025-06-15T06:30:00.000Z',
    );
  });

  it('falls back to the real clock when none is injected', () => {
    const before = Date.now();
    const report = diagnose({});
    expect(report.generatedAt).toBeInstanceOf(Date);
    expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
