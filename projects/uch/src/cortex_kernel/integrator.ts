import { Consciousness, type ConsciousnessLayer, type Thought } from '../aether/consciousness.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { AttentionCortex } from './attention-cortex.js';
import { UnderstandingCortex } from './understanding-cortex.js';
import { ExecutiveCortex } from './executive-cortex.js';
import { MetaBrain } from './meta-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import type { InformationMetrics } from '../shared/branded-types.js';

export interface IntegrationInsight {
  layer: ConsciousnessLayer;
  content: string;
  confidence: number;
  timestamp: Date;
  informationMetrics?: InformationMetrics;
}

// ── Consciousness Threshold ─────────────────────────────────
// The dynamic gate that filters which signals reach consciousness.

export interface ConsciousnessGateConfig {
  baseThreshold: number;         // θ_conscious baseline
  cognitiveLoadInfluence: number; // how much load raises the threshold (0-1)
  predictionErrorInfluence: number; // how much error lowers it
  userAttentionInfluence: number; // how much user activity lowers it
  adaptationRate: number;        // how fast the threshold adjusts (0-1)
  minThreshold: number;
  maxThreshold: number;
}

export class ConsciousnessGate {
  private currentThreshold: number;
  private config: ConsciousnessGateConfig;
  private recentPredictionErrors: number[] = [];
  private readonly maxErrorHistory = 50;

  constructor(config?: Partial<ConsciousnessGateConfig>) {
    this.config = {
      baseThreshold: config?.baseThreshold ?? 0.35,
      cognitiveLoadInfluence: config?.cognitiveLoadInfluence ?? 0.3,
      predictionErrorInfluence: config?.predictionErrorInfluence ?? 0.4,
      userAttentionInfluence: config?.userAttentionInfluence ?? 0.2,
      adaptationRate: config?.adaptationRate ?? 0.1,
      minThreshold: config?.minThreshold ?? 0.1,
      maxThreshold: config?.maxThreshold ?? 0.8,
    };
    this.currentThreshold = this.config.baseThreshold;
  }

  shouldReachConsciousness(info: InformationMetrics, cognitiveLoad: number, userActive: boolean): boolean {
    // Information value is a weighted combination of entropy, novelty, and information gain
    const informationValue =
      Number(info.entropy) * 0.3 +
      Number(info.novelty) * 0.4 +
      info.informationGain * 0.3;

    // Higher cognitive load → higher threshold (more selective)
    const loadAdjustment = cognitiveLoad * this.config.cognitiveLoadInfluence;

    // Higher prediction error → lower threshold (more curious)
    const avgError = this.getAveragePredictionError();
    const errorAdjustment = avgError * this.config.predictionErrorInfluence;

    // User active → lower threshold (more receptive)
    const attentionAdjustment = userActive ? -this.config.userAttentionInfluence : 0;

    const dynamicThreshold = Math.max(
      this.config.minThreshold,
      Math.min(
        this.config.maxThreshold,
        this.currentThreshold + loadAdjustment - errorAdjustment + attentionAdjustment,
      ),
    );

    // Adapt threshold slowly over time
    this.currentThreshold += (dynamicThreshold - this.currentThreshold) * this.config.adaptationRate;

    return informationValue > dynamicThreshold;
  }

  recordPredictionError(error: number): void {
    this.recentPredictionErrors.push(error);
    if (this.recentPredictionErrors.length > this.maxErrorHistory) {
      this.recentPredictionErrors.shift();
    }
  }

  private getAveragePredictionError(): number {
    if (this.recentPredictionErrors.length === 0) return 0;
    return this.recentPredictionErrors.reduce((a, b) => a + b, 0) / this.recentPredictionErrors.length;
  }

  getCurrentThreshold(): number { return this.currentThreshold; }

  getStats() {
    return {
      currentThreshold: this.currentThreshold,
      baseThreshold: this.config.baseThreshold,
      avgPredictionError: this.getAveragePredictionError(),
      errorHistorySize: this.recentPredictionErrors.length,
    };
  }
}

export class CortexKernel {
  readonly attention: AttentionCortex;
  readonly understanding: UnderstandingCortex;
  readonly executive: ExecutiveCortex;
  readonly metaBrain: MetaBrain;
  private consciousness: Consciousness;
  private consciousnessGate: ConsciousnessGate;
  private insights: IntegrationInsight[] = [];
  private integrationCount = 0;
  private cognitiveLoad = 0;
  private userActive = false;

