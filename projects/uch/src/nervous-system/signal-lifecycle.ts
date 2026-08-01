/**
 * Signal Lifecycle Engine — prototype (IDEA-0084).
 *
 * Signals are stateful messages with lifecycle rules, like packets:
 * born with a TTL, decaying through a freshness curve (fresh →
 * useful → weak → expired), garbage-collected when expired, and
 * admitted through a noise gate that attenuates irrelevant
 * observations BEFORE they consume attention. Every decision is
 * ledgered — nothing is silent, and TTL gates live processing, never
 * replay.
 *
 * This is a PROTOTYPE (SOP-08 Prototype stage): a new module, not
 * wired into the bus. It reads Signal-shaped inputs (the
 * SignalPriority + freshness fields from signal.ts) and returns
 * lifecycle/GC/admission results.
 *
 * G1 evidence: research/foundations/21-signal-lifecycle.md
 * (RFC 791 TTL, RFC 1035 DNS TTL, RFC 5861 stale-while-revalidate,
 * Friston 2010 prediction-error salience, Broadbent 1958 filter
 * theory, Treisman 1964 attenuation).
 */

import type { SignalPriority } from './signal.js';

/** Freshness stage of a signal on its lifecycle curve. */
export type FreshnessStage = 'fresh' | 'useful' | 'weak' | 'expired';

/** Admission decision of the noise gate. */
export type AdmissionDecision = 'admit' | 'attenuate' | 'absorb';

export interface SignalLifecycleState {
  readonly signalId: string;
  readonly type: string;
  readonly priority: SignalPriority;
  readonly bornAt: number;
  readonly ttl: number;
  /** TTL = Infinity for never-expiring (emergency) signals. */
  readonly expires: boolean;
  readonly age: number;
  readonly stage: FreshnessStage;
  /** Class weight from repetition (Law 17 repetition path). */
  readonly classWeight: number;
}

export interface AdmissionRecord {
  readonly signalId: string;
  readonly decision: AdmissionDecision;
  readonly score: number;
  /** The noise-gate threshold that was applied. */
  readonly threshold: number;
  readonly reason: string;
  readonly tick: number;
}

export interface SignalLifecycleConfig {
  /** TTL (ticks) for emergency-tier signals (priority >= 3) — never
   * expires unless a finite value is configured. */
  readonly emergencyTtl: number;
  /** TTL for background-tier signals (priority 0). */
  readonly backgroundTtl: number;
  /** TTL for mid-tier signals (priority 1-2). */
  readonly midTtl: number;
  /** Noise-gate threshold: score below this absorbs at the lowest
   * capable layer (Law 15). */
  readonly absorbThreshold: number;
  /** Score between absorb and this is delivered attenuated. */
  readonly attenuateThreshold: number;
  /** Repetition weight gain per repeated signal of one (source, type)
   * class, capped. */
  readonly repetitionGain: number;
  /** Maximum class weight (Law 17 fusion ceiling). */
  readonly maxClassWeight: number;
}

export interface SignalLifecycleInput {
  readonly id: string;
  readonly type: string;
  readonly priority: SignalPriority;
  readonly bornAt: number;
  readonly source: string;
  /** Optional repetition count hint (defaults to engine-tracked count). */
  readonly repeatCount?: number;
}

const DEFAULT_CONFIG: SignalLifecycleConfig = {
  emergencyTtl: Infinity,
  backgroundTtl: 5,
  midTtl: 20,
  absorbThreshold: 0.15,
  attenuateThreshold: 0.35,
  repetitionGain: 0.05,
  maxClassWeight: 1.0,
};

/** Freshness curve: stage is a function of age/TTL. */
export function freshnessStage(age: number, ttl: number): FreshnessStage {
  if (ttl === Infinity) return 'fresh';
  if (ttl <= 0) return 'expired';
  const ratio = age / ttl;
  if (ratio >= 1) return 'expired';
  if (ratio >= 0.5) return 'weak';
  if (ratio >= 0.25) return 'useful';
  return 'fresh';
}

/** Per-type TTL from the priority tier: emergencies never expire;
 * background observations expire fast; mid-tier expires slowly. */
export function ttlForPriority(priority: SignalPriority, config?: Partial<SignalLifecycleConfig>): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (priority >= 3) return cfg.emergencyTtl;
  if (priority === 0) return cfg.backgroundTtl;
  return cfg.midTtl;
}

export class SignalLifecycleEngine {
  private readonly config: SignalLifecycleConfig;
  private readonly classWeights = new Map<string, number>();
  private readonly admissionLedger: AdmissionRecord[] = [];
  private readonly expiredLedger: Array<{ signalId: string; type: string; atTick: number }> = [];
  private readonly states = new Map<string, SignalLifecycleState>();

