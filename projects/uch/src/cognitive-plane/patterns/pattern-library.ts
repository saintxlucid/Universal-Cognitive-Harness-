import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';
import type { CognitiveTrace } from '../trace-engine/cognitive-trace.js';
import type { DecisionEntry } from '../decisions/decision-log.js';

export interface TracePattern {
  id: string;
  name: string;
  description: string;
  category: string;
  matcher: TraceMatcher;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  matchCount: number;
}

export interface TraceMatcher {
  type: 'sequence' | 'attribute' | 'name' | 'agent' | 'event' | 'custom';
  pattern: string[];
  minConfidence: number;
}

export interface PatternMatch {
  patternId: string;
  patternName: string;
  category: string;
  traceIds: string[];
  confidence: number;
  matchedAt: Date;
}

export class PatternLibrary {
  private patterns: Map<string, TracePattern> = new Map();
  private matches: PatternMatch[] = [];
  private maxMatches: number;

  constructor(maxMatches = 1000) {
    this.maxMatches = maxMatches;
  }

  define(pattern: Omit<TracePattern, 'id' | 'createdAt' | 'matchCount'>): TracePattern {
    const created: TracePattern = {
      ...pattern,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      matchCount: 0,
    };
    this.patterns.set(created.id, created);
    return created;
  }

  remove(id: string): boolean {
    return this.patterns.delete(id);
  }

  get(id: string): TracePattern | undefined {
    return this.patterns.get(id);
  }

  getAll(limit = 100): TracePattern[] {
    return [...this.patterns.values()].slice(0, limit);
  }

  getByCategory(category: string): TracePattern[] {
    return [...this.patterns.values()].filter((p) => p.category === category);
  }

  getByTag(tag: string): TracePattern[] {
    return [...this.patterns.values()].filter((p) => p.tags.includes(tag));
  }

  matchTrace(trace: CognitiveTrace): PatternMatch[] {
    const results: PatternMatch[] = [];
    for (const [, pattern] of this.patterns) {
      const confidence = this.evaluateMatch(trace, pattern.matcher);
      if (confidence >= pattern.matcher.minConfidence) {
        const match: PatternMatch = {
          patternId: pattern.id,
          patternName: pattern.name,
          category: pattern.category,
          traceIds: [trace.trace_id],
          confidence,
          matchedAt: new Date(),
        };
        pattern.matchCount++;
        results.push(match);
        this.recordMatch(match);
      }
    }
    return results;
  }

  matchTraces(traces: CognitiveTrace[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    for (const trace of traces) {
      results.push(...this.matchTrace(trace));
    }
    return results;
  }

  matchDecision(decision: DecisionEntry): PatternMatch[] {
    const results: PatternMatch[] = [];
    for (const [, pattern] of this.patterns) {
      if (pattern.matcher.type !== 'custom') continue;
      const trace: CognitiveTrace = {
        trace_id: decision.id,
        span_id: decision.id,
        parent_span_id: null,
        name: decision.title,
        kind: 'internal',
        timestamp: decision.timestamp,
        end_timestamp: null,
        status: 'ok',
        attributes: [
          ...Object.entries(decision.metadata).map(([key, value]) => ({ key, value: String(value) })),
          ...decision.tags.map((t) => ({ key: 'tag', value: t })),
        ],
        events: [],
        links: [],
      };
      const confidence = this.evaluateMatch(trace, pattern.matcher);
      if (confidence >= pattern.matcher.minConfidence) {
        const match: PatternMatch = {
          patternId: pattern.id,
          patternName: pattern.name,
          category: pattern.category,
          traceIds: [decision.id],
          confidence,
          matchedAt: new Date(),
        };
        pattern.matchCount++;
        results.push(match);
        this.recordMatch(match);
      }
    }
    return results;
  }

  getRecentMatches(limit = 50): PatternMatch[] {
    return this.matches.slice(-limit);
  }

  getStats(): { total: number; totalMatches: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    for (const [, p] of this.patterns) {
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    }
    return {
      total: this.patterns.size,
      totalMatches: this.matches.length,
      byCategory,
    };
  }

  clearMatches(): void {
    this.matches = [];
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      patterns: mapToRecord(this.patterns),
      matches: this.matches,
      maxMatches: this.maxMatches,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      patterns: Record<string, TracePattern>;
      matches: PatternMatch[];
      maxMatches: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxMatches !== undefined) this.maxMatches = data.maxMatches;
    this.patterns = recordToMap(data.patterns ?? {});
    this.matches = data.matches ?? [];
    return this.patterns.size;
  }

  private evaluateMatch(trace: CognitiveTrace, matcher: TraceMatcher): number {
    switch (matcher.type) {
      case 'name':
        return matcher.pattern.some((p) => trace.name.toLowerCase().includes(p.toLowerCase())) ? 1.0 : 0;

      case 'attribute': {
        let hits = 0;
        for (const p of matcher.pattern) {
          const [key, ...valParts] = p.split('=');
          const val = valParts.join('=');
          for (const attr of trace.attributes) {
            const attrVal = String(attr.value);
            if (attr.key === key && (!val || attrVal.toLowerCase().includes(val.toLowerCase()))) hits++;
          }
        }
        return matcher.pattern.length > 0 ? hits / matcher.pattern.length : 0;
      }

      case 'agent': {
        const agentAttr = trace.attributes.find((a) => a.key === 'agent.id');
        if (!agentAttr) return 0;
        return matcher.pattern.some((p) => String(agentAttr.value).toLowerCase().includes(p.toLowerCase())) ? 1.0 : 0;
      }

      case 'event': {
        const eventTypes = trace.events.map((e) => e.type.toLowerCase());
        let hits = 0;
        for (const p of matcher.pattern) {
          if (eventTypes.some((n) => n.includes(p.toLowerCase()))) hits++;
        }
        return matcher.pattern.length > 0 ? hits / matcher.pattern.length : 0;
      }

      case 'sequence': {
        const eventTypes = trace.events.map((e) => e.type);
        let matches = 0;
        let pos = 0;
        for (const p of matcher.pattern) {
          while (pos < eventTypes.length) {
            if (eventTypes[pos]!.toLowerCase().includes(p.toLowerCase())) { matches++; pos++; break; }
            pos++;
          }
          if (pos >= eventTypes.length) break;
        }
        return matcher.pattern.length > 0 ? matches / matcher.pattern.length : 0;
      }

      case 'custom':
        return 0;

      default:
        return 0;
    }
  }

  private recordMatch(match: PatternMatch): void {
    this.matches.push(match);
    if (this.matches.length > this.maxMatches) this.matches.shift();
  }
}
