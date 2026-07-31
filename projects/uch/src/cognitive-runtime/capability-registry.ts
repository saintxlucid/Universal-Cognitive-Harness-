// ── Capability Registry ─────────────────────────────────────────────────
// The machine-readable description of what a workspace runtime can provide.
// Capabilities carry CIC §2.1-aligned semantics: a scope cascade, an
// authority (operation families), cost budgets, and retention limits.
// Discovery and invocation are separate: a declared capability does not
// grant action authority — authority is granted by GrantEngine.
// ────────────────────────────────────────────────────────────────────────

export type GrantOperation =
  | 'observe'
  | 'retrieve'
  | 'propose'
  | 'commit'
  | 'evaluate'
  | 'delegate'
  | 'consolidate'
  | 'simulate';

/** Scope cascade, most granular to most broad (CIC §2.2). */
export interface CapabilityScope {
  session?: string;
  task?: string;
  branch?: string;
  project?: string;
  workspace?: string;
  organization?: string;
}

export interface CapabilityCost {
  maxTokensPerDay?: number;
  maxTokensPerSession?: number;
  maxOperationsPerDay?: number;
  maxCostPerDay?: number;
}

export interface CapabilityRetention {
  maxAgeDays: number;
}

export interface Capability {
  name: string;
  version: string;
  description: string;
  requires: string[];
  provides: string[];
  enabled: boolean;
  /** Scope levels this capability can be exercised at (CIC §2.2 cascade). */
  scope?: CapabilityScope;
  /** Operation families this capability authorizes (CIC §4). */
  authority?: GrantOperation[];
  /** Resource budgets (CIC §2.1 constraints.budget). */
  cost?: CapabilityCost;
  /** How long objects derived through this capability may be retained. */
  retention?: CapabilityRetention;
}

export interface CapabilityDependencyCheck {
  satisfied: boolean;
  missing: string[];
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

  checkDependency(name: string): CapabilityDependencyCheck {
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

  /** Authority (operation families) a capability grants, if any. */
  getAuthority(name: string): GrantOperation[] {
    return this.capabilities.get(name)?.authority ?? [];
  }

  /** Scope levels a capability may be exercised at, if constrained. */
  getScope(name: string): CapabilityScope | undefined {
    return this.capabilities.get(name)?.scope;
  }

  /** Cost budgets of a capability, if declared. */
  getCost(name: string): CapabilityCost | undefined {
    return this.capabilities.get(name)?.cost;
  }

  /** Retention limit of a capability, if declared. */
  getRetention(name: string): CapabilityRetention | undefined {
    return this.capabilities.get(name)?.retention;
  }

  count(): number {
    return this.capabilities.size;
  }

  reset(): void {
    this.capabilities.clear();
  }
}
