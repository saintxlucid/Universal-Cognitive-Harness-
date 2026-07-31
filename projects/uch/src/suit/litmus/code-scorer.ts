export type ScoreDimension =
  | 'organic' | 'architecture' | 'maintainability' | 'readability'
  | 'testability' | 'idiomatic' | 'security' | 'performance'
  | 'coupling' | 'cohesion' | 'complexity' | 'documentation'
  | 'consistency' | 'reuse' | 'technical-debt' | 'future-readiness';

export interface ScoreResult {
  dimension: ScoreDimension;
  score: number;
  weight: number;
  reason: string;
}

export interface ScoredFile {
  path: string;
  language: string;
  dimensions: ScoreResult[];
  composite: number;
  timestamp: Date;
  rejected: boolean;
}

export interface ScorerConfig {
  threshold: number;
  weights: Partial<Record<ScoreDimension, number>>;
}

const DEFAULT_WEIGHTS: Record<ScoreDimension, number> = {
  organic: 1.0,
  architecture: 0.9,
  maintainability: 0.85,
  readability: 0.8,
  testability: 0.75,
  idiomatic: 0.7,
  security: 0.95,
  performance: 0.65,
  coupling: 0.8,
  cohesion: 0.75,
  complexity: 0.8,
  documentation: 0.6,
  consistency: 0.7,
  reuse: 0.65,
  'technical-debt': 0.7,
  'future-readiness': 0.6,
};

export interface FileProfile {
  path: string;
  language: string;
  lines: number;
  imports: string[];
  exports: string[];
  functions: Array<{ name: string; lines: number; params: number; complexity: number }>;
  classes: Array<{ name: string; methods: number; lines: number }>;
  comments: number;
  todoCount: number;
  hasTests: boolean;
  hasTypes: boolean;
  maxNesting: number;
  duplicateScore: number;
  dependencyCount: number;
  securityPatterns: string[];
}

export class CodeScorer {
  private config: Required<ScorerConfig>;
  private history: ScoredFile[] = [];
  private maxHistory: number;

  constructor(maxHistory = 500, config?: Partial<ScorerConfig>) {
    this.maxHistory = maxHistory;
    this.config = {
      threshold: config?.threshold ?? 0.7,
      weights: { ...DEFAULT_WEIGHTS, ...config?.weights } as Record<ScoreDimension, number>,
    };
  }

  score(profile: FileProfile): ScoredFile {
    const dimensions: ScoreResult[] = [
      this.scoreArchitecture(profile),
      this.scoreMaintainability(profile),
      this.scoreReadability(profile),
      this.scoreTestability(profile),
      this.scoreIdiomatic(profile),
      this.scoreSecurity(profile),
      this.scorePerformance(profile),
      this.scoreCoupling(profile),
      this.scoreCohesion(profile),
      this.scoreComplexity(profile),
      this.scoreDocumentation(profile),
      this.scoreConsistency(profile),
      this.scoreReuse(profile),
      this.scoreTechnicalDebt(profile),
      this.scoreFutureReadiness(profile),
    ];

    const composite = this.computeOrganic(dimensions);

    const result: ScoredFile = {
      path: profile.path,
      language: profile.language,
      dimensions: [...dimensions, composite],
      composite: composite.score,
      timestamp: new Date(),
      rejected: composite.score < this.config.threshold,
    };

    this.history.push(result);
    if (this.history.length > this.maxHistory) this.history.shift();
    return result;
  }

  private computeOrganic(dimensions: ScoreResult[]): ScoreResult {
    const totalWeight = dimensions.reduce((s, d) => s + (this.config.weights[d.dimension] ?? 0.5), 0);
    const weighted = dimensions.reduce((s, d) => s + d.score * (this.config.weights[d.dimension] ?? 0.5), 0);
    const score = totalWeight > 0 ? weighted / totalWeight : 0;
    const reasons = dimensions.filter((d) => d.score < 0.7).map((d) => `${d.dimension}=${d.score.toFixed(2)}`);
    return {
      dimension: 'organic', score, weight: 1.0,
      reason: reasons.length > 0 ? `Low dimensions: ${reasons.join(', ')}` : 'All dimensions acceptable',
    };
  }

