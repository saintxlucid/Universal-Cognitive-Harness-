import { Consciousness, type ConsciousnessLayer } from '../aether/consciousness.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';

export interface ExtractedConcept {
  name: string;
  type: 'entity' | 'relation' | 'process' | 'quality' | 'value';
  definition: string;
  confidence: number;
  source: string;
  relatedConcepts: string[];
  embedding?: number[];
}

export interface UnderstandingCortexConfig {
  minConceptConfidence: number;
  maxConceptsPerExtraction: number;
  enableInference: boolean;
  enableRelationshipDiscovery: boolean;
  relationshipConfidenceThreshold: number;
  coOccurrenceWindow: number;
}

export class UnderstandingCortex {
  private consciousness: Consciousness;
  private kernel: CognitiveKernel;
  private config: Required<UnderstandingCortexConfig>;
  private extractionHistory: ExtractedConcept[] = [];
  private totalExtractions = 0;
  private conceptCoOccurrences: Map<string, Map<string, number>> = new Map();
  private recentTokens: string[] = [];

  constructor(
    consciousness: Consciousness,
    kernel: CognitiveKernel,
    config?: Partial<UnderstandingCortexConfig>,
  ) {
    this.consciousness = consciousness;
    this.kernel = kernel;
    this.config = {
      minConceptConfidence: config?.minConceptConfidence ?? 0.5,
      maxConceptsPerExtraction: config?.maxConceptsPerExtraction ?? 20,
      enableInference: config?.enableInference ?? true,
      enableRelationshipDiscovery: config?.enableRelationshipDiscovery ?? true,
      relationshipConfidenceThreshold: config?.relationshipConfidenceThreshold ?? 0.3,
      coOccurrenceWindow: config?.coOccurrenceWindow ?? 50,
    };
  }

  extractConcepts(params: {
    tokens: string[];
    source: string;
    context?: string;
    extractor?: (tokens: string[]) => Promise<ExtractedConcept[]>;
  }): ExtractedConcept[] {
    this.recentTokens.push(...params.tokens);
    if (this.recentTokens.length > this.config.coOccurrenceWindow * 10) {
      this.recentTokens = this.recentTokens.slice(-this.config.coOccurrenceWindow * 10);
    }

    const concepts = this.extractEntities(params.tokens, params.source);
    const filtered = concepts.filter((c) => c.confidence >= this.config.minConceptConfidence);
    const limited = filtered.slice(0, this.config.maxConceptsPerExtraction);

    for (const concept of limited) {
      this.kernel.addConcept({
        name: concept.name,
        concept_type: concept.type,
        definition: concept.definition,
      });

      this.extractionHistory.push(concept);
      this.totalExtractions++;

      this.consciousness.observe(
        'working',
        `Extracted concept: ${concept.name} (${concept.type}, conf: ${concept.confidence.toFixed(2)})`,
        params.source,
      );
    }

    if (this.extractionHistory.length > 500) {
      this.extractionHistory = this.extractionHistory.slice(-500);
    }

    if (this.config.enableRelationshipDiscovery && limited.length >= 2) {
      this.discoverRelationships(limited);
    }

    return limited;
  }

  private extractEntities(tokens: string[], source: string): ExtractedConcept[] {
    const concepts: ExtractedConcept[] = [];
    const seen = new Set<string>();
    const freq = new Map<string, number>();

    for (const token of tokens) {
      const normalized = token.toLowerCase().trim();
      if (normalized.length < 3) continue;
      freq.set(normalized, (freq.get(normalized) ?? 0) + 1);
    }

    const maxFreq = Math.max(1, ...freq.values());

    for (const token of tokens) {
      const normalized = token.toLowerCase().trim();
      if (normalized.length < 3 || seen.has(normalized)) continue;
      seen.add(normalized);

      const frequency = freq.get(normalized) ?? 1;
      const normalizedFreq = frequency / maxFreq;
      const isUpperCase = token[0] === token[0]?.toUpperCase();
      const containsSpecial = /[_-]/.test(token);
      const confidence = Math.min(0.95, 0.3 + normalizedFreq * 0.4 + (isUpperCase ? 0.2 : 0) + (containsSpecial ? 0.1 : 0));

      if (confidence < this.config.minConceptConfidence) continue;

      const type = this.inferType(token, isUpperCase, containsSpecial);

      concepts.push({
        name: token,
        type,
        definition: `Extracted from ${source}: "${token}"`,
        confidence,
        source,
        relatedConcepts: [],
      });
    }

    this.updateCoOccurrences(concepts);
    return concepts;
  }

