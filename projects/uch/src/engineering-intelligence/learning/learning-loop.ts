/**
 * Engineering Learning Loop — ADR-003 Phase E (Wave E).
 *
 * Closes the learning loop for the Engineering Intelligence layer:
 *  - Tier IX taste reinforcement: review outcomes become taste feedback
 *    via `TasteEngine.learn` (vetoes penalize, clean reviews reinforce).
 *  - Connectome weight reinforcement: concepts that co-activate across
 *    reviews get `connectome:link` events (register-or-strengthen in
 *    `src/connectome/wiring.ts`).
 *  - Sleep-cycle distillation: repeated concept activations are exposed
 *    through the `SleepFrameworkSource` contract so the sleep cycle
 *    consolidates them into skill entries without any change to
 *    `src/sleep_cycle/cycle.ts`.
 *
 * Deterministic: no randomness, no I/O. Never self-applies changes.
 */

import type { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import type { TasteEngine, TasteDimension } from '../../cognitive-plane/taste/taste-engine.js';
import type { SleepFrameworkPattern } from '../../sleep_cycle/cycle.js';
import type { EngineeringReview } from '../types.js';

/** Minimum activations before a concept is offered to the sleep cycle. */
export const MIN_SLEEP_ACTIVATIONS = 2;
/** Minimum score for a review to count as a taste reinforcement. */
export const TASTE_REINFORCE_SCORE = 0.9;
/** Reviews with vetoes penalize taste (mirrors organic-score veto semantics). */
export const TASTE_PENALTY = 0.2;

export interface ConceptActivation {
  readonly conceptId: string;
  readonly count: number;
  readonly lastAtTick: number;
}

export interface LearningLoopStats {
  readonly reviews: number;
  readonly activations: number;
  readonly tasteFeedback: number;
  readonly connectomeLinks: number;
  readonly strongestConcept: string;
}

export interface LearningLoopConfig {
  /** Minimum activations before the loop emits a connectome:link event. */
  readonly connectomeThreshold?: number;
  /** Taste dimension reinforced on a clean review. */
  readonly reinforceDimension?: TasteDimension;
  /** Taste dimension penalized when vetoes fire. */
  readonly penaltyDimension?: TasteDimension;
}

const DEFAULT_CONFIG: LearningLoopConfig = {
  connectomeThreshold: 2,
  reinforceDimension: 'code-elegance',
  penaltyDimension: 'architecture-beauty',
};

export class EngineeringLearningLoop {
  private readonly eventBus: NeuralEventBus | null;
  private readonly tasteEngine: TasteEngine | null;
  private readonly config: LearningLoopConfig;
  private activations = new Map<string, ConceptActivation>();
  private reviews = 0;
  private connectomeLinks = 0;
  private subscriptionIds: string[] = [];

  constructor(
    eventBus: NeuralEventBus | null = null,
    tasteEngine: TasteEngine | null = null,
    config: LearningLoopConfig = {},
  ) {
    this.eventBus = eventBus;
    this.tasteEngine = tasteEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Subscribes to `engineering:reviewed` events published by enrichment. */
  attach(): void {
    if (!this.eventBus) return;
    this.subscriptionIds.push(
      this.eventBus.subscribe(
        'engineering:reviewed',
        (event) => {
          const payload = event.payload as {
            trigger_id?: unknown;
            review?: { score?: unknown; veto_count?: unknown };
            findings?: Array<Record<string, unknown>>;
          };
          const findings = payload?.findings;
          if (!Array.isArray(findings) || findings.length === 0) return;
          const score = typeof payload?.review?.score === 'number' ? payload.review.score / 100 : 0;
          const review: EngineeringReview = {
            targetId: typeof payload?.trigger_id === 'string' ? payload.trigger_id : event.id,
            findings: findings.map((f) => ({
              tier: 'tier-02-se' as const,
              severity:
                f.severity === 'critical'
                  ? ('blocking' as const)
                  : f.severity === 'major'
                    ? ('warning' as const)
                    : ('info' as const),
              conceptId: String(f.conceptId ?? 'unknown'),
              message: String(f.message ?? ''),
              evidence: [],
              suggestion: [],
              gate: f.gate === 'veto' ? ('veto' as const) : ('advisory' as const),
            })),
            score,
            summary: 'enrichment review',
          };
          this.record(review, 0);
        },
        undefined,
        'engineering-learning-loop',
      ),
    );
  }

  dispose(): void {
    if (!this.eventBus) return;
    for (const id of this.subscriptionIds) this.eventBus.unsubscribe(id);
    this.subscriptionIds = [];
  }

  /**
   * Feeds a review into the loop: taste reinforcement, concept
   * activation accounting, and connectome strengthening.
   */
  record(review: EngineeringReview, atTick: number): void {
    this.reviews++;
    this.applyTaste(review);
    const vetoes = review.findings.filter((f) => f.gate === 'veto');
    for (const finding of review.findings) {
      const prev = this.activations.get(finding.conceptId);
      const count = (prev?.count ?? 0) + 1;
      this.activations.set(finding.conceptId, {
        conceptId: finding.conceptId,
        count,
        lastAtTick: atTick,
      });
      const threshold = this.config.connectomeThreshold ?? DEFAULT_CONFIG.connectomeThreshold!;
      if (count >= threshold)
        this.emitConnectomeLink(finding.conceptId, vetoes.length > 0 ? 'veto' : 'finding');
    }
  }

  getActivations(): ConceptActivation[] {
    return [...this.activations.values()].sort((a, b) => b.count - a.count);
  }

  /** Dominant concepts per EI tier, for the sleep cycle (Wave E contract). */
  getDominantPerProblemType(): SleepFrameworkPattern[] {
    return this.getActivations()
      .filter((a) => a.count >= MIN_SLEEP_ACTIVATIONS)
      .map((a) => ({ problemType: 'engineering', engine: a.conceptId, count: a.count }));
  }

  getStats(): LearningLoopStats {
    const sorted = this.getActivations();
    return {
      reviews: this.reviews,
      activations: sorted.length,
      tasteFeedback: this.tasteEngine?.getStats().totalFeedback ?? 0,
      connectomeLinks: this.connectomeLinks,
      strongestConcept: sorted[0]?.conceptId ?? 'none',
    };
  }

  private applyTaste(review: EngineeringReview): void {
    if (!this.tasteEngine) return;
    const vetoes = review.findings.filter((f) => f.gate === 'veto');
    if (vetoes.length > 0) {
      this.tasteEngine.learn(
        this.config.penaltyDimension ?? 'architecture-beauty',
        `review:${review.targetId}`,
        TASTE_PENALTY,
        `veto findings: ${vetoes.map((v) => v.conceptId).join(', ')}`,
      );
    } else if (review.score >= TASTE_REINFORCE_SCORE) {
      this.tasteEngine.learn(
        this.config.reinforceDimension ?? 'code-elegance',
        `review:${review.targetId}`,
        review.score,
        'clean engineering review',
      );
    }
  }

  private emitConnectomeLink(conceptId: string, kind: string): void {
    if (!this.eventBus) return;
    void this.eventBus.publish({
      type: 'connectome:link',
      source: 'engineering-learning-loop',
      payload: {
        from: conceptId,
        to: 'engineering-layer',
        type: 'event-driven',
        description: `co-activated engineering concept (${kind})`,
      },
      metadata: { module: 'engineering-learning-loop', importance: kind === 'veto' ? 6 : 3 },
    });
    this.connectomeLinks++;
  }
}
