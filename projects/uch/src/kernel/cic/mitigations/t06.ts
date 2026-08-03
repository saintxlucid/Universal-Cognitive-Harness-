import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import { CircuitBreaker } from '../circuit-breaker.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

export class T06RunawayProcessMitigation implements ThreatMitigation {
  id = 'T06' as ThreatID;
  description = 'Detect and contain runaway cognitive processes consuming excessive resources';
  severity = 'critical' as const;
  subsystem = 'cic';
  isActive = false;
  private circuitBreaker: CircuitBreaker;
  private processTimeouts: Map<string, number> = new Map();
  private readonly maxProcessDurationMs = 60000;

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 1,
      resetTimeoutMs: 120000,
      halfOpenMaxCalls: 1,
    });
  }

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    return this.circuitBreaker.getState() === 'open';
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    this.circuitBreaker.forceClose();
    this.processTimeouts.clear();
    return {
      applied: true,
      description:
        'Runaway process mitigation applied: circuit breaker reset, process timeouts cleared',
      evidence: ['circuit-breaker reset', 'process-timeout-cache cleared'],
    };
  }

  trackProcessStart(processId: string): void {
    this.processTimeouts.set(processId, Date.now());
  }

  trackProcessEnd(processId: string): boolean {
    const started = this.processTimeouts.get(processId);
    if (!started) return true;
    const duration = Date.now() - started;
    this.processTimeouts.delete(processId);

    if (duration > this.maxProcessDurationMs) {
      this.circuitBreaker.call(async () => {}, 1).catch(() => {});
      return false;
    }
    return true;
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }
  getActiveProcesses(): number {
    return this.processTimeouts.size;
  }
}
