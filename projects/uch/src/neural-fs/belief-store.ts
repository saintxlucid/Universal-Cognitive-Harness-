import { VectorStore } from '../kernel/storage/vector-store.js';
import { GraphStore } from '../kernel/storage/graph-store.js';

export type BeliefStatus = 'hypothesis' | 'accepted' | 'rejected' | 'contested' | 'superseded';

export interface Belief {
  id: string;
  statement: string;
  status: BeliefStatus;
  confidence: number;
  sourceIds: string[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  supersededBy: string | null;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export class BeliefStore {
  private vectors: VectorStore;
  private graph: GraphStore;
  private beliefs: Map<string, Belief> = new Map();

  constructor(vectors: VectorStore, graph: GraphStore) {
    this.vectors = vectors;
    this.graph = graph;
  }

  addBelief(statement: string, confidence: number, sourceIds: string[], tags: string[] = []): Belief {
    const id = `belief-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const belief: Belief = {
      id, statement, status: confidence >= 0.7 ? 'accepted' : 'hypothesis',
      confidence, sourceIds, supportingEvidence: [statement],
      contradictingEvidence: [], supersededBy: null,
      createdAt: Date.now(), updatedAt: Date.now(), tags,
    };
    this.beliefs.set(id, belief);

    this.graph.addNode(id, 'belief', statement.slice(0, 80), { status: belief.status, confidence, tags });
    for (const sid of sourceIds) {
      this.graph.addEdge(`belief-ref-${id}-${sid}`, id, sid, 'references', { type: 'source' });
    }

    this.checkContradictions(belief);
    return belief;
  }

  private checkContradictions(newBelief: Belief): void {
    for (const existing of this.beliefs.values()) {
      if (existing.id === newBelief.id) continue;
      if (existing.status === 'rejected' || existing.status === 'superseded') continue;
      if (existing.tags.some(t => newBelief.tags.includes(t)) && existing.confidence > 0.5 && newBelief.confidence > 0.5) {
        if (this.statementsContradict(existing.statement, newBelief.statement)) {
          existing.status = 'contested';
          newBelief.status = 'contested';
          existing.contradictingEvidence.push(newBelief.statement);
          newBelief.contradictingEvidence.push(existing.statement);
        }
      }
    }
  }

  private statementsContradict(a: string, b: string): boolean {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const negations = ['not ', 'never ', 'cannot ', 'isn\'t ', 'doesn\'t ', 'won\'t '];
    const hasNegation = (s: string) => negations.some(n => s.includes(n));
    return hasNegation(aLower) !== hasNegation(bLower);
  }

  acceptBelief(id: string): void {
    const belief = this.beliefs.get(id);
    if (!belief) return;
    for (const existing of this.beliefs.values()) {
      if (existing.id !== id && (existing.status === 'accepted' || existing.status === 'contested') && existing.tags.some(t => belief.tags.includes(t))) {
        if (this.statementsContradict(existing.statement, belief.statement)) {
          if (belief.confidence > existing.confidence) {
            existing.status = 'superseded';
            existing.supersededBy = id;
          }
        }
      }
    }
    belief.status = 'accepted';
    belief.updatedAt = Date.now();
  }

  rejectBelief(id: string): void {
    const belief = this.beliefs.get(id);
    if (!belief) return;
    belief.status = 'rejected';
    belief.updatedAt = Date.now();
  }

  getBelief(id: string): Belief | undefined {
    return this.beliefs.get(id);
  }

  queryBeliefs(tags?: string[], status?: BeliefStatus): Belief[] {
    let results = [...this.beliefs.values()];
    if (tags && tags.length > 0) results = results.filter(b => tags.some(t => b.tags.includes(t)));
    if (status) results = results.filter(b => b.status === status);
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  getAcceptedBeliefs(): Belief[] {
    return this.queryBeliefs(undefined, 'accepted');
  }

  getContestedBeliefs(): Belief[] {
    return this.queryBeliefs(undefined, 'contested');
  }

  count(): number {
    return this.beliefs.size;
  }
}
