import {
  type Signal,
  type SignalHandler,
  type SignalFilter,
  type NervousSystemLayer,
  type SignalPriority,
  type InterruptLevel,
  type EntropyReductionResult,
  createSignal,
  priorityForLayer,
} from './signal.js';
import type { InformationMetrics } from '../shared/branded-types.js';
import type { EventType, NeuralEvent } from '../event-bus/neural-event-bus.js';
import type { MetabolicCost } from '../metabolism/metabolic-profile.js';
import { type EnergyUnit, energyUnit, type ComponentID, componentID, type Entropy, entropy, type Novelty, novelty, type Timestamp, timestamp } from '../shared/branded-types.js';

// ── Entropy Reduction Pipeline ─────────────────────────────

const ENTROPY_REDUCTION_RATIOS: Record<string, number> = {
  classification: 0.20,
  deduplication: 0.40,
  aggregation: 0.20,
  compression: 0.10,
  importance: 0.05,
  priority: 0.05,
};

const CONSCIOUSNESS_THRESHOLD = 0.35;
const ENTROPY_ESCALATION_THRESHOLD = 0.15;
const NOVELTY_ESCALATION_THRESHOLD = 0.3;

export interface LayerConfig {
  enabled: boolean;
  escalateOnMatch?: EventType[];
  blockOnMatch?: EventType[];
  entropyThreshold?: number;        // minimum entropy to escalate upward
  noveltyThreshold?: number;        // minimum novelty to escalate upward
  maxCacheSize?: number;            // dedup cache size for this layer
  dedupWindowMs?: number;           // time window for deduplication
}

export interface NervousSystemConfig {
  layers: Partial<Record<NervousSystemLayer, LayerConfig>>;
  trackEnergy: boolean;
  consciousnessThreshold?: number;
  interruptPreemption?: boolean;
}

interface LayerSubscription {
  id: string;
  handler: SignalHandler;
  filter?: SignalFilter;
  label?: string;
}

interface EnergyEvent {
  signalId: string;
  source: ComponentID;
  type: EventType;
  cost: EnergyUnit;
  layer: NervousSystemLayer;
  timestamp: Timestamp;
}

interface DedupEntry {
  signalType: EventType;
  payloadHash: string;
  timestamp: number;
}

// ── Interrupt Management ───────────────────────────────────

interface InterruptEntry {
  signal: Readonly<Signal>;
  timestamp: number;
  level: InterruptLevel;
  handled: boolean;
}

export class NervousSystem {
  private subscriptions: Map<NervousSystemLayer, LayerSubscription[]> = new Map();
  private signalHistory: Signal[] = [];
  private energyEvents: EnergyEvent[] = [];
  private readonly maxHistory: number;
  private readonly config: Required<NervousSystemConfig>;
  private totalSignalsProcessed = 0;
  private totalEnergyConsumed = 0;
  private totalSignalsAbsorbed = 0;
  private totalSignalsEscalated = 0;
  private dedupCache: DedupEntry[] = [];
  private activeInterrupts: InterruptEntry[] = [];
  private currentLayer: NervousSystemLayer = 'peripheral';

  constructor(config?: Partial<NervousSystemConfig>, maxHistory = 1000) {
    const defaultLayerConfig: LayerConfig = {
      enabled: true,
      entropyThreshold: ENTROPY_ESCALATION_THRESHOLD,
      noveltyThreshold: NOVELTY_ESCALATION_THRESHOLD,
      maxCacheSize: 1000,
      dedupWindowMs: 5000,
    };
    this.config = {
      layers: {
        peripheral: config?.layers?.peripheral ?? { ...defaultLayerConfig },
        spinal: config?.layers?.spinal ?? { ...defaultLayerConfig },
        brainstem: config?.layers?.brainstem ?? { ...defaultLayerConfig },
        thalamus: config?.layers?.thalamus ?? { ...defaultLayerConfig, escalateOnMatch: ['session:started', 'agent:attached', 'user:message' as EventType] },
        cortex: config?.layers?.cortex ?? { ...defaultLayerConfig },
      },
      trackEnergy: config?.trackEnergy ?? true,
      consciousnessThreshold: config?.consciousnessThreshold ?? CONSCIOUSNESS_THRESHOLD,
      interruptPreemption: config?.interruptPreemption ?? true,
    };
    this.maxHistory = maxHistory;
  }

