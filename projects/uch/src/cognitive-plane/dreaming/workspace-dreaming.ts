import { writeSnapshot, readSnapshot } from '../persistence/persistence-engine.js';
import { TraceLedger } from '../trace-engine/trace-ledger.js';
import { KnowledgeCompiler } from '../compiler/knowledge-compiler.js';
import { ScientificMemory } from '../memory/scientific-memory.js';

export type DreamCategory =
  | 'duplicate-detection' | 'architecture-analysis'
  | 'knowledge-consolidation' | 'pattern-discovery'
  | 'anomaly-detection' | 'dependency-analysis'
  | 'coverage-gap' | 'optimization-suggestion';

export interface DreamResult {
  id: string;
  category: DreamCategory;
  title: string;
  description: string;
  evidenceIds: string[];
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  createdAt: Date;
  implemented: boolean;
}

export class WorkspaceDreaming {
  private results: DreamResult[] = [];
  private ledger: TraceLedger;
  private compiler: KnowledgeCompiler;
  private memory: ScientificMemory;
  private maxResults: number;
  private isDreaming = false;
  private cyclesCompleted = 0;

  constructor(
    ledger: TraceLedger,
    compiler: KnowledgeCompiler,
    memory: ScientificMemory,
    maxResults = 1000,
  ) {
    this.ledger = ledger;
    this.compiler = compiler;
    this.memory = memory;
    this.maxResults = maxResults;
  }

  get getResults(): DreamResult[] { return this.results; }

  async dreamOnce(): Promise<DreamResult[]> {
    this.isDreaming = true;
    const batch: DreamResult[] = [];

    batch.push(...this.detectDuplicates());
    batch.push(...this.consolidateKnowledge());
    batch.push(...this.discoverPatterns());
    batch.push(...this.detectAnomalies());
    batch.push(...this.optimizationSuggestions());

    for (const r of batch) {
      this.results.push(r);
    }

    this.enforceLimit();
    this.cyclesCompleted++;
    this.isDreaming = false;

    return batch;
  }

  async dreamCycle(count = 3, intervalMs = 100): Promise<DreamResult[]> {
    const all: DreamResult[] = [];
    for (let i = 0; i < count; i++) {
      const batch = await this.dreamOnce();
      all.push(...batch);
      if (i < count - 1) await new Promise((r) => setTimeout(r, intervalMs));
    }
    return all;
  }

  getRecent(limit = 50): DreamResult[] {
    return [...this.results].reverse().slice(0, limit);
  }

  getByCategory(category: DreamCategory): DreamResult[] {
    return this.results.filter((r) => r.category === category);
  }

  getHighImpact(): DreamResult[] {
    return this.results.filter((r) => r.impact === 'high' && !r.implemented);
  }

  markImplemented(id: string): boolean {
    const result = this.results.find((r) => r.id === id);
    if (!result) return false;
    result.implemented = true;
    return true;
  }

  getStats(): { cycles: number; totalResults: number; byCategory: Record<string, number>; highImpactRemaining: number } {
    const byCategory: Record<string, number> = {};
    for (const r of this.results) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    return {
      cycles: this.cyclesCompleted,
      totalResults: this.results.length,
      byCategory,
      highImpactRemaining: this.getHighImpact().length,
    };
  }

