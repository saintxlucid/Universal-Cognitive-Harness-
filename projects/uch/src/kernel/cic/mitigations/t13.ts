import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type {
  MitigationResult,
  ThreatID,
  ThreatMitigation,
  TokenExhaustionRecord,
} from './types.js';

export class T13TokenExhaustionMitigation implements ThreatMitigation {
  id = 'T13' as ThreatID;
  description = 'Detect and block rapid token cycling / credential exhaustion attacks';
  severity = 'critical' as const;
  subsystem = 'auth';
  isActive = false;
  private sourceRecords: Map<string, TokenExhaustionRecord> = new Map();
  private readonly maxTokensPerWindow = 50;
  private readonly windowMs = 60000;
  private readonly maxFailuresBeforeBlock = 5;
  private blockedSources: Set<string> = new Set();
  private totalMitigations = 0;

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    if (this.blockedSources.size > 0) return true;
    const now = Date.now();
    for (const [, record] of this.sourceRecords) {
      const elapsed = now - record.windowStart;
      if (elapsed < this.windowMs) {
        if (record.failureCount >= this.maxFailuresBeforeBlock) {
          return true;
        }
      }
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const blocked: string[] = [];

    for (const [source, record] of this.sourceRecords) {
      const elapsed = now - record.windowStart;
      if (elapsed < this.windowMs) {
        if (record.failureCount >= this.maxFailuresBeforeBlock) {
          this.blockedSources.add(source);
          blocked.push(source);
          this.totalMitigations++;
        }
      }
    }

    return {
      applied: blocked.length > 0,
      description: `Token exhaustion mitigation: blocked ${blocked.length} sources`,
      evidence: blocked.map((s) => `source-blocked:${s}`),
    };
  }

  recordTokenIssue(source: string, success: boolean): void {
    const now = Date.now();
    let record = this.sourceRecords.get(source);

    if (!record || now - record.windowStart > this.windowMs) {
      record = {
        source,
        tokenCount: 0,
        failureCount: 0,
        windowStart: now,
        tokensIssued: 0,
      };
      this.sourceRecords.set(source, record);
    }

    if (success) {
      record.tokensIssued++;
    } else {
      record.failureCount++;
    }

    if (record.failureCount >= this.maxFailuresBeforeBlock) {
      this.blockedSources.add(source);
    }
  }

  isSourceBlocked(source: string): boolean {
    if (!this.blockedSources.has(source)) return false;

    const record = this.sourceRecords.get(source);
    if (record) {
      const elapsed = Date.now() - record.windowStart;
      if (elapsed > this.windowMs * 2) {
        this.blockedSources.delete(source);
        this.sourceRecords.delete(source);
        return false;
      }
    }

    return true;
  }

  unblockSource(source: string): void {
    this.blockedSources.delete(source);
    this.sourceRecords.delete(source);
  }

  getBlockedSources(): string[] {
    return [...this.blockedSources];
  }

  getStats(): Record<string, unknown> {
    return {
      trackedSources: this.sourceRecords.size,
      blockedSources: this.blockedSources.size,
      totalMitigations: this.totalMitigations,
      windowMs: this.windowMs,
      maxTokensPerWindow: this.maxTokensPerWindow,
    };
  }
}
