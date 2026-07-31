import { EventLedger } from '../cognitive-recorder/event-ledger.js';
import type { CognitiveActivity } from '../cognitive-recorder/cognitive-activity.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';

export interface ReflectionReport {
  timestamp: Date;
  session_summary: string;
  patterns_observed: string[];
  anomalies_detected: string[];
  recommendations: string[];
  strategic_insights: string[];
}

export interface PredictionResult {
  predicted_type: string;
  confidence: number;
  context_basis: string[];
}

export class Conscience {
  private ledger: EventLedger;
  private kernel: CognitiveKernel;

  constructor(ledger: EventLedger, kernel: CognitiveKernel) {
    this.ledger = ledger;
    this.kernel = kernel;
  }

  async reflect(sessionId: string, _agentId: string): Promise<ReflectionReport> {
    const activities = this.ledger.getBySession(sessionId);
    const stats = this.kernel.getStats();
    const recent = this.ledger.getRecent(10);

    const typeCounts: Record<string, number> = {};
    for (const a of activities) {
      typeCounts[a.type] = (typeCounts[a.type] ?? 0) + 1;
    }

    const dominantTypes = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([t]) => t);

    const patterns = this.detectPatterns(activities);
    const anomalies = this.detectAnomalies(activities);
    const engineeredRecommendations = this.generateEngineeringRecommendations(
      recent,
      patterns,
      anomalies,
    );

    const strategicInsights = this.generateStrategicInsights(recent, patterns, anomalies);

    const report: ReflectionReport = {
      timestamp: new Date(),
      session_summary: [
        `Session ${sessionId}: ${activities.length} activities across ${Object.keys(typeCounts).length} types.`,
        `Dominant: ${dominantTypes.join(', ')}.`,
        `Brain state: ${stats.episodes} episodes, ${stats.concepts} concepts, ${stats.beliefs} beliefs.`,
      ].join(' '),
      patterns_observed: patterns,
      anomalies_detected: anomalies,
      recommendations: this.generateRecommendations(patterns, anomalies).concat(
        engineeredRecommendations,
      ),
      strategic_insights: strategicInsights,
    };

    return report;
  }

  async predict(agentId: string, context: string[]): Promise<PredictionResult> {
    const recent = this.ledger.getRecent(20);
    const typeSequence = recent.map((a) => a.type);

    const adjacent: Record<string, Record<string, number>> = {};
    for (let i = 0; i < typeSequence.length - 1; i++) {
      const current = typeSequence[i]!;
      const next = typeSequence[i + 1]!;
      if (!adjacent[current]) adjacent[current] = {};
      adjacent[current]![next] = (adjacent[current]![next] ?? 0) + 1;
    }

    const lastType = typeSequence[typeSequence.length - 1];
    const predictions = adjacent[lastType ?? ''];
    let predictedType = 'observe';
    let maxCount = 0;

    if (predictions) {
      for (const [type, count] of Object.entries(predictions)) {
        if (count > maxCount) {
          maxCount = count;
          predictedType = type;
        }
      }
    }

    return {
      predicted_type: predictedType,
      confidence: recent.length > 0 ? maxCount / recent.length : 0.1,
      context_basis: context,
    };
  }

  private detectPatterns(activities: CognitiveActivity[]): string[] {
    const patterns: string[] = [];
    const sequence = activities.map((a) => a.type);

    const consecutive: Record<string, number> = {};
    let currentRun = 1;
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i] === sequence[i - 1]) {
        currentRun++;
      } else {
        if (currentRun > 2) {
          consecutive[sequence[i - 1]!] = Math.max(consecutive[sequence[i - 1]!] ?? 0, currentRun);
        }
        currentRun = 1;
      }
    }
    if (currentRun > 2) {
      consecutive[sequence[sequence.length - 1]!] = Math.max(
        consecutive[sequence[sequence.length - 1]!] ?? 0,
        currentRun,
      );
    }

    for (const [type, count] of Object.entries(consecutive)) {
      patterns.push(`Repetitive ${type} activity (${count} consecutive)`);
    }

    if (
      activities.some((a) => a.type === 'observe') &&
      activities.some((a) => a.type === 'plan') &&
      activities.some((a) => a.type === 'execute')
    ) {
      patterns.push('Observe-Plan-Execute cycle detected');
    }

    return patterns;
  }

  private detectAnomalies(activities: CognitiveActivity[]): string[] {
    const anomalies: string[] = [];
    const failures = activities.filter((a) => a.outcome.status === 'failure');

    if (failures.length > 3) {
      anomalies.push(
        `High failure rate: ${failures.length} failures in ${activities.length} activities`,
      );
    }

    const errorTags = activities.filter((a) => a.tags?.some((t) => t.startsWith('error')));
    if (errorTags.length > 0) {
      anomalies.push(`${errorTags.length} error-tagged activities detected`);
    }

    return anomalies;
  }

  private generateRecommendations(patterns: string[], anomalies: string[]): string[] {
    const recommendations: string[] = [];
    if (patterns.some((p) => p.includes('Repetitive'))) {
      recommendations.push('Consider consolidating repetitive activity patterns');
    }
    if (anomalies.some((a) => a.includes('failure'))) {
      recommendations.push('Review recent failures for systemic issues');
    }
    if (recommendations.length === 0) {
      recommendations.push('No immediate recommendations — pattern baseline looks stable');
    }
    return recommendations;
  }

  private generateStrategicInsights(
    recent: CognitiveActivity[],
    patterns: string[],
    anomalies: string[],
  ): string[] {
    const insights: string[] = [];

    if (
      recent.some(
        (activity) => activity.type === 'execute' && activity.outcome.status === 'failure',
      )
    ) {
      insights.push(
        'Execution failures suggest the workflow needs a stronger pre-flight validation gate.',
      );
    }

    if (patterns.some((pattern) => pattern.includes('Observe-Plan-Execute'))) {
      insights.push(
        'The observe-plan-execute loop is healthy; the next gain is tighter verification between plan and execution.',
      );
    }

    if (anomalies.some((anomaly) => anomaly.includes('failure'))) {
      insights.push(
        'Repeated failure patterns indicate a shared abstraction or process should be reviewed, not just patched locally.',
      );
    }

    if (insights.length === 0) {
      insights.push(
        'The current session is stable; preserve the rhythm and keep the review loop lightweight.',
      );
    }

    return insights;
  }

  private generateEngineeringRecommendations(
    recent: CognitiveActivity[],
    patterns: string[],
    anomalies: string[],
  ): string[] {
    const recommendations: string[] = [];

    if (
      recent.some(
        (activity) => activity.type === 'execute' && activity.outcome.status === 'failure',
      )
    ) {
      recommendations.push(
        'Introduce a rollback or mitigation plan for repeated execution failures',
      );
    }

    if (patterns.some((pattern) => pattern.includes('Observe-Plan-Execute'))) {
      recommendations.push(
        'Preserve the observe-plan-execute loop and add explicit verification before execution',
      );
    }

    if (anomalies.some((anomaly) => anomaly.includes('failure'))) {
      recommendations.push(
        'Treat failures as architectural signals and inspect shared abstractions before changing behavior',
      );
    }

    return recommendations;
  }
}
