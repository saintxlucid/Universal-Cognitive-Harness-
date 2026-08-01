/**
 * Attention Algebra — prototype (IDEA-0093).
 *
 * Attention is a conserved quantity: per cognitive tick, the sum of
 * attention over all signal sources cannot exceed the attention
 * budget. It is a measure, not a score — allocated, spent, and
 * restored by the tick. Named operators transform allocations:
 * focus (concentrate), split (divide), merge (fuse — merged
 * attention is LESS than the sum, the conserved-resource law),
 * diffuse (spread for vigilance), attenuate (novelty/habituation
 * decay), amplify (repetition strengthening).
 *
 * This is a PROTOTYPE (SOP-08 Prototype stage): a new module, not
 * wired into any gate. Its value is BINDING — the corpus's three
 * ad-hoc attention numbers (AttentionCortex bottleneck, the
 * attention.saturation SLO, the allocator's allowance) all become
 * instances of one conserved system with testable invariants.
 *
 * G1 evidence: research/foundations/20-attention-algebra.md
 * (Kahneman 1973 limited capacity; Norman & Bobrow 1975
 * resource-limited processes; Lavie 1995 load theory; Wickens
 * 1984/2002 multiple resources; Treisman 1964 attenuation;
 * Busemeyer et al. 2008 non-commutative transforms).
 */

export type AttentionOperator = 'focus' | 'split' | 'merge' | 'diffuse' | 'attenuate' | 'amplify';

/** A single allocation of attention to a source. */
export interface AttentionAllocation {
  readonly source: string;
  readonly amount: number;
  /** The operator that produced this allocation. */
  readonly operator: AttentionOperator;
  readonly tick: number;
}

/** Append-only ledger entry: every allocation decision, oldest first.
 * The ledger is the observability surface — nothing is silent. */
export interface AllocationRecord extends AttentionAllocation {
  readonly budgetAtTick: number;
  /** For merge: the sources fused. For amplify: the prior amount. */
  readonly origin?: string[];
  /** For attenuate: the amount released back to the pool. */
  readonly released?: number;
}

export interface AttentionAlgebraConfig {
  /** Per-source amplification ceiling (fraction of budget). */
  readonly amplifyMax: number;
  /** Merge subadditivity factor: fused = sum × factor (factor < 1). */
  readonly mergeFactor: number;
  /** Maximum per-source share for diffuse (vigilance ceiling). */
  readonly diffuseCeiling: number;
  /** Default factor for attenuate. */
  readonly attenuateDefault: number;
}

export interface AttentionAllocationSummary {
  readonly totalAllocated: number;
  readonly reserved: number;
  readonly budget: number;
  readonly sources: number;
  /** Current allocations per source (post-attenuation state). */
  readonly allocations: readonly AttentionAllocation[];
}

