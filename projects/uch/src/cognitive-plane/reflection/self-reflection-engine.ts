import { writeSnapshot, readSnapshot } from '../persistence/persistence-engine.js';
import { ScientificMemory } from '../memory/scientific-memory.js';
import type { CompilationArtifact } from '../compiler/knowledge-compiler.js';

export type ReflectionPhase =
  | 'dawn' | 'morning' | 'afternoon' | 'evening' | 'dusk';

export type ReflectionCategory =
  | 'learning' | 'mistakes' | 'assumptions' | 'patterns'
  | 'skills' | 'rules' | 'forgetting' | 'compression'
  | 'knowledge-gaps' | 'decisions' | 'predictions';

export interface ReflectionEntry {
  id: string;
  phase: ReflectionPhase;
  category: ReflectionCategory;
  title: string;
  content: string;
  confidence: number;
  evidenceIds: string[];
  actionItems: string[];
  timestamp: Date;
  integrated: boolean;
}

export interface ReflectionSession {
  id: string;
  phase: ReflectionPhase;
  entries: ReflectionEntry[];
  startedAt: Date;
  completedAt: Date | null;
  summary: string;
}

export class SelfReflectionEngine {
  private entries: ReflectionEntry[] = [];
  private sessions: ReflectionSession[] = [];
  private memory: ScientificMemory;
  private maxEntries: number;

  constructor(memory: ScientificMemory, maxEntries = 5000) {
    this.memory = memory;
    this.maxEntries = maxEntries;
  }

  runNightly(): ReflectionSession {
    return this.runPhase('dusk');
  }

  runPhase(phase: ReflectionPhase): ReflectionSession {
    const session: ReflectionSession = {
      id: crypto.randomUUID(),
      phase,
      entries: [],
      startedAt: new Date(),
      completedAt: null,
      summary: '',
    };

    const newEntries: ReflectionEntry[] = [];

    newEntries.push(this.baselineReflection(phase));
    newEntries.push(...this.reflectOnLearnings(phase));
    newEntries.push(...this.reflectOnMistakes(phase));
    newEntries.push(...this.reflectOnAssumptions(phase));
    newEntries.push(...this.reflectOnPatterns(phase));
    newEntries.push(...this.reflectOnSkills(phase));
    newEntries.push(...this.reflectOnCompression(phase));

    for (const e of newEntries) {
      this.entries.push(e);
      session.entries.push(e);
    }

    this.enforceLimit();

    session.summary = this.generateSummary(session.entries);
    session.completedAt = new Date();
    this.sessions.push(session);

    return session;
  }

  getEntries(limit = 50): ReflectionEntry[] {
    return [...this.entries].reverse().slice(0, limit);
  }

  getByCategory(category: ReflectionCategory): ReflectionEntry[] {
    return this.entries.filter((e) => e.category === category);
  }

  getByPhase(phase: ReflectionPhase): ReflectionEntry[] {
    return this.entries.filter((e) => e.phase === phase);
  }

  getSessions(limit = 20): ReflectionSession[] {
    return this.sessions.slice(-limit);
  }

  getUnintegrated(): ReflectionEntry[] {
    return this.entries.filter((e) => !e.integrated);
  }

