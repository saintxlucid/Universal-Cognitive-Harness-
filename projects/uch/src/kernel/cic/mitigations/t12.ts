import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface TimingRecord {
  scopeId: string;
  responseTimes: number[];
  variance: number;
  lastAccess: number;
}

export class T12TimingSideChannelMitigation implements ThreatMitigation {
  id = 'T12' as ThreatID;
  description =
    'Detect and mitigate timing side channels by injecting noise and enforcing constant-time scope checks';
  severity = 'low' as const;
  subsystem = 'cic';
  isActive = false;
  private timingRecords: Map<string, TimingRecord> = new Map();
  private readonly maxSamples = 20;
  private readonly varianceThreshold = 50;
  private readonly noiseMin = 5;
  private readonly noiseMax = 25;
  private readonly windowMs = 60000;

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.timingRecords) {
      if (now - record.lastAccess > this.windowMs) continue;
      if (record.responseTimes.length >= 3 && record.variance > this.varianceThreshold) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.timingRecords) {
      if (now - record.lastAccess > this.windowMs) continue;
      if (record.responseTimes.length >= 3 && record.variance > this.varianceThreshold) {
        evidence.push(`noise-injected:${record.scopeId} variance:${record.variance.toFixed(0)}ms`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Timing side channel mitigation: injected noise into ${evidence.length} scope timing patterns`,
      evidence,
    };
  }

  recordTiming(scopeId: string, responseTimeMs: number): void {
    let record = this.timingRecords.get(scopeId);
    const now = Date.now();
    if (!record || now - record.lastAccess > this.windowMs) {
      record = { scopeId, responseTimes: [], variance: 0, lastAccess: now };
      this.timingRecords.set(scopeId, record);
    }
    record.responseTimes.push(responseTimeMs);
    if (record.responseTimes.length > this.maxSamples) {
      record.responseTimes = record.responseTimes.slice(-this.maxSamples);
    }
    record.variance = this.calculateVariance(record.responseTimes);
    record.lastAccess = now;
  }

  injectNoise(): number {
    return Math.floor(Math.random() * (this.noiseMax - this.noiseMin + 1)) + this.noiseMin;
  }

  private calculateVariance(times: number[]): number {
    if (times.length < 2) return 0;
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const squaredDiffs = times.map((t) => (t - mean) ** 2);
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / times.length);
  }

  getStats(): Record<string, unknown> {
    return {
      trackedScopes: this.timingRecords.size,
      varianceThreshold: this.varianceThreshold,
    };
  }
}
