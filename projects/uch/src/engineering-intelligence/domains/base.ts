/**
 * Domain store — a Storable registry of engineering concepts for one
 * tier. Data + activation logic only: no I/O, no dependencies, no LLM.
 */

import {
  writeSnapshot,
  readSnapshot,
  mapToRecord,
  serializeDates,
} from '../../cognitive-plane/persistence/persistence-engine.js';
import type { EngineeringConcept, JudgmentContext, TierId } from '../types.js';

export interface ActivationResult {
  concept: EngineeringConcept;
  score: number;
  matchedSignals: string[];
  matchedTriggers: string[];
}

export class DomainStore {
  private concepts = new Map<string, EngineeringConcept>();

  constructor(
    readonly tier: TierId,
    readonly name: string,
    initial?: EngineeringConcept[],
  ) {
    if (initial) for (const c of initial) this.register(c);
  }

  register(concept: EngineeringConcept): void {
    if (concept.tier !== this.tier) {
      throw new Error(
        `DomainStore(${this.tier}) rejected concept ${concept.id} (tier ${concept.tier})`,
      );
    }
    if (this.concepts.has(concept.id)) {
      throw new Error(`Duplicate concept id: ${concept.id}`);
    }
    this.concepts.set(concept.id, { ...concept });
  }

  get(id: string): EngineeringConcept | null {
    return this.concepts.get(id) ?? null;
  }

  list(family?: string): EngineeringConcept[] {
    const all = [...this.concepts.values()];
    return family ? all.filter((c) => c.family === family) : all;
  }

  families(): string[] {
    return [...new Set([...this.concepts.values()].map((c) => c.family))].sort();
  }

  get size(): number {
    return this.concepts.size;
  }

  /** Concepts whose definition mentions any of the given tokens. */
  search(tokens: string[]): EngineeringConcept[] {
    const lower = tokens.map((t) => t.toLowerCase());
    return [...this.concepts.values()].filter((c) => {
      const hay = [
        c.name,
        c.definition,
        ...c.signals,
        ...c.triggers,
        ...c.guidance,
        ...c.antiPatterns,
      ].join(' ').toLowerCase();
      return lower.some((t) => hay.includes(t));
    });
  }

  /**
   * Score concepts against a judgment context: signals/triggers that
   * appear in the text raise the score. This is the activation logic
   * behind the "judgment pack" context enrichment.
   *
   * Matching is symmetric containment: a signal matches a token when
   * either contains the other, so derived forms work (token
   * "microservices" matches signal "microservice", token "duplication."
   * with the tokenizer's glued punctuation matches "duplication").
   */
  activate(ctx: JudgmentContext, limit = 5): ActivationResult[] {
    const matches = (needle: string) => {
      const l = needle.toLowerCase();
      return ctx.tokens.some((t) => t.length > 2 && (l.includes(t) || t.includes(l)));
    };
    const results: ActivationResult[] = [];
    for (const concept of this.concepts.values()) {
      const matchedSignals = concept.signals.filter(matches);
      const matchedTriggers = concept.triggers.filter(matches);
      if (matchedSignals.length === 0 && matchedTriggers.length === 0) continue;
      const score =
        (matchedSignals.length + matchedTriggers.length * 2) * (concept.weight + 0.5);
      results.push({ concept, score, matchedSignals, matchedTriggers });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async persist(filePath: string): Promise<void> {
    writeSnapshot(
      filePath,
      serializeDates({
        tier: this.tier,
        name: this.name,
        concepts: mapToRecord(this.concepts),
      }),
    );
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      tier?: TierId;
      name?: string;
      concepts?: Record<string, EngineeringConcept>;
    }>(filePath);
    if (!data?.concepts) return 0;
    this.concepts.clear();
    let count = 0;
    for (const [id, concept] of Object.entries(data.concepts)) {
      if (!concept || concept.id !== id) continue;
      this.register({ ...concept, tier: this.tier });
      count++;
    }
    return count;
  }
}
