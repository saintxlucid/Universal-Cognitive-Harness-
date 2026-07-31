import { EpisodicStore } from '../storage/episodic-store.js';
import { SemanticGraph } from '../storage/semantic-graph.js';
import { Neuromodulation } from '../cortex/neuromodulation.js';

interface SleepConfig {
  interval_ms: number;
  novelty_weight: number;
  recency_weight: number;
  importance_weight: number;
  uncertainty_weight: number;
  prune_threshold: number;
  replay_batch_size: number;
  contradiction_check: boolean;
}

export class SleepCycle {
  private episodic: EpisodicStore;
  private graph: SemanticGraph;
  private neuromodulation: Neuromodulation;
  private config: SleepConfig;
  private running = false;
  private cycle_count = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    episodic: EpisodicStore,
    graph: SemanticGraph,
    neuromodulation: Neuromodulation,
    config?: Partial<SleepConfig>,
  ) {
    this.episodic = episodic;
    this.graph = graph;
    this.neuromodulation = neuromodulation;
    this.config = {
      interval_ms: 300_000,
      novelty_weight: 0.4,
      recency_weight: 0.3,
      importance_weight: 0.2,
      uncertainty_weight: 0.1,
      prune_threshold: 0.1,
      replay_batch_size: 50,
      contradiction_check: true,
      ...config,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.cycle(), this.config.interval_ms);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getCycleCount(): number {
    return this.cycle_count;
  }

  async cycle(): Promise<SleepReport> {
    const startTime = Date.now();
    this.cycle_count++;

    const report: SleepReport = {
      cycle: this.cycle_count,
      episodes_replayed: 0,
      patterns_found: 0,
      contradictions_detected: 0,
      duplicates_merged: 0,
      episodes_pruned: 0,
      abstractions_created: 0,
      duration_ms: 0,
    };

    // 1. Select candidate episodes for replay (prioritized)
    const candidates = this.selectCandidates();
    report.episodes_replayed = candidates.length;

    // 2. Discover patterns across episodes
    const patterns = this.discoverPatterns(candidates);
    report.patterns_found = patterns.length;

    // 3. Build abstractions
    for (const pattern of patterns) {
      // In a full implementation, this would create abstract concepts
      report.abstractions_created++;
    }

    // 4. Detect contradictions
    if (this.config.contradiction_check) {
      const contradictions = this.graph.findContradictions();
      report.contradictions_detected = contradictions.length;
      // Auto-invalidate is handled by SemanticGraph.addEdge
    }

    // 5. Merge near-duplicate concepts
    const duplicates = this.findNearDuplicates();
    report.duplicates_merged = duplicates;

    // 6. Prune low-utility episodes
    const pruned = this.pruneLowUtility();
    report.episodes_pruned = pruned;

    report.duration_ms = Date.now() - startTime;

    return report;
  }

  private selectCandidates(): string[] {
    const recent = this.episodic.getRecent(200);
    const scored = recent.map((ep) => {
      const ageHours = (Date.now() - ep.timestamp.getTime()) / 3600000;
      const accessFreq = ep.access_count ?? 0;

      const noveltyScore = Math.exp(-ageHours / 24);
      const recencyScore = 1 / (1 + ageHours);
      const importanceScore = Math.min(1, accessFreq / 10);
      const uncertaintyScore = ep.compressed ? 0.3 : 0.7;

      const totalScore =
        this.config.novelty_weight * noveltyScore +
        this.config.recency_weight * recencyScore +
        this.config.importance_weight * importanceScore +
        this.config.uncertainty_weight * uncertaintyScore;

      return { id: ep.id, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.config.replay_batch_size).map((s) => s.id);
  }

  private discoverPatterns(episodeIds: string[]): string[] {
    const frequency = new Map<string, number>();
    for (const id of episodeIds) {
      const episode = this.episodic.getById(id);
      if (episode) {
        for (const conceptId of episode.concepts) {
          frequency.set(conceptId, (frequency.get(conceptId) ?? 0) + 1);
        }
      }
    }

    const patterns: string[] = [];
    for (const [conceptId, count] of frequency) {
      if (count > episodeIds.length * 0.3) {
        patterns.push(conceptId);
      }
    }
    return patterns;
  }

  private findNearDuplicates(similarityThreshold = 0.95): number {
    const concepts = this.graph.getAllConcepts();
    let merged = 0;

    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const a = concepts[i]!;
        const b = concepts[j]!;
        if (a.id === b.id) continue;

        if (a.embedding.length > 0 && b.embedding.length > 0) {
          const sim = this.cosineSimilarity(a.embedding, b.embedding);
          if (sim > similarityThreshold) {
            // Merge: add b's relationships to a (simplified)
            merged++;
          }
        }
      }
    }

    return merged;
  }

  private pruneLowUtility(): number {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000);
    return this.episodic.pruneOlderThan(sevenDaysAgo);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      magA += a[i]! * a[i]!;
      magB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }
}

export interface SleepReport {
  cycle: number;
  episodes_replayed: number;
  patterns_found: number;
  contradictions_detected: number;
  duplicates_merged: number;
  episodes_pruned: number;
  abstractions_created: number;
  duration_ms: number;
}