const DEFAULT_CONFIG: AttentionAlgebraConfig = {
  amplifyMax: 0.5,
  mergeFactor: 0.8,
  diffuseCeiling: 0.25,
  attenuateDefault: 0.5,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class AttentionAlgebra {
  private readonly config: AttentionAlgebraConfig;
  private readonly records: AllocationRecord[] = [];
  private readonly budgets = new Map<number, number>();
  private readonly reserved = new Map<number, number>();
  private readonly current = new Map<string, number>();

  constructor(config?: Partial<AttentionAlgebraConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /* ------------------------------------------------------------------ */
  /* Allocation state                                                   */
  /* ------------------------------------------------------------------ */

  /** Start a tick with the budget granted by the allocator (IDEA-0063)
   * — the algebra never invents budget. */
  beginTick(tick: number, budget: number): void {
    if (budget <= 0) throw new Error(`attention budget must be positive, got ${budget}`);
    this.budgets.set(tick, budget);
    this.reserved.set(tick, budget);
    this.current.clear();
  }

  /** The share of this tick's budget still available for allocation. */
  available(tick: number): number {
    return this.reserved.get(tick) ?? 0;
  }

  /* ------------------------------------------------------------------ */
  /* Operators                                                          */
  /* ------------------------------------------------------------------ */

  /** Concentrate `share` of the budget on one source. The remainder
   * stays reserved; it is never silently reassigned. */
  focus(tick: number, source: string, share: number): AttentionAllocation {
    const amount = this.take(tick, source, clamp(share, 0, 1) * this.budgetOf(tick));
    return this.record({ source, amount, operator: 'focus', tick });
  }

  /** Divide the budget across sources by weights. Σ shares ≤ 1 is
   * enforced: weights are normalized, and the total is capped at the
   * reserved pool. */
  split(tick: number, sources: readonly string[], weights: readonly number[]): AttentionAllocation[] {
    if (sources.length === 0) return [];
    if (sources.length !== weights.length) {
      throw new Error(`split: ${sources.length} sources but ${weights.length} weights`);
    }
    const budget = this.budgetOf(tick);
    const weightSum = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
    if (weightSum <= 0) return [];
    const allocations: AttentionAllocation[] = [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const w = weights[i];
      if (!source || w === undefined) continue;
      const amount = this.take(tick, source, (w / weightSum) * budget);
      allocations.push(this.record({ source, amount, operator: 'split', tick }));
    }
    return allocations;
  }

  /** Fuse weak signals into one allocation. The fused share is LESS
   * than the sum of the parts (conservation — "Attention + Attention
   * ≠ Double Attention"): fusion costs attention. */
  merge(tick: number, target: string, sources: readonly AttentionAllocation[]): AttentionAllocation {
    const sum = sources.reduce((total, a) => total + a.amount, 0);
    const amount = this.take(tick, target, sum * this.config.mergeFactor);
    return this.record({
      source: target,
      amount,
      operator: 'merge',
      tick,
      origin: sources.map((s) => s.source),
    });
  }

  /** Spread the budget thinly for vigilance. Each share is
   * budget/n, capped at the diffuse ceiling. */
  diffuse(tick: number, n: number): AttentionAllocation[] {
    if (n <= 0) return [];
    const budget = this.budgetOf(tick);
    const share = Math.min(budget / n, this.config.diffuseCeiling * budget);
    const allocations: AttentionAllocation[] = [];
    for (let i = 0; i < n; i++) {
      const amount = this.take(tick, `vigilance:${i}`, share);
      allocations.push(this.record({ source: `vigilance:${i}`, amount, operator: 'diffuse', tick }));
    }
    return allocations;
  }

  /** Reduce a source's allocation. The released amount returns to the
   * reserved pool for reallocation in the same tick — it is never
   * destroyed and never silently reassigned. */
  attenuate(tick: number, source: string, factor?: number): AttentionAllocation {
    const f = clamp(factor ?? this.config.attenuateDefault, 0, 1);
    const current = this.current.get(source) ?? 0;
    const remaining = current * (1 - f);
    this.current.set(source, remaining);
    const released = current - remaining;
    this.reserved.set(tick, (this.reserved.get(tick) ?? 0) + released);
    return this.record({ source, amount: remaining, operator: 'attenuate', tick, released });
  }

  /** Increase a source's share by repetition, bounded by the
   * per-source max and by the available pool. Amplification draws
   * from the pool — it never violates conservation. */
  amplify(tick: number, source: string, boost: number, max?: number): AttentionAllocation {
    const current = this.current.get(source) ?? 0;
    const ceiling = max ?? this.config.amplifyMax * this.budgetOf(tick);
    const target = Math.min(current + boost, ceiling, current + this.available(tick));
    const amount = this.take(tick, source, target - current);
    return this.record({ source, amount: current + amount, operator: 'amplify', tick });
  }

  /* ------------------------------------------------------------------ */
  /* Observability                                                      */
  /* ------------------------------------------------------------------ */

  /** The append-only allocation ledger for a tick (oldest first). */
  recordsFor(tick: number): AllocationRecord[] {
    return this.records.filter((r) => r.tick === tick);
  }

  /** The ledger in full — replay-complete sequence of decisions. */
  fullLedger(): AllocationRecord[] {
    return [...this.records];
  }

  /** Current allocation of a source in a tick (post-attenuation). */
  allocatedTo(source: string): number {
    return this.current.get(source) ?? 0;
  }

  summary(tick: number): AttentionAllocationSummary {
    const bySource = new Map<string, number>();
    for (const record of this.recordsFor(tick)) bySource.set(record.source, record.amount);
    const allocations: AttentionAllocation[] = [];
    for (const [source, amount] of bySource) {
      if (amount > 0) allocations.push({ source, amount, operator: 'focus', tick });
    }
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    return {
      totalAllocated,
      reserved: this.available(tick),
      budget: this.budgetOf(tick),
      sources: allocations.length,
      allocations,
    };
  }

  /** Conservation check: Σ current allocations ≤ budget for the tick.
   * The algebra's headline invariant. */
  conservationHolds(tick: number): boolean {
    let total = 0;
    for (const amount of this.current.values()) total += amount;
    return total <= this.budgetOf(tick) + 1e-9;
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                          */
  /* ------------------------------------------------------------------ */

  private budgetOf(tick: number): number {
    const budget = this.budgets.get(tick);
    if (budget === undefined) {
      throw new Error(`attention algebra: no budget for tick ${tick} (call beginTick first)`);
    }
    return budget;
  }

  /** Take `amount` from the reserved pool for `source`. Capped at the
   * pool — allocation never exceeds conservation. */
  private take(tick: number, source: string, amount: number): number {
    if (amount <= 0) return 0;
    const reserved = this.reserved.get(tick) ?? 0;
    const granted = Math.min(amount, reserved);
    this.reserved.set(tick, reserved - granted);
    this.current.set(source, (this.current.get(source) ?? 0) + granted);
    return granted;
  }

  private record(allocation: AttentionAllocation & { origin?: string[]; released?: number }): AttentionAllocation {
    const { origin, released, ...rest } = allocation;
    this.records.push({
      ...rest,
      budgetAtTick: this.budgetOf(allocation.tick),
      ...(origin !== undefined ? { origin } : {}),
      ...(released !== undefined ? { released } : {}),
    });
    return Object.freeze({ ...rest });
  }
}

/* ------------------------------------------------------------------ */
/* Derived helpers — consumable by the corpus                          */
/* ------------------------------------------------------------------ */

export interface AttentionWindowState {
  readonly tick: number;
  /** Sources admitted to the window this tick, with their shares. */
  readonly window: readonly AttentionAllocation[];
  /** The conserved budget for the tick (the SLO's reference value). */
  readonly budget: number;
  /** Saturation: total allocated / budget — the SLO's metric. */
  readonly saturation: number;
}

/**
 * Derive the attention window from an algebra tick — the shape the
 * AttentionCortex bottleneck would consume. Pure derivation; nothing
 * is wired (SOP-08 Prototype discipline).
 */
export function attentionWindow(algebra: AttentionAlgebra, tick: number): AttentionWindowState {
  const summary = algebra.summary(tick);
  return {
    tick,
    window: summary.allocations,
    budget: summary.budget,
    saturation: summary.budget > 0 ? summary.totalAllocated / summary.budget : 0,
  };
}
