/**
 * IDEA-0070 — Organ Health, Watchdogs & Safe Mode (prototype).
 *
 * Per-organ health state machine (alive → healthy → degraded →
 * recovering → failed, plus sleeping), tick-based heartbeat watchdogs
 * with graduated escalation, a bounded self-healing loop (restart →
 * recovering → replay → healthy), and safe-mode boot gating.
 * Deterministic: tick-based, no wall clock, no randomness.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type HealthState = 'alive' | 'healthy' | 'degraded' | 'recovering' | 'failed' | 'sleeping';

export interface OrganHealthRecord {
  readonly organId: string;
  state: HealthState;
  lastHeartbeatTick: number;
  missedBeats: number;
  recoveryAttempts: number;
  restarts: number;
}

export interface WatchdogConfig {
  /** Missed beats before healthy → degraded. */
  readonly degradeAfter: number;
  /** Missed beats before degraded → recovering (restart triggered). */
  readonly recoverAfter: number;
  /** Max restarts within the window before the organ is failed. */
  readonly maxRestarts: number;
}

export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  degradeAfter: 2,
  recoverAfter: 4,
  maxRestarts: 3,
};

export type HealthEvent =
  | { readonly kind: 'degraded'; readonly organId: string }
  | { readonly kind: 'recovering'; readonly organId: string; readonly replayRequired: boolean }
  | { readonly kind: 'recovered'; readonly organId: string }
  | { readonly kind: 'failed'; readonly organId: string; readonly reason: string }
  | { readonly kind: 'suspended'; readonly organId: string }
  | { readonly kind: 'resumed'; readonly organId: string };

export class HealthRegistry {
  private organs = new Map<string, OrganHealthRecord>();
  private events: HealthEvent[] = [];

  constructor(private readonly config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG) {}

  register(organId: string): void {
    this.organs.set(organId, {
      organId,
      state: 'alive',
      lastHeartbeatTick: 0,
      missedBeats: 0,
      recoveryAttempts: 0,
      restarts: 0,
    });
  }

  get(organId: string): OrganHealthRecord | undefined {
    return this.organs.get(organId);
  }

  list(): OrganHealthRecord[] {
    return Array.from(this.organs.values());
  }

  reportHeartbeat(organId: string, tick: number, state: HealthState = 'healthy'): void {
    const record = this.organs.get(organId);
    if (!record) return;
    record.lastHeartbeatTick = tick;
    record.missedBeats = 0;
    record.state = state === 'recovering' ? 'recovering' : 'healthy';
  }

  suspend(organId: string, tick: number): void {
    const record = this.organs.get(organId);
    if (!record || record.state === 'failed') return;
    record.state = 'sleeping';
    record.lastHeartbeatTick = tick;
    this.events.push({ kind: 'suspended', organId });
  }

  resume(organId: string, tick: number): void {
    const record = this.organs.get(organId);
    if (!record || record.state !== 'sleeping') return;
    record.state = 'alive';
    record.lastHeartbeatTick = tick;
    record.missedBeats = 0;
    this.events.push({ kind: 'resumed', organId });
  }

  /**
   * Advances the watchdog one tick: organs with missed beats escalate
   * (healthy → degraded → recovering), and recovering organs that
   * report no heartbeat within the window restart (bounded).
   */
  tick(tick: number): HealthEvent[] {
    const fired: HealthEvent[] = [];
    for (const record of this.organs.values()) {
      if (record.state === 'sleeping' || record.state === 'failed') continue;
      if (tick - record.lastHeartbeatTick > 0) record.missedBeats += 1;

      if (record.state === 'healthy' && record.missedBeats >= this.config.degradeAfter) {
        record.state = 'degraded';
        fired.push({ kind: 'degraded', organId: record.organId });
      } else if (record.state === 'degraded' && record.missedBeats >= this.config.recoverAfter) {
        this.restart(record, tick, fired);
      } else if (record.state === 'recovering' && record.missedBeats >= this.config.recoverAfter) {
        this.restart(record, tick, fired);
      }
    }
    this.events.push(...fired);
    return fired;
  }

  /** Self-healing: restart → recovering (requires signal replay) → healthy. */
  reportRecovered(organId: string, tick: number): void {
    const record = this.organs.get(organId);
    if (!record || record.state !== 'recovering') return;
    record.state = 'healthy';
    record.missedBeats = 0;
    record.lastHeartbeatTick = tick;
    this.events.push({ kind: 'recovered', organId });
  }

  eventsSince(): HealthEvent[] {
    return [...this.events];
  }

  private restart(record: OrganHealthRecord, tick: number, fired: HealthEvent[]): void {
    record.recoveryAttempts += 1;
    record.restarts += 1;
    if (record.restarts > this.config.maxRestarts) {
      record.state = 'failed';
      fired.push({ kind: 'failed', organId: record.organId, reason: 'restart budget exhausted' });
      return;
    }
    record.state = 'recovering';
    record.missedBeats = 0;
    record.lastHeartbeatTick = tick;
    fired.push({ kind: 'recovering', organId: record.organId, replayRequired: true });
  }
}

// ── Safe mode ──────────────────────────────────────────────

export type BootMode = 'normal' | 'safe';

export interface BootPlan {
  readonly mode: BootMode;
  /** Organs allowed to load; safe mode admits kernel + constitution only. */
  readonly allowedOrgans: readonly string[];
}

export const SAFE_MODE_ORGANS: readonly string[] = ['kernel', 'constitution'];

/** Gates a boot plan: safe mode drops learning, plugins, evolution organs. */
export function bootPlan(mode: BootMode, requested: readonly string[]): BootPlan {
  if (mode === 'normal') return { mode, allowedOrgans: [...requested] };
  const allowed = requested.filter((o) => SAFE_MODE_ORGANS.includes(o));
  return { mode, allowedOrgans: allowed };
}
