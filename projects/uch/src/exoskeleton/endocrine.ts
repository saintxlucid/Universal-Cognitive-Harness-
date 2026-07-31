import { NervousSystem } from '../nervous-system/nervous-system.js';
import type { Signal } from '../nervous-system/signal.js';
import { Consciousness } from '../aether/consciousness.js';

export interface GlobalSignals {
  urgency: number;
  confidence: number;
  uncertainty: number;
  resourcePressure: number;
  technicalDebtLevel: number;
  riskLevel: number;
  userSatisfactionTrend: number;
  cognitiveLoad: number;
}

export class EndocrineSystem {
  private nervousSystem: NervousSystem;
  private consciousness: Consciousness;
  private signals: GlobalSignals;
  private history: GlobalSignals[] = [];
  private unsubIds: string[] = [];

  constructor(nervousSystem: NervousSystem, consciousness: Consciousness) {
    this.nervousSystem = nervousSystem;
    this.consciousness = consciousness;
    this.signals = {
      urgency: 0.5,
      confidence: 0.8,
      uncertainty: 0.2,
      resourcePressure: 0.3,
      technicalDebtLevel: 0.3,
      riskLevel: 0.3,
      userSatisfactionTrend: 0.5,
      cognitiveLoad: 0.3,
    };

    const id = this.nervousSystem.subscribe('brainstem', (signal: Signal) => {
      this.onSignal(signal);
    }, undefined, 'endocrine-listener');
    this.unsubIds.push(id);
  }

  private onSignal(signal: Signal): void {
    if (signal.type === 'error:occurred') {
      this.modulate('uncertainty', 0.05);
      this.modulate('confidence', -0.05);
    }
    if (signal.type === 'aether:tick') {
      this.modulate('cognitiveLoad', (this.consciousness.getState().load - 0.5) * 0.1);
    }
  }

  private modulate(key: keyof GlobalSignals, delta: number): void {
    const current = this.signals[key];
    this.signals[key] = Math.max(0, Math.min(1, current + delta));
  }

  setSignal(key: keyof GlobalSignals, value: number): void {
    this.signals[key] = Math.max(0, Math.min(1, value));
  }

  getSignals(): GlobalSignals {
    return { ...this.signals };
  }

  async tick(): Promise<void> {
    this.signals.urgency = this.consciousness.getState().urgency;
    this.signals.cognitiveLoad = this.consciousness.getState().load;
    this.signals.uncertainty = Math.max(0, 1 - this.consciousness.getState().confidence);

    this.history.push({ ...this.signals });
    if (this.history.length > 1000) this.history.shift();
  }

  getHistory(count = 10): GlobalSignals[] {
    return this.history.slice(-count);
  }

  getStatus(): Record<string, unknown> {
    return {
      current: this.signals,
      historyLength: this.history.length,
    };
  }

  destroy(): void {
    for (const id of this.unsubIds) {
      this.nervousSystem.unsubscribe(id);
    }
    this.unsubIds = [];
  }
}
