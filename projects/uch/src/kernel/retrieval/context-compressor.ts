import type { ScoredResult, FusionQuery } from './fusion.js';

export interface CompressOptions {
  maxEntries?: number;
  minScore?: number;
  maxEntryChars?: number;
  dedupeSimilarity?: number;
}

export interface CompressionStats {
  inputEntries: number;
  outputEntries: number;
  droppedByScore: number;
  droppedByDedupe: number;
  truncated: number;
  inputChars: number;
  outputChars: number;
  compressionPct: number;
}

export interface CompressedContext {
  text: string;
  stats: CompressionStats;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxEntries: 8,
  minScore: 0,
  dedupeSimilarity: 0.85,
  maxEntryChars: 400,
};

function contentOf(result: ScoredResult): string {
  const c = result.content as { name?: string; definition?: string; content?: unknown };
  if (typeof c?.name === 'string' && typeof c.definition === 'string') {
    return `[${c.name}]: ${c.definition}`;
  }
  if (c?.content !== undefined) {
    return JSON.stringify(c.content);
  }
  return JSON.stringify(result.content);
}

function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.min(tokensA.size, tokensB.size);
}

function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  const cut = text.slice(0, maxChars);
  const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(': '));
  const end = lastSentence > maxChars * 0.5 ? lastSentence + 1 : maxChars;
  return { text: `${text.slice(0, end)} ...`, truncated: true };
}

export class ContextCompressor {
  private options: Required<CompressOptions>;

  constructor(options?: CompressOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  compress(results: ScoredResult[], query?: FusionQuery, options?: CompressOptions): CompressedContext {
    const opts = { ...this.options, ...options };
    const stats: CompressionStats = {
      inputEntries: results.length,
      outputEntries: 0,
      droppedByScore: 0,
      droppedByDedupe: 0,
      truncated: 0,
      inputChars: 0,
      outputChars: 0,
      compressionPct: 0,
    };

    const ranked = [...results].sort((a, b) => b.score - a.score);
    for (const result of ranked) {
      stats.inputChars += contentOf(result).length;
    }

    const kept: ScoredResult[] = [];
    const seenHashes = new Set<string>();
    for (const result of ranked) {
      if (result.score < opts.minScore) {
        stats.droppedByScore++;
        continue;
      }
      const content = contentOf(result);
      if (kept.length >= opts.maxEntries) {
        stats.droppedByScore++;
        continue;
      }
      const hash = contentHash(content);
      let isDuplicate = false;
      if (seenHashes.has(hash)) {
        isDuplicate = true;
      } else {
        for (const keptContent of kept.map(contentOf)) {
          if (tokenOverlap(content, keptContent) >= opts.dedupeSimilarity) {
            isDuplicate = true;
            break;
          }
        }
      }
      if (isDuplicate) {
        stats.droppedByDedupe++;
        continue;
      }
      seenHashes.add(hash);
      kept.push(result);
    }

    const parts = kept.map((r) => {
      const concept = r.content as { name?: string; confidence?: { value?: number } };
      const label = typeof concept?.name === 'string' ? concept.name : (r.source ?? 'memory');
      const confidence =
        typeof concept?.confidence?.value === 'number'
          ? ` c:${concept.confidence.value.toFixed(2)}`
          : '';
      const raw = contentOf(r);
      const { text, truncated } = truncate(raw, opts.maxEntryChars);
      if (truncated) stats.truncated++;
      return `--- ${label} (${r.source}${confidence}) ---\n${text}`;
    });

    const text = parts.join('\n\n');
    stats.outputEntries = kept.length;
    stats.outputChars = text.length;
    stats.compressionPct =
      stats.inputChars > 0 ? Math.round((1 - stats.outputChars / stats.inputChars) * 100) : 0;

    return { text, stats };
  }
}
