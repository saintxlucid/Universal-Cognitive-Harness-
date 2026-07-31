import { describe, it, expect } from 'vitest';
import { scoreCompliance, certificateLine, MINIMUM_LEVEL_OPS } from '../compliance.js';
import { CP_OPS } from '../../protocol/cp.js';

describe('Driver compliance scoring', () => {
  it('certifies a full-fidelity L4 driver at 100% coverage', () => {
    const report = scoreCompliance({
      driverId: 'codex-driver',
      host: 'Codex',
      declaredLevel: 4,
      supportedOps: [...CP_OPS],
    });
    expect(report.protocolCoverage).toBe(1);
    expect(report.coverageVerdict).toBe('certified');
    expect(report.levelFidelity.missing).toHaveLength(0);
    expect(report.verdict).toBe('certified');
    expect(certificateLine(report)).toBe('Codex: L4 · 100% ops · 100% level-fidelity · certified');
  });

  it('rates a partial driver and reports its missing minimum ops', () => {
    const report = scoreCompliance({
      driverId: 'cursor-driver',
      host: 'Cursor',
      declaredLevel: 3,
      supportedOps: ['observe', 'status', 'ping', 'remember', 'retrieve', 'execute', 'think'],
    });
    expect(report.coverageVerdict).toBe('not-certified');
    expect(report.levelFidelity.missing).toEqual(['reflect', 'learn', 'consolidate', 'critique']);
    expect(report.verdict).toBe('not-certified');
  });

  it('gives a partial verdict when level is fine but coverage is mid', () => {
    const report = scoreCompliance({
      driverId: 'partial-driver',
      host: 'Partial',
      declaredLevel: 0,
      supportedOps: [...CP_OPS.slice(0, 10), 'status', 'ping'],
    });
    expect(report.protocolCoverage).toBeGreaterThan(0.5);
    expect(report.protocolCoverage).toBeLessThan(0.9);
    expect(report.coverageVerdict).toBe('partial');
    expect(report.verdict).toBe('partial');
  });

  it('declares minimum op sets per integration level', () => {
    expect(MINIMUM_LEVEL_OPS[0]).toEqual(['observe', 'status', 'ping']);
    expect(MINIMUM_LEVEL_OPS[4]).toEqual([...CP_OPS]);
    expect(MINIMUM_LEVEL_OPS[3].length).toBeGreaterThan(MINIMUM_LEVEL_OPS[2].length);
  });

  it('computes the energy profile from the catalog', () => {
    const report = scoreCompliance({
      driverId: 'lite-driver',
      host: 'Lite',
      declaredLevel: 0,
      supportedOps: ['observe', 'status', 'ping'],
    });
    expect(report.energyProfile).toBe(3);
  });
});
