/**
 * Organ Event Wiring (Event-Driven Workflow) — connects the blueprint §2
 * organ engines to the Neural Event Bus so every organ activity becomes a
 * first-class cognitive event (Law 3 Causality: no state change without a
 * parent signal).
 *
 * Each factory builds the organ with its eventSink wired to the bus
 * (fire-and-forget publish). The sink adapters never await the bus; the
 * organs stay synchronous and deterministic.
 */

import { NeuralEventBus, type EventType } from '../event-bus/neural-event-bus.js';
import { ProductivityKernel } from '../productivity-kernel/productivity-kernel.js';
import { SignalFusionEngine } from '../cortex_kernel/signal-fusion-engine.js';
import { CodeGovernanceGate } from '../kernel/constitution/code-governance-gate.js';

export interface OrganEvent {
  type: string;
  source: string;
  payload: Record<string, unknown>;
}

/** Fire-and-forget adapter: organ event -> bus publish. */
export function publishOrganEvent(bus: NeuralEventBus): (event: OrganEvent) => void {
  return (event) => {
    void bus.publish({
      type: event.type as EventType,
      source: event.source,
      payload: event.payload,
    });
  };
}

export function createWiredProductivityKernel(bus: NeuralEventBus): ProductivityKernel {
  return new ProductivityKernel({ eventSink: publishOrganEvent(bus) });
}

export function createWiredSignalFusionEngine(bus: NeuralEventBus): SignalFusionEngine {
  return new SignalFusionEngine({ eventSink: publishOrganEvent(bus) });
}

export function createWiredCodeGovernanceGate(bus: NeuralEventBus): CodeGovernanceGate {
  return new CodeGovernanceGate({ eventSink: publishOrganEvent(bus) });
}
