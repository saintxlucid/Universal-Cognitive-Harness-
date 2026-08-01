/**
 * IDEA-0072 — Universal Lifecycle Engine (prototype).
 *
 * One 8-stage lifecycle for every cognitive object class:
 * idea → research → prototype → experiment → production → legacy →
 * archive → extinct, with a declared transition table (including legal
 * rollbacks), evidence-gated transitions, a registry, and a journal.
 * Deterministic: no randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export const LIFECYCLE_STAGES = [
  'idea',
  'research',
  'prototype',
  'experiment',
  'production',
  'legacy',
  'archive',
  'extinct',
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export type EvidenceKind =
  | 'register'
  | 'prototype'
  | 'verification'
  | 'benchmark'
  | 'review'
  | 'certification'
  | 'usage';

/** Required evidence kinds per destination stage (SOP-08 gates generalized). */
export const STAGE_GATES: Readonly<Partial<Record<LifecycleStage, readonly EvidenceKind[]>>> = {
  research: ['register'],
  prototype: ['register', 'prototype'],
  experiment: ['prototype', 'verification'],
  production: ['verification', 'benchmark', 'review'],
  legacy: ['usage'],
  archive: [],
  extinct: [],
};

export interface TransitionRule {
  readonly from: LifecycleStage;
  readonly to: LifecycleStage;
  /** Rollback transitions require explicit opt-in. */
  readonly rollback?: boolean;
}

export const ALLOWED_TRANSITIONS: readonly TransitionRule[] = [
  { from: 'idea', to: 'research' },
  { from: 'idea', to: 'prototype' },
  { from: 'research', to: 'idea', rollback: true },
  { from: 'research', to: 'prototype' },
  { from: 'prototype', to: 'research', rollback: true },
  { from: 'prototype', to: 'experiment' },
  { from: 'experiment', to: 'prototype', rollback: true },
  { from: 'experiment', to: 'production' },
  { from: 'experiment', to: 'archive' },
  { from: 'production', to: 'experiment', rollback: true },
  { from: 'production', to: 'legacy' },
  { from: 'production', to: 'archive' },
  { from: 'legacy', to: 'archive' },
  { from: 'legacy', to: 'production', rollback: true },
  { from: 'archive', to: 'extinct' },
  { from: 'archive', to: 'legacy', rollback: true },
];

export interface LifecycleEntry {
  readonly objectId: string;
  readonly kind: string;
  stage: LifecycleStage;
}

export interface TransitionJournalEntry {
  readonly objectId: string;
  readonly from: LifecycleStage;
  readonly to: LifecycleStage;
  readonly evidence: readonly EvidenceKind[];
  readonly atTick: number;
}

export class LifecycleRegistry {
  private entries = new Map<string, LifecycleEntry>();
  private journal: TransitionJournalEntry[] = [];

  register(objectId: string, kind: string): void {
    this.entries.set(objectId, { objectId, kind, stage: 'idea' });
  }

  get(objectId: string): LifecycleEntry | undefined {
    return this.entries.get(objectId);
  }

  /** Extinct objects are retained as lineage stubs. */
  listAtStage(stage: LifecycleStage): LifecycleEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.stage === stage);
  }

  /**
   * Transitions an object with evidence. Late stages are gated:
   * the required evidence kinds for the destination must all be
   * present. Extinct is terminal.
   */
  transition(objectId: string, to: LifecycleStage, evidence: readonly EvidenceKind[], atTick: number): boolean {
    const entry = this.entries.get(objectId);
    if (!entry) return false;
    if (entry.stage === to) return false;
    if (entry.stage === 'extinct') return false;
    const rule = ALLOWED_TRANSITIONS.find((r) => r.from === entry.stage && r.to === to);
    if (!rule) return false;
    const gate = STAGE_GATES[to] ?? [];
    const missing = gate.filter((g) => !evidence.includes(g));
    if (missing.length > 0) return false;
    this.journal.push({ objectId, from: entry.stage, to, evidence, atTick });
    entry.stage = to;
    return true;
  }

  journalFor(objectId: string): TransitionJournalEntry[] {
    return this.journal.filter((j) => j.objectId === objectId);
  }
}
