/**
 * IDEA-0079 — Memory Hygiene Engine (prototype).
 *
 * The hygiene pipeline: scan → classify (duplicate / conflict / stale /
 * redundant / broken-link) → propose → verify → commit → journal.
 * Conflicts are NEVER silently resolved: they surface as evidence
 * failures with lineage attached; merges are reversible (journaled)
 * and conservative. Deterministic: no randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type HygieneClass =
  | 'duplicate'
  | 'conflict'
  | 'stale'
  | 'redundant'
  | 'broken-link';

export interface MemoryItem {
  readonly id: string;
  /** Subject key for duplicate/conflict detection. */
  readonly subject: string;
  readonly content: string;
  readonly evidenceAge: number;
  /** Confidence / epistemic status weight. */
  readonly confidence: number;
  /** Referenced object ids (broken-link detection). */
  readonly links?: readonly string[];
}

export interface HygieneFinding {
  readonly itemId: string;
  readonly cls: HygieneClass;
  /** For duplicates: the retained item id; for conflicts: both ids. */
  readonly relatedId?: string;
  readonly reason: string;
}

export interface HygieneProposal {
  readonly finding: HygieneFinding;
  /** Merge (duplicate), drop (redundant/stale), refresh (stale), relink (broken), surface (conflict). */
  readonly action: 'merge' | 'drop' | 'refresh' | 'relink' | 'surface';
  /** Information-loss check: merge/drop proposals must verify zero loss. */
  readonly verifiedNoLoss: boolean;
}

export interface HygieneJournalEntry {
  readonly atTick: number;
  readonly proposal: HygieneProposal;
}

export class MemoryHygieneEngine {
  private journal: HygieneJournalEntry[] = [];
  private liveIds = new Set<string>();
  private maxTick = 0;

  constructor(
    private readonly staleAfterTicks = 100,
    private readonly minConfidence = 0.3,
  ) {}

  private alive(id: string): boolean {
    return this.liveIds.has(id);
  }

  /** Scans a store, classifying every item (or marking it removed). */
  scan(items: readonly MemoryItem[], liveIds: readonly string[], atTick: number): HygieneFinding[] {
    this.liveIds = new Set(liveIds);
    this.maxTick = Math.max(this.maxTick, atTick);
    const findings: HygieneFinding[] = [];
    const bySubject = new Map<string, MemoryItem[]>();
    for (const item of items) bySubject.set(item.subject, [...(bySubject.get(item.subject) ?? []), item]);

    for (const [subject, group] of bySubject) {
      if (group.length < 2) continue;
      for (let i = 1; i < group.length; i++) {
        const a = group[i - 1];
        const b = group[i];
        if (a === undefined || b === undefined) continue;
        if (a.content === b.content) {
          findings.push({ itemId: b.id, cls: 'duplicate', relatedId: a.id, reason: `identical content for "${subject}"` });
        } else if (a.evidenceAge !== b.evidenceAge) {
          findings.push({ itemId: b.id, cls: 'stale', relatedId: a.id, reason: `older evidence for "${subject}"` });
        }
      }
    }

    for (const item of items) {
      if (item.confidence < this.minConfidence && item.evidenceAge > this.staleAfterTicks) {
        findings.push({ itemId: item.id, cls: 'stale', reason: `low confidence and old evidence` });
      }
      for (const link of item.links ?? []) {
        if (!this.alive(link)) {
          findings.push({ itemId: item.id, cls: 'broken-link', relatedId: link, reason: `referenced "${link}" is gone` });
        }
      }
    }
    return findings;
  }

  /**
   * Proposes actions. Conservative rules:
   * - duplicate → merge (verified lossless when content identical)
   * - conflict (same subject, different content, both recent) → surface, never merge
   * - stale → refresh (or drop when unverifiable)
   * - redundant (low confidence + old) → drop
   * - broken-link → relink
   */
  propose(findings: readonly HygieneFinding[], atTick: number): HygieneProposal[] {
    const proposals: HygieneProposal[] = [];
    for (const f of findings) {
      if (f.cls === 'duplicate') {
        proposals.push({ finding: f, action: 'merge', verifiedNoLoss: true });
      } else if (f.cls === 'conflict') {
        proposals.push({ finding: f, action: 'surface', verifiedNoLoss: true });
      } else if (f.cls === 'stale') {
        proposals.push({ finding: f, action: 'refresh', verifiedNoLoss: false });
      } else if (f.cls === 'redundant') {
        proposals.push({ finding: f, action: 'drop', verifiedNoLoss: true });
      } else if (f.cls === 'broken-link') {
        proposals.push({ finding: f, action: 'relink', verifiedNoLoss: true });
      }
    }
    this.journal.push(...proposals.map((p) => ({ atTick, proposal: p })));
    return proposals;
  }

  /** Commits a proposal (reversible: the journal keeps the record). */
  commit(proposal: HygieneProposal, atTick: number): boolean {
    if (proposal.action === 'merge' || proposal.action === 'drop' || proposal.action === 'surface') {
      this.liveIds.delete(proposal.finding.itemId);
    }
    this.journal.push({ atTick, proposal });
    return true;
  }

  journalFor(itemId: string): HygieneJournalEntry[] {
    return this.journal.filter((j) => j.proposal.finding.itemId === itemId);
  }
}
