/**
 * RFC-0005 failure physics — held-out calibration and cross-validation.
 *
 * Validates that the bootstrap-calibrated threshold θ = 0.5 generalizes:
 * it was calibrated on the 17-case training corpus (min veto instability
 * 0.7, max non-veto 0.25); this module re-calibrates on an INDEPENDENT
 * held-out corpus (failure-physics/held-out.ts) and cross-applies both
 * thresholds across corpora.
 *
 * Contract (per ENGINEERING-INTELLIGENCE.md §6 plus the RFC-0005
 * milestone): held-out veto recall >= 0.8, negative pass rate 1.0,
 * separable θ range, and θ_heldout applied to the training corpus keeps
 * veto recall >= 0.8 and negative pass 1.0.
 */

import type { EvaluationTarget } from '../types.js';
import type { BenchmarkCase } from '../benchmark/corpus.js';
import { ENGINEERING_BENCHMARK_CORPUS } from '../benchmark/corpus.js';
import { evaluateInstability, calibrateThreshold, VETO_THRESHOLD } from './instability.js';
import { FAILURE_PHYSICS_HELDOUT_CORPUS, type HeldOutCase } from './held-out.js';

export interface HeldOutCalibrationResult {
  trainSize: number;
  heldOutSize: number;
  /** θ range calibrated on the training corpus (existing result). */
  trainRange: [number, number] | null;
  /** θ range calibrated on the held-out corpus (the new evidence). */
  heldOutRange: [number, number] | null;
  recommendedThreshold: number;
  /** θ = 0.5 applied to the held-out corpus. */
  heldOutVetoRecall: number;
  heldOutNegativePassRate: number;
  heldOutAdvisoryNonVetoRate: number;
  /** θ_heldout applied back to the training corpus. */
  crossVetoRecall: number;
  crossNegativePassRate: number;
  /** Contract booleans. */
  contract: {
    vetoRecallOk: boolean;
    negativePassOk: boolean;
    separable: boolean;
    crossOk: boolean;
  };
  /** Per-case verdicts on the held-out set. */
  cases: Array<{ id: string; group: HeldOutCase['group']; instability: number; veto: boolean }>;
}

function instabilityOf(target: EvaluationTarget): number {
  return evaluateInstability(target).maxInstability;
}

export function runHeldOutCalibration(
  train: BenchmarkCase[] = ENGINEERING_BENCHMARK_CORPUS,
  heldOut: HeldOutCase[] = FAILURE_PHYSICS_HELDOUT_CORPUS,
): HeldOutCalibrationResult {
  const trainRange = calibrateThreshold(train).thresholdRange;
  const heldOutRange = calibrateThreshold(heldOut).thresholdRange;

  const cases = heldOut.map((c) => {
    const instability = Math.round(instabilityOf(c.target) * 100) / 100;
    return { id: c.id, group: c.group, instability, veto: instability >= VETO_THRESHOLD };
  });

  const vetoes = cases.filter((c) => c.group === 'veto');
  const negatives = cases.filter((c) => c.group === 'negative');
  const advisories = cases.filter((c) => c.group === 'advisory');

  const heldOutVetoRecall =
    vetoes.length > 0 ? vetoes.filter((c) => c.veto).length / vetoes.length : 1;
  const heldOutNegativePassRate =
    negatives.length > 0 ? negatives.filter((c) => !c.veto).length / negatives.length : 1;
  const heldOutAdvisoryNonVetoRate =
    advisories.length > 0 ? advisories.filter((c) => !c.veto).length / advisories.length : 1;

  /* Cross-validate: θ_heldout (midpoint of the held-out range) on train. */
  const crossTheta =
    heldOutRange !== null ? (heldOutRange[0] + heldOutRange[1]) / 2 : VETO_THRESHOLD;
  const crossVetoes = train.filter((c) => c.group === 'veto');
  const crossNegatives = train.filter((c) => c.group === 'negative');
  const crossVetoRecall =
    crossVetoes.length > 0
      ? crossVetoes.filter((c) => instabilityOf(c.target) >= crossTheta).length / crossVetoes.length
      : 1;
  const crossNegativePassRate =
    crossNegatives.length > 0
      ? crossNegatives.filter((c) => instabilityOf(c.target) < crossTheta).length / crossNegatives.length
      : 1;

  const recommendedThreshold =
    heldOutRange !== null ? (heldOutRange[0] + heldOutRange[1]) / 2 : VETO_THRESHOLD;

  return {
    trainSize: train.length,
    heldOutSize: heldOut.length,
    trainRange,
    heldOutRange,
    recommendedThreshold,
    heldOutVetoRecall,
    heldOutNegativePassRate,
    heldOutAdvisoryNonVetoRate,
    crossVetoRecall,
    crossNegativePassRate,
    contract: {
      vetoRecallOk: heldOutVetoRecall >= 0.8,
      negativePassOk: heldOutNegativePassRate === 1,
      separable: heldOutRange !== null,
      crossOk: crossVetoRecall >= 0.8 && crossNegativePassRate === 1,
    },
    cases,
  };
}
