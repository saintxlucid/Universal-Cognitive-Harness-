// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Embedding layer
// Deterministic hash embedding by default (no API keys, testable); a real
// semantic embedder can be plugged in behind the same interface.
// k-WTA sparse fingerprint = hippocampal-style pattern separation.
// ═══════════════════════════════════════════════════════════════════════════

export interface Embedder {
  embed(text: string): number[];
  dimension(): number;
}

const DIM = 128;

function hash32(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Deterministic n-gram hashing embedder. Captures lexical signal well enough
 * for deterministic tests and offline operation; swap for a semantic embedder
 * (e.g. an API provider) in production via the Embedder interface.
 */
export class HashEmbedder implements Embedder {
  private dim: number;

  constructor(dim = DIM) {
    this.dim = dim;
  }

  embed(text: string): number[] {
    const v = new Array<number>(this.dim).fill(0);
    const lower = text.toLowerCase();
    const tokens = lower.split(/\W+/).filter(Boolean);

    for (const t of tokens) {
      const idx = Math.abs(hash32(t)) % this.dim;
      v[idx] = Math.min(1, (v[idx] ?? 0) + 0.2);
      for (let ng = 0; ng < Math.max(1, t.length - 1); ng++) {
        const gram = t.slice(ng, ng + 3);
        if (gram.length < 2) continue;
        const nidx = Math.abs(hash32(gram)) % this.dim;
        v[nidx] = Math.min(1, (v[nidx] ?? 0) + 0.06);
      }
    }

    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (mag > 0) for (let i = 0; i < v.length; i++) v[i] = (v[i] ?? 0) / mag;
    return v;
  }

  dimension(): number {
    return this.dim;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    magA += (a[i] ?? 0) * (a[i] ?? 0);
    magB += (b[i] ?? 0) * (b[i] ?? 0);
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * k-WTA sparse fingerprint: the indices of the top-k dimensions.
 * Sparse, pattern-separated, cheap to compare (Jaccard-ish overlap).
 */
export function kwtaFingerprint(embedding: number[], k = 12): number[] {
  const indexed = embedding.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => b.v - a.v || a.i - b.i);
  return indexed.slice(0, k).map((e) => e.i);
}

export function fingerprintOverlap(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const x of a) if (setB.has(x)) hits++;
  return hits / Math.min(a.length, b.length);
}

export function extractTerms(text: string, minLen = 3, maxTerms = 64): string[] {
  const tokens = text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= minLen);
  const uniq = [...new Set(tokens)];
  return uniq.slice(0, maxTerms);
}

/** Simple BM25 scorer over a corpus of term vectors. */
export interface Bm25IndexEntry {
  id: string;
  terms: string[];
  length: number;
}

export class Bm25Index {
  private docs: Map<string, Bm25IndexEntry> = new Map();
  private df: Map<string, number> = new Map();
  private avgLen = 1;
  private k1 = 1.5;
  private b = 0.75;

  add(id: string, terms: string[]): void {
    this.docs.set(id, { id, terms, length: terms.length });
    for (const t of new Set(terms)) {
      this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    const lens = [...this.docs.values()].map((d) => d.length);
    this.avgLen = lens.reduce((s, l) => s + l, 0) / Math.max(1, lens.length);
  }

  remove(id: string): void {
    this.docs.delete(id);
    this.rebuild();
  }

  private rebuild(): void {
    this.df.clear();
    for (const doc of this.docs.values()) {
      for (const t of new Set(doc.terms)) {
        this.df.set(t, (this.df.get(t) ?? 0) + 1);
      }
    }
    const lens = [...this.docs.values()].map((d) => d.length);
    this.avgLen = lens.reduce((s, l) => s + l, 0) / Math.max(1, lens.length);
  }

  search(queryTerms: string[], topK = 10): Array<{ id: string; score: number }> {
    const n = this.docs.size;
    const results: Array<{ id: string; score: number }> = [];
    for (const doc of this.docs.values()) {
      let score = 0;
      for (const term of queryTerms) {
        const tf = doc.terms.filter((t) => t === term).length;
        if (tf === 0) continue;
        const df = this.df.get(term) ?? 1;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        const denom = tf + this.k1 * (1 - this.b + (this.b * doc.length) / this.avgLen);
        score += idf * ((tf * (this.k1 + 1)) / denom);
      }
      if (score > 0) results.push({ id: doc.id, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  count(): number {
    return this.docs.size;
  }
}
