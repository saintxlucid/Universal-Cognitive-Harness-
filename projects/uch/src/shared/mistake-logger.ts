export interface MistakeRecord {
  id: string;
  signature: string;
  source: string;
  intent: string;
  message: string;
  severity: 'warning' | 'major' | 'critical';
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrences: number;
}

export interface MistakeLogInput {
  source: string;
  intent: string;
  message: string;
  severity?: MistakeRecord['severity'];
}

export class MistakeLogger {
  private readonly mistakes: MistakeRecord[] = [];

  recordMistake(input: MistakeLogInput): MistakeRecord {
    const signature = this.createSignature(input.intent, input.message);
    const existing = this.mistakes.find((entry) => entry.signature === signature);

    if (existing) {
      existing.lastSeenAt = new Date();
      existing.occurrences += 1;
      return existing;
    }

    const entry: MistakeRecord = {
      id: crypto.randomUUID(),
      signature,
      source: input.source,
      intent: input.intent,
      message: input.message,
      severity: input.severity ?? 'major',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrences: 1,
    };

    this.mistakes.push(entry);
    return entry;
  }

  hasSeen(intent: string, message: string): boolean {
    const signature = this.createSignature(intent, message);
    return this.mistakes.some((entry) => entry.signature === signature);
  }

  getAllMistakes(): MistakeRecord[] {
    return [...this.mistakes].sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }

  getRecentMistakes(limit = 10): MistakeRecord[] {
    return this.getAllMistakes().slice(0, limit);
  }

  getBySeverity(severity: MistakeRecord['severity']): MistakeRecord[] {
    return this.getAllMistakes().filter((entry) => entry.severity === severity);
  }

  getBySource(source: string): MistakeRecord[] {
    return this.getAllMistakes().filter((entry) => entry.source === source);
  }

  getTopMistakes(limit = 10): MistakeRecord[] {
    return this.getAllMistakes()
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  getStats(limit = 10): {
    total: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    topMistakes: MistakeRecord[];
  } {
    const stats = {
      total: 0,
      bySeverity: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      topMistakes: [] as MistakeRecord[],
    };

    const all = this.getAllMistakes();
    stats.total = all.length;

    for (const mistake of all) {
      stats.bySeverity[mistake.severity] = (stats.bySeverity[mistake.severity] ?? 0) + 1;
      stats.bySource[mistake.source] = (stats.bySource[mistake.source] ?? 0) + 1;
    }

    stats.topMistakes = this.getTopMistakes(Math.min(limit, all.length));
    return stats;
  }

  private computeStats(limit = 10): {
    total: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    topMistakes: MistakeRecord[];
  } {
    const stats = {
      total: 0,
      bySeverity: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      topMistakes: [] as MistakeRecord[],
    };

    const all = this.getAllMistakes();
    stats.total = all.length;

    for (const mistake of all) {
      stats.bySeverity[mistake.severity] = (stats.bySeverity[mistake.severity] ?? 0) + 1;
      stats.bySource[mistake.source] = (stats.bySource[mistake.source] ?? 0) + 1;
    }

    stats.topMistakes = this.getTopMistakes(Math.min(limit, all.length));
    return stats;
  }

  getSummary(): string {
    const stats = this.getStats();
    const topSources = Object.entries(stats.bySource)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([source, count]) => `${source}(${count})`)
      .join(', ');

    return `Remembered mistakes: ${stats.total}. Top sources: ${topSources || 'none'}.`;
  }

  private createSignature(intent: string, message: string): string {
    const normalize = (value: string): string =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    return `${normalize(intent)}::${normalize(message)}`;
  }
}
