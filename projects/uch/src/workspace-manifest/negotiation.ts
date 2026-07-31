import type { WorkspaceManifest, ManifestCapabilityEntry, ManifestDriverEntry } from './manifest.js';

export interface NegotiatedCapability {
  name: string;
  requested: boolean;
  enabled: boolean;
  granted: boolean;
}

export interface NegotiatedDriver {
  id: string;
  requested: boolean;
  enabled: boolean;
  started: boolean;
  error?: string;
}

export interface NegotiationResult {
  capabilities: NegotiatedCapability[];
  drivers: NegotiatedDriver[];
  grantedCapabilities: string[];
  enabledDrivers: string[];
}

/**
 * Negotiates which capabilities and drivers the workspace requests against
 * what the runtime can actually provide. Capabilities and drivers are
 * declared independently of activation: discovery does not grant action
 * authority (ADR-001).
 */
export function negotiate(
  manifest: WorkspaceManifest,
  available: {
    capabilities: string[];
    drivers: string[];
  },
): NegotiationResult {
  const requestedCapabilities = manifest.capabilities ?? [];
  const requestedDrivers = manifest.drivers ?? [];

  const capabilities = mergeCapabilities(requestedCapabilities, available.capabilities);
  const drivers = mergeDrivers(requestedDrivers, available.drivers);

  return {
    capabilities,
    drivers,
    grantedCapabilities: capabilities.filter((c) => c.granted).map((c) => c.name),
    enabledDrivers: drivers.filter((d) => d.started).map((d) => d.id),
  };
}

function mergeCapabilities(
  requested: ManifestCapabilityEntry[],
  available: string[],
): NegotiatedCapability[] {
  const known = new Set(available);
  return requested.map((entry) => {
    const canProvide = known.has(entry.name);
    const granted = entry.enabled && canProvide;
    return {
      name: entry.name,
      requested: true,
      enabled: entry.enabled,
      granted,
    };
  });
}

function mergeDrivers(
  requested: ManifestDriverEntry[],
  available: string[],
): NegotiatedDriver[] {
  const known = new Set(available);
  return requested.map((entry) => {
    const canProvide = known.has(entry.id);
    return {
      id: entry.id,
      requested: true,
      enabled: entry.enabled,
      started: entry.enabled && canProvide,
      error: canProvide ? undefined : `driver "${entry.id}" not available in runtime`,
    };
  });
}
