import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { BeliefSet } from '../kernel/constitution/epistemology.js';
import { assessTruth, classifyEpistemicStatus } from '../kernel/constitution/epistemology.js';

export interface WorldFact {
  statement: string;
  confidence: number;
  epistemicStatus: string;
  entrenchment: number;
  evidenceCount: number;
  contradictionCount: number;
}

export interface Prediction {
  hypothesis: string;
  confidence: number;
  outcome: 'pending' | 'confirmed' | 'refuted';
  evidence: string[];
}

export class WorldModel {
  private kernel: CognitiveKernel;
  private predictions: Prediction[] = [];

  constructor(kernel: CognitiveKernel) {
    this.kernel = kernel;
  }

  getBeliefs(): BeliefSet {
    return this.kernel.getBeliefs();
  }

  listFacts(): WorldFact[] {
    const beliefs = this.kernel.getBeliefs();
    const facts: WorldFact[] = [];
    for (const [, prop] of beliefs.propositions) {
      facts.push({
        statement: prop.value,
        confidence: prop.confidence.value,
        epistemicStatus: classifyEpistemicStatus(prop.confidence.value, prop.evidence.length, prop.contradictions.length > 0),
        entrenchment: prop.entrenchment,
        evidenceCount: prop.evidence.length,
        contradictionCount: prop.contradictions.length,
      });
    }
    return facts.sort((a, b) => b.confidence - a.confidence);
  }

  async learn(proposition: string, evidence: string, sourceReliability: number): Promise<void> {
    await this.kernel.learnEvidence(proposition, evidence, sourceReliability);
  }

  predict(hypothesis: string, confidence: number): Prediction {
    const prediction: Prediction = { hypothesis, confidence, outcome: 'pending', evidence: [] };
    this.predictions.push(prediction);
    return prediction;
  }

  confirmPrediction(hypothesis: string, evidence: string): void {
    const pred = this.predictions.find((p) => p.hypothesis === hypothesis && p.outcome === 'pending');
    if (pred) {
      pred.outcome = 'confirmed';
      pred.evidence.push(evidence);
    }
  }

  refutePrediction(hypothesis: string, evidence: string): void {
    const pred = this.predictions.find((p) => p.hypothesis === hypothesis && p.outcome === 'pending');
    if (pred) {
      pred.outcome = 'refuted';
      pred.evidence.push(evidence);
    }
  }

  truthScore(proposition: string, pragmaticSuccess: number, coherenceScore: number, consensusScore: number): number {
    const contradictionResult = this.kernel.getBeliefs().propositions.has(proposition) ? 0.5 : 0;
    return assessTruth(proposition, pragmaticSuccess, coherenceScore, contradictionResult, consensusScore);
  }

  listPredictions(): Prediction[] {
    return [...this.predictions];
  }
}
