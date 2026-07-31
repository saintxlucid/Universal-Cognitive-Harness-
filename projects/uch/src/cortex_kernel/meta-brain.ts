import { Consciousness, type ConsciousnessLayer } from '../aether/consciousness.js';
import { ConsciousnessGate, type IntegrationInsight } from './integrator.js';
import { entropy, novelty } from '../shared/branded-types.js';

export interface SelfObservation {
  id: string;
  timestamp: Date;
  category: 'cognitive' | 'emotional' | 'behavioral' | 'performance' | 'social';
  aspect: string;
  content: string;
  confidence: number;
  relatedObservations: string[];
  valence: number;
  arousal: number;
}

export interface ReflectiveInsight {
  id: string;
  timestamp: Date;
  source: string;
  content: string;
  significance: number;
  pattern: string;
  recommendations: string[];
  applied: boolean;
  metadata: Record<string, unknown>;
}

export interface MetaBrainConfig {
  observationIntervalMs: number;
  maxObservations: number;
  maxInsights: number;
  reflectionThreshold: number;
  enablePatternDiscovery: boolean;
  enableSelfModeling: boolean;
}

export class MetaBrain {
  private consciousness: Consciousness;
  private gate: ConsciousnessGate;
  private config: Required<MetaBrainConfig>;
  private observations: SelfObservation[] = [];
  private insights: ReflectiveInsight[] = [];
  private patternRegistry: Map<string, { pattern: string; count: number; lastSeen: Date; confidence: number }> = new Map();
  private selfModel: Map<string, { value: number; samples: number; trend: 'improving' | 'declining' | 'stable' }> = new Map();
  private totalReflections = 0;
  private reflectionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    consciousness: Consciousness,
    gate: ConsciousnessGate,
    config?: Partial<MetaBrainConfig>,
  ) {
    this.consciousness = consciousness;
    this.gate = gate;
    this.config = {
      observationIntervalMs: config?.observationIntervalMs ?? 10000,
      maxObservations: config?.maxObservations ?? 500,
      maxInsights: config?.maxInsights ?? 200,
      reflectionThreshold: config?.reflectionThreshold ?? 0.6,
      enablePatternDiscovery: config?.enablePatternDiscovery ?? true,
      enableSelfModeling: config?.enableSelfModeling ?? true,
    };
  }

  observe(params: {
    category: SelfObservation['category'];
    aspect: string;
    content: string;
    confidence?: number;
    valence?: number;
    arousal?: number;
  }): SelfObservation {
    const observation: SelfObservation = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      category: params.category,
      aspect: params.aspect,
      content: params.content,
      confidence: params.confidence ?? 0.7,
      relatedObservations: [],
      valence: params.valence ?? 0,
      arousal: params.arousal ?? 0.5,
    };

    this.observations.push(observation);
    if (this.observations.length > this.config.maxObservations) {
      this.observations = this.observations.slice(-this.config.maxObservations);
    }

    if (this.config.enablePatternDiscovery) {
      this.detectPattern(observation);
    }

    if (this.config.enableSelfModeling) {
      this.updateSelfModel(observation);
    }

    const info = {
      entropy: observation.arousal,
      novelty: observation.confidence,
      informationGain: Math.abs(observation.valence),
      predictionError: 1 - observation.confidence,
    };

    const infoMetrics = { entropy: entropy(info.entropy), novelty: novelty(info.novelty), informationGain: info.informationGain, predictionError: info.predictionError };
    if (this.gate.shouldReachConsciousness(infoMetrics, 0.3, true)) {
      this.consciousness.observe(
        'meta',
        `Self-observation [${observation.category}/${observation.aspect}]: ${observation.content}`,
        'meta-brain',
      );
    }

    return observation;
  }

  reflect(): ReflectiveInsight[] {
    this.totalReflections++;
    const newInsights: ReflectiveInsight[] = [];

    const patterns = this.discoverRecurringPatterns();
    for (const pattern of patterns) {
      if (pattern.count >= 3 && pattern.confidence >= this.config.reflectionThreshold) {
        const insight = this.generateInsight(pattern);
        newInsights.push(insight);
      }
    }

    const trendInsight = this.analyzeSelfModelTrends();
    if (trendInsight) {
      newInsights.push(trendInsight);
    }

    for (const insight of newInsights) {
      this.insights.push(insight);
      this.consciousness.observe('meta', `Reflective insight: ${insight.content}`, 'meta-brain');
    }

    if (this.insights.length > this.config.maxInsights) {
      this.insights = this.insights.slice(-this.config.maxInsights);
    }

    return newInsights;
  }

  scheduleReflection(): void {
    if (this.reflectionTimer) return;
    this.reflectionTimer = setInterval(async () => {
      this.reflect();
    }, this.config.observationIntervalMs);
  }

  stopReflection(): void {
    if (this.reflectionTimer) {
      clearInterval(this.reflectionTimer);
      this.reflectionTimer = null;
    }
  }

  private detectPattern(observation: SelfObservation): void {
    const key = `${observation.category}:${observation.aspect}`;
    const existing = this.patternRegistry.get(key);
    if (existing) {
      existing.count++;
      existing.lastSeen = observation.timestamp;
      existing.confidence = Math.min(0.95, existing.confidence + 0.05);
    } else {
      this.patternRegistry.set(key, {
        pattern: key,
        count: 1,
        lastSeen: observation.timestamp,
        confidence: 0.3,
      });
    }
  }

  private discoverRecurringPatterns(): Array<{ category: string; aspect: string; count: number; confidence: number; observations: SelfObservation[] }> {
    const grouped = new Map<string, SelfObservation[]>();
    for (const obs of this.observations) {
      const key = `${obs.category}:${obs.aspect}`;
      const group = grouped.get(key) ?? [];
      group.push(obs);
      grouped.set(key, group);
    }

    return [...grouped.entries()]
      .map(([key, observations]) => {
        const [category, aspect] = key.split(':');
        const regEntry = this.patternRegistry.get(key);
        return {
          category: category ?? 'unknown',
          aspect: aspect ?? 'unknown',
          count: observations.length,
          confidence: regEntry?.confidence ?? 0.3,
          observations,
        };
      })
      .filter((p) => p.count >= 2)
      .sort((a, b) => b.count - a.count);
  }

  private generateInsight(pattern: {
    category: string;
    aspect: string;
    count: number;
    confidence: number;
    observations: SelfObservation[];
  }): ReflectiveInsight {
    const avgValence =
      pattern.observations.reduce((s, o) => s + o.valence, 0) / pattern.observations.length;
    const avgArousal =
      pattern.observations.reduce((s, o) => s + o.arousal, 0) / pattern.observations.length;

    let content: string;
    let recommendations: string[] = [];

    if (avgValence < -0.3) {
      content = `Recurring ${pattern.category} issue in '${pattern.aspect}': ${pattern.count} occurrences, negatively valenced (${avgValence.toFixed(2)})`;
      recommendations = [
        `Investigate root causes of '${pattern.aspect}' in ${pattern.category} domain`,
        `Consider adjusting approach for '${pattern.aspect}'`,
        `Monitor for improvement after intervention`,
      ];
    } else if (avgValence > 0.3) {
      content = `Positive pattern in ${pattern.category}/${pattern.aspect}: ${pattern.count} occurrences with favorable outcomes`;
      recommendations = [
        `Reinforce current approach for '${pattern.aspect}'`,
        `Document effective strategies for reuse`,
        `Share pattern across related domains`,
      ];
    } else {
      content = `Pattern detected in ${pattern.category}/${pattern.aspect}: ${pattern.count} occurrences, neutral valence (${avgValence.toFixed(2)})`;
      recommendations = [
        `Continue monitoring '${pattern.aspect}' for valence shifts`,
        `Consider deeper analysis of ${pattern.category} patterns`,
      ];
    }

    if (avgArousal > 0.7) {
      recommendations.push('High arousal detected — consider regulation strategies');
    }

    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      source: 'meta-brain',
      content,
      significance: pattern.confidence * Math.min(1, pattern.count / 10),
      pattern: `${pattern.category}:${pattern.aspect}`,
      recommendations,
      applied: false,
      metadata: {
        category: pattern.category,
        aspect: pattern.aspect,
        count: pattern.count,
        avgValence,
        avgArousal,
        confidence: pattern.confidence,
      },
    };
  }

  private updateSelfModel(observation: SelfObservation): void {
    const key = `${observation.category}:${observation.aspect}`;
    const current = this.selfModel.get(key);

    if (current) {
      const newValue = (current.value * current.samples + observation.valence) / (current.samples + 1);
      const newSamples = current.samples + 1;
      const trend = newValue > current.value ? 'improving' : newValue < current.value ? 'declining' : 'stable';
      this.selfModel.set(key, { value: newValue, samples: newSamples, trend });
    } else {
      this.selfModel.set(key, { value: observation.valence, samples: 1, trend: 'stable' });
    }
  }

  private analyzeSelfModelTrends(): ReflectiveInsight | null {
    const declining: string[] = [];
    const improving: string[] = [];

    for (const [key, model] of this.selfModel) {
      if (model.trend === 'declining' && model.samples >= 5) {
        declining.push(key);
      }
      if (model.trend === 'improving' && model.samples >= 5) {
        improving.push(key);
      }
    }

    if (declining.length === 0 && improving.length === 0) return null;

    const parts: string[] = [];
    if (declining.length > 0) {
      parts.push(`Declining: ${declining.join(', ')}`);
    }
    if (improving.length > 0) {
      parts.push(`Improving: ${improving.join(', ')}`);
    }

    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      source: 'meta-brain',
      content: `Self-model trend analysis: ${parts.join('; ')}`,
      significance: Math.min(0.8, (declining.length + improving.length) * 0.1),
      pattern: 'self-model-trend',
      recommendations: [
        ...declining.map((d) => `Investigate declining trend: ${d}`),
        ...improving.map((i) => `Reinforce improving trend: ${i}`),
      ],
      applied: false,
      metadata: {
        declining,
        improving,
        totalTracked: this.selfModel.size,
      },
    };
  }

  markInsightApplied(insightId: string): boolean {
    const insight = this.insights.find((i) => i.id === insightId);
    if (!insight) return false;
    insight.applied = true;
    return true;
  }

  getObservations(category?: SelfObservation['category'], limit = 20): SelfObservation[] {
    let filtered = this.observations;
    if (category) {
      filtered = filtered.filter((o) => o.category === category);
    }
    return filtered.slice(-limit);
  }

  getInsights(limit = 10, includeApplied = false): ReflectiveInsight[] {
    const filtered = includeApplied
      ? this.insights
      : this.insights.filter((i) => !i.applied);
    return filtered.slice(-limit);
  }

  getPatterns(): Array<{ pattern: string; count: number; confidence: number }> {
    return [...this.patternRegistry.entries()]
      .map(([, entry]) => ({
        pattern: entry.pattern,
        count: entry.count,
        confidence: entry.confidence,
      }))
      .sort((a, b) => b.count - a.count);
  }

  getSelfModel(): Record<string, { value: number; samples: number; trend: string }> {
    const model: Record<string, { value: number; samples: number; trend: string }> = {};
    for (const [key, entry] of this.selfModel) {
      model[key] = { value: entry.value, samples: entry.samples, trend: entry.trend };
    }
    return model;
  }

  getTotalReflections(): number {
    return this.totalReflections;
  }

  getStats(): Record<string, unknown> {
    return {
      totalReflections: this.totalReflections,
      observationsCount: this.observations.length,
      insightsCount: this.insights.length,
      unappliedInsights: this.insights.filter((i) => !i.applied).length,
      patternsTracked: this.patternRegistry.size,
      selfModelEntries: this.selfModel.size,
      config: {
        observationIntervalMs: this.config.observationIntervalMs,
        reflectionThreshold: this.config.reflectionThreshold,
        enablePatternDiscovery: this.config.enablePatternDiscovery,
        enableSelfModeling: this.config.enableSelfModeling,
      },
    };
  }
}
