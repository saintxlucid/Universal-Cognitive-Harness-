import type { Edge } from '../types/edge.js';
import type { Concept } from '../types/concept.js';

export class SemanticGraph {
  private concepts: Map<string, Concept> = new Map();
  private edges: Map<string, Edge> = new Map();
  private adjacency: Map<string, Set<string>> = new Map();
  private concept_by_name: Map<string, string> = new Map();

  addConcept(concept: Concept): void {
    this.concepts.set(concept.id, concept);
    this.concept_by_name.set(concept.name.toLowerCase(), concept.id);
  }

  getConcept(id: string): Concept | undefined {
    return this.concepts.get(id);
  }

  findConceptByName(name: string): Concept | undefined {
    const id = this.concept_by_name.get(name.toLowerCase());
    return id ? this.concepts.get(id) : undefined;
  }

  getAllConcepts(): Concept[] {
    return [...this.concepts.values()];
  }

  /** Rebinds a concept and its edges to a new stable id (used by snapshot restore). */
  renameConcept(oldId: string, newId: string): boolean {
    const concept = this.concepts.get(oldId);
    if (!concept || this.concepts.has(newId)) return false;
    this.concepts.delete(oldId);
    concept.id = newId;
    this.concepts.set(newId, concept);
    this.concept_by_name.set(concept.name.toLowerCase(), newId);
    for (const [, edge] of this.edges) {
      if (edge.source === oldId) edge.source = newId;
      if (edge.target === oldId) edge.target = newId;
    }
    const adjacency = this.adjacency.get(oldId);
    if (adjacency) {
      this.adjacency.delete(oldId);
      this.adjacency.set(newId, adjacency);
    }
    return true;
  }

  addEdge(edge: Edge): void {
    // Check for contradictions before adding
    const existingEdges = this.getEdgesBetween(edge.source, edge.target);
    for (const existing of existingEdges) {
      if (existing.relationship === edge.relationship && existing.invalid_at === null) {
        // Auto-invalidate old edge on contradiction
        if (this.detectContradiction(existing, edge)) {
          existing.invalid_at = edge.valid_at;
          existing.expired_at = edge.created_at;
        }
      }
    }

    this.edges.set(edge.id, edge);

    if (!this.adjacency.has(edge.source)) {
      this.adjacency.set(edge.source, new Set());
    }
    this.adjacency.get(edge.source)!.add(edge.target);

    if (!this.adjacency.has(edge.target)) {
      this.adjacency.set(edge.target, new Set());
    }
    this.adjacency.get(edge.target)!.add(edge.source);
  }

  getEdge(id: string): Edge | undefined {
    return this.edges.get(id);
  }

  getEdgesBetween(source: string, target: string): Edge[] {
    const results: Edge[] = [];
    for (const [, edge] of this.edges) {
      if ((edge.source === source && edge.target === target) || (edge.source === target && edge.target === source)) {
        results.push(edge);
      }
    }
    return results;
  }

  getEdgesFrom(conceptId: string, onlyValid = true): Edge[] {
    const results: Edge[] = [];
    for (const [, edge] of this.edges) {
      if (edge.source === conceptId || edge.target === conceptId) {
        if (!onlyValid || edge.invalid_at === null) {
          results.push(edge);
        }
      }
    }
    return results;
  }

  bfsTraversal(startId: string, maxDepth = 3): Array<{ concept: Concept; depth: number; path: string[] }> {
    const visited = new Set<string>();
    const results: Array<{ concept: Concept; depth: number; path: string[] }> = [];
    const queue: Array<{ id: string; depth: number; path: string[] }> = [{ id: startId, depth: 0, path: [startId] }];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const concept = this.concepts.get(current.id);
      if (concept && current.depth > 0) {
        results.push({ concept, depth: current.depth, path: current.path });
      }

      if (current.depth >= maxDepth) continue;

      const neighbors = this.adjacency.get(current.id);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push({ id: neighborId, depth: current.depth + 1, path: [...current.path, neighborId] });
          }
        }
      }
    }

    return results;
  }

  findContradictions(): Array<{ edge1: Edge; edge2: Edge }> {
    const contradictions: Array<{ edge1: Edge; edge2: Edge }> = [];
    const edgeList = [...this.edges.values()];

    for (let i = 0; i < edgeList.length; i++) {
      for (let j = i + 1; j < edgeList.length; j++) {
        const e1 = edgeList[i]!;
        const e2 = edgeList[j]!;

        if (e1.invalid_at !== null || e2.invalid_at !== null) continue;

        if ((e1.source === e2.source && e1.target === e2.target) || (e1.source === e2.target && e1.target === e2.source)) {
          if (e1.relationship !== e2.relationship && this.detectContradiction(e1, e2)) {
            contradictions.push({ edge1: e1, edge2: e2 });
          }
        }
      }
    }

    return contradictions;
  }

  getConceptCount(): number {
    return this.concepts.size;
  }

  getEdgeCount(): number {
    return this.edges.size;
  }

  private detectContradiction(a: Edge, b: Edge): boolean {
    // Same source-target pair with different facts → contradiction
    if (a.source === b.source && a.target === b.target && a.relationship === b.relationship) {
      return true;
    }
    return false;
  }
}
