import { NervousSystem } from '../nervous-system/nervous-system.js';
import { createSignal } from '../nervous-system/signal.js';
import { AetherCore } from '../aether/aether-core.js';
import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';

export type SleepPhase = 'awake' | 'napping' | 'deep-sleep' | 'dreaming' | 'waking';

export interface SleepReport {
  phase: SleepPhase;
  startedAt: Date;
  durationMs: number;
  memoriesConsolidated: number;
  patternsLearned: number;
  skillsBenchmarked: number;
  insightsGenerated: number;
  /** Dominant-framework patterns consolidated from framework traces (blueprint §5.1). */
  frameworkPatternsLearned?: number;
  dominantFrameworks?: SleepFrameworkPattern[];
  [key: string]: unknown;
}

export interface SleepMemoryItem {
  id: string;
  content: string;
  importance: number;
  timestamp: Date;
}

export interface SleepMemorySource {
  listUnconsolidated(limit?: number): Promise<SleepMemoryItem[]>;
  markConsolidated(ids: string[], summary?: string): Promise<void>;
}

export interface DistilledSkill {
  id: string;
  name: string;
  description: string;
  body: string;
  sourceCount: number;
  distilledAt: Date;
  provenance: string[];
}

export interface SleepSkillSink {
  publish(skill: DistilledSkill): Promise<void>;
}

/** A dominant framework per problem type, consolidated from framework traces. */
export interface SleepFrameworkPattern {
  problemType: string;
  engine: string;
  count: number;
}

/**
 * Framework-trace source (blueprint §5.1): the sleep cycle consumes
 * framework invocation traces to consolidate "dominant framework per
 * problem type" patterns — the harness learns which frameworks it
 * actually uses for which problems.
 */
export interface SleepFrameworkSource {
  getDominantPerProblemType(): SleepFrameworkPattern[];
}

export interface SkillDistillationConfig {
  minImportance: number;
  minContentLength: number;
  maxSkillsPerCycle: number;
  patternMinFrequency: number;
  consolidationChunkSize: number;
}

const DEFAULT_CONFIG: SkillDistillationConfig = {
  minImportance: 0.4,
  minContentLength: 20,
  maxSkillsPerCycle: 3,
  patternMinFrequency: 2,
  consolidationChunkSize: 200,
};

export function createKernelMemorySource(kernel: CognitiveKernel): SleepMemorySource {
  return {
    async listUnconsolidated(limit = 200): Promise<SleepMemoryItem[]> {
      const store = kernel.getEpisodicStore();
      const episodes = store.getRecent(limit).filter((ep) => !ep.compressed);
      return episodes.map((ep) => {
        const content = renderEpisodeContent(ep.content);
        const importance = Math.min(1, 0.4 + (ep.access_count ?? 0) / 10);
        return { id: ep.id, content, importance, timestamp: ep.timestamp };
      });
    },
    async markConsolidated(ids: string[], summary?: string): Promise<void> {
      const store = kernel.getEpisodicStore();
      for (const id of ids) {
        store.markCompressed(id, summary ?? 'consolidated by sleep cycle');
      }
    },
  };
}

function renderEpisodeContent(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(renderEpisodeContent).join(' ');
  if (typeof content === 'object') {
    const c = content as Record<string, unknown>;
    if (c.type === 'text' && typeof c.text === 'string') return c.text;
    if (c.type === 'observation' && typeof c.observation === 'string') return c.observation;
    if (c.type === 'tool_call') {
      return `${String(c.tool)}: ${JSON.stringify(c.input)} -> ${JSON.stringify(c.output)}`;
    }
    return JSON.stringify(content);
  }
  return String(content);
}

function contentHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = (h1 * 31 + code) >>> 0;
    h2 = (h2 * 33 + code) >>> 0;
  }
  return `${h1.toString(16)}-${h2.toString(16)}`;
}

interface PatternScore {
  pattern: string;
  frequency: number;
  score: number;
  sources: string[];
}

export class SleepCycle {
  private nervousSystem: NervousSystem;
  private aether: AetherCore;
  private memorySource: SleepMemorySource | null;
  private skillSink: SleepSkillSink | null;
  private frameworkSource: SleepFrameworkSource | null;
  private config: SkillDistillationConfig;
  private distilledSkills: DistilledSkill[] = [];
  private _phase: SleepPhase = 'awake';
  private cycleCount = 0;
  private reports: SleepReport[] = [];
  private napTimer: ReturnType<typeof setInterval> | null = null;
  private napIntervalMs: number;

