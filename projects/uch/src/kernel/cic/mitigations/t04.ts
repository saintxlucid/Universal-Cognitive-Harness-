import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface ObservationRecord {
  driverId: string;
  observationsWithoutConsent: number;
  lastObservation: number;
  blocked: boolean;
}

export class T04ConsentBypassMitigation implements ThreatMitigation {
  id = 'T04' as ThreatID;
  description = 'Detect and block observation events emitted without active consent grants';
  severity = 'high' as const;
  subsystem = 'exoskeleton';
  isActive = false;
  private observationRecords: Map<string, ObservationRecord> = new Map();
  private readonly maxViolations = 2;
  private readonly windowMs = 60000;
  private blockedDrivers: Set<string> = new Set();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.observationRecords) {
      if (now - record.lastObservation > this.windowMs) continue;
      if (record.observationsWithoutConsent >= this.maxViolations) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.observationRecords) {
      if (now - record.lastObservation > this.windowMs) continue;
      if (record.observationsWithoutConsent >= this.maxViolations && !record.blocked) {
        record.blocked = true;
        this.blockedDrivers.add(record.driverId);
        evidence.push(`driver-blocked:${record.driverId} observation pipeline disabled`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Consent bypass mitigation: blocked ${evidence.length} drivers from emitting observations`,
      evidence,
    };
  }

  recordObservation(driverId: string, hasConsent: boolean): void {
    if (hasConsent) return;
    const now = Date.now();
    let record = this.observationRecords.get(driverId);
    if (!record || now - record.lastObservation > this.windowMs) {
      record = { driverId, observationsWithoutConsent: 0, lastObservation: now, blocked: false };
      this.observationRecords.set(driverId, record);
    }
    record.observationsWithoutConsent++;
    record.lastObservation = now;
  }

  isDriverBlocked(driverId: string): boolean {
    return this.blockedDrivers.has(driverId);
  }

  unblockDriver(driverId: string, reConsented: boolean): void {
    if (reConsented) {
      this.blockedDrivers.delete(driverId);
      this.observationRecords.delete(driverId);
    }
  }

  getStats(): Record<string, unknown> {
    return {
      trackedDrivers: this.observationRecords.size,
      blockedDrivers: this.blockedDrivers.size,
    };
  }
}
