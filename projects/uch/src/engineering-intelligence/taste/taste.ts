/**
 * IDEA-0082 — Engineering Taste (prototype).
 *
 * Taste as a versioned rubric: the seven qualities (elegant, simple,
 * composable, minimal, readable, maintainable, beautiful) with metric
 * weights and a gate — data, not code — plus per-author taste
 * accumulation so the organism can route work toward what reliably
 * produces ≥ gate scores, and can reinforce skills (firmware loop).
 * Deterministic: no randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type TasteQuality = 'elegant' | 'simple' | 'composable' | 'minimal' | 'readable' | 'maintainable' | 'beautiful';

export interface TasteMetric {
  readonly quality: TasteQuality;
  /** Metric weight in the aggregate taste score (sum = 1). */
  readonly weight: number;
  /** Measurable proxy — 'beautiful' = clarity + consistency proxy. */
  readonly proxy: string;
}

export const TASTE_RUBRIC: readonly TasteMetric[] = [
  { quality: 'elegant', weight: 0.15, proxy: 'conceptual depth per line' },
  { quality: 'simple', weight: 0.2, proxy: 'fewest moving parts' },
  { quality: 'composable', weight: 0.15, proxy: 'reusable building blocks' },
  { quality: 'minimal', weight: 0.1, proxy: 'no dead or speculative code' },
  { quality: 'readable', weight: 0.15, proxy: 'naming + structure clarity' },
  { quality: 'maintainable', weight: 0.15, proxy: 'change amplification' },
  { quality: 'beautiful', weight: 0.1, proxy: 'consistency + clarity score' },
];

/** Default gate mirroring the Organic Score engine (≥ 0.9 = land). */
export const TASTE_GATE = 0.9;

export interface TasteVerdict {
  readonly score: number;
  readonly passes: boolean;
  /** Weakest quality (for feedback routing). */
  readonly weakest: TasteQuality;
  readonly weakestScore: number;
}

export interface TasteAssessment {
  readonly artifactId: string;
  /** Per-quality scores 0..1. */
  readonly scores: Readonly<Record<TasteQuality, number>>;
}

/** Weighted aggregate + gate verdict over the rubric. */
export function assessTaste(assessment: TasteAssessment): TasteVerdict {
  let score = 0;
  let weakest: TasteQuality = 'elegant';
  let weakestScore = 1;
  for (const metric of TASTE_RUBRIC) {
    const s = assessment.scores[metric.quality] ?? 0;
    score += s * metric.weight;
    if (s < weakestScore) {
      weakestScore = s;
      weakest = metric.quality;
    }
  }
  return { score, passes: score >= TASTE_GATE, weakest, weakestScore };
}

export interface AuthorTasteRecord {
  readonly authorId: string;
  readonly assessments: readonly TasteAssessment[];
  readonly average: number;
  readonly passRate: number;
}

export class TasteRegistry {
  private records = new Map<string, { assessments: TasteAssessment[] }>();

  record(authorId: string, assessment: TasteAssessment): void {
    const r = this.records.get(authorId) ?? { assessments: [] };
    r.assessments = [...r.assessments, assessment];
    this.records.set(authorId, r);
  }

  author(authorId: string): AuthorTasteRecord | undefined {
    const r = this.records.get(authorId);
    if (!r || r.assessments.length === 0) return undefined;
    const verdicts = r.assessments.map((a) => assessTaste(a));
    const average = verdicts.reduce((sum, v) => sum + v.score, 0) / verdicts.length;
    const passRate = verdicts.filter((v) => v.passes).length / verdicts.length;
    return { authorId, assessments: r.assessments, average, passRate };
  }

  /**
   * Routes work to the author whose recent taste reliably passes the
   * gate (the firmware reinforcement target).
   */
  bestAuthor(authors: readonly string[]): string | undefined {
    let best: string | undefined;
    let bestRate = -1;
    for (const a of authors) {
      const record = this.author(a);
      if (!record) continue;
      if (record.passRate > bestRate) {
        bestRate = record.passRate;
        best = a;
      }
    }
    return best;
  }
}
