import type { EventType } from '../../event-bus/neural-event-bus.js';

// ── Capability Protocol ────────────────────────────────────

export type LifecycleStage =
  | 'embryonic'
  | 'experimental'
  | 'learning'
  | 'stable'
  | 'optimized'
  | 'deprecated'
  | 'retired'
  | 'archived';

export type CapabilityID = string & { readonly __capability: unique symbol };

export interface CapabilityProtocol {
  readonly id: CapabilityID;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly signals: ReadonlyArray<EventType | string>;
  readonly dependsOn: ReadonlyArray<CapabilityID>;
  readonly provides: ReadonlyArray<CapabilityID>;
  readonly lifecycle: LifecycleStage;
  readonly requiresEnergy: number;
  readonly handler: CapabilityHandler;
}

export interface CapabilityHandler {
  canHandle(signalType: EventType | string): boolean;
  handle(signal: Readonly<{ type: EventType | string; payload: Readonly<Record<string, unknown>> }>): Promise<CapabilityResult>;
}

export interface CapabilityResult {
  success: boolean;
  output?: unknown;
  error?: string;
  energyConsumed: number;
  informationGain: number;
}

// ── Protocol Registry ──────────────────────────────────────

export class CognitiveProtocolRegistry {
  private capabilities = new Map<CapabilityID, CapabilityProtocol>();
  private signalRouting = new Map<string, CapabilityID[]>();

  register(protocol: CapabilityProtocol): void {
    this.capabilities.set(protocol.id, protocol);
    for (const signalType of protocol.signals) {
      const existing = this.signalRouting.get(signalType) ?? [];
      existing.push(protocol.id);
      this.signalRouting.set(signalType, existing);
    }
  }

  unregister(id: CapabilityID): void {
    const protocol = this.capabilities.get(id);
    if (!protocol) return;
    for (const signalType of protocol.signals) {
      const routes = this.signalRouting.get(signalType);
      if (routes) {
        const filtered = routes.filter(r => r !== id);
        if (filtered.length === 0) {
          this.signalRouting.delete(signalType);
        } else {
          this.signalRouting.set(signalType, filtered);
        }
      }
    }
    this.capabilities.delete(id);
  }

  findHandlers(signalType: EventType | string): CapabilityProtocol[] {
    const ids = this.signalRouting.get(signalType) ?? [];
    return ids.map(id => this.capabilities.get(id)).filter((c): c is CapabilityProtocol => c !== undefined);
  }

  getCapability(id: CapabilityID): CapabilityProtocol | undefined {
    return this.capabilities.get(id);
  }

  listCapabilities(): CapabilityProtocol[] {
    return Array.from(this.capabilities.values());
  }

  listByStage(stage: LifecycleStage): CapabilityProtocol[] {
    return this.listCapabilities().filter(c => c.lifecycle === stage);
  }
}

// ── Helper to create capability IDs ────────────────────────

export function capabilityID(name: string): CapabilityID {
  return `cap:${name}` as CapabilityID;
}