  private scoreArchitecture(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.lines > 500) { score -= 0.2; }
    if (p.maxNesting > 4) { score -= 0.15; }
    if (p.functions.some((f) => f.lines > 100)) { score -= 0.15; }
    if (p.classes.some((c) => c.lines > 400)) { score -= 0.1; }
    return { dimension: 'architecture', score: Math.max(0, score), weight: 0.9, reason: score >= 0.8 ? 'Good structure' : 'Large/complex file' };
  }

  private scoreMaintainability(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.todoCount > 3) { score -= 0.1 * Math.min(5, p.todoCount); }
    const avgFuncLines = p.functions.length > 0 ? p.functions.reduce((s, f) => s + f.lines, 0) / p.functions.length : 0;
    if (avgFuncLines > 50) { score -= 0.15; }
    if (p.duplicateScore > 0.3) { score -= 0.2; }
    return { dimension: 'maintainability', score: Math.max(0, score), weight: 0.85, reason: score >= 0.7 ? 'Maintainable' : 'High maintenance risk' };
  }

  private scoreReadability(p: FileProfile): ScoreResult {
    let score = 1.0;
    const nestingPenalty = Math.max(0, p.maxNesting - 3) * 0.1;
    score -= nestingPenalty;
    if (p.maxNesting > 6) { score -= 0.2; }
    if (p.functions.some((f) => f.params > 5)) { score -= 0.1; }
    return { dimension: 'readability', score: Math.max(0, score), weight: 0.8, reason: score >= 0.7 ? 'Readable' : `Deep nesting (${p.maxNesting})` };
  }

  private scoreTestability(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (!p.hasTests) { score -= 0.3; }
    if (p.functions.some((f) => f.complexity > 10)) { score -= 0.15; }
    if (p.functions.some((f) => f.params > 6)) { score -= 0.1; }
    if (p.dependencyCount > 10) { score -= 0.1; }
    return { dimension: 'testability', score: Math.max(0, score), weight: 0.75, reason: !p.hasTests ? 'No tests detected' : 'Testable' };
  }

  private scoreIdiomatic(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.hasTypes === false) { score -= 0.2; }
    if (p.functions.some((f) => f.params > 7)) { score -= 0.1; }
    return { dimension: 'idiomatic', score: Math.max(0, score), weight: 0.7, reason: score >= 0.8 ? 'Idiomatic' : 'May not follow language conventions' };
  }

  private scoreSecurity(p: FileProfile): ScoreResult {
    let score = 1.0;
    const unsafe = p.securityPatterns.filter((s) => ['eval', 'exec', 'innerHTML', 'dangerouslySetInnerHTML', 'raw_sql', 'shell'].includes(s));
    if (unsafe.length > 0) { score -= 0.1 * unsafe.length; }
    return { dimension: 'security', score: Math.max(0, score), weight: 0.95, reason: unsafe.length > 0 ? `Unsafe patterns: ${unsafe.join(', ')}` : 'No security concerns' };
  }

  private scorePerformance(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.maxNesting > 5) { score -= 0.1; }
    return { dimension: 'performance', score: Math.max(0, score), weight: 0.65, reason: score >= 0.9 ? 'Good performance profile' : 'Potential performance concerns' };
  }

  private scoreCoupling(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.dependencyCount > 15) { score -= 0.2; }
    if (p.dependencyCount > 8) { score -= 0.1; }
    return { dimension: 'coupling', score: Math.max(0, score), weight: 0.8, reason: p.dependencyCount <= 8 ? 'Low coupling' : `High dependency count (${p.dependencyCount})` };
  }

  private scoreCohesion(p: FileProfile): ScoreResult {
    let score = 1.0;
    const hasMixed = p.functions.length > 0 && p.classes.length > 0 && p.exports.length === 0;
    if (hasMixed) { score -= 0.15; }
    if (p.lines > 300 && p.exports.length > 5) { score -= 0.1; }
    return { dimension: 'cohesion', score: Math.max(0, score), weight: 0.75, reason: score >= 0.8 ? 'Well-cohesive' : 'Mixed responsibilities' };
  }

  private scoreComplexity(p: FileProfile): ScoreResult {
    let score = 1.0;
    const highComplexity = p.functions.filter((f) => f.complexity > 10).length;
    if (highComplexity > 0) { score -= 0.1 * Math.min(5, highComplexity); }
    if (p.maxNesting > 5) { score -= 0.15; }
    if (p.lines > 400) { score -= 0.1; }
    return { dimension: 'complexity', score: Math.max(0, score), weight: 0.8, reason: score >= 0.7 ? 'Acceptable complexity' : `High complexity (${highComplexity} complex functions)` };
  }

  private scoreDocumentation(p: FileProfile): ScoreResult {
    let score = 1.0;
    const commentRatio = p.lines > 0 ? p.comments / p.lines : 0;
    if (commentRatio < 0.05 && p.lines > 100) { score -= 0.2; }
    if (p.todoCount > 5) { score -= 0.1; }
    if (p.functions.some((f) => f.lines > 30 && !p.comments)) { score -= 0.1; }
    return { dimension: 'documentation', score: Math.max(0, score), weight: 0.6, reason: commentRatio >= 0.05 ? 'Adequate documentation' : 'Low comment ratio' };
  }

  private scoreConsistency(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.duplicateScore > 0.5) { score -= 0.2; }
    return { dimension: 'consistency', score: Math.max(0, score), weight: 0.7, reason: p.duplicateScore <= 0.3 ? 'Consistent' : 'Inconsistent patterns detected' };
  }

  private scoreReuse(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.functions.some((f) => f.lines > 80 && f.name.startsWith('handle') || f.name.startsWith('process'))) { score -= 0.1; }
    return { dimension: 'reuse', score: Math.max(0, score), weight: 0.65, reason: score >= 0.9 ? 'Good reuse potential' : 'Some functions may be too specific' };
  }

  private scoreTechnicalDebt(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.todoCount > 0) { score -= 0.05 * Math.min(10, p.todoCount); }
    if (p.duplicateScore > 0.4) { score -= 0.15; }
    return { dimension: 'technical-debt', score: Math.max(0, score), weight: 0.7, reason: p.todoCount === 0 ? 'No TODOs' : `${p.todoCount} TODOs` };
  }

  private scoreFutureReadiness(p: FileProfile): ScoreResult {
    let score = 1.0;
    if (p.lines > 500) { score -= 0.15; }
    if (p.maxNesting > 5) { score -= 0.1; }
    return { dimension: 'future-readiness', score: Math.max(0, score), weight: 0.6, reason: score >= 0.8 ? 'Future-ready' : 'May need refactoring for growth' };
  }

  getHistory(limit = 20): ScoredFile[] {
    return this.history.slice(-limit);
  }

  getRejected(): ScoredFile[] {
    return this.history.filter((f) => f.rejected);
  }

  getStats(): Record<string, unknown> {
    const scored = this.history;
    return {
      totalScored: scored.length,
      rejected: scored.filter((f) => f.rejected).length,
      avgComposite: scored.length > 0 ? scored.reduce((s, f) => s + f.composite, 0) / scored.length : 0,
      minComposite: scored.length > 0 ? Math.min(...scored.map((f) => f.composite)) : 0,
      maxComposite: scored.length > 0 ? Math.max(...scored.map((f) => f.composite)) : 0,
    };
  }
}
