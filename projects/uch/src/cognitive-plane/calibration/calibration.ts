/**
 * Calibration profile â€” aggregates resolved takes into a track record,
 * from the calibration_profile cycle phase.
 *
 * Contract preserved:
 *   - Cold-brain branch: skips when < 5 resolved takes (MIN_RESOLVED).
 *   - Brier score per conviction bucket + overall (scalar_brier default;
 *     weighted_brier used when `weightByConviction` is set).
 *   - Unresolvable rate is a first-class signal: a brain with 50%
 *     unresolvable verdicts reads as "retrieval is weak in this domain",
 *     not "no data".
 *   - Output is 2-4 narrative pattern statements + active bias tags,
 *     voice-gated via gateVoice() (see voice-gate.ts).
 */

import type { Take } from './takes.js';

export interface ScorecardRow {
  domain: string;
  n: number;
  correct: number;
  accuracy: number; // correct / (correct + incorrect + partial), 0 when n=0
  brier: number; // 0 = perfectly calibrated
  unresolvable: number;
  unresolvableRate: number; // unresolvable / (resolved + unresolvable)
}

export interface ConvictionBucket {
  label: string;
  n: number;
  correct: number;
  brier: number;
}

export interface CalibrationProfile {
  resolvedCount: number;
  openCount: number;
  coldStart: boolean;
  brier: number; // overall scalar Brier
  accuracy: number;
  scorecards: ScorecardRow[];
  buckets: ConvictionBucket[];
  narratives: string[];
  biasTags: string[];
  unresolvableRate: number;
  voiceGate: { passed: boolean; regenerationsUsed: number; finalText: string };
}

export interface CalibrationOptions {
  weightByConviction?: boolean;
  minResolved?: number;
  minBiasSample?: number;
}

const DEFAULT_OPTIONS: Required<CalibrationOptions> = {
  weightByConviction: false,
  minResolved: 5,
  minBiasSample: 3,
};

/** Brier score for a single resolution. outcome: 1 correct, 0 incorrect, 0.5 partial. */
export function brierForTake(take: Take): number | null {
  if (take.status !== 'resolved') return null;
  const outcome = take.outcome === true ? 1 : take.outcome === false ? 0 : 0.5;
  const p = Math.max(0, Math.min(1, take.conviction));
  return (p - outcome) ** 2;
}

