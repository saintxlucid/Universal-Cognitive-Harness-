import { ConsciousnessGate } from './integrator.js';
import { Consciousness, type ConsciousnessLayer } from '../aether/consciousness.js';
import { entropy, novelty } from '../shared/branded-types.js';

export interface ImportanceSignal {
  sourceId: string;
  source: string;
  content: string;
  importance: number;
  urgency: number;
  novelty: number;
  relevance: number;
  semanticSalience: number;
  emotionalValence: number;
  timestamp: Date;
}

export interface AttentionCortexConfig {
  importanceBaseThreshold: number;
  urgencyWeight: number;
  noveltyWeight: number;
  relevanceWeight: number;
  semanticSalienceWeight: number;
  emotionalValenceWeight: number;
  decayRate: number;
  maxSignals: number;
  attentionBottleneck: number;
  recencyBoost: number;
}

export class AttentionCortex {
  private consciousness: Consciousness;
  private gate: ConsciousnessGate;
  private config: Required<AttentionCortexConfig>;
  private signals: ImportanceSignal[] = [];
  private attendedSignals: ImportanceSignal[] = [];
  private attentionHistory: ImportanceSignal[] = [];
  private totalProcessed = 0;

  constructor(
    consciousness: Consciousness,
    gate: ConsciousnessGate,
    config?: Partial<AttentionCortexConfig>,
  ) {
    this.consciousness = consciousness;
    this.gate = gate;
    this.config = {
      importanceBaseThreshold: config?.importanceBaseThreshold ?? 0.4,
      urgencyWeight: config?.urgencyWeight ?? 0.25,
      noveltyWeight: config?.noveltyWeight ?? 0.2,
      relevanceWeight: config?.relevanceWeight ?? 0.25,
      semanticSalienceWeight: config?.semanticSalienceWeight ?? 0.15,
      emotionalValenceWeight: config?.emotionalValenceWeight ?? 0.15,
      decayRate: config?.decayRate ?? 0.05,
      maxSignals: config?.maxSignals ?? 200,
      attentionBottleneck: config?.attentionBottleneck ?? 7,
      recencyBoost: config?.recencyBoost ?? 0.1,
    };
  }

  evaluateImportance(params: {
    urgency?: number;
    novelty?: number;
    relevance?: number;
    semanticSalience?: number;
    emotionalValence?: number;
  }): number {
    const urgency = params.urgency ?? 0.3;
    const novelty = params.novelty ?? 0.3;
    const relevance = params.relevance ?? 0.3;
    const semanticSalience = params.semanticSalience ?? 0.3;
    const emotionalValence = params.emotionalValence ?? 0.3;

    return (
      urgency * this.config.urgencyWeight +
      novelty * this.config.noveltyWeight +
      relevance * this.config.relevanceWeight +
      semanticSalience * this.config.semanticSalienceWeight +
      emotionalValence * this.config.emotionalValenceWeight
    );
  }

  registerSignal(params: {
    sourceId: string;
    source: string;
    content: string;
    urgency?: number;
    novelty?: number;
    relevance?: number;
    semanticSalience?: number;
    emotionalValence?: number;
  }): ImportanceSignal {
    const importance = this.evaluateImportance(params);

    const signal: ImportanceSignal = {
      sourceId: params.sourceId,
      source: params.source,
      content: params.content,
      importance,
      urgency: params.urgency ?? 0.3,
      novelty: params.novelty ?? 0.3,
      relevance: params.relevance ?? 0.3,
      semanticSalience: params.semanticSalience ?? 0.3,
      emotionalValence: params.emotionalValence ?? 0.3,
      timestamp: new Date(),
    };

    this.signals.push(signal);
    if (this.signals.length > this.config.maxSignals) {
      this.signals.sort((a, b) => b.importance - a.importance);
      this.signals = this.signals.slice(0, this.config.maxSignals);
    }

    this.totalProcessed++;
    return signal;
  }

  attend(): ImportanceSignal[] {
    this.applyDecay();

    const sorted = [...this.signals].sort((a, b) => b.importance - a.importance);
    const topSignals = sorted.slice(0, this.config.attentionBottleneck);

    this.attendedSignals = topSignals;

    for (const signal of topSignals) {
      const info = {
        entropy: signal.novelty,
        novelty: signal.novelty,
        informationGain: signal.importance,
        predictionError: 1 - signal.relevance,
      };

      const infoMetrics = { entropy: entropy(info.entropy), novelty: novelty(info.novelty), informationGain: info.informationGain, predictionError: info.predictionError };
      if (this.gate.shouldReachConsciousness(infoMetrics, 0.5, true)) {
        this.consciousness.observe(
          'working',
          `[${signal.source}] ${signal.content} (importance: ${signal.importance.toFixed(3)})`,
          signal.source,
        );
        this.attentionHistory.push(signal);
      }
    }

    if (this.attentionHistory.length > 100) {
      this.attentionHistory = this.attentionHistory.slice(-100);
    }

    this.signals = sorted.slice(this.config.attentionBottleneck);
    return topSignals;
  }

  getTopSignals(n = 10): ImportanceSignal[] {
    return [...this.signals]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, n);
  }

  getAttendedSignals(): ImportanceSignal[] {
    return [...this.attendedSignals];
  }

  getAttentionHistory(n = 10): ImportanceSignal[] {
    return this.attentionHistory.slice(-n);
  }

  getImportanceTrend(source: string): { average: number; volatility: number; count: number } {
    const relevant = this.attentionHistory.filter((s) => s.source === source);
    if (relevant.length === 0) {
      return { average: 0, volatility: 0, count: 0 };
    }
    const avg = relevant.reduce((sum, s) => sum + s.importance, 0) / relevant.length;
    const variance =
      relevant.reduce((sum, s) => sum + (s.importance - avg) ** 2, 0) / relevant.length;
    return { average: avg, volatility: Math.sqrt(variance), count: relevant.length };
  }

  private applyDecay(): void {
    const now = Date.now();
    for (const signal of this.signals) {
      const ageHours = (now - signal.timestamp.getTime()) / (1000 * 60 * 60);
      const decay = Math.exp(-this.config.decayRate * ageHours);
      signal.importance *= decay;
    }
    this.signals = this.signals.filter((s) => s.importance > 0.01);
  }

  setImportance(sourceId: string, importance: number): boolean {
    const signal = this.signals.find((s) => s.sourceId === sourceId);
    if (!signal) return false;
    signal.importance = Math.max(0, Math.min(1, importance));
    return true;
  }

  getStats(): Record<string, unknown> {
    return {
      totalProcessed: this.totalProcessed,
      pendingSignals: this.signals.length,
      currentAttentionWindow: this.attendedSignals.length,
      attentionHistorySize: this.attentionHistory.length,
      bottleneckSize: this.config.attentionBottleneck,
      topSignals: this.getTopSignals(5).map((s) => ({
        source: s.source,
        importance: s.importance,
        urgency: s.urgency,
        content: s.content.substring(0, 60),
      })),
    };
  }
}
