import { writeSnapshot, readSnapshot, type Storable } from '../cognitive-plane/persistence/persistence-engine.js';

export type ConnectionType = 'event-driven' | 'data-flow' | 'control' | 'reference';

export interface Connection {
  id: string;
  from: string;
  to: string;
  type: ConnectionType;
  description: string;
  /** Edge weight — path ranking and integrity reporting use it. Default 1. */
  weight?: number;
  /** Current activation level set by `activate()`. Default 0. */
  activation?: number;
  /** When the edge was last activated. */
  lastActivatedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ConnectomeConfig {
  /** Upper bound for `link()` strengthening. */
  maxWeight: number;
  /** Amount added to an existing edge's weight on `link()`. */
  strengthenDelta: number;
  /** Activation decay per hop during propagation. */
  activationDecayPerHop: number;
  /** Default BFS depth for activation propagation. */
  activationMaxDepth: number;
  /** Default BFS depth for path finding. */
  maxPathDepth: number;
}

export interface IntegrityReport {
  nodeCount: number;
  edgeCount: number;
  components: number;
  weaklyConnected: boolean;
  danglingEdges: number;
  emergencyBroadcast: boolean;
}

export interface NeighborhoodNode {
  id: string;
  activation: number;
  depth: number;
}

const DEFAULT_CONFIG: ConnectomeConfig = {
  maxWeight: 10,
  strengthenDelta: 1,
  activationDecayPerHop: 0.5,
  activationMaxDepth: 4,
  maxPathDepth: 5,
};

interface PersistedConnectome {
  connections: Connection[];
  nextId: number;
}

export class Connectome implements Storable {
  private connections: Map<string, Connection> = new Map();
  private nodes: Set<string> = new Set();
  private nextId = 0;
  private config: ConnectomeConfig;