  constructor(
    nervousSystem: NervousSystem,
    aether: AetherCore,
    memorySource?: SleepMemorySource | null,
    skillSink?: SleepSkillSink | null,
    config?: Partial<SkillDistillationConfig>,
    napIntervalMs = 300000,
    frameworkSource?: SleepFrameworkSource | null,
  ) {
    this.nervousSystem = nervousSystem;
    this.aether = aether;
    this.memorySource = memorySource ?? null;
    this.skillSink = skillSink ?? null;
    this.frameworkSource = frameworkSource ?? null;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.napIntervalMs = napIntervalMs;
  }

  get phase(): SleepPhase {
    return this._phase;
  }

  setMemorySource(source: SleepMemorySource): void {
    this.memorySource = source;
  }

  setSkillSink(sink: SleepSkillSink): void {
    this.skillSink = sink;
  }

  setFrameworkSource(source: SleepFrameworkSource): void {
    this.frameworkSource = source;
  }

  startNapCycle(): void {
    if (this.napTimer) return;
    this.napTimer = setInterval(async () => {
      await this.nap();
    }, this.napIntervalMs);
  }

  stopNapCycle(): void {
    if (this.napTimer) {
      clearInterval(this.napTimer);
      this.napTimer = null;
    }
  }

  getDistilledSkills(): DistilledSkill[] {
    return [...this.distilledSkills];
  }

  async nap(): Promise<SleepReport> {
    const start = Date.now();
    this._phase = 'napping';
    this.aether.phase = 'sleeping';

    const insights = await this.runMaintenance();

    this._phase = 'waking';
    this.aether.phase = 'active';
    const duration = Date.now() - start;

    const report: SleepReport = {
      phase: 'napping',
      startedAt: new Date(start),
      durationMs: duration,
      ...insights,
    };

    this.cycleCount++;
    this.reports.push(report);
    if (this.reports.length > 50) this.reports.shift();

    const sig = createSignal('sleep:cycle', 'sleep-cycle', report as unknown as Record<string, unknown>);
    await this.nervousSystem.emit(sig);

    return report;
  }

  async deepSleep(): Promise<SleepReport> {
    const start = Date.now();
    this._phase = 'deep-sleep';
    this.aether.phase = 'sleeping';

    this._phase = 'dreaming';
    const insights = await this.runMaintenance();

    this._phase = 'waking';
    this.aether.phase = 'active';
    const duration = Date.now() - start;

    const report: SleepReport = {
      phase: 'deep-sleep',
      startedAt: new Date(start),
      durationMs: duration,
      ...insights,
    };

    this.cycleCount++;
    this.reports.push(report);

    const sig = createSignal('sleep:cycle', 'sleep-cycle', report as unknown as Record<string, unknown>);
    await this.nervousSystem.emit(sig);

    return report;
  }

  private async runMaintenance(): Promise<{
    memoriesConsolidated: number;
    patternsLearned: number;
    skillsBenchmarked: number;
    insightsGenerated: number;
    skillsDistilled: number;
    tokenReductionPct: number;
    frameworkPatternsLearned: number;
    dominantFrameworks: SleepFrameworkPattern[];
  }> {
    if (!this.memorySource) {
      return {
        memoriesConsolidated: 0,
        patternsLearned: 0,
        skillsBenchmarked: 0,
        insightsGenerated: 0,
        skillsDistilled: 0,
        tokenReductionPct: 0,
        frameworkPatternsLearned: 0,
        dominantFrameworks: [],
      };
    }

    // 1. Scout — pull recent unconsolidated episodes
    const items = await this.memorySource.listUnconsolidated(this.config.consolidationChunkSize);

    // 2. Filter — dedupe by content hash, drop low-importance / too-short content
    const seen = new Set<string>();
    const candidates = items.filter((item) => {
      if (item.content.length < this.config.minContentLength) return false;
      if (item.importance < this.config.minImportance) return false;
      const hash = contentHash(item.content);
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });

    // 3. Read + 4. Extract — tokenize and extract n-gram patterns
    const patterns = this.extractPatterns(candidates);

    // 5. Score — rank patterns by frequency x importance
    const scored = this.scorePatterns(candidates, patterns);

    // 6. Generate — distill drafts from top patterns
    const drafts = this.distillSkills(scored);

    // 7. Review — deterministic quality gates
    const reviewed = drafts.filter((d) => this.reviewSkill(d));

    // 8. Publish — emit signal, hand to sink, mark source consolidated
    const published: DistilledSkill[] = [];
    for (const skill of reviewed) {
      this.distilledSkills.push(skill);
      if (this.distilledSkills.length > 100) this.distilledSkills.shift();
      if (this.skillSink) {
        await this.skillSink.publish(skill);
      }
      const sig = createSignal('skill:distilled', 'sleep-cycle', skill as unknown as Record<string, unknown>);
      await this.nervousSystem.emit(sig);
      published.push(skill);
    }

    let tokenReductionPct = 0;
    if (candidates.length > 0) {
      const inputChars = candidates.reduce((s, c) => s + c.content.length, 0);
      const patternNames = published.map((d) => d.name).join(', ');
      const consolidationSummary =
        published.length > 0
          ? `distilled ${published.length} skill(s): ${patternNames}`
          : 'reviewed by sleep cycle';
      tokenReductionPct =
        inputChars > 0 ? Math.round((1 - consolidationSummary.length / inputChars) * 100) : 0;
      await this.memorySource.markConsolidated(candidates.map((c) => c.id), consolidationSummary);
    }

    // Framework-trace consolidation (blueprint §5.1): repeated selections
    // become "dominant framework per problem-type" patterns. Only patterns
    // above the minimum frequency threshold are treated as learned.
    const frameworkPatterns = this.frameworkSource?.getDominantPerProblemType() ?? [];
    const dominantFrameworks = frameworkPatterns
      .filter((p) => p.count >= this.config.patternMinFrequency)
      .sort((a, b) => b.count - a.count);

    return {
      memoriesConsolidated: candidates.length,
      patternsLearned: scored.length,
      skillsBenchmarked: drafts.length,
      insightsGenerated: scored.filter((p) => p.score >= this.config.patternMinFrequency).length,
      skillsDistilled: published.length,
      tokenReductionPct,
      frameworkPatternsLearned: dominantFrameworks.length,
      dominantFrameworks,
    };
  }

