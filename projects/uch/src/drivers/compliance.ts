// ─── Driver Compliance ───────────────────────────────────────────────────────
// The POSIX-style certification surface for drivers: a driver declares its
// integration level (ADR-005 L0–L4) and the CP ops it supports; compliance
// scores the claim. "Codex passes 100%" becomes a computed, auditable number
// instead of a marketing claim.

import { CP_OPS, type CPOp } from '../protocol/cp.js';
import { instructionMetadata } from '../protocol/catalog.js';

export type IntegrationLevel = 0 | 1 | 2 | 3 | 4;

export interface DriverCapabilities {
  driverId: string;
  host: string;
  declaredLevel: IntegrationLevel;
  supportedOps: CPOp[];
}

export type ComplianceVerdict = 'certified' | 'partial' | 'not-certified';

export interface DriverComplianceReport {
  driverId: string;
  host: string;
  declaredLevel: IntegrationLevel;
  minimumLevelOps: { level: IntegrationLevel; ops: CPOp[] };
  supportedOpCount: number;
  protocolCoverage: number; // 0–1, fraction of CP v1 ops supported
  coverageVerdict: ComplianceVerdict;
  levelFidelity: {
    level: IntegrationLevel;
    missing: CPOp[];
    fidelity: number; // 0–1, fraction of minimum ops for the declared level
  };
  energyProfile: number; // total catalog energy cost of supported ops
  verdict: ComplianceVerdict;
}

/** The minimum instruction set a driver must support to claim a level. */
export const MINIMUM_LEVEL_OPS: Record<IntegrationLevel, CPOp[]> = {
  0: ['observe', 'status', 'ping'],
  1: [...['observe', 'status', 'ping'] as CPOp[], 'remember', 'retrieve'],
  2: [...['observe', 'status', 'ping'] as CPOp[], 'remember', 'retrieve', 'execute'],
  3: [
    ...['observe', 'status', 'ping'] as CPOp[],
    'remember', 'retrieve', 'execute',
    'think', 'reflect', 'learn', 'consolidate', 'critique',
  ],
  4: [...CP_OPS],
};

export function scoreCompliance(caps: DriverCapabilities): DriverComplianceReport {
  const supported = new Set(caps.supportedOps);
  const coverage = CP_OPS.filter((op) => supported.has(op)).length / CP_OPS.length;

  const minimum = MINIMUM_LEVEL_OPS[caps.declaredLevel];
  const missing = minimum.filter((op) => !supported.has(op));
  const fidelity = 1 - missing.length / minimum.length;

  const coverageVerdict: ComplianceVerdict = coverage >= 0.9 ? 'certified'
    : coverage >= 0.5 ? 'partial'
      : 'not-certified';
  const levelVerdict: ComplianceVerdict = fidelity >= 0.9 ? 'certified'
    : fidelity >= 0.5 ? 'partial'
      : 'not-certified';

  const energyProfile = caps.supportedOps.reduce(
    (sum, op) => sum + instructionMetadata(op).energyCost,
    0,
  );

  return {
    driverId: caps.driverId,
    host: caps.host,
    declaredLevel: caps.declaredLevel,
    minimumLevelOps: { level: caps.declaredLevel, ops: minimum },
    supportedOpCount: caps.supportedOps.length,
    protocolCoverage: Number(coverage.toFixed(3)),
    coverageVerdict,
    levelFidelity: { level: caps.declaredLevel, missing, fidelity: Number(fidelity.toFixed(3)) },
    energyProfile,
    verdict: coverageVerdict === 'certified' && levelVerdict === 'certified'
      ? 'certified'
      : coverageVerdict === 'not-certified' || levelVerdict === 'not-certified'
        ? 'not-certified'
        : 'partial',
  };
}

/** One-line certificate string, e.g. `Codex v1: L4 · 100% ops · certified`. */
export function certificateLine(report: DriverComplianceReport): string {
  const pct = Math.round(report.protocolCoverage * 100);
  const fid = Math.round(report.levelFidelity.fidelity * 100);
  return `${report.host}: L${report.declaredLevel} · ${pct}% ops · ${fid}% level-fidelity · ${report.verdict}`;
}
