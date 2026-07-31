import { ActivationField } from '../activation/activation-field.js';

export type ClaimClass = 'descriptive' | 'predictive' | 'normative';
export type PredictionType = 'state' | 'outcome' | 'risk' | 'preference' | 'counterfactual';
export type ModelVersionStatus = 'draft' | 'shadow' | 'active' | 'revised' | 'retired';
export type PredictionStatus = 'pending' | 'correct' | 'incorrect' | 'abstained';

export interface StateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  unit?: string;
  validityMs?: number;
}

export interface WorldModelDeclaration {
  id: string;
  name: string;
  domain: string;
  scope: string[];
  owner: string;
  accessPolicy: string;
  stateVariables: StateVariable[];
  acceptedObservations: string[];
  assumptions: string[];
  unknowns: string[];
  horizonMs: number;
  predictionTypes: PredictionType[];
  calibrationTarget: number;
}

export interface WorldModelObservation {
  id: string;
  claim: string;
  claimClass: ClaimClass;
  topic: string;
  evidenceRef?: string;
  confidence: number;
  source: string;
  observedAt: number;
  variables?: Record<string, unknown>;
}

export interface WorldModelVersion {
  number: number;
  status: ModelVersionStatus;
  supersedes: number | null;
  supersededBy: number | null;
  observations: WorldModelObservation[];
  assumptions: string[];
  unknowns: string[];
  createdAt: number;
  revisionReason: string | null;
}

export interface WorldModelPrediction {
  id: string;
  modelId: string;
  version: number;
  type: PredictionType;
  prediction: string;
  confidence: number;
  madeAt: number;
  outcomeAt: number | null;
  status: PredictionStatus;
  measuredOutcome: string | null;
  evidenceRefs: string[];
}

export interface Generalization {
  id: string;
  modelId: string;
  variable: string;
  value: unknown;
  category: string;
  claim: string;
  confidence: number;
  supportCount: number;
}

export interface WorldModelEngineConfig {
  field?: ActivationField;
  categoryOf?: (value: unknown, variable: string) => string;
}

export interface WorldModelStats {
  modelId: string;
  versionCount: number;
  activeVersion: number | null;
  shadowVersion: number | null;
  observationCount: number;
  descriptiveCount: number;
  predictiveCount: number;
  normativeCount: number;
  predictionCount: number;
  pendingCount: number;
  correctCount: number;
  incorrectCount: number;
  abstainedCount: number;
  calibration: number | null;
  freshness: number;
  coverage: number;
  generalizations: number;
}

export class UnknownObservationTopicError extends Error {
  constructor(modelId: string, topic: string) {
    super(`Observation topic '${topic}' is not accepted by model '${modelId}'`);
    this.name = 'UnknownObservationTopicError';
  }
}

export class NoActiveVersionError extends Error {
  constructor(modelId: string) {
    super(`Model '${modelId}' has no active version`);
    this.name = 'NoActiveVersionError';
  }
}

export class UnscopedModelError extends Error {
  constructor() {
    super('A model with no declared scope is not eligible for high-impact use');
    this.name = 'UnscopedModelError';
  }
}

export class UndeclaredPredictionTypeError extends Error {
  constructor(modelId: string, type: string) {
    super(`Prediction type '${type}' is not declared by model '${modelId}'`);
    this.name = 'UndeclaredPredictionTypeError';
  }
}

export class WorldModelEngine {
  private models: Map<string, WorldModelDeclaration> = new Map();
  private versions: Map<string, WorldModelVersion[]> = new Map();
  private observations: Map<string, WorldModelObservation[]> = new Map();
  private predictions: Map<string, WorldModelPrediction[]> = new Map();
  private generalizations: Map<string, Generalization[]> = new Map();
  private correctCount: Map<string, number> = new Map();
  private incorrectCount: Map<string, number> = new Map();
  private abstainedCount: Map<string, number> = new Map();
  private field?: ActivationField;
  private categoryOf?: (value: unknown, variable: string) => string;

  constructor(config?: WorldModelEngineConfig) {
    this.field = config?.field;
    this.categoryOf = config?.categoryOf;
  }

  declareModel(declaration: WorldModelDeclaration): WorldModelDeclaration {
    if (!declaration.domain || declaration.scope.length === 0 || !declaration.owner) {
      throw new UnscopedModelError();
    }
    if (declaration.predictionTypes.length === 0) {
      throw new UndeclaredPredictionTypeError(declaration.id, '(none declared)');
    }
    this.models.set(declaration.id, declaration);
    this.versions.set(declaration.id, [{
      number: 1,
      status: 'draft',
      supersedes: null,
      supersededBy: null,
      observations: [],
      assumptions: [...declaration.assumptions],
      unknowns: [...declaration.unknowns],
      createdAt: Date.now(),
      revisionReason: null,
    }]);
    this.observations.set(declaration.id, []);
    this.predictions.set(declaration.id, []);
    this.generalizations.set(declaration.id, []);
    this.correctCount.set(declaration.id, 0);
    this.incorrectCount.set(declaration.id, 0);
    this.abstainedCount.set(declaration.id, 0);
    if (this.field) {
      this.field.register({
        id: declaration.id,
        label: declaration.name,
        kind: 'world-model',
        activation: 0.1,
      });
    }
    return declaration;
  }

