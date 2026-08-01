/**
 * Signal Flow Control — prototype (IDEA-0085).
 *
 * Flow control for the signal fabric, the way a network has it:
 * bounded ingress queues with producer-facing backpressure,
 * per-source token buckets (RFC 2697 semantics), and a quality floor
 * (throttle vs quarantine) tied to budget health. Flow control gates
 * VOLUME; energy budgets gate cost; SLOs measure quality.
 *
 * Emergency traffic (priority >= 3, Law 16) bypasses bounded queues
 * via a preemption lane. Every refusal or delay is ledgered with a
 * reason — replay preserves the full causal picture, including
 * refusals.
 *
 * This is a PROTOTYPE (SOP-08 Prototype stage): a new module, not
 * wired into the bus. A submit() entry point models one signal's
 * journey: preemption lane → token bucket → queue → consume.
 *
 * G1 evidence: research/foundations/22-signal-flow-control.md
 * (RFC 793 TCP flow control; RFC 2697 srTCM token bucket; Reactive
 * Streams request(n); Little's law queue bound; Law 16 preemption;
 * ADR-002 ledgered replay).
 */

import type { SignalPriority } from './signal.js';

/** Why a signal was refused or delayed. */
export type RefusalReason = 'backpressure' | 'rate' | 'quarantine';

/** The token bucket's three-color classification (RFC 2697). */
export type TokenColor = 'green' | 'yellow' | 'red';

/** Health of the consumer's SLO error budget (IDEA-0071 input). */
export type BudgetHealth = 'healthy' | 'degraded' | 'exhausted';

export interface RefusalRecord {
  readonly signalId: string;
  readonly source: string;
  readonly type: string;
  readonly priority: SignalPriority;
  readonly reason: RefusalReason;
  readonly tick: number;
}

export interface ConsumedSignal {
  readonly signalId: string;
  readonly source: string;
  readonly type: string;
  readonly priority: SignalPriority;
  /** 'immediate' for preemption-lane traffic, else 'queued'. */
  readonly lane: 'immediate' | 'queued';
  readonly color: TokenColor;
  readonly queueDepthAtConsume: number;
}

export interface TokenBucketState {
  readonly tokens: number;
  readonly capacity: number;
  readonly color: TokenColor;
}

export interface FlowControlConfig {
  /** Default per-consumer queue depth. */
  readonly queueDepth: number;
  /** Queue occupancy ratio at which backpressure releases. */
  readonly releaseRatio: number;
  /** Emergency tier (Law 16): priority >= this bypasses queues. */
  readonly preemptionPriority: SignalPriority;
  /** Token bucket capacity per grant unit. */
  readonly bucketCapacity: number;
  /** Token refill per tick per grant unit. */
  readonly refillRate: number;
  /** Quarantine instead of rate-limit when budget exhausted. */
  readonly quarantineOnExhaustion: boolean;
}

export interface FlowControlSource {
  /** Grant magnitude (IDEA-0063) — token budget scales with it. */
  readonly grant: number;
  /** Current SLO error-budget health for this source's consumer. */
  readonly budgetHealth: BudgetHealth;
}

