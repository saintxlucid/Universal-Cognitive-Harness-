import { describe, it, expect } from 'vitest';
import {
  WorldModelEngine,
  UnscopedModelError,
  UnknownObservationTopicError,
  NoActiveVersionError,
  UndeclaredPredictionTypeError,
  type WorldModelDeclaration,
} from '../world-model/world-model.js';
import { ActivationField } from '../activation/activation-field.js';
import { CognitiveKernel } from '../cognitive-kernel.js';

function makeDeclaration(overrides?: Partial<WorldModelDeclaration>): WorldModelDeclaration {
  return {
    id: 'wm:user-prefs',
    name: 'User Language Preferences',
    domain: 'programming-languages',
    scope: ['workspace:daira', 'person:karim'],
    owner: 'karim',
    accessPolicy: 'owner-read-write',
    stateVariables: [
      { name: 'language', type: 'enum', validityMs: 0 },
      { name: 'ecosystem', type: 'enum' },
    ],
    acceptedObservations: ['preference', 'skill', 'project'],
    assumptions: ['preferences are stable over the horizon'],
    unknowns: ['future language exposure'],
    horizonMs: 86_400_000,
    predictionTypes: ['preference', 'outcome', 'risk'],
    calibrationTarget: 0.8,
    ...overrides,
  };
}

