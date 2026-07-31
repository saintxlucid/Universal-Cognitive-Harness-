export interface SkillProficiency {
  skillId: string;
  confidence: number;
  invocationCount: number;
  lastInvoked: Date;
}

export interface ConfidenceDistribution {
  sourceId: string;
  meanConfidence: number;
  sampleCount: number;
  trend: 'improving' | 'stable' | 'declining';
}

export class AdaptiveGenome {
  private skills: Map<string, SkillProficiency> = new Map();
  private confidenceDists: Map<string, ConfidenceDistribution> = new Map();
  private adaptationLog: string[] = [];
  private readonly maxLogSize = 50;

  recordSkillUsage(skillId: string, success: boolean): void {
    const existing = this.skills.get(skillId);
    if (existing) {
      existing.invocationCount++;
      existing.lastInvoked = new Date();
      existing.confidence = success ? Math.min(1, existing.confidence + 0.05) : Math.max(0, existing.confidence - 0.1);
    } else {
      this.skills.set(skillId, { skillId, confidence: success ? 0.3 : 0.1, invocationCount: 1, lastInvoked: new Date() });
    }
  }

  recordConfidence(sourceId: string, confidence: number): void {
    const existing = this.confidenceDists.get(sourceId);
    if (existing) {
      const newMean = (existing.meanConfidence * existing.sampleCount + confidence) / (existing.sampleCount + 1);
      existing.meanConfidence = newMean;
      existing.sampleCount++;
      existing.trend = confidence > existing.meanConfidence ? 'improving' : confidence < existing.meanConfidence ? 'declining' : 'stable';
    } else {
      this.confidenceDists.set(sourceId, { sourceId, meanConfidence: confidence, sampleCount: 1, trend: 'stable' });
    }
  }

  recordAdaptation(description: string): void {
    this.adaptationLog.push(`[${new Date().toISOString()}] ${description}`);
    if (this.adaptationLog.length > this.maxLogSize) this.adaptationLog.shift();
  }

  getSkillProficiencies(): SkillProficiency[] { return [...this.skills.values()]; }
  getConfidenceDistributions(): ConfidenceDistribution[] { return [...this.confidenceDists.values()]; }
  getAdaptationHistory(): string[] { return [...this.adaptationLog]; }

  getStats() {
    return { trackedSkills: this.skills.size, confidenceSources: this.confidenceDists.size, recentAdaptations: this.adaptationLog.length };
  }
}
