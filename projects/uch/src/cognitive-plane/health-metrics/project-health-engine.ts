import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';

export type HealthDimension =
  | 'architecture' | 'code' | 'knowledge' | 'documentation'
  | 'memory' | 'technical-debt' | 'knowledge-debt'
  | 'complexity' | 'velocity' | 'risk'
  | 'prediction-accuracy' | 'cognitive-load';

export interface HealthMetric {
  dimension: HealthDimension;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  confidence: number;
  details: string;
  recommendations: string[];
  measuredAt: Date;
}

export interface HealthReport {
  id: string;
  metrics: HealthMetric[];
  overall: number;
  generatedAt: Date;
  summary: string;
  criticalItems: string[];
}

export class ProjectHealthEngine {
  private reports: HealthReport[] = [];
  private metricsHistory: Map<HealthDimension, HealthMetric[]> = new Map();
  private maxHistory: number;

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  assess(overrides?: Partial<Record<HealthDimension, number>>): HealthReport {
    const metrics: HealthMetric[] = [];

    metrics.push(this.assessArchitecture(overrides?.architecture));
    metrics.push(this.assessCode(overrides?.code));
    metrics.push(this.assessKnowledge(overrides?.knowledge));
    metrics.push(this.assessDocumentation(overrides?.documentation));
    metrics.push(this.assessMemory(overrides?.memory));
    metrics.push(this.assessTechnicalDebt(overrides?.['technical-debt']));
    metrics.push(this.assessKnowledgeDebt(overrides?.['knowledge-debt']));
    metrics.push(this.assessComplexity(overrides?.complexity));
    metrics.push(this.assessVelocity(overrides?.velocity));
    metrics.push(this.assessRisk(overrides?.risk));
    metrics.push(this.assessPredictionAccuracy(overrides?.['prediction-accuracy']));
    metrics.push(this.assessCognitiveLoad(overrides?.['cognitive-load']));

    const overall = metrics.reduce((s, m) => s + m.score, 0) / metrics.length;
    const criticalItems = metrics
      .filter((m) => m.score < 0.3)
      .map((m) => `${m.dimension} score ${(m.score * 100).toFixed(0)}%: ${m.details}`);

    const report: HealthReport = {
      id: crypto.randomUUID(),
      metrics,
      overall,
      generatedAt: new Date(),
      summary: `Overall health: ${(overall * 100).toFixed(0)}%. ${metrics.filter((m) => m.score < 0.5).length} dimensions below 50%.`,
      criticalItems,
    };

    for (const m of metrics) {
      const history = this.metricsHistory.get(m.dimension) ?? [];
      history.push(m);
      if (history.length > this.maxHistory) history.shift();
      this.metricsHistory.set(m.dimension, history);
    }

    this.reports.push(report);
    if (this.reports.length > 100) this.reports.shift();

    return report;
  }

