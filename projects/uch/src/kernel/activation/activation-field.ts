import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { Connectome, type ConnectomeConfig } from './connectome.js';
import type { Novelty, Confidence, EnergyUnit } from '../../shared/branded-types.js';
import { novelty, confidence, energyUnit } from '../../shared/branded-types.js';

export interface FieldMetrics {
  activation: number;
  importance: number;
  recency: number;
  predictionScore: number;
  novelty: Novelty;
  utility: number;
  energy: EnergyUnit;
  confidence: Confidence;
  valence: number;
  arousal: number;
  curiosity: number;
  risk: number;
  reward: number;
  contradictions: number;
  strength: number;
}

export interface FieldEntity {
  id: string;
  label: string;
  kind: string;
  activation: number;
  halfLifeMs: number;
  createdAt: number;
  lastAccessAt: number;
  lastSpikeAt: number;
  hitCount: number;
  archived: boolean;
  metrics: FieldMetrics;
}

export interface FieldEntityInput {
  id: string;
  label: string;
  kind?: string;
  halfLifeMs?: number;
  activation?: number;
  novelty?: Novelty;
  confidence?: Confidence;
  utility?: number;
  predictionScore?: number;
  valence?: number;
  arousal?: number;
  reward?: number;
  contradictions?: number;
  taskRelevance?: number;
}

export interface ActivationFieldConfig {
  maxEntities: number;
  defaultHalfLifeMs: number;
  spreadFactor: number;
  spikeThreshold: number;
  spikeCost: EnergyUnit;
  edgePropagationCost: EnergyUnit;
  energyPool: EnergyUnit;
  energyRegenPerMs: EnergyUnit;
  archiveThreshold: number;
  archiveMinAgeMs: number;
  similarityFn?: (a: string, b: string) => number;
  connectome?: Partial<ConnectomeConfig>;
}

export interface SpikeResult {
  entityId: string;
  fired: boolean;
  activation: number;
  propagatedTo: string[];
  energyRemaining: EnergyUnit;
}

export interface FieldStats {
  entityCount: number;
  activeCount: number;
  archivedCount: number;
  edgeCount: number;
  meanActivation: number;
  maxActivation: number;
  energyRemaining: EnergyUnit;
}

const DEFAULT_CONFIG: ActivationFieldConfig = {
  maxEntities: 10_000,
  defaultHalfLifeMs: 86_400_000,
  spreadFactor: 0.2,
  spikeThreshold: 0.6,
  spikeCost: energyUnit(1),
  edgePropagationCost: energyUnit(0.1),
  energyPool: energyUnit(100),
  energyRegenPerMs: energyUnit(0.001),
  archiveThreshold: 0.05,
  archiveMinAgeMs: 604_800_000,
};

const HALF_LIFE_FACTOR = Math.log(2);
const REUSE_FREQ_SCALE = 0.25;

const createDefaultMetrics = (): FieldMetrics => ({
  activation: 0,
  importance: 0,
  recency: 0,
  predictionScore: 0.5,
  novelty: novelty(0.5),
  utility: 0.5,
  energy: energyUnit(0),
  confidence: confidence(0.5),
  valence: 0,
  arousal: 0,
  curiosity: 0,
  risk: 0.5,
  reward: 0,
  contradictions: 0,
  strength: 0,
});

export class ActivationField {
  readonly connectome: Connectome;
  private entities: Map<string, FieldEntity> = new Map();
  private config: ActivationFieldConfig;
  private energy: EnergyUnit;
  private eventBus?: NeuralEventBus;
  private now: () => number;

