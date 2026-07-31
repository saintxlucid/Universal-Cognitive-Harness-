export type HealthStatus = 'healthy' | 'warn' | 'critical';

export interface HealthThreshold {
  /**
   * Band boundary, inclusive: for lower-is-better metrics a value >= warn is a
   * warning and >= critical is critical; for higher-is-better metrics the same
   * numbers act as upper bounds (value <= warn / <= critical).
   */
  warn: number;
  critical: number;
}

export interface HealthMetric {
  id: string;
  label: string;
  value: number;
  status: HealthStatus;
  threshold: HealthThreshold;
  remediationHint?: string;
}

export interface HealthInputs {
  /** 0-1; high fragmentation is bad. */
  memoryFragmentation?: number;
  /** 0-1 deviation of current reasoning from the cognitive trace; high is bad. */
  reasoningDrift?: number;
  /** 0-1 entropy of the knowledge base; high is bad. */
  knowledgeEntropy?: number;
  /** 0-1 fraction of beliefs that contradict another belief; high is bad. */
  contradictionRate?: number;
  /** 0-1 useful work per energy unit; HIGH is good. */
  energyEfficiency?: number;
  /** 0-1 fraction of ingested episodes distilled into reusable knowledge; high is good. */
  learningRate?: number;
  /** 0-1 fraction of applicable tasks routed through skills; high is good. */
  skillUsage?: number;
  /** 0-1 deviation from the architecture genome; high is bad. */
  architectureDrift?: number;
  /** 0-1 mean calibrated confidence of the belief set; high is good. */
  confidence?: number;
  /** 0-1 estimated bias contamination of provenance; high is bad. */
  biasSignal?: number;
  /** 0-1 estimated probability that recent claims are unsupported; high is bad. */
  hallucinationRisk?: number;
  /** 0-1 fraction of committed knowledge verified by a gate; high is good. */
  verificationCoverage?: number;
}

export interface CognitiveHealthReport {
  overall: HealthStatus;
  metrics: HealthMetric[];
  remediations: string[];
  generatedAt: Date;
}