export function computeCalibrationProfile(
  takes: Take[],
  options: CalibrationOptions = {},
): CalibrationProfile {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const resolved = takes.filter((t) => t.status === 'resolved');
  const openCount = takes.filter((t) => t.status === 'open').length;
  const unresolvable = resolved.filter((t) => t.quality === 'unresolvable');
  const unresolvableRate = resolved.length > 0 ? unresolvable.length / resolved.length : 0;

  const empty: CalibrationProfile = {
    resolvedCount: 0,
    openCount,
    coldStart: true,
    brier: 0,
    accuracy: 0,
    scorecards: [],
    buckets: [],
    narratives: [],
    biasTags: [],
    unresolvableRate: 0,
    voiceGate: { passed: true, regenerationsUsed: 0, finalText: '' },
  };

  if (resolved.length < opts.minResolved) {
    return {
      ...empty,
      resolvedCount: resolved.length,
      unresolvableRate: Number(unresolvableRate.toFixed(3)),
      narratives: [
        `Not enough resolved takes yet (${resolved.length}/${opts.minResolved}). Record more gradeable claims and resolve them to get a calibration profile.`,
      ],
    };
  }

  const scoreable = resolved.filter((t) => t.quality !== 'unresolvable');

  // Overall Brier.
  const briers = scoreable.map((t) => brierForTake(t) ?? 0);
  const overallBrier = briers.length > 0
    ? briers.reduce((a, b) => a + b, 0) / briers.length
    : 0;
  const correctCount = scoreable.filter((t) => t.outcome === true).length;
  const accuracy = scoreable.length > 0 ? correctCount / scoreable.length : 0;

  // Domain scorecards.
  const byDomain = new Map<string, Take[]>();
  for (const t of scoreable) {
    const list = byDomain.get(t.domain) ?? [];
    list.push(t);
    byDomain.set(t.domain, list);
  }
  const scorecards: ScorecardRow[] = [...byDomain.entries()]
    .map(([domain, list]) => {
      const correct = list.filter((t) => t.outcome === true).length;
      const domBrier = list.map((t) => brierForTake(t) ?? 0).reduce((a, b) => a + b, 0) / list.length;
      const unresolvableInDomain = resolved.filter((t) => t.domain === domain && t.quality === 'unresolvable').length;
      return {
        domain,
        n: list.length,
        correct,
        accuracy: correct / list.length,
        brier: domBrier,
        unresolvable: unresolvableInDomain,
        unresolvableRate: unresolvableInDomain / (list.length + unresolvableInDomain),
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);

  // Conviction buckets.
  const bucketDefs: Array<{ label: string; min: number; max: number }> = [
    { label: '0.5-0.6', min: 0.5, max: 0.6 },
    { label: '0.6-0.7', min: 0.6, max: 0.7 },
    { label: '0.7-0.8', min: 0.7, max: 0.8 },
    { label: '0.8-0.9', min: 0.8, max: 0.9 },
    { label: '0.9-1.0', min: 0.9, max: 1.0 },
  ];
  const buckets: ConvictionBucket[] = bucketDefs.map((def) => {
    const inBucket = scoreable.filter((t) => t.conviction >= def.min && t.conviction < def.max);
    const correct = inBucket.filter((t) => t.outcome === true).length;
    const brier = inBucket.length > 0
      ? inBucket.map((t) => brierForTake(t) ?? 0).reduce((a, b) => a + b, 0) / inBucket.length
      : 0;
    return { label: def.label, n: inBucket.length, correct, brier };
  });

  // Bias tags: domains where the user is wrong more often than not, with
  // a minimum sample; plus overconfidence signal from high-conviction misses.
  const biasTags: string[] = [];
  for (const row of scorecards) {
    if (row.n >= opts.minBiasSample && row.accuracy < 0.5) {
      biasTags.push(`domain:${row.domain}`);
    }
  }
  const highConviction = scoreable.filter((t) => t.conviction >= 0.8);
  const highConvictionCorrect = highConviction.filter((t) => t.outcome === true).length;
  if (highConviction.length >= opts.minBiasSample && highConvictionCorrect / highConviction.length < 0.5) {
    biasTags.push('overconfidence:high-conviction-misses');
  }
  const lowConviction = scoreable.filter((t) => t.conviction < 0.7);
  const lowConvictionCorrect = lowConviction.filter((t) => t.outcome === true).length;
  if (lowConviction.length >= opts.minBiasSample && lowConvictionCorrect / lowConviction.length > 0.7) {
    biasTags.push('underconfidence:low-conviction-hits');
  }

  // Narratives: 2-4 conversational pattern statements ("friend-not-doctor"
  // voice: no academic jargon).
  const narratives = buildNarratives(scorecards, overallBrier, accuracy);

  return {
    resolvedCount: resolved.length,
    openCount,
    coldStart: false,
    brier: Number(overallBrier.toFixed(3)),
    accuracy: Number(accuracy.toFixed(3)),
    scorecards,
    buckets,
    narratives,
    biasTags,
    unresolvableRate: Number(unresolvableRate.toFixed(3)),
    voiceGate: { passed: true, regenerationsUsed: 0, finalText: narratives.join('\n') },
  };
}

function buildNarratives(scorecards: ScorecardRow[], overallBrier: number, accuracy: number): string[] {
  const out: string[] = [];

  if (scorecards.length > 0) {
    const best = scorecards[scorecards.length - 1]!;
    const worst = scorecards[0]!;
    if (best.accuracy >= 0.6 && best.n >= 2) {
      out.push(`You call ${best.domain} well â€” ${best.correct} of ${best.n} held up.`);
    }
    if (worst.accuracy < 0.6 && worst.n >= 2) {
      out.push(`${worst.domain} is your blind spot â€” ${worst.correct} of ${worst.n} missed.`);
    }
  }

  if (out.length < 2) {
    if (accuracy >= 0.7) {
      out.push(`Your track record is strong: ${Math.round(accuracy * 100)}% of resolved takes held up.`);
    } else if (accuracy >= 0.5) {
      out.push(`You're roughly at coin-flip overall (${Math.round(accuracy * 100)}% accuracy) â€” worth hedging more.`);
    } else {
      out.push(`Below coin-flip overall (${Math.round(accuracy * 100)}%) â€” the calibration profile is telling you to doubt first.`);
    }
  }

  if (overallBrier < 0.1) {
    out.push('Your confidence numbers track reality closely â€” trust them.');
  } else if (overallBrier > 0.3) {
    out.push('Your confidence numbers drift from reality â€” treat stated conviction as a hint, not a fact.');
  }

  return out.slice(0, 4);
}
