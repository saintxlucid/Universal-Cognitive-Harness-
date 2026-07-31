import { PolicyEngine } from '../control-plane/policies.js';
import { Auth } from '../control-plane/auth/auth.js';
import { ReflexEngine, type ReflexResult } from '../suit/instinct/reflex-engine.js';

export interface ThreatAssessment {
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  description: string;
  subsystem: string;
  recommendation: string;
}

export class ImmuneSystem {
  private policies: PolicyEngine;
  private auth: Auth;
  private reflexEngine: ReflexEngine;
  private threats: ThreatAssessment[] = [];
  private scanCount = 0;
  private blockedActions = 0;

  constructor(policies: PolicyEngine, auth: Auth, reflexEngine: ReflexEngine) {
    this.policies = policies;
    this.auth = auth;
    this.reflexEngine = reflexEngine;
  }

  async tick(): Promise<void> {
    this.scanCount++;

    const agentCount = this.auth.getAgents().length;
    if (agentCount > 50) {
      this.reportThreat({
        severity: 'high',
        source: 'auth',
        description: `High agent count: ${agentCount}`,
        subsystem: 'immune',
        recommendation: 'Review registered agents for stale entries',
      });
    }
  }

  async evaluateAction(
    agentId: string,
    action: string,
    resource: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const result = this.policies.evaluate({
      principal: agentId,
      action,
      resource,
    });
    if (!result.allowed) {
      this.blockedActions++;
      const matchedRule = result.matchedRule;
      this.reportThreat({
        severity: matchedRule && matchedRule.effect === 'deny' ? 'critical' : 'medium',
        source: `agent:${agentId}`,
        description: matchedRule
          ? `Policy "${matchedRule.id}" denied ${action} on ${resource}`
          : `No matching policy for ${action} on ${resource}`,
        subsystem: 'policies',
        recommendation: 'Review policy rules or agent permissions',
      });
    }
    return { allowed: result.allowed, reason: result.matchedRule?.id };
  }

  async scanReflexes(): Promise<ReflexResult[]> {
    return this.reflexEngine.getResults(50);
  }

  private reportThreat(threat: ThreatAssessment): void {
    this.threats.push(threat);
    if (this.threats.length > 100) this.threats.shift();
  }

  getThreats(): ThreatAssessment[] {
    return [...this.threats];
  }

  getStatus(): Record<string, unknown> {
    return {
      scanCount: this.scanCount,
      blockedActions: this.blockedActions,
      activeThreats: this.threats.filter((t) => t.severity === 'critical' || t.severity === 'high')
        .length,
      totalThreats: this.threats.length,
      recentThreats: this.threats.slice(-5),
    };
  }
}