  constructor(config?: Partial<ConnectomeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerNode(id: string): void {
    if (id.length > 0) this.nodes.add(id);
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  getNodes(): string[] {
    return [...this.nodes];
  }

  removeNode(id: string): void {
    this.nodes.delete(id);
    for (const [, conn] of this.connections) {
      if (conn.from === id || conn.to === id) this.connections.delete(conn.id);
    }
  }

  registerConnection(conn: Omit<Connection, 'id'> & { id?: string }): string {
    const id = conn.id ?? `conn-${this.nextId++}`;
    this.connections.set(id, {
      ...conn,
      id,
      weight: conn.weight ?? 1,
      activation: conn.activation ?? 0,
      lastActivatedAt: conn.lastActivatedAt,
    });
    return id;
  }

  removeConnection(id: string): boolean {
    return this.connections.delete(id);
  }

  /**
   * Auto-wiring primitive: register-or-strengthen. If an edge with the same
   * endpoints and type already exists, its weight is increased (capped at
   * maxWeight) instead of duplicating. Endpoints are registered as nodes —
   * the graph learns its shape from events, not hand-registration.
   */
  link(
    from: string,
    to: string,
    type: ConnectionType,
    description = '',
    weight?: number,
  ): string {
    this.registerNode(from);
    this.registerNode(to);
    const existing = this.findConnection(from, to, type);
    if (existing) {
      const next = Math.min(this.config.maxWeight, (existing.weight ?? 1) + this.config.strengthenDelta);
      existing.weight = next;
      return existing.id;
    }
    return this.registerConnection({ from, to, type, description, weight });
  }

  setWeight(id: string, weight: number): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;
    conn.weight = Math.max(0, Math.min(this.config.maxWeight, weight));
    return true;
  }

  getWeight(id: string): number {
    return this.connections.get(id)?.weight ?? 0;
  }

  getConnections(): Connection[] {
    return [...this.connections.values()];
  }

  getConnectionsFrom(source: string): Connection[] {
    return this.getConnections()
      .filter((c) => c.from === source)
      .sort((a, b) => (b.activation ?? 0) - (a.activation ?? 0));
  }

  getConnectionsTo(target: string): Connection[] {
    return this.getConnections().filter((c) => c.to === target);
  }

  /**
   * Cue-tag-content activation: BFS from the cue with per-hop decay. Sets
   * activation on every traversed edge (active reconstruction — the returned
   * neighborhood IS the reconstructed context).
   */
  activate(cue: string, strength = 1): NeighborhoodNode[] {
    const visited = new Set<string>();
    const frontier: Array<{ id: string; depth: number }> = [{ id: cue, depth: 0 }];
    const result: NeighborhoodNode[] = [];
    const now = new Date();

    while (frontier.length > 0) {
      const { id, depth } = frontier.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const activation = strength * Math.pow(this.config.activationDecayPerHop, depth);
      result.push({ id, activation, depth });

      for (const conn of this.getConnectionsFrom(id)) {
        conn.activation = Math.max(conn.activation ?? 0, activation);
        conn.lastActivatedAt = now;
        if (depth < this.config.activationMaxDepth && !visited.has(conn.to)) {
          frontier.push({ id: conn.to, depth: depth + 1 });
        }
      }
    }

    return result.sort((a, b) => b.activation - a.activation);
  }

  /** Activation-ordered reachable set for a cue (reconstruction query). */
  getNeighborhood(cue: string, maxDepth = this.config.activationMaxDepth): NeighborhoodNode[] {
    const visited = new Set<string>();
    const frontier: Array<{ id: string; depth: number }> = [{ id: cue, depth: 0 }];
    const result: NeighborhoodNode[] = [];

    while (frontier.length > 0) {
      const { id, depth } = frontier.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      result.push({ id, activation: Math.pow(this.config.activationDecayPerHop, depth), depth });
      if (depth >= maxDepth) continue;
      for (const conn of this.getConnectionsFrom(id)) {
        if (!visited.has(conn.to)) frontier.push({ id: conn.to, depth: depth + 1 });
      }
    }

    return result.sort((a, b) => b.activation - a.activation);
  }

  findPaths(from: string, to: string, maxDepth = this.config.maxPathDepth): Connection[][] {
    const paths: Connection[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: Connection[]) => {
      if (path.length > maxDepth) return;
      if (current === to && path.length > 0) {
        paths.push([...path]);
        return;
      }
      visited.add(current);
      for (const conn of this.getConnectionsFrom(current)) {
        if (!visited.has(conn.to)) {
          path.push(conn);
          dfs(conn.to, path);
          path.pop();
        }
      }
      visited.delete(current);
    };

    dfs(from, []);
    return paths;
  }

  /** Path ranking by summed edge weight (heavier = preferred route). */
  rankPaths(from: string, to: string, maxDepth = this.config.maxPathDepth): Connection[][] {
    const totalWeight = (path: Connection[]): number =>
      path.reduce((sum, conn) => sum + (conn.weight ?? 1), 0);
    return this.findPaths(from, to, maxDepth).sort((a, b) => totalWeight(b) - totalWeight(a));
  }

  /**
   * Graph integrity per FORMAL_FOUNDATIONS: the Connectome must remain weakly
   * connected; partitioned components enter emergency broadcast mode.
   */
  checkIntegrity(): IntegrityReport {
    const edges = this.getConnections();
    const nodeIds = new Set<string>(this.nodes);

    let danglingEdges = 0;
    for (const conn of edges) {
      if (!nodeIds.has(conn.from) || !nodeIds.has(conn.to)) danglingEdges++;
    }

    const adjacency = new Map<string, Set<string>>();
    for (const node of nodeIds) adjacency.set(node, new Set());
    for (const conn of edges) {
      adjacency.get(conn.from)?.add(conn.to);
      adjacency.get(conn.to)?.add(conn.from);
    }

    const seen = new Set<string>();
    let components = 0;
    for (const node of nodeIds) {
      if (seen.has(node)) continue;
      components++;
      const queue = [node];
      seen.add(node);
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!seen.has(neighbor)) {
            seen.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    return {
      nodeCount: nodeIds.size,
      edgeCount: edges.length,
      components,
      weaklyConnected: components <= 1,
      danglingEdges,
      emergencyBroadcast: components > 1,
    };
  }

  getStats(): Record<string, unknown> {
    return {
      totalConnections: this.connections.size,
      totalNodes: this.nodes.size,
      byType: {
        'event-driven': this.getConnections().filter((c) => c.type === 'event-driven').length,
        'data-flow': this.getConnections().filter((c) => c.type === 'data-flow').length,
        control: this.getConnections().filter((c) => c.type === 'control').length,
        reference: this.getConnections().filter((c) => c.type === 'reference').length,
      },
    };
  }

  async persist(filePath: string): Promise<void> {
    const data: PersistedConnectome = {
      connections: this.getConnections(),
      nextId: this.nextId,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<PersistedConnectome>(filePath);
    if (!data) return 0;
    this.connections.clear();
    for (const conn of data.connections) {
      this.connections.set(conn.id, conn);
      if (conn.from) this.nodes.add(conn.from);
      if (conn.to) this.nodes.add(conn.to);
    }
    this.nextId = data.nextId ?? this.connections.size;
    return this.connections.size;
  }

  private findConnection(
    from: string,
    to: string,
    type: ConnectionType,
  ): Connection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.from === from && conn.to === to && conn.type === type) return conn;
    }
    return undefined;
  }
}