  constructor(config?: Partial<ActivationFieldConfig>, eventBus?: NeuralEventBus, clock: () => number = Date.now) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.energy = this.config.energyPool;
    this.eventBus = eventBus;
    this.now = clock;
    this.connectome = new Connectome(this.config.connectome);
  }

  register(input: FieldEntityInput): FieldEntity {
    if (this.entities.size >= this.config.maxEntities) {
      this.compact();
    }
    if (this.entities.size >= this.config.maxEntities) {
      this.evictLowestActivation();
    }
    const existing = this.entities.get(input.id);
    if (existing) return existing;
    const t = this.now();
    const metrics = createDefaultMetrics();
    metrics.novelty = this.computeNovelty(input.label, input.novelty);
    metrics.confidence = confidence(input.confidence ?? 0.5);
    metrics.utility = clamp01(input.utility ?? 0.5);
    metrics.predictionScore = clamp01(input.predictionScore ?? 0.5);
    metrics.valence = clamp(input.valence ?? 0, -1, 1);
    metrics.arousal = clamp01(input.arousal ?? 0);
    metrics.reward = input.reward ?? 0;
    metrics.contradictions = input.contradictions ?? 0;
    const entity: FieldEntity = {
      id: input.id,
      label: input.label,
      kind: input.kind ?? 'concept',
      activation: clamp01(input.activation ?? 0),
      halfLifeMs: input.halfLifeMs ?? this.config.defaultHalfLifeMs,
      createdAt: t,
      lastAccessAt: t,
      lastSpikeAt: 0,
      hitCount: 0,
      archived: false,
      metrics,
    };
    this.entities.set(entity.id, entity);
    this.updateDerivedMetrics(entity);
    this.publish('memory:ingest', { entityId: entity.id, label: entity.label, kind: entity.kind, activation: entity.activation });
    return entity;
  }

  get(id: string): FieldEntity | undefined {
    return this.entities.get(id);
  }

  spike(id: string, externalInput = 0): SpikeResult {
    const entity = this.entities.get(id);
    if (!entity || entity.archived) {
      return { entityId: id, fired: false, activation: 0, propagatedTo: [], energyRemaining: this.energy };
    }
    entity.activation = clamp01(entity.activation + externalInput);
    entity.lastAccessAt = this.now();
    entity.hitCount += 1;
    entity.metrics.recency = 1;

    if (entity.activation < this.config.spikeThreshold) {
      this.updateDerivedMetrics(entity);
      return { entityId: id, fired: false, activation: entity.activation, propagatedTo: [], energyRemaining: this.energy };
    }

    if (this.energy < this.config.spikeCost) {
      this.updateDerivedMetrics(entity);
      return { entityId: id, fired: false, activation: entity.activation, propagatedTo: [], energyRemaining: this.energy };
    }

    entity.lastSpikeAt = this.now();
    entity.activation = 1;
    this.energy = energyUnit(this.energy - this.config.spikeCost);

    const propagatedTo: string[] = [];
    for (const neighbor of this.connectome.neighbors(entity.id)) {
      if (this.energy < this.config.edgePropagationCost) break;
      const target = this.entities.get(neighbor.id);
      if (!target || target.archived) continue;
      this.energy = energyUnit(this.energy - this.config.edgePropagationCost);
      target.activation = clamp01(target.activation + entity.activation * neighbor.weight * this.config.spreadFactor);
      target.lastAccessAt = this.now();
      this.connectome.strengthen(entity.id, neighbor.id, entity.activation, target.activation, this.now());
      propagatedTo.push(neighbor.id);
    }

    this.updateDerivedMetrics(entity);
    for (const propagatedId of propagatedTo) {
      const target = this.entities.get(propagatedId);
      if (target) this.updateDerivedMetrics(target);
    }

    this.publish('cognitive:state_changed', {
      entityId: entity.id,
      activation: entity.activation,
      propagatedTo,
      energyRemaining: this.energy,
    });

    return { entityId: id, fired: true, activation: entity.activation, propagatedTo, energyRemaining: this.energy };
  }

  recordReward(id: string, rewardDelta: number): void {
    const entity = this.entities.get(id);
    if (!entity || entity.archived) return;
    entity.metrics.reward = Math.max(0, entity.metrics.reward + rewardDelta);
    entity.metrics.utility = clamp01(entity.metrics.utility + rewardDelta * 0.1);
    entity.metrics.valence = clamp(entity.metrics.valence + rewardDelta * 0.1, -1, 1);
    entity.metrics.arousal = clamp01(entity.metrics.arousal + Math.abs(rewardDelta) * 0.1);
    this.updateDerivedMetrics(entity);
  }

  recordPrediction(id: string, score: number, hit: boolean): void {
    const entity = this.entities.get(id);
    if (!entity || entity.archived) return;
    const s = clamp01(score);
    entity.metrics.predictionScore = clamp01(entity.metrics.predictionScore * 0.7 + (hit ? s : 1 - s) * 0.3);
    if (hit) {
      this.recordReward(id, s);
    } else {
      entity.metrics.contradictions += 1;
      entity.metrics.confidence = confidence(clamp01(entity.metrics.confidence * 0.9));
    }
    this.publish('prediction:made', { entityId: id, score: s, hit, predictionScore: entity.metrics.predictionScore });
  }

  link(source: string, target: string, initialWeight?: number): void {
    this.connectome.link(source, target, initialWeight);
    const sourceEntity = this.entities.get(source);
    const targetEntity = this.entities.get(target);
    if (sourceEntity) {
      sourceEntity.metrics.novelty = novelty(Math.max(0, sourceEntity.metrics.novelty - 0.05));
      this.updateDerivedMetrics(sourceEntity);
    }
    if (targetEntity) {
      targetEntity.metrics.novelty = novelty(Math.max(0, targetEntity.metrics.novelty - 0.05));
      this.updateDerivedMetrics(targetEntity);
    }
  }

  unlink(source: string, target: string): void {
    this.connectome.unlink(source, target);
  }

  tick(deltaMs: number): void {
    const t = this.now();
    for (const entity of this.entities.values()) {
      if (entity.archived) continue;
      this.decayEntity(entity, deltaMs, t);
      this.updateDerivedMetrics(entity);
      if (this.isArchiveCandidate(entity, t)) {
        entity.archived = true;
        this.publish('memory:consolidate', { entityId: entity.id, reason: 'dormant' });
      }
    }
    this.connectome.decayAll();
    this.energy = energyUnit(Math.min(this.config.energyPool, this.energy + this.config.energyRegenPerMs * deltaMs));
  }

  retrieve(query: string, limit = 10): FieldEntity[] {
    const q = query.toLowerCase();
    const scored = [...this.entities.values()]
      .filter((e) => !e.archived)
      .map((e) => ({
        entity: e,
        score: e.activation * (0.5 + e.metrics.importance) * (e.label.toLowerCase().includes(q) ? 1.2 : 1),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map((s) => s.entity);
  }

  getTopActivated(limit = 10): FieldEntity[] {
    return [...this.entities.values()]
      .filter((e) => !e.archived)
      .sort((a, b) => b.activation - a.activation)
      .slice(0, limit);
  }

  compact(): number {
    let removed = 0;
    for (const entity of this.entities.values()) {
      if (entity.archived) {
        this.entities.delete(entity.id);
        removed += 1;
      }
    }
    if (removed > 0) {
      for (const edge of this.connectome.getEdges()) {
        if (!this.entities.has(edge.source) || !this.entities.has(edge.target)) {
          this.connectome.unlink(edge.source, edge.target);
        }
      }
    }
    return removed;
  }

  getStats(): FieldStats {
    const active = [...this.entities.values()].filter((e) => !e.archived);
    const totalActivation = active.reduce((sum, e) => sum + e.activation, 0);
    const maxActivation = active.reduce((max, e) => Math.max(max, e.activation), 0);
    return {
      entityCount: this.entities.size,
      activeCount: active.length,
      archivedCount: this.entities.size - active.length,
      edgeCount: this.connectome.edgeCount(),
      meanActivation: active.length > 0 ? totalActivation / active.length : 0,
      maxActivation,
      energyRemaining: this.energy,
    };
  }

  clear(): void {
    this.entities.clear();
    this.connectome.clear();
    this.energy = this.config.energyPool;
  }

  private evictLowestActivation(): void {
    let lowestId: string | null = null;
    let lowestActivation = Infinity;
    for (const entity of this.entities.values()) {
      if (!entity.archived && entity.activation < lowestActivation) {
        lowestActivation = entity.activation;
        lowestId = entity.id;
      }
    }
    if (lowestId) {
      this.entities.delete(lowestId);
      for (const neighbor of this.connectome.neighbors(lowestId)) {
        this.connectome.unlink(lowestId, neighbor.id);
      }
    }
  }

  private computeNovelty(label: string, provided?: Novelty): Novelty {    if (provided !== undefined) return provided;
    if (!this.config.similarityFn || this.entities.size === 0) return novelty(0.5);
    let maxSimilarity = 0;
    for (const entity of this.entities.values()) {
      const similarity = this.config.similarityFn(label, entity.label);
      if (similarity > maxSimilarity) maxSimilarity = similarity;
    }
    return novelty(clamp01(1 - maxSimilarity));
  }

  private decayEntity(entity: FieldEntity, deltaMs: number, t: number): void {
    const decay = Math.exp(-HALF_LIFE_FACTOR * (deltaMs / entity.halfLifeMs));
    entity.activation = clamp01(entity.activation * decay);
    const ageMs = Math.max(0, t - entity.lastAccessAt);
    entity.metrics.recency = Math.exp(-HALF_LIFE_FACTOR * (ageMs / entity.halfLifeMs));
  }

  private isArchiveCandidate(entity: FieldEntity, t: number): boolean {
    const ageMs = t - entity.createdAt;
    return entity.activation < this.config.archiveThreshold && ageMs >= this.config.archiveMinAgeMs;
  }

  private updateDerivedMetrics(entity: FieldEntity): void {
    const m = entity.metrics;
    m.activation = clamp01(entity.activation);
    m.novelty = novelty(m.novelty);
    m.confidence = confidence(m.confidence);
    m.curiosity = clamp01(Number(m.novelty) * (1 - entity.activation));
    m.risk = clamp01(1 - Number(m.confidence));
    m.importance = this.computeImportance(entity);
    m.strength = this.computeStrength(entity);
    m.energy = energyUnit(this.energy);
  }

  private computeImportance(entity: FieldEntity): number {
    const m = entity.metrics;
    const reuseFrequency = 1 - Math.exp(-entity.hitCount * REUSE_FREQ_SCALE);
    const taskRelevance = 0.5;
    return clamp01(m.utility * m.predictionScore * taskRelevance * reuseFrequency);
  }

  private computeStrength(entity: FieldEntity): number {
    const m = entity.metrics;
    const reuseFrequency = 1 - Math.exp(-entity.hitCount * REUSE_FREQ_SCALE);
    const connectivity = clamp01(this.connectome.neighbors(entity.id).length / 10);
    const contradictionFactor = clamp01(1 - m.contradictions * 0.1);
    return clamp01(
      0.25 * reuseFrequency
      + 0.25 * m.recency
      + 0.2 * Number(m.confidence)
      + 0.1 * m.predictionScore
      + 0.1 * m.utility
      + 0.1 * connectivity
      + 0.05 * Number(m.novelty)
    ) * contradictionFactor;
  }

  private publish(type: 'memory:ingest' | 'cognitive:state_changed' | 'memory:consolidate' | 'prediction:made', payload: Record<string, unknown>): void {
    if (!this.eventBus) return;
    this.eventBus.publish({
      type,
      source: 'activation-field',
      payload,
    });
  }
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
