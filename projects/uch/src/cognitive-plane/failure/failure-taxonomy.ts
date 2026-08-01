/**
 * IDEA-0074 — Cognitive Failure Taxonomy (prototype).
 *
 * Ten faculty failure classes (reasoning, knowledge, memory, identity,
 * constitution, evidence, simulation, verification, attention,
 * homeostasis), each with detection signals, severity, canonical
 * response, and ledger event type — plus a conservative tagger that
 * defaults to the reasoning class (reverification, never aggressive
 * quarantine) and a response registry. Deterministic: no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type FacultyClass =
  | 'reasoning'
  | 'knowledge'
  | 'memory'
  | 'identity'
  | 'constitution'
  | 'evidence'
  | 'simulation'
  | 'verification'
  | 'attention'
  | 'homeostasis';

export type CanonicalResponse = 'retry' | 'reverify' | 'quarantine' | 'veto' | 'degrade' | 'rehomeostat';

export interface FailureClassDefinition {
  readonly faculty: FacultyClass;
  /** Signal substrings the tagger keys on (lowercase). */
  readonly signals: readonly string[];
  readonly severity: 'minor' | 'major' | 'critical';
  readonly response: CanonicalResponse;
  /** ADR-002-compatible ledger event type. */
  readonly eventType: string;
  /** Constitution-class failures never retry. */
  readonly neverRetry: boolean;
}

export const FAILURE_CLASSES: readonly [FailureClassDefinition, ...FailureClassDefinition[]] = [
  { faculty: 'reasoning', signals: ['contradiction', 'fallacy', 'invalid inference', 'unsound'], severity: 'major', response: 'reverify', eventType: 'failure:reasoning', neverRetry: false },
  { faculty: 'knowledge', signals: ['outdated', 'stale knowledge', 'wrong fact', 'misremembered'], severity: 'major', response: 'reverify', eventType: 'failure:knowledge', neverRetry: false },
  { faculty: 'memory', signals: ['corrupt recall', 'memory corruption', 'cannot retrieve', 'lost episode'], severity: 'major', response: 'quarantine', eventType: 'failure:memory', neverRetry: false },
  { faculty: 'identity', signals: ['identity mismatch', 'who am i', 'workspace confusion', 'wrong brain'], severity: 'critical', response: 'degrade', eventType: 'failure:identity', neverRetry: false },
  { faculty: 'constitution', signals: ['law violation', 'constitution', 'veto', 'integrity check failed'], severity: 'critical', response: 'veto', eventType: 'failure:constitution', neverRetry: true },
  { faculty: 'evidence', signals: ['no evidence', 'unverified claim', 'hallucination', 'fabricated'], severity: 'major', response: 'reverify', eventType: 'failure:evidence', neverRetry: false },
  { faculty: 'simulation', signals: ['simulation divergence', 'model drift', 'twin mismatch'], severity: 'minor', response: 'retry', eventType: 'failure:simulation', neverRetry: false },
  { faculty: 'verification', signals: ['verification failed', 'test failed', 'assertion', 'gate rejected'], severity: 'major', response: 'reverify', eventType: 'failure:verification', neverRetry: false },
  { faculty: 'attention', signals: ['attention saturated', 'overloaded', 'dropped signal', 'missed deadline'], severity: 'minor', response: 'degrade', eventType: 'failure:attention', neverRetry: false },
  { faculty: 'homeostasis', signals: ['energy depleted', 'budget exhausted', 'overheating', 'fatigue'], severity: 'major', response: 'rehomeostat', eventType: 'failure:homeostasis', neverRetry: false },
];

export const DEFAULT_FACULTY: FacultyClass = 'reasoning';

/**
 * Classifies an error description into a faculty class. Conservative:
 * matches on declared signals only; unmatched text defaults to
 * reasoning (reverification is the safe response — never aggressive
 * quarantine on ambiguity).
 */
export function classifyFailure(text: string): FacultyClass {
  const lowered = text.toLowerCase();
  for (const def of FAILURE_CLASSES) {
    if (def.signals.some((s) => lowered.includes(s))) return def.faculty;
  }
  return DEFAULT_FACULTY;
}

export function failureDefinition(faculty: FacultyClass): FailureClassDefinition {
  return FAILURE_CLASSES.find((d) => d.faculty === faculty) ?? FAILURE_CLASSES[0];
}

/** Canonical response for a faculty class (overrides generic retry). */
export function responseFor(faculty: FacultyClass): CanonicalResponse {
  return failureDefinition(faculty).response;
}

/** Constitution failures never retry, regardless of caller policy. */
export function neverRetries(faculty: FacultyClass): boolean {
  return failureDefinition(faculty).neverRetry;
}

export interface FailureRecord {
  readonly faculty: FacultyClass;
  readonly response: CanonicalResponse;
  readonly severity: 'minor' | 'major' | 'critical';
  readonly eventType: string;
  readonly atTick: number;
  readonly text: string;
}

/** Produces the full record a failure should carry on the signal bus. */
export function recordFailure(text: string, atTick: number): FailureRecord {
  const faculty = classifyFailure(text);
  const def = failureDefinition(faculty);
  return { faculty, response: def.response, severity: def.severity, eventType: def.eventType, atTick, text };
}

/** SLO observables: failure rates per class (IDEA-0071 wiring point). */
export function failureRateByClass(records: readonly FailureRecord[]): Record<FacultyClass, number> {
  const counts = new Map<FacultyClass, number>();
  for (const r of records) counts.set(r.faculty, (counts.get(r.faculty) ?? 0) + 1);
  const total = records.length === 0 ? 1 : records.length;
  const out = {} as Record<FacultyClass, number>;
  for (const c of FAILURE_CLASSES) out[c.faculty] = (counts.get(c.faculty) ?? 0) / total;
  return out;
}