  private inferType(token: string, isUpperCase: boolean, containsSpecial: boolean): ExtractedConcept['type'] {
    if (containsSpecial) return 'process';
    if (isUpperCase && token.length > 2) return 'entity';
    if (token.endsWith('ing') || token.endsWith('ion') || token.endsWith('ment')) return 'process';
    if (token.endsWith('ly') || token.endsWith('ful') || token.endsWith('ous')) return 'quality';
    if (token.startsWith('is') || token.startsWith('has') || token.startsWith('can')) return 'relation';
    return 'value';
  }

  private updateCoOccurrences(concepts: ExtractedConcept[]): void {
    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const a = concepts[i]!.name.toLowerCase();
        const b = concepts[j]!.name.toLowerCase();
        if (a === b) continue;

        if (!this.conceptCoOccurrences.has(a)) {
          this.conceptCoOccurrences.set(a, new Map());
        }
        const aMap = this.conceptCoOccurrences.get(a)!;
        aMap.set(b, (aMap.get(b) ?? 0) + 1);

        if (!this.conceptCoOccurrences.has(b)) {
          this.conceptCoOccurrences.set(b, new Map());
        }
        const bMap = this.conceptCoOccurrences.get(b)!;
        bMap.set(a, (bMap.get(a) ?? 0) + 1);
      }
    }
  }

  private discoverRelationships(concepts: ExtractedConcept[]): void {
    for (const concept of concepts) {
      const lowName = concept.name.toLowerCase();
      const coOccurrences = this.conceptCoOccurrences.get(lowName);
      if (!coOccurrences) continue;

      const totalCoOccurrences = [...coOccurrences.values()].reduce((sum, c) => sum + c, 0);
      if (totalCoOccurrences === 0) continue;

      const related: string[] = [];
      for (const [relatedName, count] of coOccurrences) {
        const confidence = count / totalCoOccurrences;
        if (confidence >= this.config.relationshipConfidenceThreshold) {
          related.push(relatedName);

          const otherConcept = this.extractionHistory.find(
            (c) => c.name.toLowerCase() === relatedName,
          );
          if (otherConcept) {
            this.kernel.addRelationship({
              source: concept.name,
              target: otherConcept.name,
              relationship: 'RELATED_TO',
              source_episode: 'extraction',
              confidence,
            });
          }
        }
      }

      concept.relatedConcepts = related;
    }
  }

  findRelatedConcepts(name: string, minConfidence = 0.1): Array<{ name: string; coOccurrence: number }> {
    const lowName = name.toLowerCase();
    const coOccurrences = this.conceptCoOccurrences.get(lowName);
    if (!coOccurrences) return [];

    const total = [...coOccurrences.values()].reduce((sum, c) => sum + c, 0);
    if (total === 0) return [];

    return [...coOccurrences.entries()]
      .map(([name, count]) => ({ name, coOccurrence: count / total }))
      .filter((r) => r.coOccurrence >= minConfidence)
      .sort((a, b) => b.coOccurrence - a.coOccurrence);
  }

  getExtractionHistory(limit = 20): ExtractedConcept[] {
    return this.extractionHistory.slice(-limit);
  }

  getTotalExtractions(): number {
    return this.totalExtractions;
  }

  getCoOccurrenceGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    for (const [concept, relations] of this.conceptCoOccurrences) {
      graph[concept] = [...relations.keys()];
    }
    return graph;
  }

  getStats(): Record<string, unknown> {
    return {
      totalExtractions: this.totalExtractions,
      extractionHistorySize: this.extractionHistory.length,
      trackedConcepts: this.conceptCoOccurrences.size,
      recentTokens: this.recentTokens.length,
      config: {
        minConfidence: this.config.minConceptConfidence,
        maxPerExtraction: this.config.maxConceptsPerExtraction,
        enableInference: this.config.enableInference,
        enableRelationshipDiscovery: this.config.enableRelationshipDiscovery,
      },
    };
  }
}
