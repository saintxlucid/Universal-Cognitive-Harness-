import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';

export type TasteDimension =
  | 'code-elegance' | 'architecture-beauty' | 'api-quality'
  | 'ux-quality' | 'readability' | 'simplicity'
  | 'consistency' | 'balance' | 'minimalism';

export interface TastePreference {
  dimension: TasteDimension;
  weight: number;
  examples: string[];
  feedback: TasteFeedback[];
  score: number;
}

export interface TasteFeedback {
  subject: string;
  rating: number;
  comment: string;
  timestamp: Date;
}

export interface TasteAssessment {
  dimension: TasteDimension;
  score: number;
  alignment: number;
  suggestions: string[];
}

export class TasteEngine {
  private preferences: Map<TasteDimension, TastePreference> = new Map();
  private assessments: TasteAssessment[] = [];
  private feedbackCount = 0;

  constructor() {
    this.initialize();
  }

  learn(dimension: TasteDimension, subject: string, rating: number, comment?: string): TastePreference {
    const pref = this.getOrCreate(dimension);
    pref.feedback.push({
      subject, rating: Math.max(0, Math.min(1, rating)),
      comment: comment ?? '',
      timestamp: new Date(),
    });

    const total = pref.feedback.reduce((s, f) => s + f.rating, 0);
    pref.score = total / pref.feedback.length;
    this.feedbackCount++;

    if (rating >= 0.8 && !pref.examples.includes(subject)) {
      pref.examples.push(subject);
      if (pref.examples.length > 20) pref.examples.shift();
    }

    return pref;
  }

  assess(dimension: TasteDimension, candidate: string): TasteAssessment {
    const pref = this.getOrCreate(dimension);
    const score = pref.score;

    const assessment: TasteAssessment = {
      dimension,
      score,
      alignment: pref.feedback.length > 0 ? score : 0.5,
      suggestions: this.generateSuggestions(dimension, score, candidate),
    };

    this.assessments.push(assessment);
    return assessment;
  }

  getPreference(dimension: TasteDimension): TastePreference {
    return this.getOrCreate(dimension);
  }

  getAllPreferences(): TastePreference[] {
    return [...this.preferences.values()];
  }

  getTopPreferences(limit = 5): TastePreference[] {
    return [...this.preferences.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  getStats(): {
    dimensions: number; totalFeedback: number;
    topDimension: string; avgScore: number;
  } {
    const all = [...this.preferences.values()];
    const avgScore = all.length > 0 ? all.reduce((s, p) => s + p.score, 0) / all.length : 0;
    const top = all.sort((a, b) => b.score - a.score)[0];
    return {
      dimensions: all.length,
      totalFeedback: this.feedbackCount,
      topDimension: top?.dimension ?? 'none',
      avgScore,
    };
  }

  private getOrCreate(dimension: TasteDimension): TastePreference {
    const existing = this.preferences.get(dimension);
    if (existing) return existing;
    const pref: TastePreference = {
      dimension, weight: 0.5,
      examples: [], feedback: [], score: 0.5,
    };
    this.preferences.set(dimension, pref);
    return pref;
  }

  private generateSuggestions(dimension: TasteDimension, score: number, _candidate: string): string[] {
    const suggestions: string[] = [];
    if (score < 0.4) {
      switch (dimension) {
        case 'code-elegance': suggestions.push('Prefer declarative over imperative patterns'); break;
        case 'architecture-beauty': suggestions.push('Aim for loose coupling and high cohesion'); break;
        case 'api-quality': suggestions.push('Design APIs that are hard to misuse'); break;
        case 'ux-quality': suggestions.push('Reduce cognitive friction in user flows'); break;
        case 'readability': suggestions.push('Favor explicit intent over clever conciseness'); break;
        case 'simplicity': suggestions.push('Remove unnecessary abstractions'); break;
        case 'consistency': suggestions.push('Follow existing patterns in the codebase'); break;
        case 'balance': suggestions.push('Avoid extreme optimization at the cost of clarity'); break;
        case 'minimalism': suggestions.push('Question whether each component earns its complexity'); break;
      }
    }
    return suggestions;
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      preferences: mapToRecord(this.preferences),
      assessments: this.assessments,
      feedbackCount: this.feedbackCount,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      preferences: Record<string, TastePreference>;
      assessments: TasteAssessment[];
      feedbackCount: number;
    }>(filePath);
    if (!data) return 0;

    if (data.preferences) this.preferences = recordToMap(data.preferences);
    this.assessments = data.assessments ?? [];
    this.feedbackCount = data.feedbackCount ?? 0;
    return this.preferences.size;
  }

  private initialize(): void {
    const dimensions: TasteDimension[] = [
      'code-elegance', 'architecture-beauty', 'api-quality',
      'ux-quality', 'readability', 'simplicity',
      'consistency', 'balance', 'minimalism',
    ];
    for (const dim of dimensions) this.getOrCreate(dim);
  }
}