const DEFAULT_CONFIG: FlowControlConfig = {
  queueDepth: 100,
  releaseRatio: 0.5,
  preemptionPriority: 3,
  bucketCapacity: 10,
  refillRate: 1,
  quarantineOnExhaustion: true,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class SignalFlowController {
  private readonly config: FlowControlConfig;
  private readonly queues = new Map<string, ConsumedSignal[]>();
  private readonly tokens = new Map<string, TokenBucketState>();
  private readonly sources = new Map<string, FlowControlSource>();
  private readonly refusals: RefusalRecord[] = [];
  private readonly consumed: ConsumedSignal[] = [];
  private lastTick = 0;

  constructor(config?: Partial<FlowControlConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register a source (organ) with its grant magnitude and budget
   * health. Token buckets are derived from the grant, so admission is
   * budget-consistent, not arbitrary. */
  registerSource(source: string, state: FlowControlSource): void {
    this.sources.set(source, { ...state });
    const capacity = this.config.bucketCapacity * Math.max(0.1, state.grant);
    this.tokens.set(source, { tokens: capacity, capacity, color: 'green' });
  }

  /** Advance the tick: refill token buckets (rate × grant), and
   * re-evaluate budget-health-driven admission policy. */
  tick(n: number): void {
    if (n <= this.lastTick) return;
    for (const [source, state] of this.sources) {
      const bucket = this.tokens.get(source);
      if (!bucket) continue;
      const refill = this.config.refillRate * Math.max(0.1, state.grant);
      const tokens = clamp(bucket.tokens + refill, 0, bucket.capacity);
      const color: TokenColor = state.budgetHealth === 'exhausted' ? 'red' : tokens > 0 ? 'green' : 'red';
      this.tokens.set(source, { tokens, capacity: bucket.capacity, color });
    }
    this.lastTick = n;
  }

  /** Submit a signal on its journey. Returns the refusal record if
   * the signal was refused (never silently dropped), or null if it
   * was admitted to a lane/queue. */
  submit(input: {
    signalId: string;
    source: string;
    type: string;
    priority: SignalPriority;
    tick: number;
  }): RefusalRecord | null {
    const { signalId, source, type, priority, tick } = input;
    if (tick > this.lastTick) this.tick(tick);

    /* Emergency tier bypasses bounded queues entirely (Law 16 —
     * preemption lanes are structural, not best-effort). */
    if (priority >= this.config.preemptionPriority) {
      this.consumed.push({
        signalId,
        source,
        type,
        priority,
        lane: 'immediate',
        color: 'green',
        queueDepthAtConsume: this.queueOccupancy(source),
      });
      return null;
    }

    const bucket = this.tokens.get(source);
    if (!bucket) return this.refuse({ signalId, source, type, priority, reason: 'quarantine', tick });

    /* Quality floor: exhausted budget → quarantine (defer to
     * circuit-breaker semantics until recovery). */
    const sourceState = this.sources.get(source);
    if (sourceState?.budgetHealth === 'exhausted') {
      if (this.config.quarantineOnExhaustion) {
        return this.refuse({ signalId, source, type, priority, reason: 'quarantine', tick });
      }
    }

    /* Token bucket: red → rate-limited refusal. */
    if (bucket.color === 'red' || bucket.tokens <= 0) {
      return this.refuse({ signalId, source, type, priority, reason: 'rate', tick });
    }
    this.tokens.set(source, { ...bucket, tokens: bucket.tokens - 1 });

    /* Backpressure: bounded ingress queue; saturation refuses
     * (ledgered), never silently drops. */
    const queue = this.queues.get(source) ?? [];
    if (queue.length >= this.config.queueDepth) {
      return this.refuse({ signalId, source, type, priority, reason: 'backpressure', tick });
    }
    queue.push({ signalId, source, type, priority, lane: 'queued', color: bucket.color, queueDepthAtConsume: queue.length });
    this.queues.set(source, queue);
    return null;
  }

  /** Drain a consumer's queue. Returns the signals delivered — the
   * consumer's own consume() call reports occupancy, which drives
   * backpressure release. */
  drain(source: string): ConsumedSignal[] {
    const queue = this.queues.get(source) ?? [];
    this.queues.delete(source);
    for (const signal of queue) this.consumed.push(signal);
    return queue;
  }

  /** Is this source currently backpressured (queue saturated)? */
  isBackpressured(source: string): boolean {
    const queue = this.queues.get(source) ?? [];
    return queue.length >= this.config.queueDepth;
  }

  /** The preemption-lane delivery the emergency signal got. */
  delivered(): ConsumedSignal[] {
    return [...this.consumed];
  }

  /** The refusal ledger — replay preserves refused signals too. */
  refusalsFor(tick?: number): RefusalRecord[] {
    return tick === undefined ? [...this.refusals] : this.refusals.filter((r) => r.tick === tick);
  }

  /** Current token-bucket state for a source. */
  bucketOf(source: string): TokenBucketState | undefined {
    const bucket = this.tokens.get(source);
    return bucket ? { ...bucket } : undefined;
  }

  queueOccupancy(source: string): number {
    return (this.queues.get(source) ?? []).length;
  }

  /** Total signals queued across all consumers. */
  totalQueued(): number {
    let total = 0;
    for (const queue of this.queues.values()) total += queue.length;
    return total;
  }

  private refuse(record: RefusalRecord): RefusalRecord {
    this.refusals.push(record);
    return Object.freeze(record);
  }
}

/* ------------------------------------------------------------------ */
/* Derived helpers — consumable by the corpus                          */
/* ------------------------------------------------------------------ */

export interface FlowControlReport {
  readonly queued: number;
  readonly delivered: number;
  readonly refusedByBackpressure: number;
  readonly refusedByRate: number;
  readonly refusedByQuarantine: number;
  /** Share of traffic refused — the fabric's loss metric. */
  readonly refusalRate: number;
}

/** Aggregate flow-control state into a report — the shape a
 * fabric-health SLO would consume. Pure derivation. */
export function flowControlReport(controller: SignalFlowController, tick: number): FlowControlReport {
  const refusals = controller.refusalsFor(tick);
  const delivered = controller.delivered().length;
  const refusedByBackpressure = refusals.filter((r) => r.reason === 'backpressure').length;
  const refusedByRate = refusals.filter((r) => r.reason === 'rate').length;
  const refusedByQuarantine = refusals.filter((r) => r.reason === 'quarantine').length;
  const total = delivered + refusals.length;
  return {
    queued: controller.totalQueued(),
    delivered,
    refusedByBackpressure,
    refusedByRate,
    refusedByQuarantine,
    refusalRate: total > 0 ? refusals.length / total : 0,
  };
}