  // ── Interrupt API ────────────────────────────────────────

  raiseInterrupt(signal: Readonly<Signal>): void {
    if (!signal.interrupt || signal.interruptLevel === undefined) return;

    const level = signal.interruptLevel;
    this.activeInterrupts.push({
      signal,
      timestamp: timestamp(Date.now()),
      level,
      handled: false,
    });

    // Preempt current execution if interrupt has higher priority
    if (this.config.interruptPreemption && this.currentLayer !== 'cortex') {
      const currentLevel = priorityForLayer[this.currentLayer] as InterruptLevel;
      if (level > currentLevel) {
        this.activeInterrupts.sort((a, b) => b.level - a.level);
      }
    }
  }

  getPendingInterrupts(aboveLevel: InterruptLevel): Readonly<Signal>[] {
    return this.activeInterrupts
      .filter(i => !i.handled && i.level > aboveLevel)
      .sort((a, b) => b.level - a.level)
      .map(i => i.signal);
  }

  acknowledgeInterrupt(signalId: string): void {
    const entry = this.activeInterrupts.find(i => i.signal.id === signalId);
    if (entry) entry.handled = true;
  }

  // ── Entropy Reduction Pipeline ────────────────────────────

  private computeLayerEntropy(
    signal: Readonly<Signal>,
    layer: NervousSystemLayer,
  ): { entropy: Entropy; novelty: Novelty } {
    let currentEntropy = signal.information.entropy;
    let currentNovelty = signal.information.novelty;

    const reductionKey = this.layerToReductionStage(layer);
    const reductionRatio = ENTROPY_REDUCTION_RATIOS[reductionKey] ?? 0;
    currentEntropy = entropy(Number(currentEntropy) * (1 - reductionRatio));

    return { entropy: currentEntropy, novelty: currentNovelty };
  }

  private reduceEntropy(
    signal: Readonly<Signal>,
    layer: NervousSystemLayer,
  ): EntropyReductionResult {
    const { entropy: currentEntropy, novelty: currentNovelty } = this.computeLayerEntropy(signal, layer);
    const informationGain = signal.information.informationGain;

    // Deduplication check — only at the signal's own layer, not during pipeline traversal
    if (layer === signal.layer && (layer === 'spinal' || layer === 'peripheral')) {
      const isDuplicate = this.checkDuplicate(signal);
      if (isDuplicate) {
        return {
          signal,
          metrics: { entropy: entropy(0), novelty: novelty(0), informationGain: 0, predictionError: signal.information.predictionError },
          escalate: false,
          absorbedAt: layer,
        };
      }
    }

    // Determine if signal should escalate upward
    const escalate =
      Number(currentEntropy) >= (this.config.layers[layer]?.entropyThreshold ?? ENTROPY_ESCALATION_THRESHOLD) ||
      Number(currentNovelty) >= (this.config.layers[layer]?.noveltyThreshold ?? NOVELTY_ESCALATION_THRESHOLD) ||
      signal.interrupt;

    if (!escalate) {
      this.totalSignalsAbsorbed++;
    }

    return {
      signal,
      metrics: { entropy: currentEntropy, novelty: currentNovelty, informationGain, predictionError: signal.information.predictionError },
      escalate,
      absorbedAt: escalate ? null : layer,
    };
  }

  private layerToReductionStage(layer: NervousSystemLayer): string {
    switch (layer) {
      case 'peripheral': return 'classification';
      case 'spinal': return 'deduplication';
      case 'brainstem': return 'aggregation';
      case 'thalamus': return 'importance';
      case 'cortex': return 'priority';
    }
  }

