import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';

export type MemoryCertainty = 'confirmed' | 'likely' | 'uncertain' | 'speculative' | 'contradicted';

export interface ScientificMemoryEntry {
  id: string;
  key: string;
  value: unknown;
  memoryType: string;
  certainty: MemoryCertainty;
  confidence: number;
  evidence: string[];
  source: string;
  sourceTimestamp: Date;
  verificationStatus: 'verified' | 'unverified' | 'failed';
  contradictions: string[];
  usageCount: number;
  predictionAccuracy: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class ScientificMemory {
  private entries: Map<string, ScientificMemoryEntry> = new Map();
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  store(params: {
    key: string;
    value: unknown;
    memoryType?: string;
    certainty?: MemoryCertainty;
    confidence?: number;
    evidence?: string[];
    source: string;
    tags?: string[];
  }): ScientificMemoryEntry {
    const existing = this.getByKey(params.key);

    if (existing) {
      existing.value = params.value;
      existing.certainty = params.certainty ?? existing.certainty;
      existing.confidence = params.confidence ?? existing.confidence;
      if (params.evidence) existing.evidence = [...new Set([...existing.evidence, ...params.evidence])];
      existing.updatedAt = new Date();
      existing.sourceTimestamp = new Date();
      if (params.tags) existing.tags = [...new Set([...existing.tags, ...params.tags])];
      return existing;
    }

    const entry: ScientificMemoryEntry = {
      id: crypto.randomUUID(),
      key: params.key,
      value: params.value,
      memoryType: params.memoryType ?? 'general',
      certainty: params.certainty ?? 'uncertain',
      confidence: params.confidence ?? 0.5,
      evidence: params.evidence ?? [],
      source: params.source,
      sourceTimestamp: new Date(),
      verificationStatus: 'unverified',
      contradictions: [],
      usageCount: 0,
      predictionAccuracy: 0,
      tags: params.tags ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.entries.set(entry.id, entry);
    this.enforceLimit();
    return entry;
  }

  get(id: string): ScientificMemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) entry.usageCount++;
    return entry;
  }

  getByKey(key: string): ScientificMemoryEntry | undefined {
    const entry = [...this.entries.values()].find((e) => e.key === key);
    if (entry) entry.usageCount++;
    return entry;
  }

  query(query: string): ScientificMemoryEntry[] {
    const lower = query.toLowerCase();
    return [...this.entries.values()]
      .filter((e) => e.key.toLowerCase().includes(lower) || e.tags.some((t) => t.toLowerCase().includes(lower)))
      .sort((a, b) => b.confidence - a.confidence);
  }

  verify(id: string, status: 'verified' | 'failed'): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.verificationStatus = status;
    if (status === 'verified') {
      entry.certainty = 'confirmed';
      entry.confidence = Math.min(1, entry.confidence + 0.2);
    } else {
      entry.certainty = 'contradicted';
      entry.confidence = Math.max(0, entry.confidence - 0.3);
    }
    entry.updatedAt = new Date();
    return true;
  }

  addContradiction(id: string, contradiction: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.contradictions.push(contradiction);
    entry.certainty = 'contradicted';
    entry.confidence = Math.max(0, entry.confidence - 0.2);
    entry.updatedAt = new Date();
    return true;
  }

  addEvidence(id: string, evidence: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.evidence.push(evidence);
    entry.confidence = Math.min(1, entry.confidence + 0.05);
    entry.updatedAt = new Date();
    return true;
  }

  recordPrediction(id: string, accurate: boolean): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const prevAccuracy = entry.predictionAccuracy;
    const prevCount = entry.usageCount > 0 ? entry.usageCount : 1;
    entry.predictionAccuracy = ((prevAccuracy * prevCount) + (accurate ? 1 : 0)) / (prevCount + 1);
  }

  getByMemoryType(type: string): ScientificMemoryEntry[] {
    return [...this.entries.values()].filter((e) => e.memoryType === type);
  }

  getContradicted(): ScientificMemoryEntry[] {
    return [...this.entries.values()].filter((e) => e.certainty === 'contradicted');
  }

  getByCertainty(certainty: MemoryCertainty): ScientificMemoryEntry[] {
    return [...this.entries.values()].filter((e) => e.certainty === certainty);
  }

  getAll(limit = 100): ScientificMemoryEntry[] {
    return [...this.entries.values()]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
  }

  getStats(): {
    total: number; byCertainty: Record<string, number>;
    byType: Record<string, number>; avgConfidence: number;
    contradictions: number; verifiedCount: number;
  } {
    const byCertainty: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalConfidence = 0;
    let contradictions = 0;
    let verifiedCount = 0;

    for (const [, e] of this.entries) {
      byCertainty[e.certainty] = (byCertainty[e.certainty] ?? 0) + 1;
      byType[e.memoryType] = (byType[e.memoryType] ?? 0) + 1;
      totalConfidence += e.confidence;
      contradictions += e.contradictions.length;
      if (e.verificationStatus === 'verified') verifiedCount++;
    }

    return {
      total: this.entries.size, byCertainty, byType,
      avgConfidence: this.entries.size > 0 ? totalConfidence / this.entries.size : 0,
      contradictions, verifiedCount,
    };
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      entries: mapToRecord(this.entries),
      maxEntries: this.maxEntries,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      entries: Record<string, ScientificMemoryEntry>;
      maxEntries: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxEntries !== undefined) this.maxEntries = data.maxEntries;
    this.entries = recordToMap(data.entries ?? {});
    return this.entries.size;
  }

  private enforceLimit(): void {
    if (this.entries.size > this.maxEntries) {
      const oldest = [...this.entries.values()].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0];
      if (oldest) this.entries.delete(oldest.id);
    }
  }
}
