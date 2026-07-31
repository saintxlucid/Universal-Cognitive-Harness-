import { VectorStore, VectorRecord } from '../storage/vector-store.js';
import { GraphStore } from '../storage/graph-store.js';

export interface EvolutionConfig {
  basePath: string;
  vectorStore: VectorStore;
  graphStore: GraphStore;
  maxAgeMs?: number;
  importanceThreshold?: number;
  accessDecayFactor?: number;
  consolidationBatchSize?: number;
}

interface AccessRecord {
  id: string;
  lastAccess: number;
  accessCount: number;
  importance: number;
}

export class MemoryEvolution {
  private config: Required<EvolutionConfig>;
  private accessMap: Map<string, AccessRecord> = new Map();
  private cycleCount = 0;

  constructor(config: EvolutionConfig) {
    this.config = {
      maxAgeMs: config.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000,
      importanceThreshold: config.importanceThreshold ?? 0.3,
      accessDecayFactor: config.accessDecayFactor ?? 0.9,
      consolidationBatchSize: config.consolidationBatchSize ?? 100,
      ...config,
    };
  }

  recordAccess(id: string, importance = 0.5): void {
    const existing = this.accessMap.get(id);
    if (existing) {
      existing.lastAccess = Date.now();
      existing.accessCount++;
      existing.importance = Math.max(existing.importance, importance);
    } else {
      this.accessMap.set(id, { id, lastAccess: Date.now(), accessCount: 1, importance });
    }
  }

  async runCycle(): Promise<EvolutionReport> {
    this.cycleCount++;
    const now = Date.now();
    const forgotten: string[] = [];
    const consolidated: string[] = [];
    const merged: string[] = [];

    const allVectors = this.config.vectorStore.getAll();

    for (const vec of allVectors) {
      const access = this.accessMap.get(vec.id);
      const age = now - vec.timestamp;
      const importance = access?.importance ?? 0.3;
      const accessCount = access?.accessCount ?? 0;

      const forgetScore = this.computeForgetScore(age, importance, accessCount, now - (access?.lastAccess ?? vec.timestamp));

      if (forgetScore > 0.7) {
        this.config.vectorStore.delete(vec.id);
        forgotten.push(vec.id);
      }
    }

    const recent = allVectors.filter(v => !forgotten.includes(v.id));
    const clusters = this.clusterVectors(recent);
    for (const cluster of clusters) {
      if (cluster.length >= 3) {
        const centroid = this.computeCentroid(cluster);
        const mergedId = `merged-${this.cycleCount}-${Date.now()}`;
        this.config.vectorStore.insert(mergedId, centroid, { merged: true, sourceIds: cluster.map(c => c.id), cycle: this.cycleCount });
        merged.push(mergedId);
        for (const v of cluster) {
          this.config.vectorStore.delete(v.id);
          consolidated.push(v.id);
        }
      }
    }

    this.config.graphStore.detectContradictions().forEach(c => {
      if (c.edge1.weight < 0.3) {
        this.config.graphStore.getEdge(c.edge1.id);
      }
    });

    this.accessMap.clear();
    return { cycle: this.cycleCount, forgotten: forgotten.length, consolidated: consolidated.length, merged: merged.length, timestamp: now };
  }

  private computeForgetScore(ageMs: number, importance: number, accessCount: number, timeSinceLastAccess: number): number {
    const ageFactor = Math.min(1, ageMs / this.config.maxAgeMs);
    const importanceFactor = 1 - importance;
    const accessFactor = Math.exp(-accessCount * 0.1);
    const recencyFactor = Math.min(1, timeSinceLastAccess / (this.config.maxAgeMs * 0.3));
    return 0.3 * ageFactor + 0.35 * importanceFactor + 0.15 * accessFactor + 0.2 * recencyFactor;
  }

  private clusterVectors(vectors: VectorRecord[]): VectorRecord[][] {
    const clusters: VectorRecord[][] = [];
    const assigned = new Set<string>();
    const threshold = 0.85;

    for (const v of vectors) {
      if (assigned.has(v.id)) continue;
      const cluster = [v];
      assigned.add(v.id);
      for (const other of vectors) {
        if (assigned.has(other.id)) continue;
        const sim = this.cosineSimilarity(v.vector, other.vector);
        if (sim >= threshold) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }
      clusters.push(cluster);
    }

    return clusters.filter(c => c.length >= 2);
  }

  private computeCentroid(cluster: VectorRecord[]): number[] {
    const dim = cluster[0]!.vector.length;
    const centroid = new Array(dim).fill(0);
    for (const v of cluster) {
      for (let i = 0; i < dim; i++) centroid[i] += v.vector[i]!;
    }
    const mag = Math.sqrt(centroid.reduce((s, v) => s + v * v, 0));
    return mag > 0 ? centroid.map(c => c / cluster.length / mag) : centroid;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
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

export interface EvolutionReport {
  cycle: number;
  forgotten: number;
  consolidated: number;
  merged: number;
  timestamp: number;
}
