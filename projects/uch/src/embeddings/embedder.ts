import { LLMClient } from '../llm/provider.js';

export interface EmbedderConfig {
  provider?: LLMClient;
  dimension?: number;
  cacheSize?: number;
}

export interface ScoredItem {
  id: string;
  score: number;
  item: unknown;
}

export class Embedder {
  private llm: LLMClient | null;
  private dimension: number;
  private cache: Map<string, number[]> = new Map();
  private maxCache: number;

  constructor(config?: EmbedderConfig) {
    this.llm = config?.provider ?? null;
    this.dimension = config?.dimension ?? 1536;
    this.maxCache = config?.cacheSize ?? 1000;
  }

  get available(): boolean {
    return this.llm !== null && this.llm.isAvailable;
  }

  get useLocalFallback(): boolean {
    return !this.available;
  }

  private simpleHashEmbed(text: string): number[] {
    let seed = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const vec: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      vec.push((seed % 1000) / 1000 - 0.5);
    }
    return vec;
  }

  async embed(text: string): Promise<number[]> {
    const cached = this.cache.get(text);
    if (cached) return cached;

    let vector: number[];
    if (this.llm && this.llm.isAvailable) {
      const results = await this.llm.embed({ input: text });
      vector = results[0] ?? this.simpleHashEmbed(text);
    } else {
      vector = this.simpleHashEmbed(text);
    }

    if (this.cache.size < this.maxCache) {
      this.cache.set(text, vector);
    }
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.llm && this.llm.isAvailable && texts.length > 1) {
      try {
        const uncached = texts.filter((t) => !this.cache.has(t));
        if (uncached.length > 0) {
          const results = await this.llm.embed({ input: uncached });
          for (let i = 0; i < uncached.length; i++) {
            if (this.cache.size < this.maxCache) {
              this.cache.set(uncached[i]!, results[i] ?? this.simpleHashEmbed(uncached[i]!));
            }
          }
        }
        return texts.map((t) => this.cache.get(t) ?? this.simpleHashEmbed(t));
      } catch {
        return texts.map((t) => this.simpleHashEmbed(t));
      }
    }
    return texts.map((t) => this.simpleHashEmbed(t));
  }

  cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }

  async search(query: string, items: { id: string; text: string }[], topK = 5): Promise<ScoredItem[]> {
    const queryVec = await this.embed(query);
    const itemTexts = items.map((i) => i.text);
    const itemVecs = await this.embedBatch(itemTexts);

    const scored: ScoredItem[] = items.map((item, i) => ({
      id: item.id,
      score: this.cosineSimilarity(queryVec, itemVecs[i] ?? []),
      item,
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