describe('WorldModelEngine', () => {
  it('declares a model and creates a draft version', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    expect(engine.getModel('wm:user-prefs')!.domain).toBe('programming-languages');
    expect(engine.getVersion('wm:user-prefs', 1)!.status).toBe('draft');
    expect(engine.listModels()).toHaveLength(1);
  });

  it('rejects unscoped models (no domain, scope or owner)', () => {
    const engine = new WorldModelEngine();
    expect(() => engine.declareModel(makeDeclaration({ scope: [] }))).toThrow(UnscopedModelError);
    expect(() => engine.declareModel(makeDeclaration({ domain: '' }))).toThrow(UnscopedModelError);
    expect(() => engine.declareModel(makeDeclaration({ owner: '' }))).toThrow(UnscopedModelError);
  });

  it('rejects models with no declared prediction types', () => {
    const engine = new WorldModelEngine();
    expect(() => engine.declareModel(makeDeclaration({ predictionTypes: [] }))).toThrow(UndeclaredPredictionTypeError);
  });

  it('ingests observations only for accepted topics', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const observation = {
      id: 'obs1',
      claim: 'Karim likes Rust',
      claimClass: 'descriptive' as const,
      topic: 'preference',
      confidence: 0.9,
      source: 'conversation',
      observedAt: Date.now(),
    };
    engine.ingestObservation('wm:user-prefs', observation);
    expect(() => engine.ingestObservation('wm:user-prefs', { ...observation, id: 'obs2', topic: 'unrelated' }))
      .toThrow(UnknownObservationTopicError);
  });

  it('requires an active version before observations or predictions', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    const observation = {
      id: 'obs1',
      claim: 'x',
      claimClass: 'descriptive' as const,
      topic: 'preference',
      confidence: 0.5,
      source: 's',
      observedAt: Date.now(),
    };
    expect(() => engine.ingestObservation('wm:user-prefs', observation)).toThrow(NoActiveVersionError);
    expect(() => engine.predict('wm:user-prefs', { type: 'preference', prediction: 'x', confidence: 0.5 }))
      .toThrow(NoActiveVersionError);
  });

  it('tracks the three claim classes without converting between them', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const base = { topic: 'preference', confidence: 0.5, source: 's', observedAt: Date.now() };
    engine.ingestObservation('wm:user-prefs', { id: 'd', claim: 'saw rust usage', claimClass: 'descriptive', ...base });
    engine.ingestObservation('wm:user-prefs', { id: 'p', claim: 'will enjoy zig', claimClass: 'predictive', ...base });
    engine.ingestObservation('wm:user-prefs', { id: 'n', claim: 'avoid breaking changes', claimClass: 'normative', ...base });
    const stats = engine.getStats('wm:user-prefs');
    expect(stats.descriptiveCount).toBe(1);
    expect(stats.predictiveCount).toBe(1);
    expect(stats.normativeCount).toBe(1);
  });

  it('proposes shadow versions and promotes them to active', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const shadow = engine.proposeUpdate('wm:user-prefs', 'new evidence');
    expect(shadow.status).toBe('shadow');
    expect(shadow.supersedes).toBe(1);
    const promoted = engine.promote('wm:user-prefs', 2);
    expect(promoted.status).toBe('active');
    expect(engine.getVersion('wm:user-prefs', 1)!.status).toBe('revised');
    expect(engine.getVersion('wm:user-prefs', 1)!.supersededBy).toBe(2);
  });

  it('rejects only one shadow version at a time', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    engine.proposeUpdate('wm:user-prefs', 'first');
    expect(() => engine.proposeUpdate('wm:user-prefs', 'second')).toThrow(/already has a shadow/);
  });

  it('rejects shadow candidates', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    engine.proposeUpdate('wm:user-prefs', 'bad idea');
    engine.reject('wm:user-prefs', 2);
    expect(engine.getVersion('wm:user-prefs', 2)).toBeUndefined();
  });

  it('supersedes the active version with a successor', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const successor = engine.supersede('wm:user-prefs', 'world changed');
    expect(successor.status).toBe('active');
    expect(successor.supersedes).toBe(1);
    expect(engine.getVersion('wm:user-prefs', 1)!.status).toBe('retired');
  });

  it('enforces declared prediction types', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    expect(() => engine.predict('wm:user-prefs', { type: 'counterfactual', prediction: 'x', confidence: 0.5 }))
      .toThrow(UndeclaredPredictionTypeError);
  });

  it('records prediction outcomes and measures calibration', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const p1 = engine.predict('wm:user-prefs', { type: 'preference', prediction: 'zig', confidence: 0.8 });
    const p2 = engine.predict('wm:user-prefs', { type: 'preference', prediction: 'cobol', confidence: 0.6 });
    engine.recordOutcome(p1.id, 'correct', true);
    engine.recordOutcome(p2.id, 'wrong', false);
    expect(engine.getCalibration('wm:user-prefs')).toBeCloseTo(0.5, 5);
    const stats = engine.getStats('wm:user-prefs');
    expect(stats.correctCount).toBe(1);
    expect(stats.incorrectCount).toBe(1);
    expect(stats.pendingCount).toBe(0);
  });

  it('does not double-resolve predictions', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const p = engine.predict('wm:user-prefs', { type: 'preference', prediction: 'x', confidence: 0.5 });
    engine.recordOutcome(p.id, 'ok', true);
    engine.recordOutcome(p.id, 'changed', true);
    expect(engine.getCalibration('wm:user-prefs')).toBeCloseTo(1, 5);
  });

  it('records abstentions', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const p = engine.predict('wm:user-prefs', { type: 'preference', prediction: 'x', confidence: 0.5 });
    engine.recordAbstention(p.id, 'insufficient evidence');
    expect(engine.getStats('wm:user-prefs').abstainedCount).toBe(1);
    expect(engine.getCalibration('wm:user-prefs')).toBeNull();
  });

  it('generalizes consistent observations into a claim', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const base = { topic: 'preference', claimClass: 'descriptive' as const, confidence: 0.8, source: 's', observedAt: Date.now() };
    engine.ingestObservation('wm:user-prefs', { id: 'o1', claim: 'likes rust', variables: { language: 'rust', ecosystem: 'systems' }, ...base });
    engine.ingestObservation('wm:user-prefs', { id: 'o2', claim: 'likes c++', variables: { language: 'c++', ecosystem: 'systems' }, ...base });
    engine.ingestObservation('wm:user-prefs', { id: 'o3', claim: 'likes go', variables: { language: 'go', ecosystem: 'systems' }, ...base });
    const generalization = engine.generalize('wm:user-prefs', 'ecosystem');
    expect(generalization).not.toBeNull();
    expect(generalization!.value).toBe('systems');
    expect(generalization!.confidence).toBeCloseTo(1, 5);
    expect(generalization!.supportCount).toBe(3);
  });

  it('groups semantic categories when a categoryOf function is provided', () => {
    const engine = new WorldModelEngine({
      categoryOf: (value) => (['rust', 'c++', 'zig'].includes(String(value)) ? 'systems-lang' : String(value)),
    });
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const base = { topic: 'preference', claimClass: 'descriptive' as const, confidence: 0.8, source: 's', observedAt: Date.now() };
    engine.ingestObservation('wm:user-prefs', { id: 'o1', claim: 'likes rust', variables: { language: 'rust' }, ...base });
    engine.ingestObservation('wm:user-prefs', { id: 'o2', claim: 'likes c++', variables: { language: 'c++' }, ...base });
    const generalization = engine.generalize('wm:user-prefs', 'language');
    expect(generalization!.claim).toContain('systems-lang');
    expect(generalization!.confidence).toBeCloseTo(1, 5);
  });

  it('returns null when support is insufficient', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const base = { topic: 'preference', claimClass: 'descriptive' as const, confidence: 0.8, source: 's', observedAt: Date.now() };
    engine.ingestObservation('wm:user-prefs', { id: 'o1', claim: 'likes rust', variables: { language: 'rust' }, ...base });
    engine.ingestObservation('wm:user-prefs', { id: 'o2', claim: 'likes python', variables: { language: 'python' }, ...base });
    expect(engine.generalize('wm:user-prefs', 'language', 2, 0.8)).toBeNull();
  });

  it('exposes stats including freshness and coverage', () => {
    const engine = new WorldModelEngine();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const base = { topic: 'preference', claimClass: 'descriptive' as const, confidence: 0.8, source: 's', observedAt: Date.now() };
    engine.ingestObservation('wm:user-prefs', { id: 'o1', claim: 'likes rust', ...base });
    const stats = engine.getStats('wm:user-prefs');
    expect(stats.activeVersion).toBe(1);
    expect(stats.observationCount).toBe(1);
    expect(stats.coverage).toBeCloseTo(1 / 3, 5);
    expect(stats.freshness).toBeCloseTo(1, 5);
  });
});