  private checkDuplicate(signal: Readonly<Signal>): boolean {
    const layerConfig = this.config.layers[signal.layer];
    const windowMs = layerConfig?.dedupWindowMs ?? 5000;
    const maxSize = layerConfig?.maxCacheSize ?? 1000;
    const payloadHash = JSON.stringify(signal.payload);
    const now = Date.now();

    // Clean expired entries
    this.dedupCache = this.dedupCache.filter(e => now - e.timestamp < windowMs);

    // Check for exact duplicate
    const found = this.dedupCache.some(
      e => e.signalType === signal.type && e.payloadHash === payloadHash,
    );

    if (!found) {
      this.dedupCache.push({ signalType: signal.type, payloadHash, timestamp: now });
      if (this.dedupCache.length > maxSize) {
        this.dedupCache.shift();
      }
    }

    return found;
  }

  // ── Signal Routing (overridden) ──────────────────────────

  subscribe(
    layer: NervousSystemLayer,
    handler: SignalHandler,
    filter?: SignalFilter,
    label?: string,
  ): string {
    const id = `nss-${crypto.randomUUID()}`;
    const subs = this.subscriptions.get(layer) ?? [];
    subs.push({ id, handler, filter, label });
    this.subscriptions.set(layer, subs);
    return id;
  }

  subscribeToAll(handler: SignalHandler, filter?: SignalFilter, label?: string): string[] {
    const ids: string[] = [];
    const layers: NervousSystemLayer[] = ['peripheral', 'spinal', 'brainstem', 'thalamus', 'cortex'];
    for (const layer of layers) {
      ids.push(this.subscribe(layer, handler, filter, label));
    }
    return ids;
  }

