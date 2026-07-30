import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';
import type { CognitiveTrace } from '../trace-engine/cognitive-trace.js';
import type { DecisionEntry } from '../decisions/decision-log.js';

export type CompilationStage = 'raw' | 'fact' | 'knowledge' | 'mental-model' | 'framework' | 'pattern' | 'heuristic' | 'principle' | 'wisdom';

export interface CompilationArtifact {
  id: string;
  stage: CompilationStage;
  title: string;
  content: string;
  sourceIds: string[];
  tags: string[];
  confidence: number;
  provenance: string;
  compressedFrom: string[];
  createdAt: Date;
  accessedCount: number;
}

export interface CompilationResult {
  artifacts: CompilationArtifact[];
  stage: CompilationStage;
  inputCount: number;
  outputCount: number;
  compressionRatio: number;
}

export class KnowledgeCompiler {
  private artifacts: Map<string, CompilationArtifact> = new Map();
  private maxArtifacts: number;
  private totalInputs = 0;
  private totalOutputs = 0;

  constructor(maxArtifacts = 10000) {
    this.maxArtifacts = maxArtifacts;
  }

  ingest(traces: CognitiveTrace[]): CompilationResult {
    this.totalInputs += traces.length;
    const facts = this.extractFacts(traces);
    const result: CompilationResult = {
      artifacts: facts,
      stage: 'fact',
      inputCount: traces.length,
      outputCount: facts.length,
      compressionRatio: traces.length > 0 ? facts.length / traces.length : 0,
    };
    return result;
  }

  ingestDecisions(decisions: DecisionEntry[]): CompilationResult {
    this.totalInputs += decisions.length;
    const artifacts: CompilationArtifact[] = decisions.map((d) => ({
      id: crypto.randomUUID(),
      stage: 'knowledge' as CompilationStage,
      title: d.title,
      content: `${d.rationale}: ${d.outcome}`,
      sourceIds: d.traceIds,
      tags: [...d.tags],
      confidence: 0.7,
      provenance: `decision:${d.id}`,
      compressedFrom: [],
      createdAt: d.timestamp,
      accessedCount: 0,
    }));
    for (const a of artifacts) this.addArtifact(a);
    this.totalOutputs += artifacts.length;
    return { artifacts, stage: 'knowledge', inputCount: decisions.length, outputCount: artifacts.length, compressionRatio: 1 };
  }

  compress(stage: CompilationStage): CompilationResult {
    const candidates = [...this.artifacts.values()].filter(
      (a) => a.stage === stage && this.canCompressStage(stage),
    );

    if (candidates.length < 2) {
      return { artifacts: [], stage: this.nextStage(stage), inputCount: candidates.length, outputCount: 0, compressionRatio: 0 };
    }

    const groups = this.groupByTags(candidates);
    const artifacts: CompilationArtifact[] = [];

    for (const [, group] of groups) {
      if (group.length < 2) continue;

      const commonTags = this.findCommonTags(group);
      const title = group[0]!.title.includes(':') ? group[0]!.title.split(':')[0]!.trim() : group[0]!.title;
      const merged: CompilationArtifact = {
        id: crypto.randomUUID(),
        stage: this.nextStage(stage),
        title: `${title} (compressed)`,
        content: group.map((a) => a.content).join('\n'),
        sourceIds: group.flatMap((a) => a.sourceIds),
        tags: commonTags,
        confidence: Math.min(0.95, group.reduce((s, a) => s + a.confidence, 0) / group.length + 0.1),
        provenance: `compressed:${stage}→${this.nextStage(stage)}`,
        compressedFrom: group.map((a) => a.id),
        createdAt: new Date(),
        accessedCount: 0,
      };
      for (const g of group) this.artifacts.delete(g.id);
      artifacts.push(merged);
      this.addArtifact(merged);
    }

    this.totalInputs += candidates.length;
    this.totalOutputs += artifacts.length;

    return {
      artifacts,
      stage: this.nextStage(stage),
      inputCount: candidates.length,
      outputCount: artifacts.length,
      compressionRatio: candidates.length > 0 ? artifacts.length / candidates.length : 0,
    };
  }

  compressAll(): CompilationResult[] {
    const stages: CompilationStage[] = ['fact', 'knowledge', 'mental-model', 'framework', 'pattern', 'heuristic', 'principle'];
    const results: CompilationResult[] = [];
    for (const stage of stages) {
      const result = this.compress(stage);
      if (result.artifacts.length > 0) results.push(result);
    }
    return results;
  }

