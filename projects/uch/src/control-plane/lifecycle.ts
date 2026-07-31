export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';

export interface ServiceDefinition {
  name: string;
  version: string;
  dependencies: string[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
  healthCheck?: () => Promise<boolean>;
}

export class Lifecycle {
  private services: Map<string, { def: ServiceDefinition; status: ServiceStatus }> = new Map();
  private startOrder: string[] = [];

  register(def: ServiceDefinition): void {
    this.services.set(def.name, { def, status: 'stopped' });
  }

  async startAll(): Promise<void> {
    this.resolveOrder();
    for (const name of this.startOrder) {
      await this.start(name);
    }
  }

  async stopAll(): Promise<void> {
    const reversed = [...this.startOrder].reverse();
    for (const name of reversed) {
      await this.stop(name);
    }
  }

  async start(name: string): Promise<boolean> {
    const entry = this.services.get(name);
    if (!entry) return false;
    if (entry.status === 'running') return true;

    entry.status = 'starting';
    try {
      await entry.def.start();
      entry.status = 'running';
    } catch {
      entry.status = 'failed';
      return false;
    }
    return true;
  }

  async stop(name: string): Promise<boolean> {
    const entry = this.services.get(name);
    if (!entry) return false;
    if (entry.status === 'stopped') return true;

    entry.status = 'stopping';
    try {
      await entry.def.stop();
      entry.status = 'stopped';
    } catch {
      entry.status = 'failed';
      return false;
    }
    return true;
  }

  getStatus(name: string): ServiceStatus | undefined {
    return this.services.get(name)?.status;
  }

  getAllStatus(): Array<{ name: string; status: ServiceStatus; dependencies: string[] }> {
    const result: Array<{ name: string; status: ServiceStatus; dependencies: string[] }> = [];
    for (const name of this.startOrder) {
      const entry = this.services.get(name);
      if (entry) {
        result.push({ name, status: entry.status, dependencies: entry.def.dependencies });
      }
    }
    return result;
  }

  private resolveOrder(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) return;
      visiting.add(name);
      const entry = this.services.get(name);
      if (entry) {
        for (const dep of entry.def.dependencies) {
          visit(dep);
        }
      }
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.services.keys()) {
      visit(name);
    }

    this.startOrder = order;
  }
}
