export interface Connection {
  id: string;
  from: string;
  to: string;
  type: 'event-driven' | 'data-flow' | 'control' | 'reference';
  description: string;
  metadata?: Record<string, unknown>;
}

export class Connectome {
  private connections: Map<string, Connection> = new Map();
  private nextId = 0;

  registerConnection(conn: Omit<Connection, 'id'>): string {
    const id = `conn-${this.nextId++}`;
    this.connections.set(id, { id, ...conn });
    return id;
  }

  removeConnection(id: string): boolean {
    return this.connections.delete(id);
  }

  getConnections(): Connection[] {
    return [...this.connections.values()];
  }

  getConnectionsFrom(source: string): Connection[] {
    return this.getConnections().filter((c) => c.from === source);
  }

  getConnectionsTo(target: string): Connection[] {
    return this.getConnections().filter((c) => c.to === target);
  }

  findPaths(from: string, to: string, maxDepth = 5): Connection[][] {
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

  getStats(): Record<string, unknown> {
    return {
      totalConnections: this.connections.size,
      byType: {
        'event-driven': this.getConnections().filter((c) => c.type === 'event-driven').length,
        'data-flow': this.getConnections().filter((c) => c.type === 'data-flow').length,
        control: this.getConnections().filter((c) => c.type === 'control').length,
        reference: this.getConnections().filter((c) => c.type === 'reference').length,
      },
    };
  }
}