  markIntegrated(id: string): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return false;
    entry.integrated = true;
    return true;
  }

  getStats(): { totalSessions: number; totalEntries: number; byCategory: Record<string, number>; unintegrated: number } {
    const byCategory: Record<string, number> = {};
    for (const e of this.entries) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    return {
      totalSessions: this.sessions.length,
      totalEntries: this.entries.length,
      byCategory,
      unintegrated: this.entries.filter((e) => !e.integrated).length,
    };
  }

  clear(): void {
    this.entries = [];
    this.sessions = [];
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      entries: this.entries,
      sessions: this.sessions,
      maxEntries: this.maxEntries,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      entries: ReflectionEntry[];
      sessions: ReflectionSession[];
      maxEntries: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxEntries !== undefined) this.maxEntries = data.maxEntries;
    this.entries = data.entries ?? [];
    this.sessions = data.sessions ?? [];
    return this.entries.length;
  }

  private baselineReflection(phase: ReflectionPhase): ReflectionEntry {
    const memoryStats = this.memory.getStats();
    return {
      id: crypto.randomUUID(), phase, category: 'learning',
      title: `Phase ${phase} reflection cycle`,
      content: `Reflection cycle with ${memoryStats.total} memories, ${memoryStats.verifiedCount} verified, ${memoryStats.contradictions} contradictions.`,
      confidence: 0.9, evidenceIds: [],
      actionItems: [],
      timestamp: new Date(), integrated: false,
    };
  }

  private reflectOnLearnings(phase: ReflectionPhase): ReflectionEntry[] {
    const results: ReflectionEntry[] = [];
    const recentMemories = this.memory.getAll(20).filter((m) => m.confidence > 0.6);
    if (recentMemories.length === 0) return results;

    const title = `Key learnings from ${recentMemories.length} recent memories`;
    results.push({
      id: crypto.randomUUID(), phase, category: 'learning',
      title,
      content: `Consolidated ${recentMemories.length} high-confidence memories. Topics: ${recentMemories.map((m) => m.key).slice(0, 5).join(', ')}.`,
      confidence: 0.7, evidenceIds: recentMemories.map((m) => m.id),
      actionItems: ['Review and consolidate related knowledge'],
      timestamp: new Date(), integrated: false,
    });
    return results;
  }

  private reflectOnMistakes(phase: ReflectionPhase): ReflectionEntry[] {
    const results: ReflectionEntry[] = [];
    const lowConfidence = this.memory.getByCertainty('contradicted');
    if (lowConfidence.length === 0) return results;

    results.push({
      id: crypto.randomUUID(), phase, category: 'mistakes',
      title: `${lowConfidence.length} contradicted memories detected`,
      content: `${lowConfidence.length} memories have contradictions. Topics: ${lowConfidence.map((m) => m.key).slice(0, 5).join(', ')}.`,
      confidence: 0.8, evidenceIds: lowConfidence.slice(0, 10).map((m) => m.id),
      actionItems: ['Review contradicted memories', 'Resolve contradictions'],
      timestamp: new Date(), integrated: false,
    });
    return results;
  }

  private reflectOnAssumptions(phase: ReflectionPhase): ReflectionEntry[] {
    const results: ReflectionEntry[] = [];
    const speculative = this.memory.getByCertainty('speculative');
    if (speculative.length === 0) return results;

    results.push({
      id: crypto.randomUUID(), phase, category: 'assumptions',
      title: `${speculative.length} unvalidated assumptions`,
      content: `${speculative.length} memories remain speculative. Consider validation.`,
      confidence: 0.5, evidenceIds: speculative.slice(0, 5).map((m) => m.id),
      actionItems: ['Validate speculative memories'],
      timestamp: new Date(), integrated: false,
    });
    return results;
  }

  private reflectOnPatterns(phase: ReflectionPhase): ReflectionEntry[] {
    const results: ReflectionEntry[] = [];
    const byType = this.memory.getStats().byType;
    const dominantTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (dominantTypes.length === 0) return results;

    results.push({
      id: crypto.randomUUID(), phase, category: 'patterns',
      title: 'Dominant memory patterns identified',
      content: `Most frequent memory types: ${dominantTypes.map(([t, c]) => `${t} (${c})`).join(', ')}.`,
      confidence: 0.75, evidenceIds: [],
      actionItems: ['Review if dominant types indicate focus areas'],
      timestamp: new Date(), integrated: false,
    });
    return results;
  }

  private reflectOnSkills(phase: ReflectionPhase): ReflectionEntry[] {
    const results: ReflectionEntry[] = [];
    const verified = this.memory.getStats().verifiedCount;
    const total = this.memory.getStats().total;

    if (total === 0) return results;

    results.push({
      id: crypto.randomUUID(), phase, category: 'skills',
      title: 'Knowledge verification status',
      content: `${verified}/${total} memories verified (${((verified / total) * 100).toFixed(1)}%). Target: >80%.`,
      confidence: 0.9, evidenceIds: [],
      actionItems: verified / total < 0.8 ? ['Increase verification rate'] : [],
      timestamp: new Date(), integrated: false,
    });
    return results;
  }

  private reflectOnCompression(phase: ReflectionPhase): ReflectionEntry[] {
    const results: ReflectionEntry[] = [];
    const unintegrated = this.entries.filter((e) => !e.integrated);
    if (unintegrated.length < 5) return results;

    results.push({
      id: crypto.randomUUID(), phase, category: 'compression',
      title: `${unintegrated.length} reflections pending integration`,
      content: `${unintegrated.length} reflections from previous sessions have not been integrated into memory.`,
      confidence: 0.8, evidenceIds: unintegrated.slice(0, 5).map((e) => e.id),
      actionItems: ['Integrate pending reflections into memory'],
      timestamp: new Date(), integrated: false,
    });
    return results;
  }

  private generateSummary(entries: ReflectionEntry[]): string {
    if (entries.length === 0) return 'No reflections generated.';
    const byCat = new Map<string, number>();
    for (const e of entries) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
    const cats = [...byCat.entries()].map(([c, n]) => `${c} (${n})`).join(', ');
    const actionItems = entries.flatMap((e) => e.actionItems).filter(Boolean);
    return `Reflection session with ${entries.length} entries across ${byCat.size} categories: ${cats}. ${actionItems.length} action items identified.`;
  }

  private enforceLimit(): void {
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    if (this.sessions.length > 100) {
      this.sessions.splice(0, this.sessions.length - 100);
    }
  }
}