  unsubscribe(subscriptionId: string): boolean {
    for (const [, subs] of this.subscriptions) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx >= 0) {
        subs.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  async emit(signal: Readonly<Signal>): Promise<void> {
    // Handle interrupts first — they bypass normal entropy pipeline
    if (signal.interrupt) {
      this.raiseInterrupt(signal);
    }

    const layer = signal.layer;
    const layerConfig = this.config.layers[layer];
    if (!layerConfig?.enabled) return;
    if (layerConfig.blockOnMatch?.includes(signal.type)) return;

    // Process through entropy-reduction pipeline
    const result = this.processThroughPipeline(signal);

    if (result.absorbedAt) {
      // Signal absorbed (e.g., duplicate) — deliver and stop
      await this.deliverToLayer(result.absorbedAt, signal);
      return;
    }

    if (this.config.trackEnergy) {
      this.totalEnergyConsumed += signal.energy;
      this.energyEvents.push({
        signalId: signal.id,
        source: signal.source,
        type: signal.type,
        cost: signal.energy,
        layer,
        timestamp: timestamp(Date.now()),
      });
    }

    this.signalHistory.push(signal as Signal);
    if (this.signalHistory.length > this.maxHistory) this.signalHistory.shift();
    this.totalSignalsProcessed++;

    // Deliver to current layer
    await this.deliverToLayer(layer, signal);

    // Escalate to higher layers only when explicitly configured or on interrupt
    if (signal.interrupt || layerConfig.escalateOnMatch?.includes(signal.type)) {
      const nextLayer = this.nextLayer(layer);
      if (nextLayer) {
        this.totalSignalsEscalated++;
        await this.deliverToLayer(nextLayer, signal);
      }
    }
  }

  private processThroughPipeline(signal: Readonly<Signal>): EntropyReductionResult {
    // Run the signal through all layers up to and including its starting layer
    const order: NervousSystemLayer[] = ['peripheral', 'spinal', 'brainstem', 'thalamus', 'cortex'];
    const startIndex = order.indexOf(signal.layer);
    let currentSignal = signal;

    for (let i = 0; i <= startIndex; i++) {
      const layer = order[i]!;
      const result = this.reduceEntropy(currentSignal, layer);
      currentSignal = { ...currentSignal, information: result.metrics } as Signal;

      if (!result.escalate) {
        return result;
      }
    }

    return {
      signal: currentSignal,
      metrics: currentSignal.information,
      escalate: true,
      absorbedAt: null,
    };
  }

  async emitFromEvent(
    event: NeuralEvent,
    source: string,
    energy?: number,
    causalParent?: string,
  ): Promise<void> {
    const signal = createSignal(
      event.type,
      source,
      event.payload,
      { energy, causalParent },
    );
    await this.emit(signal);
  }

  private async deliverToLayer(layer: NervousSystemLayer, signal: Readonly<Signal>): Promise<void> {
    const subs = this.subscriptions.get(layer) ?? [];
    for (const sub of subs) {
      try {
        if (sub.filter && !sub.filter(signal as Signal)) continue;
        const result = sub.handler(signal);
        if (result instanceof Promise) await result;
      } catch {
        // Isolated handler failures don't crash the nervous system
      }
    }
  }

  private nextLayer(current: NervousSystemLayer): NervousSystemLayer | null {
    const order: NervousSystemLayer[] = ['peripheral', 'spinal', 'brainstem', 'thalamus', 'cortex'];
    const idx = order.indexOf(current);
    if (idx >= 0 && idx < order.length - 1) return order[idx + 1] as NervousSystemLayer;
    return null;
  }

  async routeToLayer(signal: Readonly<Signal>, targetLayer: NervousSystemLayer): Promise<void> {
    const targetPriority = priorityForLayer[targetLayer];
    if (targetPriority !== undefined && signal.priority <= targetPriority) {
      await this.deliverToLayer(targetLayer, signal);
    }
  }

  getSignalHistory(type?: EventType): Signal[] {
    if (type) return this.signalHistory.filter((s) => s.type === type);
    return [...this.signalHistory];
  }

  getEnergyReport(): {
    totalSignals: number;
    totalEnergy: number;
    byLayer: Record<string, number>;
    bySource: Record<string, number>;
  } {
    const byLayer: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const ev of this.energyEvents) {
      byLayer[ev.layer] = (byLayer[ev.layer] ?? 0) + ev.cost;
      bySource[ev.source] = (bySource[ev.source] ?? 0) + ev.cost;
    }
    return {
      totalSignals: this.totalSignalsProcessed,
      totalEnergy: this.totalEnergyConsumed,
      byLayer,
      bySource,
    };
  }

  resetEnergyTracking(): void {
    this.energyEvents = [];
    this.totalEnergyConsumed = 0;
    this.totalSignalsProcessed = 0;
  }

  getStats(): Record<string, unknown> {
    return {
      totalSignalsProcessed: this.totalSignalsProcessed,
      totalSignalsAbsorbed: this.totalSignalsAbsorbed,
      totalSignalsEscalated: this.totalSignalsEscalated,
      absorptionRate: this.totalSignalsProcessed > 0
        ? this.totalSignalsAbsorbed / this.totalSignalsProcessed
        : 0,
      escalationRate: this.totalSignalsProcessed > 0
        ? this.totalSignalsEscalated / this.totalSignalsProcessed
        : 0,
      totalEnergyConsumed: this.totalEnergyConsumed,
      pendingInterrupts: this.activeInterrupts.filter(i => !i.handled).length,
      historyLength: this.signalHistory.length,
      dedupCacheSize: this.dedupCache.length,
      subscriptions: {
        peripheral: (this.subscriptions.get('peripheral') ?? []).length,
        spinal: (this.subscriptions.get('spinal') ?? []).length,
        brainstem: (this.subscriptions.get('brainstem') ?? []).length,
        thalamus: (this.subscriptions.get('thalamus') ?? []).length,
        cortex: (this.subscriptions.get('cortex') ?? []).length,
      },
    };
  }
}
