/**
 * Engineering Enrichment — event-bus middleware (Phase D).
 *
 * Watches code-change and failure events and runs the deterministic
 * EngineeringEvaluator over whatever diff/prose the event carries.
 * When findings exist, it publishes an `engineering:reviewed` event so
 * downstream organs (executive filter, observatory, memory) can act on
 * engineering risk without re-evaluating.
 *
 * Purely additive middleware: it never mutates the triggering event and
 * never blocks the bus. Zero-LLM, deterministic, < 1 ms per target.
 */

import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import type { NeuralEvent } from '../../event-bus/neural-event-bus.js';
import { createDomainRegistry } from '../domains/index.js';
import { createLawRegistry } from '../laws/engineering-laws.js';
import { EngineeringEvaluator } from '../evaluator.js';
import type { EvaluationTarget } from '../types.js';

export const ENGINEERING_WATCH_EVENTS = [
  'git:commit',
  'file:saved',
  'test:failed',
  'build:failed',
  'error:occurred',
] as const;

/** Extract an evaluation target from a bus event payload, or null. */
export function targetFromEvent(event: NeuralEvent): EvaluationTarget | null {
  const p = event.payload;
  const paths = Array.isArray(p.paths)
    ? p.paths.filter((x): x is string => typeof x === 'string')
    : [];

  const diff =
    typeof p.diff === 'string' && p.diff
      ? p.diff
      : typeof p.content === 'string' && p.content.includes('\n')
        ? p.content
        : undefined;

  const text =
    typeof p.message === 'string' && p.message
      ? p.message
      : typeof p.description === 'string'
        ? p.description
        : undefined;

  if (diff) return { kind: 'code', diff, paths };
  if (text) return { kind: 'design', text };
  return null;
}

export interface EngineeringEnrichmentConfig {
  evaluator?: EngineeringEvaluator;
  /** Event types to watch; defaults to ENGINEERING_WATCH_EVENTS. */
  eventTypes?: readonly string[];
}

export class EngineeringEnrichment {
  readonly evaluator: EngineeringEvaluator;
  private eventBus: NeuralEventBus;
  private subscriptions: string[] = [];
  private reviewsPublished = 0;

  constructor(eventBus: NeuralEventBus, config: EngineeringEnrichmentConfig = {}) {
    this.eventBus = eventBus;
    const domains = createDomainRegistry();
    const laws = createLawRegistry();
    this.evaluator =
      config.evaluator ?? new EngineeringEvaluator(domains, laws);

    const types = config.eventTypes ?? ENGINEERING_WATCH_EVENTS;
    for (const type of types) {
      this.subscriptions.push(
        eventBus.subscribe(type as never, (event) => this.handleEvent(event), undefined, 'engineering-enrichment'),
      );
    }
  }

  getPublishedCount(): number {
    return this.reviewsPublished;
  }

  dispose(): void {
    for (const id of this.subscriptions) this.eventBus.unsubscribe(id);
    this.subscriptions = [];
  }

  private async handleEvent(event: NeuralEvent): Promise<void> {
    const target = targetFromEvent(event);
    if (!target) return;

    const review = this.evaluator.evaluate(target);
    if (review.findings.length === 0) return;

    const vetoes = review.findings.filter((f) => f.gate === 'veto');
    await this.eventBus.publish({
      type: 'engineering:reviewed',
      source: 'engineering-enrichment',
      payload: {
        trigger_type: event.type,
        trigger_id: event.id,
        review: {
          score: review.score,
          summary: review.summary,
          finding_count: review.findings.length,
          veto_count: vetoes.length,
        },
        findings: review.findings.map((f) => ({
          conceptId: f.conceptId,
          gate: f.gate,
          severity: f.severity,
          message: f.message,
        })),
      },
      metadata: { module: 'engineering-enrichment', importance: vetoes.length > 0 ? 8 : 4 },
    });
    this.reviewsPublished += 1;
  }
}
