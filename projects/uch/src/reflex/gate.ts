import * as path from 'node:path';
import { createSignal } from '../nervous-system/signal.js';
import type { NeuralEvent } from '../event-bus/neural-event-bus.js';
import type {
  ReflexCheck,
  ReflexEvidence,
  ReflexGateConfig,
  ReflexResult,
  WriteProposal,
} from './types.js';

export const PAIN_ESCALATION_THRESHOLD = 0.7;

interface OverrideConfig {
  enabled: boolean;
  names: string[];
}

export class ReflexGate {
  private zoneAffect: (zone: string) => number;
  private signalSink: (signal: ReturnType<typeof createSignal>) => void;
  private eventSink: (event: Omit<NeuralEvent, 'id' | 'timestamp'>) => void;
  private override: OverrideConfig;
  private checks: ReflexCheck[] = [];

  constructor(config?: ReflexGateConfig) {
    this.zoneAffect = config?.zoneAffect ?? (() => 0);
    this.signalSink = config?.signalSink ?? (() => {});
    this.eventSink = config?.eventSink ?? (() => {});
    this.override = {
      enabled: config?.override?.enabled ?? true,
      names: this.mergeOverrideNames(config?.override?.names),
    };
    if (config?.checks) this.checks = [...config.checks];
  }

  register(check: ReflexCheck): void {
    const existing = this.checks.findIndex((c) => c.id === check.id);
    if (existing >= 0) {
      this.checks[existing] = check;
    } else {
      this.checks.push(check);
    }
  }

  getChecks(): ReflexCheck[] {
    return [...this.checks];
  }

  evaluate(proposal: WriteProposal): ReflexResult {
    const start = Date.now();
    const zone = proposal.zone ?? this.zoneOf(proposal.target);
    const affect = this.zoneAffect(zone);
    const ctx = { zoneAffect: () => affect };

    const checksRun: string[] = [];
    const evidence: ReflexEvidence[] = [];
    for (const check of this.checks) {
      checksRun.push(check.id);
      const finding = check.evaluate(proposal, ctx);
      if (finding) evidence.push(finding);
    }

    const escalated = this.escalateByPain(evidence, affect);
    const suppressed = escalated.filter((e) => this.isSuppressed(e.check_id));
    const effective = escalated.filter((e) => !this.isSuppressed(e.check_id));

    let verdict: ReflexResult['verdict'] = 'allow';
    if (effective.some((e) => e.level === 'block')) verdict = 'block';
    else if (effective.some((e) => e.level === 'defer')) verdict = 'defer';

    const override = suppressed.length > 0
      ? { name: suppressed[0]!.check_id, recorded: true }
      : undefined;

    if (override) {
      this.recordBlock(proposal, suppressed[0]!, override, false);
    } else if (verdict === 'block') {
      const first = effective.find((e) => e.level === 'block')!;
      this.recordBlock(proposal, first);
    } else if (verdict === 'defer') {
      this.recordDefer(proposal, effective);
    } else {
      this.recordAllow(proposal, checksRun, Date.now() - start);
    }

    return {
      verdict,
      checks_run: checksRun,
      evidence: escalated,
      override,
      duration_ms: Date.now() - start,
      target: proposal.target,
    };
  }

  private zoneOf(target: string): string {
    return /[\\/]/.test(target) ? path.dirname(target) : target;
  }

  private escalateByPain(evidence: ReflexEvidence[], affect: number): ReflexEvidence[] {
    if (affect < PAIN_ESCALATION_THRESHOLD) return evidence;
    return evidence.map((e) =>
      e.level === 'defer' ? { ...e, level: 'block' as const } : e,
    );
  }

  private isSuppressed(checkId: string): boolean {
    if (!this.override.enabled) return false;
    return this.override.names.includes('*') || this.override.names.includes(checkId);
  }

  private blockPayload(
    proposal: WriteProposal,
    evidence: ReflexEvidence,
    override?: { name: string; recorded: boolean },
  ): Record<string, unknown> {
    return {
      gate: 'reflex',
      tool: proposal.tool,
      target: proposal.target,
      check_id: evidence.check_id,
      rule: evidence.rule,
      evidence: evidence.evidence,
      threshold: evidence.threshold,
      reason: evidence.reason,
      override,
    };
  }

  private recordBlock(
    proposal: WriteProposal,
    evidence: ReflexEvidence,
    override?: { name: string; recorded: boolean },
    emitSignal = true,
  ): void {
    const payload = this.blockPayload(proposal, evidence, override);
    this.safeEvent({ type: 'governance:event_denied' as const, source: 'reflex-gate', payload });
    if (!emitSignal) return;
    this.safeSignal(createSignal(
      'error:occurred',
      'reflex-gate',
      { ...payload, verdict: 'block' },
      { interrupt: true, interruptLevel: 2 },
    ));
  }

  private recordDefer(proposal: WriteProposal, evidence: ReflexEvidence[]): void {
    const payload = {
      tool: proposal.tool,
      target: proposal.target,
      checks: evidence.filter((e) => e.level === 'defer').map((e) => e.check_id),
      reason: evidence[0]?.reason ?? 'no evidence',
    };
    this.safeEvent({ type: 'review:requested' as const, source: 'reflex-gate', payload });
    this.safeSignal(createSignal(
      'review:requested',
      'reflex-gate',
      { ...payload, verdict: 'defer' },
      { interrupt: false },
    ));
  }

  private recordAllow(proposal: WriteProposal, checksRun: string[], durationMs: number): void {
    this.safeEvent({
      type: 'tool:called' as const,
      source: 'reflex-gate',
      payload: {
        tool: proposal.tool,
        target: proposal.target,
        verdict: 'allow',
        checks_run: checksRun,
        duration_ms: durationMs,
      },
    });
  }

  private safeEvent(event: Omit<NeuralEvent, 'id' | 'timestamp'>): void {
    try {
      this.eventSink(event);
    } catch {
      // Recording must never break enforcement.
    }
  }

  private safeSignal(signal: ReturnType<typeof createSignal>): void {
    try {
      this.signalSink(signal);
    } catch {
      // Recording must never break enforcement.
    }
  }

  private mergeOverrideNames(names?: string[]): string[] {
    const merged = new Set(names ?? []);
    const env = process.env.UCH_REFLEX_OVERRIDE;
    if (env) {
      for (const entry of env.split(',')) {
        const id = entry.trim();
        if (id) merged.add(id);
      }
    }
    return [...merged];
  }
}
