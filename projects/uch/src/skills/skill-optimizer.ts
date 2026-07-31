import type { SkillInvocation } from '../cognitive-memory/skill-registry.js';

export interface SkillOptimizationSuggestion {
  skillId: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface SkillOptimizationReport {
  skillId: string;
  invocationsAnalyzed: number;
  successRate: number;
  averageDurationMs: number;
  suggestions: SkillOptimizationSuggestion[];
  recommendedVersionBump: boolean;
}

export interface SkillOptimizerOptions {
  minInvocationsForSignal?: number;
  lowSuccessThreshold?: number;
  slowThresholdMs?: number;
}

const DEFAULT_OPTIONS: Required<SkillOptimizerOptions> = {
  minInvocationsForSignal: 3,
  lowSuccessThreshold: 0.6,
  slowThresholdMs: 120_000,
};

export class SkillOptimizer {
  private options: Required<SkillOptimizerOptions>;

  constructor(options: SkillOptimizerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  analyze(skillId: string, invocations: SkillInvocation[]): SkillOptimizationReport {
    const relevant = invocations.filter((i) => i.skill_id === skillId);
    const suggestions: SkillOptimizationSuggestion[] = [];

    if (relevant.length === 0) {
      return {
        skillId,
        invocationsAnalyzed: 0,
        successRate: 1,
        averageDurationMs: 0,
        suggestions: [
          {
            skillId,
            issue: 'no-invocations',
            severity: 'low',
            recommendation: 'Skill has never been invoked; verify trigger patterns match real user input.',
          },
        ],
        recommendedVersionBump: false,
      };
    }

    const successRate = relevant.filter((i) => i.success).length / relevant.length;
    const averageDurationMs =
      relevant.reduce((sum, i) => sum + i.duration_ms, 0) / relevant.length;

    if (relevant.length >= this.options.minInvocationsForSignal && successRate < this.options.lowSuccessThreshold) {
      suggestions.push({
        skillId,
        issue: 'low-success-rate',
        severity: 'high',
        recommendation: `Success rate ${(successRate * 100).toFixed(0)}% across ${relevant.length} invocations. Review the skill instructions and tighten preconditions before invoking.`,
      });
    }

    if (averageDurationMs > this.options.slowThresholdMs) {
      suggestions.push({
        skillId,
        issue: 'slow-execution',
        severity: 'medium',
        recommendation: `Average duration ${(averageDurationMs / 1000).toFixed(0)}s exceeds ${this.options.slowThresholdMs / 1000}s. Simplify the workflow or parallelize independent steps.`,
      });
    }

    const shortInputs = relevant.filter((i) => i.input.trim().split(/\s+/).length < 5).length;
    if (relevant.length >= this.options.minInvocationsForSignal && shortInputs / relevant.length > 0.5) {
      suggestions.push({
        skillId,
        issue: 'under-specified-inputs',
        severity: 'low',
        recommendation: 'Most invocations receive very short inputs; expand trigger patterns or document required parameters.',
      });
    }

    return {
      skillId,
      invocationsAnalyzed: relevant.length,
      successRate,
      averageDurationMs,
      suggestions,
      recommendedVersionBump: suggestions.some((s) => s.severity === 'high'),
    };
  }

  analyzeAll(invocations: SkillInvocation[]): SkillOptimizationReport[] {
    const ids = new Set(invocations.map((i) => i.skill_id));
    const reports: SkillOptimizationReport[] = [];
    for (const id of ids) {
      reports.push(this.analyze(id, invocations));
    }
    return reports.sort((a, b) => b.suggestions.length - a.suggestions.length);
  }
}