  constructor(config?: Partial<SignalLifecycleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register a signal at birth. Returns its lifecycle state — the
   * envelope evaluation against the current tick. */
  birth(signal: SignalLifecycleInput, tick: number): SignalLifecycleState {
    const ttl = ttlForPriority(signal.priority, this.config);
    const classKey = `${signal.source}::${signal.type}`;
    const priorCount = signal.repeatCount ?? this.classWeights.get(classKey) ?? 0;
    const classWeight = Math.min(this.config.maxClassWeight, priorCount + this.config.repetitionGain);
    this.classWeights.set(classKey, classWeight);
    const age = Math.max(0, tick - signal.bornAt);
    const state: SignalLifecycleState = {
      signalId: signal.id,
      type: signal.type,
      priority: signal.priority,
      bornAt: signal.bornAt,
      ttl,
      expires: ttl !== Infinity,
      age,
      stage: freshnessStage(age, ttl),
      classWeight,
    };
    this.states.set(signal.id, state);
    return Object.freeze(state);
  }

  /** Evaluate a registered signal at a later tick (freshness
   * re-evaluation without re-birth). */
  evaluate(signalId: string, tick: number): SignalLifecycleState | undefined {
    const state = this.states.get(signalId);
    if (!state) return undefined;
    const updated: SignalLifecycleState = {
      ...state,
      age: Math.max(0, tick - state.bornAt),
      stage: freshnessStage(Math.max(0, tick - state.bornAt), state.ttl),
    };
    this.states.set(signalId, updated);
    return Object.freeze(updated);
  }

  /** Is the signal expired at this tick? */
  isExpired(signalId: string, tick: number): boolean {
    const state = this.evaluate(signalId, tick);
    return state?.stage === 'expired';
  }

  /** GC pass: expire every signal past its TTL. Returns the expired
   * signals (the `signal:expired` event feed). Expired signals are
   * NOT delivered to cortex consumers, but the ledger records them —
   * TTL gates live processing, never replay. */
  expireDue(tick: number): Array<{ signalId: string; type: string; atTick: number }> {
    const expired: Array<{ signalId: string; type: string; atTick: number }> = [];
    for (const [id, state] of this.states) {
      const stage = freshnessStage(Math.max(0, tick - state.bornAt), state.ttl);
      if (stage === 'expired') {
        const entry = { signalId: id, type: state.type, atTick: tick };
        this.expiredLedger.push(entry);
        expired.push(entry);
        this.states.delete(id);
      }
    }
    return expired;
  }

  /** The noise gate: admission between the bus and the cortex.
   * Score = priority weight × freshness weight, amplified by the
   * class weight (the repetition path of Law 17); decisions are
   * ledgered with reasons, never silent. */
  admit(signal: SignalLifecycleState, tick: number): AdmissionRecord {
    const priorityWeight = (signal.priority + 1) / 5;
    const freshnessWeight =
      signal.stage === 'fresh' ? 1 : signal.stage === 'useful' ? 0.7 : signal.stage === 'weak' ? 0.35 : 0;
    const score = Math.min(1, priorityWeight * freshnessWeight + signal.classWeight * 0.5);
    const decision: AdmissionDecision =
      score < this.config.absorbThreshold ? 'absorb' : score < this.config.attenuateThreshold ? 'attenuate' : 'admit';
    const reason =
      decision === 'absorb'
        ? `absorbed at lowest capable layer (Law 15): score ${score.toFixed(3)}`
        : decision === 'attenuate'
          ? `attenuated: score ${score.toFixed(3)} below admit threshold ${this.config.attenuateThreshold}`
          : 'admit';
    const record: AdmissionRecord = { signalId: signal.signalId, decision, score, threshold: this.config.attenuateThreshold, reason, tick };
    this.admissionLedger.push(record);
    return Object.freeze(record);
  }

  /** The class weight for a (source, type) class — the repetition
   * amplification path of Law 17. */
  classWeightOf(source: string, type: string): number {
    return this.classWeights.get(`${source}::${type}`) ?? 0;
  }

  /** The noise gate's refusal ledger — a wrongly filtered signal can
   * be recovered from this audit trail (the filter's own SLO). */
  admissionLedgerFor(tick?: number): AdmissionRecord[] {
    return tick === undefined ? [...this.admissionLedger] : this.admissionLedger.filter((r) => r.tick === tick);
  }

  /** Signals expired so far (GC events). */
  expired(): Array<{ signalId: string; type: string; atTick: number }> {
    return [...this.expiredLedger];
  }

  /** Escape hatch documenting the replay rule: expired signals remain
   * in the ledger history (never purged from what replay can see). */
  replaySeesExpired(): boolean {
    return true;
  }

  /** The current lifecycle state of a signal, or undefined after GC. */
  stateOf(signalId: string): SignalLifecycleState | undefined {
    return this.states.get(signalId);
  }

  /** Number of signals alive (not yet GC'd). */
  stateOfCount(): number {
    return this.states.size;
  }

  clear(): void {
    this.states.clear();
    this.classWeights.clear();
    this.admissionLedger.length = 0;
    this.expiredLedger.length = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Derived helpers — consumable by the corpus                          */
/* ------------------------------------------------------------------ */

export interface SignalLifecycleReport {
  readonly alive: number;
  readonly expired: number;
  readonly admitted: number;
  readonly attenuated: number;
  readonly absorbed: number;
  /** Cortex-load proxy: the share of signals that reached admit. */
  readonly admissionRate: number;
}

/** Aggregate the lifecycle state into a report — the shape a
 * cortex-load SLO (IDEA-0071) would consume. Pure derivation. */
export function lifecycleReport(engine: SignalLifecycleEngine, tick: number): SignalLifecycleReport {
  const admissions = engine.admissionLedgerFor(tick);
  const admitted = admissions.filter((a) => a.decision === 'admit').length;
  const attenuated = admissions.filter((a) => a.decision === 'attenuate').length;
  const absorbed = admissions.filter((a) => a.decision === 'absorb').length;
  const total = admissions.length;
  return {
    alive: engine.stateOfCount(),
    expired: engine.expired().length,
    admitted,
    attenuated,
    absorbed,
    admissionRate: total > 0 ? admitted / total : 0,
  };
}
