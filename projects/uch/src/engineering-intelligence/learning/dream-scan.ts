/**
 * Tier X Dream Scan — ADR-003 Phase E (Wave E).
 *
 * The dream engine: a periodic offline pass over the workspace genome
 * (DNA mutation history) and the trace ledger (ADR-002) searching for
 * unknown unknowns: silent debt, dead code, duplicate concepts,
 * inconsistent terminology, hidden assumptions, migration risks.
 * Findings are classified against the Tier X concept store
 * (`TIER_10_UNKNOWN_CONCEPTS`) and emitted as `suggestion` events.
 * NEVER self-applies changes — suggestions only.
 *
 * Deterministic: seeded inputs produce identical output; no I/O.
 */

import type { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import type { DnaMutation } from '../../workspace-graphs/workspace-dna.js';
import type { CognitiveTrace } from '../../cognitive-plane/trace-engine/cognitive-trace.js';

export type DreamScanClass =
  | 'silent-debt'
  | 'dead-code'
  | 'duplicate-concepts'
  | 'inconsistent-terminology'
  | 'hidden-assumptions'
  | 'migration-risks';

export interface DreamSuggestion {
  readonly cls: DreamScanClass;
  /** Tier X concept id (unknown.<class>). */
  readonly conceptId: string;
  readonly severity: 'minor' | 'major' | 'critical';
  readonly evidence: string[];
  readonly reason: string;
}

export interface DreamScanReport {
  readonly suggestions: readonly DreamSuggestion[];
  readonly scannedTraces: number;
  readonly scannedMutations: number;
  readonly atTick: number;
}

export interface DreamScanInput {
  /** Workspace DNA mutations (genome history). */
  readonly mutations?: readonly DnaMutation[];
  /** Traces from the ADR-002 ledger. */
  readonly traces?: readonly CognitiveTrace[];
}

/** Keyword families keyed by dream class (deterministic, offline). */
export const DREAM_KEYWORDS: Readonly<Record<DreamScanClass, readonly string[]>> = {
  'silent-debt': ['temporary', 'hack', 'workaround', 'fix later', 'fragile', 'hacky'],
  'dead-code': ['unused', 'unreachable', 'dead code', 'no longer used', 'legacy', 'unreferenced'],
  'duplicate-concepts': [
    'duplicate',
    'same logic',
    'copy paste',
    'two implementations',
    'parallel',
  ],
  'inconsistent-terminology': [
    'terminology',
    'renamed',
    'alias',
    'same concept',
    'different names',
  ],
  'hidden-assumptions': ['assume', 'implicitly', 'relies on', 'not documented', 'tacit'],
  'migration-risks': [
    'migrate',
    'vendor lock',
    'exit ramp',
    'deprecated api',
    'legacy format',
    'compat',
  ],
};

const SEVERITY_BY_FAMILY: Readonly<Record<DreamScanClass, DreamSuggestion['severity']>> = {
  'silent-debt': 'major',
  'dead-code': 'minor',
  'duplicate-concepts': 'major',
  'inconsistent-terminology': 'minor',
  'hidden-assumptions': 'critical',
  'migration-risks': 'major',
};

/** Extracts text from a trace's event attributes (message/description/text...). */
function traceEventText(trace: CognitiveTrace): string[] {
  const texts: string[] = [];
  const TEXT_KEYS = ['message', 'description', 'text', 'output', 'command', 'content'];
  for (const event of trace.events ?? []) {
    for (const attr of event.attributes ?? []) {
      if (!TEXT_KEYS.includes(attr.key)) continue;
      if (typeof attr.value === 'string' && attr.value) texts.push(attr.value);
    }
  }
  return texts;
}

function hasKeyword(text: string, keywords: readonly string[]): boolean {
  const lowered = text.toLowerCase();
  return keywords.some((k) => lowered.includes(k.toLowerCase()));
}

/**
 * Deterministic offline scan. Each class is checked against keywords in
 * mutation causes / trace event text; findings carry evidence and a
 * Tier X concept id. Emits `suggestion` events when a bus is attached;
 * never modifies anything.
 */
export class DreamScan {
  private eventBus: NeuralEventBus | null;
  private lastReport: DreamScanReport | null = null;

  constructor(eventBus: NeuralEventBus | null = null) {
    this.eventBus = eventBus;
  }

  getLastReport(): DreamScanReport | null {
    return this.lastReport;
  }

  /**
   * Runs the scan over the seeded corpus (tests pass both providers
   * explicitly; the runtime wires genome + ledger).
   */
  async scan(input: DreamScanInput, atTick = 0): Promise<DreamScanReport> {
    const suggestions: DreamSuggestion[] = [];
    const mutations = input.mutations ?? [];
    const traces = input.traces ?? [];
    const corpus: Array<{ text: string; source: string }> = [];

    for (const mutation of mutations) {
      corpus.push({
        text: mutation.cause === 'deliberate' ? 'deliberate change' : 'input changed silently',
        source: `mutation@${mutation.at}`,
      });
    }
    for (const trace of traces) {
      for (const text of traceEventText(trace)) {
        corpus.push({ text, source: `trace:${trace.trace_id}` });
      }
    }

    for (const cls of Object.keys(DREAM_KEYWORDS) as DreamScanClass[]) {
      const keywords = DREAM_KEYWORDS[cls];
      const evidence = corpus
        .filter((c) => hasKeyword(c.text, keywords))
        .map((c) => `${c.source}: ${c.text}`);
      if (evidence.length === 0) continue;
      suggestions.push({
        cls,
        conceptId: `unknown.${cls}`,
        severity: SEVERITY_BY_FAMILY[cls],
        evidence,
        reason: `${evidence.length} signal(s) matching ${cls} heuristics`,
      });
    }

    // Duplicate concept signal: repeated trace names across the corpus.
    if (traces.length > 1) {
      const byName = new Map<string, string[]>();
      for (const trace of traces) {
        const list = byName.get(trace.name) ?? [];
        list.push(trace.trace_id);
        byName.set(trace.name, list);
      }
      for (const [name, ids] of byName) {
        if (ids.length > 1) {
          suggestions.push({
            cls: 'duplicate-concepts',
            conceptId: 'unknown.duplicate-concepts',
            severity: 'major',
            evidence: [`trace name "${name}" appears ${ids.length} times: ${ids.join(', ')}`],
            reason: 'repeated trace names suggest duplicated or parallel concepts',
          });
        }
      }
    }

    const report: DreamScanReport = {
      suggestions,
      scannedTraces: traces.length,
      scannedMutations: mutations.length,
      atTick,
    };
    this.lastReport = report;

    if (this.eventBus) {
      for (const s of suggestions) {
        await this.eventBus.publish({
          type: 'suggestion',
          source: 'dream-scan',
          payload: {
            class: s.cls,
            concept_id: s.conceptId,
            severity: s.severity,
            reason: s.reason,
            evidence: s.evidence,
          },
          metadata: { module: 'dream-scan', importance: s.severity === 'critical' ? 7 : 4 },
        });
      }
    }
    return report;
  }
}
