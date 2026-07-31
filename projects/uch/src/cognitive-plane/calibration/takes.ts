/**
 * Takes â€” gradeable claims extracted from memory, produced by the propose/grade cycle phases of the hindsight wave.
 *
 * A take is a claim that can be graded against reality. The system:
 *   1. Records takes with a conviction level (0..1) and domain.
 *   2. Resolves them as correct / incorrect / partial / unresolvable.
 *   3. Aggregates the record into a calibration profile (see calibration.ts).
 *
 * Unresolvable means "we tried but the evidence wasn't there to decide" â€”
 * a first-class quality, not a silent drop.
 */

export type TakeQuality = 'correct' | 'incorrect' | 'partial' | 'unresolvable';

export const QUALITY_VALUES: readonly TakeQuality[] = [
  'correct',
  'incorrect',
  'partial',
  'unresolvable',
];

export interface Take {
  id: string;
  claim: string;
  conviction: number; // 0..1
  domain: string;
  status: 'open' | 'resolved';
  quality?: TakeQuality;
  /** true = correct, false = incorrect, null = partial/unresolvable. */
  outcome?: boolean | null;
  evidence?: string;
  resolvedBy?: string;
  resolvedAt?: Date | null;
  sourceId?: string;
  createdAt: Date;
}

export interface AddTakeInput {
  claim: string;
  conviction: number;
  domain?: string;
  sourceId?: string;
}

export interface ResolveTakeInput {
  quality: TakeQuality;
  evidence?: string;
  resolvedBy?: string;
}

const DEFAULT_DOMAIN = 'general';

export class TakeFence {
  private takes: Take[] = [];

  constructor(takes: Take[] = []) {
    this.takes = [...takes];
  }

  get all(): Take[] {
    return [...this.takes];
  }

  get open(): Take[] {
    return this.takes.filter((t) => t.status === 'open');
  }

  get resolved(): Take[] {
    return this.takes.filter((t) => t.status === 'resolved');
  }

  count(): number {
    return this.takes.length;
  }

  add(input: AddTakeInput): Take {
    if (!input.claim.trim()) throw new Error('Take claim must not be empty');
    const conviction = Math.max(0, Math.min(1, input.conviction));
    const take: Take = {
      id: crypto.randomUUID(),
      claim: input.claim.trim(),
      conviction,
      domain: input.domain?.trim() || DEFAULT_DOMAIN,
      status: 'open',
      sourceId: input.sourceId,
      createdAt: new Date(),
    };
    this.takes.push(take);
    return take;
  }

  resolve(id: string, input: ResolveTakeInput): Take {
    if (!QUALITY_VALUES.includes(input.quality)) {
      throw new Error(`Invalid quality "${input.quality}"; expected one of ${QUALITY_VALUES.join(', ')}`);
    }
    const take = this.takes.find((t) => t.id === id);
    if (!take) throw new Error(`No take with id ${id}`);
    if (take.status === 'resolved') throw new Error(`Take ${id} is already resolved`);
    take.status = 'resolved';
    take.quality = input.quality;
    take.outcome = input.quality === 'correct' ? true : input.quality === 'incorrect' ? false : null;
    take.evidence = input.evidence;
    take.resolvedBy = input.resolvedBy;
    take.resolvedAt = new Date();
    return take;
  }

  resolveAll(input: ResolveTakeInput): number {
    let n = 0;
    for (const take of this.open) {
      try {
        this.resolve(take.id, input);
        n++;
      } catch {
        // already resolved â€” skip
      }
    }
    return n;
  }

  find(id: string): Take | undefined {
    return this.takes.find((t) => t.id === id);
  }

  toJSON(): Take[] {
    return this.takes;
  }
}
