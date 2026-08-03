import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import { CircuitBreaker } from '../circuit-breaker.js';

export type ThreatID = `T${string}`;

export interface ThreatMitigation {
  id: ThreatID;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  subsystem: string;
  detect: (immune: ImmuneSystem, policies: PolicyEngine) => Promise<boolean>;
  mitigate: (immune: ImmuneSystem, policies: PolicyEngine) => Promise<MitigationResult>;
  isActive: boolean;
}

export interface MitigationResult {
  applied: boolean;
  description: string;
  evidence: string[];
}

export interface ThreatMitigationConfig {
  autoMitigate: boolean;
  maxMitigationsPerCycle: number;
  cycleIntervalMs: number;
}

export interface PolicyFailureRecord {
  policyId: string;
  failureCount: number;
  lastFailure: Date;
  circuitBreaker: CircuitBreaker;
}

export interface TokenExhaustionRecord {
  source: string;
  tokenCount: number;
  failureCount: number;
  windowStart: number;
  tokensIssued: number;
}
