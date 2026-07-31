import { TraceLedger } from '../trace-engine/trace-ledger.js';
import { DecisionLog } from '../decisions/decision-log.js';
import { SignalStore } from '../signals/signal-store.js';

export interface SearchOptions {
  query: string;
  sources?: Array<'traces' | 'signals' | 'decisions'>;
  traceTypes?: string[];
  signalTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  agentIds?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  source: 'trace' | 'signal' | 'decision';
  id: string;
  title: string;
  snippet: string;
  score: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  tookMs: number;
}

export class SearchEngine {
  private ledger: TraceLedger;
  private decisionLog: DecisionLog;
  private signalStore: SignalStore;

  constructor(ledger: TraceLedger, decisionLog: DecisionLog, signalStore: SignalStore) {
    this.ledger = ledger;
    this.decisionLog = decisionLog;
    this.signalStore = signalStore;
  }

  search(opts: SearchOptions): SearchResponse {
    const start = Date.now();
    const query = opts.query.toLowerCase();
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    const sources = opts.sources ?? ['traces', 'signals', 'decisions'];
    const allResults: SearchResult[] = [];

    if (sources.includes('traces')) {
      allResults.push(...this.searchTraces(query, opts));
    }
    if (sources.includes('signals')) {
      allResults.push(...this.searchSignals(query, opts));
    }
    if (sources.includes('decisions')) {
      allResults.push(...this.searchDecisions(query, opts));
    }

    allResults.sort((a, b) => b.score - a.score || b.timestamp.getTime() - a.timestamp.getTime());
    const total = allResults.length;
    const results = allResults.slice(offset, offset + limit);

    return { results, total, query: opts.query, tookMs: Date.now() - start };
  }

  private searchTraces(query: string, opts: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    for (const [, trace] of this.ledger['traces']) {
      if (opts.traceTypes && opts.traceTypes.length > 0 && !opts.traceTypes.includes(trace.name)) continue;
      if (opts.dateFrom && trace.timestamp < opts.dateFrom) continue;
      if (opts.dateTo && trace.timestamp > opts.dateTo) continue;
      if (opts.agentIds) {
        const agentAttr = trace.attributes.find((a) => a.key === 'agent.id');
        if (!agentAttr || !opts.agentIds.includes(String(agentAttr.value))) continue;
      }

      const score = this.computeScore(query, [
        trace.name,
        ...trace.attributes.map((a) => `${a.key}:${String(a.value)}`),
        ...trace.events.map((e) => e.type),
      ]);

      if (score > 0) {
        results.push({
          source: 'trace',
          id: trace.trace_id,
          title: trace.name,
          snippet: trace.events.length > 0 ? trace.events[trace.events.length - 1]!.type : trace.name,
          score,
          timestamp: trace.timestamp,
          metadata: { spanId: trace.span_id, kind: trace.kind },
        });
      }
    }
    return results;
  }

  private searchSignals(query: string, opts: SearchOptions): SearchResult[] {
    const signals = this.signalStore.getRecent(10000);
    const results: SearchResult[] = [];
    for (const signal of signals) {
      if (opts.signalTypes && opts.signalTypes.length > 0 && !opts.signalTypes.includes(signal.type)) continue;
      if (opts.dateFrom && new Date(signal.timestamp) < opts.dateFrom) continue;
      if (opts.dateTo && new Date(signal.timestamp) > opts.dateTo) continue;
      if (opts.agentIds && !opts.agentIds.includes(signal.source)) continue;

      const score = this.computeScore(query, [
        signal.type,
        signal.source,
        ...Object.values(signal.payload).map(String),
      ]);

      if (score > 0) {
        results.push({
          source: 'signal',
          id: signal.id,
          title: signal.type,
          snippet: signal.source,
          score,
          timestamp: new Date(signal.timestamp),
          metadata: { importance: signal.importance, source: signal.source },
        });
      }
    }
    return results;
  }

  private searchDecisions(query: string, opts: SearchOptions): SearchResult[] {
    const decisions = this.decisionLog.getAll(10000);
    const results: SearchResult[] = [];
    for (const d of decisions) {
      if (opts.dateFrom && d.timestamp < opts.dateFrom) continue;
      if (opts.dateTo && d.timestamp > opts.dateTo) continue;
      if (opts.agentIds && !opts.agentIds.includes(d.metadata.agentId as string ?? '')) continue;

      const texts = [
        d.title,
        d.description,
        d.rationale,
        ...d.alternatives.map((a) => `${a.name}: ${a.description}`),
        d.outcome,
        ...Object.values(d.tags),
      ];

      const score = this.computeScore(query, texts);

      if (score > 0) {
        results.push({
          source: 'decision',
          id: d.id,
          title: d.title,
          snippet: d.description.slice(0, 200),
          score,
          timestamp: d.timestamp,
          metadata: { outcome: d.outcome, tags: d.tags },
        });
      }
    }
    return results;
  }

  private computeScore(query: string, texts: string[]): number {
    const terms = query.split(/\s+/).filter(Boolean);
    if (terms.length === 0) return 0;
    let score = 0;
    for (const term of terms) {
      for (const text of texts) {
        const lower = text.toLowerCase();
        if (lower.includes(term)) {
          score += term.length / text.length;
          if (lower.startsWith(term)) score += 0.5;
          if (lower === term) score += 1.0;
        }
      }
    }
    return Math.round(score * 100) / 100;
  }
}
