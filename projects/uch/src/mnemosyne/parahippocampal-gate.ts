// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Parahippocampal gate: trust & security
// The immune system of memory. Nothing enters or leaves context without
// admission: scope check, trust scoring, anomaly detection, poisoning
// watchdog, and a full audit trail (OWASP ASI06 forensic controls).
// ═══════════════════════════════════════════════════════════════════════════

import type { AuditEntry, MemoryChannel, Scope } from './types.js';
import { projectKeyOf } from './stores/episodic-store.js';
import { reviveDates } from './hydrate.js';

export interface GateInput {
  scope: Scope;
  channel: MemoryChannel;
  reliability: number;
  instructionLikeness: number;
  text: string;
  targetId: string;
  op: 'write' | 'read';
}

export interface GateDecision {
  admitted: boolean;
  reason: string;
  flags: string[];
}

export interface WatchdogEvent {
  ts: Date;
  channel: MemoryChannel;
  scopeKey: string;
  instructionLikeness: number;
  targetId: string;
}

export class ParahippocampalGate {
  private audit: AuditEntry[] = [];
  private watchdog: WatchdogEvent[] = [];
  private quarantineIds = new Set<string>();
  private recentWrites: Array<{ ts: number; scopeKey: string; channel: MemoryChannel; instructionLikeness: number }> = [];
  private quarantineBurstThreshold = 3;
  private burstWindowMs = 10 * 60 * 1000;

  /** Admission gate for writes. */
  admitWrite(input: GateInput): GateDecision {
    const flags: string[] = [];
    if (input.instructionLikeness >= 0.6) flags.push('instruction-like');
    if (input.channel !== 'user' && input.channel !== 'feedback' && input.instructionLikeness >= 0.4) {
      flags.push('low-trust-untrusted-channel');
    }
    if (input.reliability < 0.4) flags.push('low-reliability');

    const quarantineHit = this.quarantineIds.has(input.targetId);
    if (quarantineHit) flags.push('quarantined-target');

    const admitted = !quarantineHit && !flags.includes('instruction-like') && !flags.includes('low-trust-untrusted-channel');
    const decision: GateDecision = { admitted, reason: admitted ? 'admitted' : `blocked: ${flags.join(', ')}`, flags };
    this.log(input.op, input.scope, input.channel, input.targetId, decision);
    return decision;
  }

  /** Admission gate for reads (MemGate-style: relevance is not enough). */
  admitRead(input: GateInput): GateDecision {
    const flags: string[] = [];
    if (input.instructionLikeness >= 0.5) flags.push('instruction-like');
    if (input.reliability < 0.35) flags.push('low-trust');
    if (this.quarantineIds.has(input.targetId)) flags.push('quarantined');
    const admitted = !flags.includes('quarantined');
    const decision: GateDecision = { admitted, reason: admitted ? 'admitted' : `blocked: ${flags.join(', ')}`, flags };
    this.log(input.op, input.scope, input.channel, input.targetId, decision);
    return decision;
  }

  /** Scope enforcement: query scope must be a subspace of the memory scope. */
  scopeAllows(query: Scope, memory: Scope): boolean {
    const qk = projectKeyOf(query);
    const mk = projectKeyOf(memory);
    if (qk !== mk) return false;
    if (query.session !== '*' && query.session !== undefined && query.session !== memory.session) return false;
    if (query.task && query.task !== '*' && query.task !== memory.task) return false;
    return true;
  }

  /** Trust score: source reliability × channel prior × instruction cleanliness. */
  trustScore(reliability: number, channel: MemoryChannel, instructionLikeness: number): number {
    const channelPrior: Record<MemoryChannel, number> = {
      user: 0.9,
      feedback: 0.9,
      consolidation: 0.75,
      agent: 0.7,
      tool_output: 0.6,
      artifact: 0.65,
      environment: 0.4,
    };
    const prior = channelPrior[channel] ?? 0.5;
    const instructionPenalty = 1 - instructionLikeness;
    return Math.min(1, reliability * 0.6 + prior * 0.4) * instructionPenalty;
  }

  /**
   * Poisoning watchdog (ASI06): a burst of anomalous writes from one scope
   * (many instruction-like items in a short window) triggers a quarantine
   * list and an alert.
   */
  observeWrite(scope: Scope, channel: MemoryChannel, instructionLikeness: number, targetId: string): void {
    const now = Date.now();
    this.recentWrites.push({ ts: now, scopeKey: projectKeyOf(scope), channel, instructionLikeness });
    this.watchdog.push({ ts: new Date(now), channel, scopeKey: projectKeyOf(scope), instructionLikeness, targetId });

    const window = this.recentWrites.filter((w) => now - w.ts <= this.burstWindowMs);
    const burst = window.filter(
      (w) => w.scopeKey === projectKeyOf(scope) && w.channel === channel && w.instructionLikeness >= 0.3,
    );
    if (burst.length >= this.quarantineBurstThreshold) {
      this.quarantineIds.add(targetId);
    }
  }

  quarantine(id: string): void {
    this.quarantineIds.add(id);
  }

  isQuarantined(id: string): boolean {
    return this.quarantineIds.has(id);
  }

  unquarantine(id: string): void {
    this.quarantineIds.delete(id);
  }

  alert(): Array<{ scopeKey: string; channel: MemoryChannel; count: number; suspected: boolean }> {
    const now = Date.now();
    const grouped = new Map<string, { scopeKey: string; channel: MemoryChannel; count: number }>();
    for (const w of this.recentWrites.filter((w) => now - w.ts <= this.burstWindowMs)) {
      const key = `${w.scopeKey}::${w.channel}`;
      const entry = grouped.get(key) ?? { scopeKey: w.scopeKey, channel: w.channel, count: 0 };
      entry.count++;
      grouped.set(key, entry);
    }
    return [...grouped.values()]
      .filter((g) => g.count >= this.quarantineBurstThreshold)
      .map((g) => ({ ...g, suspected: true }));
  }

  auditLog(): AuditEntry[] {
    return [...this.audit];
  }

  clearAudit(): void {
    this.audit = [];
  }

  snapshot(): { audit: AuditEntry[]; quarantineIds: string[] } {
    return {
      audit: this.audit.map((a) => structuredClone(a)),
      quarantineIds: [...this.quarantineIds],
    };
  }

  restore(data: { audit: AuditEntry[]; quarantineIds: string[] }): void {
    this.audit = data.audit.map((raw) => {
      const entry: AuditEntry = { ...raw };
      reviveDates(entry, ['ts']);
      return entry;
    });
    this.quarantineIds = new Set(data.quarantineIds);
  }

  private log(op: GateInput['op'], scope: Scope, channel: MemoryChannel, targetId: string, decision: GateDecision): void {
    this.audit.push({ ts: new Date(), op, scope, channel, targetId, decision: decision.admitted ? 'admitted' : 'blocked', detail: decision.reason });
  }
}