  get(id: string): CompilationArtifact | undefined {
    const a = this.artifacts.get(id);
    if (a) a.accessedCount++;
    return a;
  }

  getByStage(stage: CompilationStage): CompilationArtifact[] {
    return [...this.artifacts.values()].filter((a) => a.stage === stage);
  }

  getByTag(tag: string): CompilationArtifact[] {
    return [...this.artifacts.values()].filter((a) => a.tags.includes(tag));
  }

  getAll(limit = 100): CompilationArtifact[] {
    return [...this.artifacts.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  getWisdom(): CompilationArtifact[] {
    return this.getByStage('wisdom');
  }

  getStats(): { total: number; byStage: Record<string, number>; totalInputs: number; totalOutputs: number; compressionRatio: number } {
    const byStage: Record<string, number> = {};
    for (const [, a] of this.artifacts) byStage[a.stage] = (byStage[a.stage] ?? 0) + 1;
    return {
      total: this.artifacts.size, byStage,
      totalInputs: this.totalInputs, totalOutputs: this.totalOutputs,
      compressionRatio: this.totalInputs > 0 ? this.totalOutputs / this.totalInputs : 0,
    };
  }

  clear(): void {
    this.artifacts.clear();
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      artifacts: mapToRecord(this.artifacts),
      maxArtifacts: this.maxArtifacts,
      totalInputs: this.totalInputs,
      totalOutputs: this.totalOutputs,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      artifacts: Record<string, CompilationArtifact>;
      maxArtifacts: number;
      totalInputs: number;
      totalOutputs: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxArtifacts !== undefined) this.maxArtifacts = data.maxArtifacts;
    this.totalInputs = data.totalInputs ?? 0;
    this.totalOutputs = data.totalOutputs ?? 0;
    this.artifacts = recordToMap(data.artifacts ?? {});
    return this.artifacts.size;
  }

  private extractFacts(traces: CognitiveTrace[]): CompilationArtifact[] {
    const artifacts: CompilationArtifact[] = [];
    for (const trace of traces) {
      const eventTypes = trace.events.map((e) => e.type).join(', ');
      artifacts.push({
        id: crypto.randomUUID(),
        stage: 'fact',
        title: `trace:${trace.name}`,
        content: `Operation "${trace.name}" with status ${trace.status}. Events: ${eventTypes || 'none'}`,
        sourceIds: [trace.trace_id],
        tags: [trace.name, trace.kind, trace.status],
        confidence: trace.status === 'ok' ? 0.8 : 0.5,
        provenance: `trace:${trace.trace_id}`,
        compressedFrom: [],
        createdAt: trace.timestamp,
        accessedCount: 0,
      });
    }
    for (const a of artifacts) this.addArtifact(a);
    this.totalOutputs += artifacts.length;
    return artifacts;
  }

  private addArtifact(artifact: CompilationArtifact): void {
    this.artifacts.set(artifact.id, artifact);
    if (this.artifacts.size > this.maxArtifacts) {
      const oldest = [...this.artifacts.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (oldest) this.artifacts.delete(oldest.id);
    }
  }

  private canCompressStage(stage: CompilationStage): boolean {
    return stage !== 'wisdom';
  }

  private nextStage(stage: CompilationStage): CompilationStage {
    const order: CompilationStage[] = ['raw', 'fact', 'knowledge', 'mental-model', 'framework', 'pattern', 'heuristic', 'principle', 'wisdom'];
    const idx = order.indexOf(stage);
    return idx >= 0 && idx < order.length - 1 ? order[idx + 1]! : 'wisdom';
  }

  private groupByTags(artifacts: CompilationArtifact[]): Map<string, CompilationArtifact[]> {
    const groups = new Map<string, CompilationArtifact[]>();
    for (const a of artifacts) {
      const key = a.tags.filter((t) => t !== 'ok' && t !== 'error' && t !== 'unset' && t !== 'internal').sort().join('::') || 'ungrouped';
      const existing = groups.get(key) ?? [];
      existing.push(a);
      groups.set(key, existing);
    }
    return groups;
  }

  private findCommonTags(artifacts: CompilationArtifact[]): string[] {
    if (artifacts.length === 0) return [];
    const tagCounts = new Map<string, number>();
    for (const a of artifacts) {
      for (const t of a.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    return [...tagCounts.entries()]
      .filter(([, c]) => c === artifacts.length)
      .map(([t]) => t);
  }
}