  clear(): void {
    this.results = [];
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      results: this.results,
      cyclesCompleted: this.cyclesCompleted,
      maxResults: this.maxResults,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      results: DreamResult[];
      cyclesCompleted: number;
      maxResults: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxResults !== undefined) this.maxResults = data.maxResults;
    this.results = data.results ?? [];
    this.cyclesCompleted = data.cyclesCompleted ?? 0;
    return this.results.length;
  }

  private detectDuplicates(): DreamResult[] {
    const results: DreamResult[] = [];
    const recent = this.ledger.getRecent(200);
    const byName = new Map<string, string[]>();

    for (const t of recent) {
      const existing = byName.get(t.name) ?? [];
      existing.push(t.trace_id);
      byName.set(t.name, existing);
    }

    for (const [name, ids] of byName) {
      if (ids.length >= 5) {
        results.push({
          id: crypto.randomUUID(),
          category: 'duplicate-detection',
          title: `Repeated operation: "${name}"`,
          description: `${name} executed ${ids.length} times. Consider caching or deduplication.`,
          evidenceIds: ids.slice(0, 5),
          confidence: Math.min(0.9, 0.4 + ids.length * 0.02),
          impact: ids.length >= 10 ? 'high' : 'medium',
          createdAt: new Date(),
          implemented: false,
        });
      }
    }

    return results;
  }

  private consolidateKnowledge(): DreamResult[] {
    const results: DreamResult[] = [];
    const stages = ['fact', 'knowledge'] as const;
    for (const stage of stages) {
      const artifacts = this.compiler.getByStage(stage);
      if (artifacts.length >= 5) {
        results.push({
          id: crypto.randomUUID(),
          category: 'knowledge-consolidation',
          title: `${artifacts.length} ${stage} artifacts ready for compression`,
          description: `${artifacts.length} artifacts at "${stage}" stage. Compress to next abstraction level.`,
          evidenceIds: artifacts.slice(0, 5).map((a) => a.id),
          confidence: 0.7,
          impact: artifacts.length >= 20 ? 'high' : 'medium',
          createdAt: new Date(),
          implemented: false,
        });
      }
    }
    return results;
  }

  private discoverPatterns(): DreamResult[] {
    const results: DreamResult[] = [];
    const recent = this.ledger.getRecent(100);
    const statusDistribution = new Map<string, number>();
    const kindDistribution = new Map<string, number>();

    for (const t of recent) {
      statusDistribution.set(t.status, (statusDistribution.get(t.status) ?? 0) + 1);
      kindDistribution.set(t.kind, (kindDistribution.get(t.kind) ?? 0) + 1);
    }

    const topKind = [...kindDistribution.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topKind && topKind[1] > recent.length * 0.6) {
      results.push({
        id: crypto.randomUUID(),
        category: 'pattern-discovery',
        title: `Dominant span kind: ${topKind[0]}`,
        description: `${topKind[1]}/${recent.length} traces are "${topKind[0]}" kind.`,
        evidenceIds: [],
        confidence: 0.6,
        impact: 'medium',
        createdAt: new Date(),
        implemented: false,
      });
    }

    return results;
  }

  private detectAnomalies(): DreamResult[] {
    const results: DreamResult[] = [];
    const recent = this.ledger.getRecent(200);

    const errorTraces = recent.filter((t) => t.status === 'error');
    if (errorTraces.length > recent.length * 0.15) {
      results.push({
        id: crypto.randomUUID(),
        category: 'anomaly-detection',
        title: `Error rate anomaly: ${((errorTraces.length / recent.length) * 100).toFixed(1)}%`,
        description: `Error rate exceeds 15% threshold. ${errorTraces.length} errors in last ${recent.length} traces.`,
        evidenceIds: errorTraces.slice(0, 5).map((t) => t.trace_id),
        confidence: 0.8,
        impact: 'high',
        createdAt: new Date(),
        implemented: false,
      });
    }

    const unsetTraces = recent.filter((t) => t.status === 'unset');
    if (unsetTraces.length > 30) {
      results.push({
        id: crypto.randomUUID(),
        category: 'anomaly-detection',
        title: `${unsetTraces.length} unset traces detected`,
        description: `${unsetTraces.length} traces have unset status, indicating incomplete operations.`,
        evidenceIds: [],
        confidence: 0.5,
        impact: 'medium',
        createdAt: new Date(),
        implemented: false,
      });
    }

    return results;
  }

  private optimizationSuggestions(): DreamResult[] {
    const results: DreamResult[] = [];
    const recent = this.ledger.getRecent(100);

    const nameCounts = new Map<string, number>();
    for (const t of recent) {
      nameCounts.set(t.name, (nameCounts.get(t.name) ?? 0) + 1);
    }

    const repeatedOps = [...nameCounts.entries()].filter(([, c]) => c >= 3);
    if (repeatedOps.length >= 3) {
      results.push({
        id: crypto.randomUUID(),
        category: 'optimization-suggestion',
        title: `${repeatedOps.length} operations repeated 3+ times`,
        description: `Frequent operations: ${repeatedOps.slice(0, 5).map(([n, c]) => `${n} (${c}x)`).join(', ')}. Consider optimization.`,
        evidenceIds: [],
        confidence: 0.6,
        impact: 'medium',
        createdAt: new Date(),
        implemented: false,
      });
    }

    return results;
  }

  private enforceLimit(): void {
    if (this.results.length > this.maxResults) {
      this.results.splice(0, this.results.length - this.maxResults);
    }
  }
}