describe('WorldModelEngine activation-field integration', () => {
  it('registers models in the field, spikes on prediction, and rewards on outcome', () => {
    const field = new ActivationField({}, undefined, Date.now);
    const engine = new WorldModelEngine({ field });
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const modelEntity = field.get('wm:user-prefs');
    expect(modelEntity).toBeDefined();
    expect(modelEntity!.metrics.activation).toBe(0.1);

    const prediction = engine.predict('wm:user-prefs', { type: 'preference', prediction: 'zig', confidence: 0.9 });
    expect(field.get('wm:user-prefs')!.metrics.activation).toBe(0.4);

    const before = field.get('wm:user-prefs')!.metrics.predictionScore;
    engine.recordOutcome(prediction.id, 'correct', true);
    const after = field.get('wm:user-prefs')!.metrics.predictionScore;
    expect(after).toBeGreaterThan(before);
    expect(field.get('wm:user-prefs')!.metrics.utility).toBeCloseTo(0.59, 5);
  });

  it('lowers prediction score on incorrect outcomes', () => {
    const field = new ActivationField({}, undefined, Date.now);
    const engine = new WorldModelEngine({ field });
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const prediction = engine.predict('wm:user-prefs', { type: 'preference', prediction: 'cobol', confidence: 0.9 });
    const before = field.get('wm:user-prefs')!.metrics.predictionScore;
    engine.recordOutcome(prediction.id, 'wrong', false);
    const after = field.get('wm:user-prefs')!.metrics.predictionScore;
    expect(after).toBeLessThan(before);
  });
});

describe('CognitiveKernel world-model wiring', () => {
  it('exposes a shared engine backed by the kernel activation field', () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const engine = kernel.getWorldModels();
    engine.declareModel(makeDeclaration());
    engine.promote('wm:user-prefs', 1);
    const prediction = engine.predict('wm:user-prefs', { type: 'preference', prediction: 'zig', confidence: 0.8 });
    engine.recordOutcome(prediction.id, 'correct', true);
    expect(kernel.getActivationField().get('wm:user-prefs')!.metrics.predictionScore).toBeGreaterThan(0.5);
    expect(engine.getCalibration('wm:user-prefs')).toBeCloseTo(1, 5);
  });
});