  constructor(
    consciousness: Consciousness,
    kernel: CognitiveKernel,
    executiveBrain: ExecutiveBrain,
    eventBus: NeuralEventBus,
    gate?: ConsciousnessGate,
  ) {
    this.consciousness = consciousness;
    this.consciousnessGate = gate ?? new ConsciousnessGate();
    this.attention = new AttentionCortex(consciousness, this.consciousnessGate);
    this.understanding = new UnderstandingCortex(consciousness, kernel);
    this.executive = new ExecutiveCortex(
      consciousness,
      this.consciousnessGate,
      this.attention,
      this.understanding,
      executiveBrain,
      kernel,
      eventBus,
    );
    this.metaBrain = new MetaBrain(consciousness, this.consciousnessGate);
  }

  getGate(): ConsciousnessGate { return this.consciousnessGate; }

  setCognitiveLoad(load: number): void { this.cognitiveLoad = load; }
  setUserActive(active: boolean): void { this.userActive = active; }

  evaluateSignal(info: InformationMetrics): boolean {
    return this.consciousnessGate.shouldReachConsciousness(info, this.cognitiveLoad, this.userActive);
  }

  integrate(): IntegrationInsight[] {
    this.integrationCount++;
    const produced: IntegrationInsight[] = [];
    const state = this.consciousness.getState();

    this.attention.attend();

    if (state.activeLayers.includes('reflex')) {
      const reflexThoughts = this.consciousness.getByLayer('reflex');
      if (reflexThoughts.length > 0) {
        const pattern = this.detectUrgencyPattern(reflexThoughts);
        if (pattern) {
          const infoValue = pattern.confidence * 0.6 + (reflexThoughts.filter(t => t.priority >= 0.9).length / 10) * 0.4;
          if (this.consciousnessGate.shouldReachConsciousness(
            { entropy: 0 as any, novelty: infoValue as any, informationGain: infoValue, predictionError: 0 },
            this.cognitiveLoad,
            this.userActive,
          )) {
            produced.push(pattern);
          }
        }
      }
    }

    if (state.activeLayers.includes('strategic')) {
      const strategicThoughts = this.consciousness.getByLayer('strategic');
      if (strategicThoughts.length > 3) {
        const insight: IntegrationInsight = {
          layer: 'strategic',
          content: 'Multiple strategic observations detected — consider review cycle',
          confidence: 0.7,
          timestamp: new Date(),
        };
        produced.push(insight);
      }
    }

    const reflections = this.metaBrain.reflect();
    for (const r of reflections) {
      produced.push({
        layer: 'meta' as any,
        content: r.content,
        confidence: r.significance,
        timestamp: r.timestamp,
      });
    }

    for (const insight of produced) {
      this.insights.push(insight);
    }
    if (this.insights.length > 200) this.insights = this.insights.slice(-200);

    return produced;
  }

  startCortexServices(): void {
    this.executive.schedulePlanning();
    this.metaBrain.scheduleReflection();
  }

  stopCortexServices(): void {
    this.executive.stopPlanning();
    this.metaBrain.stopReflection();
  }

  private detectUrgencyPattern(thoughts: Thought[]): IntegrationInsight | null {
    const recent = thoughts.slice(-10);
    const urgentCount = recent.filter((t) => t.priority >= 0.9 && !t.acknowledged).length;
    if (urgentCount >= 5) {
      return {
        layer: 'reflex',
        content: `High urgency: ${urgentCount} unacknowledged high-priority thoughts`,
        confidence: 0.85,
        timestamp: new Date(),
      };
    }
    return null;
  }

  getInsights(limit = 10): IntegrationInsight[] {
    return this.insights.slice(-limit);
  }

  getStatus(): Record<string, unknown> {
    return {
      totalIntegrations: this.integrationCount,
      activeInsights: this.insights.length,
      recentInsights: this.insights.slice(-5).map((i) => i.content),
      consciousnessGate: this.consciousnessGate.getStats(),
      cognitiveLoad: this.cognitiveLoad,
      userActive: this.userActive,
      attention: this.attention.getStats(),
      understanding: this.understanding.getStats(),
      executive: this.executive.getStats(),
      metaBrain: this.metaBrain.getStats(),
    };
  }
}
