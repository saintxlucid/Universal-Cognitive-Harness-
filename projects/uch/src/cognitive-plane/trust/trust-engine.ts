import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';

export type TrustLevel = 'none' | 'minimal' | 'limited' | 'standard' | 'elevated' | 'full';

export interface TrustEntry {
  id: string;
  subject: string;
  subjectType: 'source' | 'memory' | 'plugin' | 'mcp' | 'skill' | 'agent' | 'tool';
  level: TrustLevel;
  score: number;
  evidence: string[];
  createdAt: Date;
  updatedAt: Date;
  lastVerified: Date | null;
  decayRate: number;
  verificationCount: number;
  failureCount: number;
  conflictCount: number;
  tags: string[];
}

export interface TrustAssessment {
  entry: TrustEntry;
  effectiveScore: number;
  verdict: 'trusted' | 'caution' | 'untrusted';
  reasons: string[];
}

export class TrustEngine {
  private entries: Map<string, TrustEntry> = new Map();
  private maxEntries: number;
  private readonly thresholds = { none: 0, minimal: 0.1, limited: 0.3, standard: 0.5, elevated: 0.75, full: 0.9 };

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  register(subject: string, subjectType: TrustEntry['subjectType'], initialLevel: TrustLevel = 'standard', opts?: { tags?: string[]; evidence?: string[] }): TrustEntry {
    const existing = this.getBySubject(subject);
    if (existing) return existing;

    const score = this.thresholdToScore(initialLevel);
    const entry: TrustEntry = {
      id: crypto.randomUUID(),
      subject, subjectType,
      level: initialLevel,
      score,
      evidence: opts?.evidence ?? ['initial registration'],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastVerified: null,
      decayRate: this.computeDecayRate(subjectType),
      verificationCount: 0,
      failureCount: 0,
      conflictCount: 0,
      tags: opts?.tags ?? [],
    };
    this.entries.set(entry.id, entry);
    this.enforceLimit();
    return entry;
  }

  assess(subject: string): TrustAssessment {
    const entry = this.entries.get(subject) ?? this.getBySubject(subject);
    if (!entry) {
      return {
        entry: this.createAnonymous(subject),
        effectiveScore: 0,
        verdict: 'untrusted',
        reasons: ['Unknown subject, no trust data'],
      };
    }

    const reasons: string[] = [];
    let effectiveScore = entry.score;

    const elapsed = entry.lastVerified ? (Date.now() - entry.lastVerified.getTime()) : Infinity;
    const decayDays = elapsed / (24 * 60 * 60 * 1000);
    if (decayDays > 30 && entry.decayRate > 0) {
      const decay = decayDays * entry.decayRate;
      effectiveScore = Math.max(0, effectiveScore - decay);
      reasons.push(`Trust decayed by ${decay.toFixed(2)} (${decayDays.toFixed(0)} days since verification)`);
    }

    if (entry.failureCount > 0) {
      const penalty = entry.failureCount * 0.05;
      effectiveScore = Math.max(0, effectiveScore - penalty);
      reasons.push(`${entry.failureCount} failures penalized by ${penalty.toFixed(2)}`);
    }

    if (entry.conflictCount > 0) {
      const penalty = entry.conflictCount * 0.1;
      effectiveScore = Math.max(0, effectiveScore - penalty);
      reasons.push(`${entry.conflictCount} conflicts penalized by ${penalty.toFixed(2)}`);
    }

    if (entry.verificationCount > 3) {
      const bonus = Math.min(0.1, entry.verificationCount * 0.02);
      effectiveScore = Math.min(1, effectiveScore + bonus);
      reasons.push(`${entry.verificationCount} verifications bonus ${bonus.toFixed(2)}`);
    }

    let verdict: TrustAssessment['verdict'];
    if (effectiveScore >= this.thresholds.standard) verdict = 'trusted';
    else if (effectiveScore >= this.thresholds.limited) verdict = 'caution';
    else verdict = 'untrusted';

    return { entry, effectiveScore, verdict, reasons };
  }

