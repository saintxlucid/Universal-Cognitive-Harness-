// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Importance economy (ECAN-inspired)
// STI (short-term importance) — current relevance, drives context admission.
// LTI (long-term importance)  — expected future usefulness, drives retention.
// VLTI (very-long-term)       — archive vs delete.
// ROI ledger — memory must earn its tokens.
// ═══════════════════════════════════════════════════════════════════════════

import type { MemoryClass, MemoryTier, RoiEntry } from './types.js';

export interface EconomyConfig {
  ltiReinforcement: number; // LTI gained per successful use
  ltiDisconfirmation: number; // LTI lost when contradicted
  ltiDecayFactor: number; // multiplicative decay per epoch
  coreLtiFloor: number; // LTI above which a memory survives pruning
  archivalLtiFloor: number;
  stiBoost: number; // STI gained on query match
}

export const DEFAULT_ECONOMY: EconomyConfig = {
  ltiReinforcement: 0.15,
  ltiDisconfirmation: 0.4,
  ltiDecayFactor: 0.9,
  coreLtiFloor: 0.6,
  archivalLtiFloor: 0.25,
  stiBoost: 0.2,
};

export class ImportanceEconomy {
  private sti = new Map<string, number>();
  private lti = new Map<string, number>();
  private vlti = new Map<string, number>();
  private config: EconomyConfig;

  constructor(config: EconomyConfig = DEFAULT_ECONOMY) {
    this.config = config;
  }

  seed(id: string, importance: number): void {
    this.sti.set(id, Math.min(1, importance));
    this.lti.set(id, Math.min(1, 0.3 + importance * 0.5));
    this.vlti.set(id, 0);
  }

  getSti(id: string): number {
    return this.sti.get(id) ?? 0;
  }

  getLti(id: string): number {
    return this.lti.get(id) ?? 0;
  }

  getVlti(id: string): number {
    return this.vlti.get(id) ?? 0;
  }

  /** Query match → momentary relevance (DA-modulated in the orchestration layer). */
  boostSti(id: string, amount = this.config.stiBoost): void {
    this.sti.set(id, Math.min(1, this.getSti(id) + amount));
  }

  /** Successful use → LTI reinforcement (reward signal). */
  reinforce(id: string, reward: number): void {
    const delta = this.config.ltiReinforcement * Math.max(0, reward);
    this.lti.set(id, Math.min(1, this.getLti(id) + delta));
    this.sti.set(id, Math.min(1, this.getSti(id) + delta));
  }

  /** Evidence against → LTI disconfirmation. */
  disconfirm(id: string): void {
    const delta = this.config.ltiDisconfirmation;
    this.lti.set(id, Math.max(0, this.getLti(id) - delta));
  }

  /** Periodic metabolic decay; re-confirmed memories resist it. */
  decay(ids: Iterable<string>, reConfirmed: Set<string>): void {
    for (const id of ids) {
      if (reConfirmed.has(id)) continue;
      const current = this.getLti(id);
      this.lti.set(id, Math.max(0, current * this.config.ltiDecayFactor));
      const stiCurrent = this.getSti(id);
      this.sti.set(id, Math.max(0, stiCurrent * 0.5));
    }
  }

  setVlti(id: string, value: number): void {
    this.vlti.set(id, Math.min(1, Math.max(0, value)));
  }

  /**
   * Tier decision by the economy: LTI governs retention (ECAN).
   */
  tierOf(id: string, importance: number): MemoryTier {
    const l = this.getLti(id);
    if (l >= this.config.coreLtiFloor || importance >= 0.85) return 'core';
    if (l >= this.config.archivalLtiFloor) return 'archival';
    return 'archive';
  }

  snapshot(): Map<string, { sti: number; lti: number; vlti: number }> {
    const out = new Map<string, { sti: number; lti: number; vlti: number }>();
    for (const id of this.lti.keys()) {
      out.set(id, { sti: this.getSti(id), lti: this.getLti(id), vlti: this.getVlti(id) });
    }
    return out;
  }

  restore(snapshot: Map<string, { sti: number; lti: number; vlti: number }>): void {
    this.sti.clear();
    this.lti.clear();
    this.vlti.clear();
    for (const [id, v] of snapshot) {
      this.sti.set(id, v.sti);
      this.lti.set(id, v.lti);
      this.vlti.set(id, v.vlti);
    }
  }
}

/**
 * ROI ledger: tokens spent on retrieval vs outcomes achieved.
 * The metacognition loop reviews class-level ROI and tunes budgets.
 */
export class RoiLedger {
  private entries: RoiEntry[] = [];

  recordUse(memoryId: string, memoryClass: MemoryClass, tokensSpent: number, outcome: number): void {
    this.entries.push({ memoryId, memoryClass, tokensSpent, outcome, ts: new Date() });
  }

  roiOf(memoryId: string): number {
    const mine = this.entries.filter((e) => e.memoryId === memoryId);
    if (mine.length === 0) return 0;
    const tokens = mine.reduce((s, e) => s + e.tokensSpent, 0);
    const outcome = mine.reduce((s, e) => s + e.outcome, 0);
    if (tokens === 0) return 0;
    return outcome / tokens;
  }

  classRoi(memoryClass: MemoryClass): number {
    const mine = this.entries.filter((e) => e.memoryClass === memoryClass);
    if (mine.length === 0) return 0;
    const tokens = mine.reduce((s, e) => s + e.tokensSpent, 0);
    const outcome = mine.reduce((s, e) => s + e.outcome, 0);
    if (tokens === 0) return 0;
    return outcome / tokens;
  }

  total(): { tokens: number; outcome: number; uses: number } {
    return {
      tokens: this.entries.reduce((s, e) => s + e.tokensSpent, 0),
      outcome: this.entries.reduce((s, e) => s + e.outcome, 0),
      uses: this.entries.length,
    };
  }

  clear(): void {
    this.entries = [];
  }
}
