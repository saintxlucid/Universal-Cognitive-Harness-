import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { Concept, ConceptType } from '../kernel/types/concept.js';

export interface ConceptDirEntry {
  name: string;
  id: string;
  type: ConceptType;
  importance: number;
  confidence: number;
}

export class ConceptStore {
  private kernel: CognitiveKernel;

  constructor(kernel: CognitiveKernel) {
    this.kernel = kernel;
  }

  async create(name: string, conceptType: ConceptType, definition: string, opts?: { importance?: number; embedding?: number[] }): Promise<Concept> {
    return this.kernel.addConcept({ name, concept_type: conceptType, definition, importance: opts?.importance, embedding: opts?.embedding });
  }

  read(id: string): Concept | undefined {
    return this.kernel.getConcept(id);
  }

  find(name: string): Concept | undefined {
    return this.kernel.findConcept(name);
  }

  async search(query: string, limit = 20): Promise<ConceptDirEntry[]> {
    const results = await this.kernel.recall({ text: query, limit });
    const entries: ConceptDirEntry[] = [];
    for (const r of results) {
      if ('name' in r.content) {
        const c = r.content as Concept;
        entries.push({ name: c.name, id: c.id, type: c.concept_type, importance: c.importance, confidence: c.confidence.value });
      }
    }
    return entries;
  }

  listAll(): ConceptDirEntry[] {
    return this.kernel.getAllConcepts().map((c: Concept) => ({
      name: c.name,
      id: c.id,
      type: c.concept_type,
      importance: c.importance,
      confidence: c.confidence.value,
    }));
  }
}