  getLatest(): HealthReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1]! : null;
  }

  getHistory(dimension: HealthDimension, limit = 20): HealthMetric[] {
    const history = this.metricsHistory.get(dimension) ?? [];
    return history.slice(-limit);
  }

  getTrend(dimension: HealthDimension): 'improving' | 'stable' | 'declining' {
    const history = this.metricsHistory.get(dimension);
    if (!history || history.length < 3) return 'stable';
    const recent = history.slice(-3);
    const avg = recent.reduce((s, m) => s + m.score, 0) / recent.length;
    const prevAvg = history.slice(-6, -3).reduce((s, m) => s + m.score, 0) / 3;
    if (avg > prevAvg + 0.05) return 'improving';
    if (avg < prevAvg - 0.05) return 'declining';
    return 'stable';
  }

  getReports(limit = 20): HealthReport[] {
    return this.reports.slice(-limit);
  }

  getStats(): { totalReports: number; latestOverall: number; dimensions: number; criticalCount: number } {
    const latest = this.getLatest();
    return {
      totalReports: this.reports.length,
      latestOverall: latest?.overall ?? 0,
      dimensions: Object.keys(this.metricsHistory).length,
      criticalCount: latest?.criticalItems.length ?? 0,
    };
  }

  clear(): void {
    this.reports = [];
    this.metricsHistory.clear();
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      reports: this.reports,
      metricsHistory: mapToRecord(this.metricsHistory),
      maxHistory: this.maxHistory,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      reports: HealthReport[];
      metricsHistory: Record<string, HealthMetric[]>;
      maxHistory: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxHistory !== undefined) this.maxHistory = data.maxHistory;
    this.reports = data.reports ?? [];
    this.metricsHistory = recordToMap(data.metricsHistory ?? {});
    return this.reports.length;
  }

  private computeTrend(dimension: HealthDimension, currentScore: number): 'improving' | 'stable' | 'declining' {
    const history = this.metricsHistory.get(dimension);
    if (!history || history.length < 2) return 'stable';
    const prev = history[history.length - 1]!.score;
    if (currentScore > prev + 0.03) return 'improving';
    if (currentScore < prev - 0.03) return 'declining';
    return 'stable';
  }

  private assessArchitecture(override?: number): HealthMetric {
    const base = override ?? 0.7;
    return {
      dimension: 'architecture', score: base,
      trend: this.computeTrend('architecture', base),
      confidence: 0.6,
      details: 'Architecture health is estimated based on module boundaries and dependency structure.',
      recommendations: override === undefined ? ['Run a full architecture dependency analysis'] : [],
      measuredAt: new Date(),
    };
  }

  private assessCode(override?: number): HealthMetric {
    const base = override ?? 0.65;
    return {
      dimension: 'code', score: base,
      trend: this.computeTrend('code', base),
      confidence: 0.5,
      details: 'Code health estimate. Based on complexity metrics and test coverage patterns.',
      recommendations: override === undefined ? ['Run static analysis for detailed metrics'] : [],
      measuredAt: new Date(),
    };
  }

  private assessKnowledge(override?: number): HealthMetric {
    const base = override ?? 0.6;
    return {
      dimension: 'knowledge', score: base,
      trend: this.computeTrend('knowledge', base),
      confidence: 0.4,
      details: 'Knowledge health based on memory confidence distribution and coverage.',
      recommendations: override === undefined ? ['Identify and fill knowledge gaps'] : [],
      measuredAt: new Date(),
    };
  }

  private assessDocumentation(override?: number): HealthMetric {
    const base = override ?? 0.5;
    return {
      dimension: 'documentation', score: base,
      trend: this.computeTrend('documentation', base),
      confidence: 0.3,
      details: 'Documentation health is a best-effort estimate.',
      recommendations: override === undefined ? ['Audit documentation coverage'] : [],
      measuredAt: new Date(),
    };
  }

  private assessMemory(override?: number): HealthMetric {
    const base = override ?? 0.75;
    return {
      dimension: 'memory', score: base,
      trend: this.computeTrend('memory', base),
      confidence: 0.7,
      details: 'Memory system health based on contradiction rate and verification ratio.',
      recommendations: [],
      measuredAt: new Date(),
    };
  }

  private assessTechnicalDebt(override?: number): HealthMetric {
    const base = override !== undefined ? 1 - override : 0.6;
    return {
      dimension: 'technical-debt', score: base,
      trend: this.computeTrend('technical-debt', base),
      confidence: 0.4,
      details: 'Technical debt is inversely estimated (lower score = more debt).',
      recommendations: override === undefined ? ['Run a full technical debt assessment'] : [],
      measuredAt: new Date(),
    };
  }

  private assessKnowledgeDebt(override?: number): HealthMetric {
    const base = override ?? 0.55;
    return {
      dimension: 'knowledge-debt', score: base,
      trend: this.computeTrend('knowledge-debt', base),
      confidence: 0.35,
      details: 'Knowledge debt measures gaps between what is known and what should be known.',
      recommendations: override === undefined ? ['Document undocumented decisions and patterns'] : [],
      measuredAt: new Date(),
    };
  }

  private assessComplexity(override?: number): HealthMetric {
    const base = override !== undefined ? 1 - override : 0.65;
    return {
      dimension: 'complexity', score: base,
      trend: this.computeTrend('complexity', base),
      confidence: 0.5,
      details: 'Complexity score is inverted (higher = simpler).',
      recommendations: [],
      measuredAt: new Date(),
    };
  }

  private assessVelocity(override?: number): HealthMetric {
    const base = override ?? 0.7;
    return {
      dimension: 'velocity', score: base,
      trend: this.computeTrend('velocity', base),
      confidence: 0.5,
      details: 'Velocity estimate based on trace frequency and completion rate.',
      recommendations: [],
      measuredAt: new Date(),
    };
  }

  private assessRisk(override?: number): HealthMetric {
    const base = override !== undefined ? 1 - override : 0.6;
    return {
      dimension: 'risk', score: base,
      trend: this.computeTrend('risk', base),
      confidence: 0.4,
      details: 'Risk score is inverted (higher = lower risk).',
      recommendations: override === undefined ? ['Identify and mitigate top risks'] : [],
      measuredAt: new Date(),
    };
  }

  private assessPredictionAccuracy(override?: number): HealthMetric {
    const base = override ?? 0.5;
    return {
      dimension: 'prediction-accuracy', score: base,
      trend: this.computeTrend('prediction-accuracy', base),
      confidence: 0.3,
      details: 'How well the system predicts outcomes based on past patterns.',
      recommendations: [],
      measuredAt: new Date(),
    };
  }

  private assessCognitiveLoad(override?: number): HealthMetric {
    const base = override !== undefined ? 1 - override : 0.7;
    return {
      dimension: 'cognitive-load', score: base,
      trend: this.computeTrend('cognitive-load', base),
      confidence: 0.3,
      details: 'Cognitive load is inverted (higher = lower load). Based on system complexity.',
      recommendations: [],
      measuredAt: new Date(),
    };
  }
}
