import { GraphStore } from '../kernel/storage/graph-store.js';
import { VectorStore } from '../kernel/storage/vector-store.js';

export interface CausalLink {
  causeId: string;
  effectId: string;
  relationship: 'causes' | 'enables' | 'prevents' | 'correlates';
  confidence: number;
  evidence: string[];
}

export interface DependencyChain {
  root: string;
  chain: { nodeId: string; nodeName: string; relationship: string }[];
  depth: number;
}

export interface ContradictionReport {
  statementA: string;
  statementB: string;
  evidence: { sourceA: string[]; sourceB: string[] };
  resolution: 'unresolved' | 'prefers_a' | 'prefers_b' | 'both_valid';
}

export class ReasonGraph {
  private graph: GraphStore;
  private vectors: VectorStore;

  constructor(graph: GraphStore, vectors: VectorStore) {
    this.graph = graph;
    this.vectors = vectors;
  }

  recordCausalLink(link: CausalLink): void {
    const edgeId = `causal-${link.causeId}-${link.effectId}-${Date.now()}`;
    this.graph.addEdge(edgeId, link.causeId, link.effectId, link.relationship, {
      confidence: link.confidence,
      evidence: link.evidence,
    }, link.confidence);
  }

  getCausalChain(startId: string, direction: 'forward' | 'backward' = 'forward', maxDepth = 5): DependencyChain[] {
    const chains: DependencyChain[] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, chain: { nodeId: string; nodeName: string; relationship: string }[], depth: number) => {
      if (depth > maxDepth) return;
      visited.add(currentId);

      const edges = direction === 'forward'
        ? this.graph.getEdgesFrom(currentId)
        : this.graph.getEdgesFrom(currentId);

      for (const edge of edges) {
        const nextId = direction === 'forward' ? edge.target : edge.source;
        if (visited.has(nextId)) continue;
        const node = this.graph.getNode(nextId);
        chain.push({ nodeId: nextId, nodeName: node?.name ?? nextId, relationship: edge.relationship });
        chains.push({ root: startId, chain: [...chain], depth: depth + 1 });
        dfs(nextId, chain, depth + 1);
        chain.pop();
      }
      visited.delete(currentId);
    };

    dfs(startId, [], 0);
    return chains.sort((a, b) => b.depth - a.depth);
  }

  analyzeContradictions(): ContradictionReport[] {
    const contradictions = this.graph.detectContradictions();
    return contradictions.map(c => {
      const sourceA = this.graph.getNode(c.edge1.source);
      const sourceB = this.graph.getNode(c.edge2.source);
      return {
        statementA: `${sourceA?.name ?? c.edge1.source} --[${c.edge1.relationship}]--> ${this.graph.getNode(c.edge1.target)?.name ?? c.edge1.target}`,
        statementB: `${sourceB?.name ?? c.edge2.source} --[${c.edge2.relationship}]--> ${this.graph.getNode(c.edge2.target)?.name ?? c.edge2.target}`,
        evidence: {
          sourceA: (c.edge1.properties.evidence as string[]) ?? [],
          sourceB: (c.edge2.properties.evidence as string[]) ?? [],
        },
        resolution: 'unresolved',
      };
    });
  }

  findRootCauses(effectId: string): string[] {
    const causes: string[] = [];
    const incoming = this.graph.getEdgesFrom(effectId);
    for (const edge of incoming) {
      if (edge.relationship === 'causes' || edge.relationship === 'enables') {
        causes.push(edge.source);
      }
    }
    return causes;
  }

  predictImpact(nodeId: string, maxDepth = 3): { impacted: string[]; paths: number } {
    const impacted = new Set<string>();
    let pathCount = 0;
    const visited = new Set<string>();
    const dfs = (current: string, depth: number) => {
      if (depth > maxDepth) return;
      visited.add(current);
      for (const edge of this.graph.getEdgesFrom(current)) {
        if (edge.relationship === 'causes' || edge.relationship === 'enables') {
          const next = edge.target === current ? edge.source : edge.target;
          if (!visited.has(next)) {
            impacted.add(next);
            pathCount++;
            dfs(next, depth + 1);
          }
        }
      }
      visited.delete(current);
    };
    dfs(nodeId, 0);
    return { impacted: [...impacted], paths: pathCount };
  }

  getStats(): { nodes: number; edges: number; causalLinks: number; contradictions: number } {
    return {
      nodes: this.graph.nodeCount(),
      edges: this.graph.edgeCount(),
      causalLinks: this.graph.getEdgesFrom('').length,
      contradictions: this.graph.detectContradictions().length,
    };
  }
}
