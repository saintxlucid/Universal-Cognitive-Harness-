/**
 * Frontier Mapper (Exploratory Cortex) — blueprint §2.
 *
 * Continuously diffs the workspace's actual knowledge against its spec/
 * literature corpus and external sources to surface gaps. Different
 * direction of travel than RCA (finds *absence*, not *cause*).
 *
 * Delegates gap-type classification to the research methodology engine
 * (detectGaps + GAP_TYPES — the 8 gap types), and adds the stateful
 * organ behavior: open/claimed/resolved lifecycle, staleness tracking,
 * and the 90-day rolling retention window.
 *
 * Benchmarkable: gap precision/recall against a labeled gap set,
 * staleness half-life of open gaps.
 */

import {
  detectGaps,
  GAP_TYPES,
  type GapType,
  type LiteratureNote,
} from '../cognitive-plane/frameworks/research/methodology.js';

export type GapStatus = 'open' | 'claimed' | 'resolved';
export type GapDiscoveryMethod =
  | 'literature-diff'
  | 'future-work-mining'
  | 'contradiction-scan'
  | 'limitation-scan';

export interface ResearchGap {
  id: string;
  gap_type: GapType;
  /** Module/file/spec section. */
  location: string;
  description: string;
  discovered_at: string;
  discovered_via: GapDiscoveryMethod;
  status: GapStatus;
  /** Days since discovery — drives the staleness signal. */
  staleness_days: number;
  confidence: number;
}

export interface FrontierScanInput {
  topic: string;
  location: string;
  notes: LiteratureNote[];
  discoveredVia?: GapDiscoveryMethod;
}

export interface GapStats {
  total: number;
  open: number;
  claimed: number;
  resolved: number;
  byType: Record<string, number>;
  staleGaps: number;
  /** Precision against a labeled set: matched / detected. */
  precision: number;
  /** Recall against a labeled set: matched / labeled. */
  recall: number;
}

export class FrontierMapper {
  private gaps: Map<string, ResearchGap> = new Map();
  private labeledSets: Map<string, Set<GapType>> = new Map();
  private scans = 0;

  /** Scan a topic/location for gaps using the 8-type classifier. */
  scan(input: FrontierScanInput): ResearchGap[] {
    this.scans++;
    const result = detectGaps({ topic: input.topic, notes: input.notes });

    const created: ResearchGap[] = [];
    for (const detected of result.detected) {
      const existing = [...this.gaps.values()].find(
        (g) => g.location === input.location && g.gap_type === detected.type && g.status !== 'resolved',
      );
      if (existing) {
        existing.description = detected.evidence;
        existing.confidence = detected.confidence;
        existing.staleness_days = this.ageDays(existing.discovered_at);
        created.push(existing);
        continue;
      }
      const gap: ResearchGap = {
        id: crypto.randomUUID(),
        gap_type: detected.type,
        location: input.location,
        description: detected.evidence,
        discovered_at: new Date().toISOString(),
        discovered_via: input.discoveredVia ?? this.classifyMethod(detected.evidence),
        status: 'open',
        staleness_days: 0,
        confidence: detected.confidence,
      };
      this.gaps.set(gap.id, gap);
      created.push(gap);
    }
    return created;
  }

  claim(id: string): boolean {
    const gap = this.gaps.get(id);
    if (!gap || gap.status !== 'open') return false;
    gap.status = 'claimed';
    return true;
  }

  resolve(id: string): boolean {
    const gap = this.gaps.get(id);
    if (!gap) return false;
    gap.status = 'resolved';
    return true;
  }

  /**
   * Label a set of expected gaps (for precision/recall benchmarks):
   * `label(location, [gapTypes])` then `benchmarkPrecision(location)`.
   */
  label(location: string, expectedTypes: GapType[]): void {
    this.labeledSets.set(location, new Set(expectedTypes));
  }

  benchmarkPrecision(location: string): { precision: number; recall: number; matched: string[]; missed: string[] } {
    const labeled = this.labeledSets.get(location);
    if (!labeled || labeled.size === 0) {
      return { precision: 0, recall: 0, matched: [], missed: [] };
    }
    const detected = new Set(
      [...this.gaps.values()]
        .filter((g) => g.location === location && g.status !== 'resolved')
        .map((g) => g.gap_type),
    );
    const matched = [...labeled].filter((t) => detected.has(t));
    const precision = detected.size > 0 ? matched.length / detected.size : 0;
    const recall = matched.length / labeled.size;
    const missed = [...labeled].filter((t) => !detected.has(t));
    return { precision, recall, matched, missed };
  }

  /** Stale open gaps (> 90 days) — surfaced by the sleep-cycle pass. */
  getStaleGaps(maxDays = 90): ResearchGap[] {
    return [...this.gaps.values()].filter(
      (g) => g.status === 'open' && g.staleness_days >= maxDays,
    );
  }

  getGaps(location?: string): ResearchGap[] {
    const all = [...this.gaps.values()];
    return location ? all.filter((g) => g.location === location) : all;
  }

  getGap(id: string): ResearchGap | undefined {
    return this.gaps.get(id);
  }

  getStats(): GapStats {
    const all = [...this.gaps.values()];
    const byType: Record<string, number> = {};
    for (const t of GAP_TYPES) byType[t.type] = 0;
    for (const g of all) byType[g.gap_type] = (byType[g.gap_type] ?? 0) + 1;

    const open = all.filter((g) => g.status === 'open').length;
    const claimed = all.filter((g) => g.status === 'claimed').length;
    const resolved = all.filter((g) => g.status === 'resolved').length;

    // Aggregate precision/recall across all labeled sets.
    let precision = 0;
    let recall = 0;
    let labeledSets = 0;
    for (const location of this.labeledSets.keys()) {
      const b = this.benchmarkPrecision(location);
      if (this.labeledSets.get(location)!.size > 0) {
        precision += b.precision;
        recall += b.recall;
        labeledSets++;
      }
    }

    return {
      total: all.length,
      open,
      claimed,
      resolved,
      byType,
      staleGaps: this.getStaleGaps().length,
      precision: labeledSets > 0 ? precision / labeledSets : 0,
      recall: labeledSets > 0 ? recall / labeledSets : 0,
    };
  }

  get scanCount(): number {
    return this.scans;
  }

  private classifyMethod(evidence: string): GapDiscoveryMethod {
    if (/contradict|disagree|inconsistent|no significant/i.test(evidence)) return 'contradiction-scan';
    if (/limitation/i.test(evidence)) return 'limitation-scan';
    if (/future research|authors request/i.test(evidence)) return 'future-work-mining';
    return 'literature-diff';
  }

  private ageDays(iso: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  }
}
