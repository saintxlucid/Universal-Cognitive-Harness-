export interface Connection {
  source: string;
  target: string;
  weight: number;
  coActivationCount: number;
  lastStrengthAt: number;
  createdAt: number;
}

export interface ConnectomeConfig {
  plasticityRate: number;
  coactivationThreshold: number;
  weightDecayPerTick: number;
  minWeight: number;
  maxWeight: number;
}

export interface ConnectomeNeighbor {
  id: string;
  weight: number;
}

const DEFAULT_CONFIG: ConnectomeConfig = {
  plasticityRate: 0.1,
  coactivationThreshold: 0.2,
  weightDecayPerTick: 0.001,
  minWeight: 0.01,
  maxWeight: 1.0,
};

export class Connectome {
  private connections: Map<string, Connection> = new Map();
  private adjacency: Map<string, Map<string, number>> = new Map();
  private config: ConnectomeConfig;

  constructor(config?: Partial<ConnectomeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private key(a: string, b: string): string {
    return a < b ? `${a}::${b}` : `${b}::${a}`;
  }

  link(source: string, target: string, initialWeight = 0.5): void {
    if (source === target) return;
    const key = this.key(source, target);
    if (this.connections.has(key)) return;
    const weight = Math.min(this.config.maxWeight, Math.max(this.config.minWeight, initialWeight));
    const now = Date.now();
    this.connections.set(key, {
      source,
      target,
      weight,
      coActivationCount: 0,
      lastStrengthAt: now,
      createdAt: now,
    });
    if (!this.adjacency.has(source)) this.adjacency.set(source, new Map());
    if (!this.adjacency.has(target)) this.adjacency.set(target, new Map());
    this.adjacency.get(source)!.set(target, weight);
    this.adjacency.get(target)!.set(source, weight);
  }

  unlink(source: string, target: string): void {
    const key = this.key(source, target);
    this.connections.delete(key);
    this.adjacency.get(source)?.delete(target);
    this.adjacency.get(target)?.delete(source);
  }

  getWeight(source: string, target: string): number {
    return this.connections.get(this.key(source, target))?.weight ?? 0;
  }

  neighbors(id: string): ConnectomeNeighbor[] {
    const adj = this.adjacency.get(id);
    if (!adj) return [];
    const result: ConnectomeNeighbor[] = [];
    for (const [neighborId, weight] of adj) {
      result.push({ id: neighborId, weight });
    }
    return result;
  }

  strengthen(source: string, target: string, activationSource: number, activationTarget: number, now: number): void {
    const key = this.key(source, target);
    const conn = this.connections.get(key);
    if (!conn) return;
    const product = activationSource * activationTarget;
    if (product > this.config.coactivationThreshold) {
      const delta = this.config.plasticityRate * (product - this.config.coactivationThreshold) * (1 - conn.weight);
      conn.weight = Math.min(this.config.maxWeight, conn.weight + delta);
      conn.coActivationCount += 1;
      conn.lastStrengthAt = now;
      this.adjacency.get(source)?.set(target, conn.weight);
      this.adjacency.get(target)?.set(source, conn.weight);
    }
  }

  decayAll(): void {
    for (const conn of this.connections.values()) {
      conn.weight = Math.max(this.config.minWeight, conn.weight * (1 - this.config.weightDecayPerTick));
    }
  }

  getEdges(): Connection[] {
    return [...this.connections.values()];
  }

  edgeCount(): number {
    return this.connections.size;
  }

  clear(): void {
    this.connections.clear();
    this.adjacency.clear();
  }
}
