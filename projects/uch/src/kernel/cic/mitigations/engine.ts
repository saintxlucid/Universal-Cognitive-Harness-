import { ImmuneSystem, type ThreatAssessment } from '../../../cognitive-core/immune.js';
import { PolicyEngine } from '../../../control-plane/policies.js';
import type {
  MitigationResult,
  ThreatID,
  ThreatMitigation,
  ThreatMitigationConfig,
} from './types.js';
import { T01UnauthorizedMemoryAccessMitigation } from './t01.js';
import { T02CrossProjectContaminationMitigation } from './t02.js';
import { T03PrivilegeEscalationMitigation } from './t03.js';
import { T04ConsentBypassMitigation } from './t04.js';
import { T05DataExfiltrationMitigation } from './t05.js';
import { T06RunawayProcessMitigation } from './t06.js';
import { T07CascadingPolicyMitigation } from './t07.js';
import { T08ReplayAttackMitigation } from './t08.js';
import { T09ConsolidationPoisoningMitigation } from './t09.js';
import { T10RetentionPolicyMitigation } from './t10.js';
import { T11HardDeleteWithoutAuditMitigation } from './t11.js';
import { T12TimingSideChannelMitigation } from './t12.js';
import { T13TokenExhaustionMitigation } from './t13.js';
import { T14SessionHijackingMitigation } from './t14.js';

export class ThreatMitigationEngine {
  private mitigations: Map<ThreatID, ThreatMitigation> = new Map();
  private config: Required<ThreatMitigationConfig>;
  private immune: ImmuneSystem;
  private policies: PolicyEngine;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private totalCycles = 0;
  private totalMitigationsApplied = 0;
  private history: MitigationResult[] = [];

  constructor(
    immune: ImmuneSystem,
    policies: PolicyEngine,
    config?: Partial<ThreatMitigationConfig>,
  ) {
    this.immune = immune;
    this.policies = policies;
    this.config = {
      autoMitigate: config?.autoMitigate ?? true,
      maxMitigationsPerCycle: config?.maxMitigationsPerCycle ?? 5,
      cycleIntervalMs: config?.cycleIntervalMs ?? 30000,
    };

    this.register(new T01UnauthorizedMemoryAccessMitigation());
    this.register(new T02CrossProjectContaminationMitigation());
    this.register(new T03PrivilegeEscalationMitigation());
    this.register(new T04ConsentBypassMitigation());
    this.register(new T05DataExfiltrationMitigation());
    this.register(new T06RunawayProcessMitigation());
    this.register(new T07CascadingPolicyMitigation());
    this.register(new T08ReplayAttackMitigation());
    this.register(new T09ConsolidationPoisoningMitigation());
    this.register(new T10RetentionPolicyMitigation());
    this.register(new T11HardDeleteWithoutAuditMitigation());
    this.register(new T12TimingSideChannelMitigation());
    this.register(new T13TokenExhaustionMitigation());
    this.register(new T14SessionHijackingMitigation());
  }

  register(mitigation: ThreatMitigation): void {
    this.mitigations.set(mitigation.id, mitigation);
  }

  get(id: ThreatID): ThreatMitigation | undefined {
    return this.mitigations.get(id);
  }

  async tick(): Promise<MitigationResult[]> {
    this.totalCycles++;
    const applied: MitigationResult[] = [];

    for (const [, mitigation] of this.mitigations) {
      try {
        const detected = await mitigation.detect(this.immune, this.policies);
        if (detected && this.config.autoMitigate) {
          const result = await mitigation.mitigate(this.immune, this.policies);
          if (result.applied) {
            mitigation.isActive = true;
            applied.push(result);
            this.totalMitigationsApplied++;
            this.history.push(result);

            this.immune['reportThreat']({
              severity: mitigation.severity,
              source: 'threat-mitigation-engine',
              description: result.description,
              subsystem: mitigation.subsystem,
              recommendation: result.evidence.join('; '),
            } as unknown as ThreatAssessment);
          }
        } else if (!detected) {
          mitigation.isActive = false;
        }
      } catch {
        /* mitigation is best-effort */
      }
    }

    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    return applied;
  }

  start(): void {
    if (this.cycleTimer) return;
    this.cycleTimer = setInterval(async () => {
      await this.tick();
    }, this.config.cycleIntervalMs);
  }

  stop(): void {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
  }

  getHistory(limit = 10): MitigationResult[] {
    return this.history.slice(-limit);
  }

  getStats(): Record<string, unknown> {
    return {
      totalCycles: this.totalCycles,
      totalMitigationsApplied: this.totalMitigationsApplied,
      registeredMitigations: this.mitigations.size,
      autoMitigate: this.config.autoMitigate,
      mitigations: [...this.mitigations.entries()].map(([id, m]) => ({
        id,
        severity: m.severity,
        subsystem: m.subsystem,
        isActive: m.isActive,
      })),
    };
  }
}
