export interface Capability {
  name: string;
  version: string;
  description: string;
  requires: string[];
  provides: string[];
  enabled: boolean;
}

export class CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();

  register(capability: Capability): void {
    this.capabilities.set(capability.name, capability);
  }

  unregister(name: string): void {
    this.capabilities.delete(name);
  }

  get(name: string): Capability | undefined {
    return this.capabilities.get(name);
  }

  getAll(): Capability[] {
    return [...this.capabilities.values()];
  }

  getEnabled(): Capability[] {
    return [...this.capabilities.values()].filter((c) => c.enabled);
  }

  checkDependency(name: string): { satisfied: boolean; missing: string[] } {
    const cap = this.capabilities.get(name);
    if (!cap) return { satisfied: false, missing: [name] };

    const missing: string[] = [];
    for (const dep of cap.requires) {
      const depCap = this.capabilities.get(dep);
      if (!depCap || !depCap.enabled) {
        missing.push(dep);
      }
    }

    return { satisfied: missing.length === 0, missing };
  }

  count(): number {
    return this.capabilities.size;
  }

  reset(): void {
    this.capabilities.clear();
  }
}
