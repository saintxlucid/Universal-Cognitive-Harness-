export interface ArchitectureNode {
  id: string;
  name: string;
  type: 'module' | 'service' | 'package' | 'file' | 'class' | 'function' | 'route' | 'database' | 'api' | 'config';
  path: string;
  metadata: Record<string, string>;
}

export interface ArchitectureEdge {
  source: string;
  target: string;
  relationship: 'imports' | 'depends_on' | 'extends' | 'implements' | 'calls' | 'routes_to' | 'contains' | 'configures';
  weight: number;
}

export class ArchitectureGraph {
  private nodes: Map<string, ArchitectureNode> = new Map();
  private edges: ArchitectureEdge[] = [];
  private adjacency: Map<string, Set<string>> = new Map();

  addNode(node: ArchitectureNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: ArchitectureEdge): void {
    this.edges.push(edge);
    if (!this.adjacency.has(edge.source)) {
      this.adjacency.set(edge.source, new Set());
    }
    this.adjacency.get(edge.source)!.add(edge.target);
  }

  getNode(id: string): ArchitectureNode | undefined {
    return this.nodes.get(id);
  }

  getDependencies(id: string): ArchitectureNode[] {
    return this.edges
      .filter((e) => e.source === id && e.relationship === 'depends_on')
      .map((e) => this.nodes.get(e.target))
      .filter((n): n is ArchitectureNode => n !== undefined);
  }

  getDependents(id: string): ArchitectureNode[] {
    return this.edges
      .filter((e) => e.target === id && e.relationship === 'depends_on')
      .map((e) => this.nodes.get(e.source))
      .filter((n): n is ArchitectureNode => n !== undefined);
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  getEdgeCount(): number {
    return this.edges.length;
  }
}