  recordSuccess(subject: string): boolean {
    const entry = this.entries.get(subject) ?? this.getBySubject(subject);
    if (!entry) return false;
    entry.verificationCount++;
    entry.score = Math.min(1, entry.score + 0.05);
    entry.lastVerified = new Date();
    entry.updatedAt = new Date();
    return true;
  }

  recordFailure(subject: string): boolean {
    const entry = this.entries.get(subject) ?? this.getBySubject(subject);
    if (!entry) return false;
    entry.failureCount++;
    entry.score = Math.max(0, entry.score - 0.1);
    entry.updatedAt = new Date();
    return true;
  }

  recordConflict(subject: string): boolean {
    const entry = this.entries.get(subject) ?? this.getBySubject(subject);
    if (!entry) return false;
    entry.conflictCount++;
    entry.score = Math.max(0, entry.score - 0.15);
    entry.updatedAt = new Date();
    return true;
  }

  get(subject: string): TrustEntry | undefined {
    return this.entries.get(subject) ?? this.getBySubject(subject);
  }

  getByType(subjectType: TrustEntry['subjectType']): TrustEntry[] {
    return [...this.entries.values()].filter((e) => e.subjectType === subjectType);
  }

  getLowTrust(threshold = 0.3): TrustEntry[] {
    return [...this.entries.values()].filter((e) => {
      const assessment = this.assess(e.subject);
      return assessment.effectiveScore < threshold;
    });
  }

  getAll(limit = 100): TrustEntry[] {
    return [...this.entries.values()].slice(0, limit);
  }

  getStats(): { total: number; byType: Record<string, number>; avgScore: number; lowTrust: number } {
    const byType: Record<string, number> = {};
    let totalScore = 0;
    for (const [, e] of this.entries) {
      byType[e.subjectType] = (byType[e.subjectType] ?? 0) + 1;
      totalScore += e.score;
    }
    return {
      total: this.entries.size, byType,
      avgScore: this.entries.size > 0 ? totalScore / this.entries.size : 0,
      lowTrust: this.getLowTrust().length,
    };
  }

  remove(subject: string): boolean {
    const entry = this.entries.get(subject) ?? this.getBySubject(subject);
    if (!entry) return false;
    return this.entries.delete(entry.id);
  }

  clear(): void {
    this.entries.clear();
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      entries: mapToRecord(this.entries),
      maxEntries: this.maxEntries,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      entries: Record<string, TrustEntry>;
      maxEntries: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxEntries !== undefined) this.maxEntries = data.maxEntries;
    this.entries = recordToMap(data.entries ?? {});
    return this.entries.size;
  }

  private getBySubject(subject: string): TrustEntry | undefined {
    return [...this.entries.values()].find((e) => e.subject === subject);
  }

  private createAnonymous(subject: string): TrustEntry {
    return {
      id: 'anonymous', subject, subjectType: 'source',
      level: 'none', score: 0, evidence: [],
      createdAt: new Date(), updatedAt: new Date(),
      lastVerified: null, decayRate: 0,
      verificationCount: 0, failureCount: 0, conflictCount: 0,
      tags: [],
    };
  }

  private thresholdToScore(level: TrustLevel): number {
    return this.thresholds[level];
  }

  private computeDecayRate(type: TrustEntry['subjectType']): number {
    switch (type) {
      case 'source': return 0.002;
      case 'memory': return 0.001;
      case 'plugin': return 0.005;
      case 'mcp': return 0.003;
      case 'skill': return 0.001;
      case 'agent': return 0.004;
      case 'tool': return 0.002;
    }
  }

  private enforceLimit(): void {
    if (this.entries.size > this.maxEntries) {
      const oldest = [...this.entries.values()].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0];
      if (oldest) this.entries.delete(oldest.id);
    }
  }
}