  getModel(modelId: string): WorldModelDeclaration | undefined {
    return this.models.get(modelId);
  }

  listModels(): WorldModelDeclaration[] {
    return [...this.models.values()];
  }

  ingestObservation(modelId: string, observation: WorldModelObservation): WorldModelObservation {
    const declaration = this.models.get(modelId);
    if (!declaration) throw new NoActiveVersionError(modelId);
    if (!declaration.acceptedObservations.includes(observation.topic)) {
      throw new UnknownObservationTopicError(modelId, observation.topic);
    }
    const version = this.getActiveVersion(modelId);
    if (!version) throw new NoActiveVersionError(modelId);
    version.observations.push(observation);
    this.observations.get(modelId)!.push(observation);
    return observation;
  }

  proposeUpdate(modelId: string, reason: string): WorldModelVersion {
    const declaration = this.models.get(modelId);
    if (!declaration) throw new NoActiveVersionError(modelId);
    const versions = this.versions.get(modelId)!;
    if (versions.some((v) => v.status === 'shadow')) {
      throw new Error(`Model '${modelId}' already has a shadow version awaiting evaluation`);
    }
    const active = versions.find((v) => v.status === 'active');
    const base = active ?? versions[0]!;
    const version: WorldModelVersion = {
      number: base.number + 1,
      status: 'shadow',
      supersedes: base.number,
      supersededBy: null,
      observations: [...base.observations],
      assumptions: [...declaration.assumptions],
      unknowns: [...declaration.unknowns],
      createdAt: Date.now(),
      revisionReason: reason,
    };
    versions.push(version);
    return version;
  }

  promote(modelId: string, versionNumber: number): WorldModelVersion {
    const versions = this.versions.get(modelId);
    if (!versions) throw new NoActiveVersionError(modelId);
    const candidate = versions.find((v) => v.number === versionNumber && (v.status === 'shadow' || v.status === 'draft'));
    if (!candidate) throw new Error(`No activatable version ${versionNumber} for model '${modelId}'`);
    for (const version of versions) {
      if (version.status === 'active') {
        version.status = 'revised';
        version.supersededBy = versionNumber;
      }
    }
    candidate.status = 'active';
    return candidate;
  }

  supersede(modelId: string, reason: string): WorldModelVersion {
    const declaration = this.models.get(modelId);
    const versions = this.versions.get(modelId);
    if (!declaration || !versions) throw new NoActiveVersionError(modelId);
    const active = versions.find((v) => v.status === 'active');
    const base = active ?? versions[versions.length - 1]!;
    base.status = 'retired';
    const successor: WorldModelVersion = {
      number: base.number + 1,
      status: 'active',
      supersedes: base.number,
      supersededBy: null,
      observations: [...base.observations],
      assumptions: [...declaration.assumptions],
      unknowns: [...declaration.unknowns],
      createdAt: Date.now(),
      revisionReason: reason,
    };
    versions.push(successor);
    return successor;
  }

  reject(modelId: string, versionNumber: number): void {
    const versions = this.versions.get(modelId);
    if (!versions) return;
    const index = versions.findIndex((v) => v.number === versionNumber && v.status === 'shadow');
    if (index >= 0) versions.splice(index, 1);
  }

  getVersion(modelId: string, versionNumber: number): WorldModelVersion | undefined {
    return this.versions.get(modelId)?.find((v) => v.number === versionNumber);
  }

  predict(modelId: string, params: {
    type: PredictionType;
    prediction: string;
    confidence: number;
    outcomeAt?: number;
    evidenceRefs?: string[];
  }): WorldModelPrediction {
    const declaration = this.models.get(modelId);
    if (!declaration) throw new NoActiveVersionError(modelId);
    if (!declaration.predictionTypes.includes(params.type)) {
      throw new UndeclaredPredictionTypeError(modelId, params.type);
    }
    const version = this.getActiveVersion(modelId);
    if (!version) throw new NoActiveVersionError(modelId);
    const prediction: WorldModelPrediction = {
      id: crypto.randomUUID(),
      modelId,
      version: version.number,
      type: params.type,
      prediction: params.prediction,
      confidence: clamp01(params.confidence),
      madeAt: Date.now(),
      outcomeAt: params.outcomeAt ?? null,
      status: 'pending',
      measuredOutcome: null,
      evidenceRefs: params.evidenceRefs ?? [],
    };
    this.predictions.get(modelId)!.push(prediction);
    if (this.field) {
      this.field.spike(modelId, 0.3);
    }
    return prediction;
  }

