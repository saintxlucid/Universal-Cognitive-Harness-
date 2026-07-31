export interface GapAnalysisResultItem {
  id: string;
  text: string;
  timestamp: Date;
  source: string;
}

export interface GapAnalysisOptions {
  stalenessThresholdDays?: number;
  maxResults?: number;
}

export interface GapAnalysisOutput {
  query: string;
  citations: string[];
  gaps: string[];
  contradictions: Array<{ between: string[]; reason: string }>;
  stale: Array<{ id: string; ageDays: number }>;
  missingTerms: string[];
  confidence: number;
}

const DEFAULT_OPTIONS: Required<GapAnalysisOptions> = {
  stalenessThresholdDays: 30,
  maxResults: 10,
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'what', 'when', 'where', 'how', 'is', 'are', 'do', 'does', 'did', 'i', 'we',
]);

export class GapAnalysisEngine {
  private options: Required<GapAnalysisOptions>;

  constructor(options: GapAnalysisOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  analyze(query: string, results: GapAnalysisResultItem[], options: GapAnalysisOptions = {}): GapAnalysisOutput {
    const opts = { ...this.options, ...options };
    const top = results.slice(0, opts.maxResults);
    const now = Date.now();

    const citations = top.map((r) => r.id);
    const gaps: string[] = [];

    if (top.length === 0) {
      gaps.push(`The brain has no pages about "${query}". This is a hole you should fill before relying on it.`);
    } else if (top.length < 3) {
      gaps.push(`Only ${top.length} source(s) found; coverage may be thin for "${query}".`);
    }

    const queryTerms = this.extractTerms(query);
    const foundTerms = new Set<string>();
    for (const r of top) {
      const text = r.text.toLowerCase();
      for (const term of queryTerms) {
        if (text.includes(term)) foundTerms.add(term);
      }
    }
    const missingTerms = queryTerms.filter((t) => !foundTerms.has(t));
    if (missingTerms.length > 0) {
      gaps.push(`No retrieved page mentions: ${missingTerms.join(', ')}. The brain may not know about these aspects yet.`);
    }

    const stale = top
      .map((r) => ({ id: r.id, ageDays: (now - r.timestamp.getTime()) / 86_400_000 }))
      .filter((s) => s.ageDays > opts.stalenessThresholdDays);
    if (stale.length > 0) {
      gaps.push(`These pages are older than ${opts.stalenessThresholdDays} days: ${stale.map((s) => s.id).join(', ')}. Verify the information is still current before acting.`);
    }

    const contradictions = this.detectContradictions(top);

    const coverage = top.length > 0 ? Math.min(1, top.length / 5) : 0;
    const completeness = queryTerms.length > 0 ? foundTerms.size / queryTerms.length : 1;
    const confidence = Number((0.4 * coverage + 0.6 * completeness).toFixed(2));

    return { query, citations, gaps, contradictions, stale, missingTerms, confidence };
  }

  private extractTerms(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t))
      .slice(0, 8);
  }

  private detectContradictions(results: GapAnalysisResultItem[]): Array<{ between: string[]; reason: string }> {
    const contradictions: Array<{ between: string[]; reason: string }> = [];
    const negationPairs: Array<[RegExp, RegExp]> = [
      [/supports|supports this|is supported/, /does not support|unsupported|doesn't support|not supported/],
      [/increases|went up|rising|higher/, /decreases|went down|falling|lower/],
      [/is active|working|operational/, /is broken|down|not working|fails/],
      [/fixed|resolved/, /still failing|still broken|unresolved|recurring/],
    ];

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const a = results[i]!;
        const b = results[j]!;
        if (a.id === b.id) continue;
        for (const [pos, neg] of negationPairs) {
          if (pos.test(a.text) && neg.test(b.text)) {
            contradictions.push({
              between: [a.id, b.id],
              reason: `One page claims something positive while another denies it (${a.id} vs ${b.id}).`,
            });
            break;
          }
        }
      }
    }
    return contradictions;
  }
}
