import { type CapabilityProtocol, type CapabilityHandler, CognitiveProtocolRegistry, capabilityID } from './capability-protocol.js';

export function createProtocolAdapter(
  registry: CognitiveProtocolRegistry,
  name: string,
  version: string,
  description: string,
  signals: string[],
  dependsOn: string[],
  handler: CapabilityHandler,
): { id: string; register: () => void; unregister: () => void } {
  const id = capabilityID(name);
  const protocol: CapabilityProtocol = {
    id,
    version,
    name,
    description,
    signals,
    dependsOn: dependsOn.map(capabilityID),
    provides: [],
    lifecycle: 'stable',
    requiresEnergy: 1,
    handler,
  };

  return {
    id: id,
    register: () => registry.register(protocol),
    unregister: () => registry.unregister(id),
  };
}

export function protocolHealthCheck(registry: CognitiveProtocolRegistry): {
  total: number;
  byStage: Record<string, number>;
  signalCoverage: Record<string, number>;
} {
  const caps = registry.listCapabilities();
  const byStage: Record<string, number> = {};
  const signalCoverage: Record<string, number> = {};

  for (const cap of caps) {
    byStage[cap.lifecycle] = (byStage[cap.lifecycle] ?? 0) + 1;
    for (const sig of cap.signals) {
      signalCoverage[sig] = (signalCoverage[sig] ?? 0) + 1;
    }
  }

  return { total: caps.length, byStage, signalCoverage };
}
