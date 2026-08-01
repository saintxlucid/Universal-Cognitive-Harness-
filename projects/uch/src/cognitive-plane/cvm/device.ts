export type DeviceTier = 'tiny' | 'standard' | 'deep';

export interface ModelDevice {
  id: string;
  tier: DeviceTier;
  capabilities: string[];
  energyPerCall: number;
  latencyProfile: { p50: number; p95: number };
  invoke(op: string, operands: unknown[]): unknown | Promise<unknown>;
}

export interface DeviceCertification {
  certified: boolean;
  reason?: string;
}

export function hasCapability(device: ModelDevice, op: string): boolean {
  return device.capabilities.includes(op);
}

export function certifyDevice(device: ModelDevice, op: string): DeviceCertification {
  if (!hasCapability(device, op)) {
    return { certified: false, reason: `device ${device.id} does not declare op ${op}` };
  }
  if (!Number.isFinite(device.energyPerCall) || device.energyPerCall < 0) {
    return { certified: false, reason: `device ${device.id} has invalid energyPerCall` };
  }
  const { p50, p95 } = device.latencyProfile;
  if (!Number.isFinite(p50) || !Number.isFinite(p95) || p95 < p50) {
    return { certified: false, reason: `device ${device.id} has invalid latency profile` };
  }
  return { certified: true };
}

export function certificateLine(device: ModelDevice): string {
  const certified = device.capabilities.every((op) => certifyDevice(device, op).certified);
  return `${device.id}: ${device.tier} · ${device.capabilities.length} ops · ${
    certified ? 'certified' : 'partial'
  }`;
}