  private extractPatterns(items: SleepMemoryItem[]): Map<string, string[]> {
    const patterns = new Map<string, string[]>();
    const stopwords = new Set([
      'the', 'and', 'for', 'with', 'that', 'this', 'from', 'was', 'are', 'were',
      'have', 'has', 'had', 'not', 'but', 'its', 'all', 'can', 'out', 'you',
      'your', 'our', 'will', 'would', 'should', 'into', 'about', 'after',
    ]);

    for (const item of items) {
      const tokens = item.content.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      for (let i = 0; i < tokens.length - 1; i++) {
        const a = tokens[i]!;
        const b = tokens[i + 1]!;
        if (stopwords.has(a) || stopwords.has(b)) continue;
        const bigram = `${a} ${b}`;
        const sources = patterns.get(bigram) ?? [];
        if (!sources.includes(item.id)) sources.push(item.id);
        patterns.set(bigram, sources);
      }
    }
    return patterns;
  }

  private scorePatterns(items: SleepMemoryItem[], patterns: Map<string, string[]>): PatternScore[] {
    const importanceById = new Map(items.map((i) => [i.id, i.importance] as const));
    const scored: PatternScore[] = [];
    for (const [pattern, sources] of patterns) {
      if (sources.length < this.config.patternMinFrequency) continue;
      const avgImportance =
        sources.reduce((s, id) => s + (importanceById.get(id) ?? 0.5), 0) / sources.length;
      scored.push({
        pattern,
        frequency: sources.length,
        score: sources.length * avgImportance,
        sources,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.config.maxSkillsPerCycle);
  }

  private distillSkills(scored: PatternScore[]): DistilledSkill[] {
    return scored.map((p) => {
      const name = this.toSkillName(p.pattern);
      const description = `Distilled from ${p.frequency} recurring episode(s): "${p.pattern}".`;
      const body = [
        `# ${name}`,
        '',
        '## When to use',
        `Use when the workspace context contains the recurring pattern "${p.pattern}".`,
        '',
        '## Distilled procedure',
        `1. Recognize the "${p.pattern}" signal in current workspace activity.`,
        '2. Apply the established approach that produced consistent outcomes in prior episodes.',
        '3. Verify the outcome against the workspace state before recording a new episode.',
        '',
        `## Provenance`,
        ...p.sources.map((s) => `- episode \`${s}\``),
        '',
      ].join('\n');

      return {
        id: crypto.randomUUID(),
        name,
        description,
        body,
        sourceCount: p.frequency,
        distilledAt: new Date(),
        provenance: p.sources,
      };
    });
  }

  private reviewSkill(skill: DistilledSkill): boolean {
    if (!skill.name || skill.name.length < 3) return false;
    if (skill.body.length < 100) return false;
    if (skill.provenance.length === 0) return false;
    if (skill.sourceCount < this.config.patternMinFrequency) return false;
    return true;
  }

  private toSkillName(pattern: string): string {
    const words = pattern.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    return `Pattern-${words.join('')}`;
  }

  getReports(count = 5): SleepReport[] {
    return this.reports.slice(-count);
  }

  getStatus(): Record<string, unknown> {
    return {
      phase: this._phase,
      cycleCount: this.cycleCount,
      lastReport: this.reports[this.reports.length - 1] ?? null,
      napTimerActive: this.napTimer !== null,
      distilledSkills: this.distilledSkills.length,
    };
  }
}