  recordOutcome(predictionId: string, measuredOutcome: string, correct: boolean): WorldModelPrediction {
    for (const [modelId, list] of this.predictions) {
      const prediction = list.find((p) => p.id === predictionId);
      if (!prediction) continue;
      if (prediction.status !== 'pending') return prediction;
      prediction.status = correct ? 'correct' : 'incorrect';
      prediction.measuredOutcome = measuredOutcome;
      if (correct) {
        this.correctCount.set(modelId, (this.correctCount.get(modelId) ?? 0) + 1);
      } else {
        this.incorrectCount.set(modelId, (this.incorrectCount.get(modelId) ?? 0) + 1);
      }
      if (this.field) {
        this.field.recordPrediction(modelId, prediction.confidence, correct);
      }
      return prediction;
    }
    throw new Error(`Unknown prediction: ${predictionId}`);
  }

  recordAbstention(predictionId: string, reason: string): WorldModelPrediction {
    for (const [modelId, list] of this.predictions) {
      const prediction = list.find((p) => p.id === predictionId);
      if (!prediction) continue;
      if (prediction.status !== 'pending') return prediction;
      prediction.status = 'abstained';
      prediction.measuredOutcome = reason;
      this.abstainedCount.set(modelId, (this.abstainedCount.get(modelId) ?? 0) + 1);
      return prediction;
    }
    throw new Error(`Unknown prediction: ${predictionId}`);
  }

  getPredictions(modelId: string): WorldModelPrediction[] {
    return this.predictions.get(modelId) ?? [];
  }

  getCalibration(modelId: string): number | null {
    const correct = this.correctCount.get(modelId) ?? 0;
    const incorrect = this.incorrectCount.get(modelId) ?? 0;
    const total = correct + incorrect;
    return total === 0 ? null : correct / total;
  }

  generalize(modelId: string, variable: string, minSupport = 2, minConsistency = 0.8): Generalization | null {
    const declaration = this.models.get(modelId);
    if (!declaration) throw new NoActiveVersionError(modelId);
    const observations = this.observations.get(modelId)!;
    const groups = new Map<string, { value: unknown; count: number }>();
    let totalWithVariable = 0;
    for (const observation of observations) {
      if (observation.variables === undefined || !(variable in observation.variables)) continue;
      totalWithVariable += 1;
      const raw = observation.variables[variable];
      const key = this.categorize(raw, variable);
      const entry = groups.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        groups.set(key, { value: raw, count: 1 });
      }
    }
    if (totalWithVariable < minSupport) return null;
    let best: { value: unknown; count: number } | null = null;
    for (const entry of groups.values()) {
      if (!best || entry.count > best.count) best = entry;
    }
    if (!best) return null;
    const consistency = best.count / totalWithVariable;
    if (consistency < minConsistency) return null;
    const category = this.categorize(best.value, variable);
    const generalization: Generalization = {
      id: crypto.randomUUID(),
      modelId,
      variable,
      value: best.value,
      category,
      claim: `${variable} consistently maps to ${category} (${best.count}/${totalWithVariable})`,
      confidence: consistency,
      supportCount: best.count,
    };
    this.generalizations.get(modelId)!.push(generalization);
    return generalization;
  }

  getGeneralizations(modelId: string): Generalization[] {
    return this.generalizations.get(modelId) ?? [];
  }

  getStats(modelId: string): WorldModelStats {
    const declaration = this.models.get(modelId);
    const versions = this.versions.get(modelId) ?? [];
    const observations = this.observations.get(modelId) ?? [];
    const predictions = this.predictions.get(modelId) ?? [];
    const active = versions.find((v) => v.status === 'active');
    const shadow = versions.find((v) => v.status === 'shadow');
    const pending = predictions.filter((p) => p.status === 'pending').length;
    const correct = this.correctCount.get(modelId) ?? 0;
    const incorrect = this.incorrectCount.get(modelId) ?? 0;
    const abstained = this.abstainedCount.get(modelId) ?? 0;
    const calibration = correct + incorrect === 0 ? null : correct / (correct + incorrect);
    const topicsObserved = new Set(observations.map((o) => o.topic)).size;
    return {
      modelId,
      versionCount: versions.length,
      activeVersion: active?.number ?? null,
      shadowVersion: shadow?.number ?? null,
      observationCount: observations.length,
      descriptiveCount: observations.filter((o) => o.claimClass === 'descriptive').length,
      predictiveCount: observations.filter((o) => o.claimClass === 'predictive').length,
      normativeCount: observations.filter((o) => o.claimClass === 'normative').length,
      predictionCount: predictions.length,
      pendingCount: pending,
      correctCount: correct,
      incorrectCount: incorrect,
      abstainedCount: abstained,
      calibration,
      freshness: declaration ? clamp01(1 - (Date.now() - (observations.at(-1)?.observedAt ?? Date.now())) / declaration.horizonMs) : 0,
      coverage: declaration ? topicsObserved / declaration.acceptedObservations.length : 0,
      generalizations: (this.generalizations.get(modelId) ?? []).length,
    };
  }

  private getActiveVersion(modelId: string): WorldModelVersion | undefined {
    return this.versions.get(modelId)?.find((v) => v.status === 'active');
  }

  private categorize(value: unknown, variable: string): string {
    if (this.categoryOf) {
      const category = this.categoryOf(value, variable);
      if (category !== '') return category;
    }
    return JSON.stringify(value);
  }
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
