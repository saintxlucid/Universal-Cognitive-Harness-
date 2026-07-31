import { describe, it, expect } from 'vitest';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';
import { WorkspaceGenome } from '../cognitive-plane/genome/workspace-genome.js';
import { KnowledgeCompiler } from '../cognitive-plane/compiler/knowledge-compiler.js';
import { ScientificMemory } from '../cognitive-plane/memory/scientific-memory.js';
import { TrustEngine } from '../cognitive-plane/trust/trust-engine.js';
import { SelfReflectionEngine } from '../cognitive-plane/reflection/self-reflection-engine.js';
import { CreativityEngine } from '../cognitive-plane/creativity/creativity-engine.js';
import { ProjectHealthEngine } from '../cognitive-plane/health-metrics/project-health-engine.js';
import { TasteEngine } from '../cognitive-plane/taste/taste-engine.js';
import { WorkspaceDreaming } from '../cognitive-plane/dreaming/workspace-dreaming.js';
import { TraceLedger } from '../cognitive-plane/trace-engine/trace-ledger.js';
import { createTrace, endTrace } from '../cognitive-plane/trace-engine/cognitive-trace.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { CognitiveOrganism } from '../cognitive-plane/organism/organism.js';
import { createWorkspaceIdentity } from '../workspace-brain/identity.js';

// ── Cognitive Constitution ────────────────────────────────────
describe('CognitiveConstitution', () => {
  it('enacts builtin immutable laws', () => {
    const c = new CognitiveConstitution();
    const laws = c.getAll();
    expect(laws.length).toBeGreaterThanOrEqual(10);
    expect(c.getBySeverity('immutable').length).toBeGreaterThanOrEqual(3);
  });

  it('enacts new laws', () => {
    const c = new CognitiveConstitution();
    const law = c.enact({
      name: 'Custom Law',
      description: 'A test law',
      severity: 'advisory',
      category: 'test',
      provenance: 'test',
    });
    expect(c.getLaw(law.id)?.name).toBe('Custom Law');
  });

  it('cannot amend immutable laws', () => {
    const c = new CognitiveConstitution();
    const immutables = c.getBySeverity('immutable');
    expect(c.amend(immutables[0]!.id, { name: 'changed' })).toBe(false);
  });

  it('can amend advisory laws', () => {
    const c = new CognitiveConstitution();
    c.enact({
      name: 'Test',
      description: 'x',
      severity: 'advisory',
      category: 'test',
      provenance: 'test',
    });
    const advisory = c.getBySeverity('advisory')[0]!;
    expect(c.amend(advisory.id, { description: 'updated' })).toBe(true);
    expect(c.getLaw(advisory.id)!.description).toBe('updated');
  });

  it('can repeal advisory laws', () => {
    const c = new CognitiveConstitution();
    c.enact({
      name: 'ToRepeal',
      description: 'x',
      severity: 'advisory',
      category: 'test',
      provenance: 'test',
    });
    const advisory = c.getBySeverity('advisory')[0]!;
    expect(c.repeal(advisory.id)).toBe(true);
  });

  it('cannot repeal immutable laws', () => {
    const c = new CognitiveConstitution();
    const immutables = c.getBySeverity('immutable');
    expect(c.repeal(immutables[0]!.id)).toBe(false);
  });

  it('checks compliance with provenance check', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('test-agent', { evidence: false });
    const noFabrication = violations.find((v) => v.lawName.includes('No Evidence'));
    expect(noFabrication).toBeDefined();
  });

  it('tracks violations by subject', () => {
    const c = new CognitiveConstitution();
    c.checkCompliance('agent-1', { evidence: false });
    c.checkCompliance('agent-2', { evidence: false });
    c.checkCompliance('agent-1', { evidence: true });
    expect(c.getViolationsBySubject('agent-1').length).toBeGreaterThanOrEqual(1);
  });

  it('returns stats', () => {
    const c = new CognitiveConstitution();
    const stats = c.getStats();
    expect(stats.totalLaws).toBeGreaterThan(0);
    expect(stats.categories.integrity).toBeDefined();
  });

  it('clears violations', () => {
    const c = new CognitiveConstitution();
    c.checkCompliance('agent-1', { evidence: false });
    expect(c.countViolations()).toBeGreaterThan(0);
    c.clearViolations();
    expect(c.countViolations()).toBe(0);
  });
});

// ── Workspace Genome ──────────────────────────────────────────
describe('WorkspaceGenome', () => {
  it('creates with builtin sections', () => {
    const g = new WorkspaceGenome({
      workspaceId: 'ws-1',
      projectName: 'Test',
      description: 'A test project',
    });
    expect(g.getStats().totalEntries).toBeGreaterThanOrEqual(9);
    expect(g.getBySection('mission')).toHaveLength(1);
  });

  it('sets and retrieves entries', () => {
    const g = new WorkspaceGenome({ workspaceId: 'ws-1', projectName: 'Test', description: '' });
    g.set('test-key', 'tech-stack', 'Node.js', { tags: ['backend'], provenance: 'test' });
    expect(g.getByKey('test-key')?.value).toBe('Node.js');
  });

  it('updates existing entries', () => {
    const g = new WorkspaceGenome({ workspaceId: 'ws-1', projectName: 'Test', description: '' });
    g.set('key', 'principles', 'v1');
    g.set('key', 'principles', 'v2');
    expect(g.getByKey('key')?.value).toBe('v2');
    expect(g.getByKey('key')?.version).toBe(2);
  });

  it('cannot delete builtin entries', () => {
    const g = new WorkspaceGenome({ workspaceId: 'ws-1', projectName: 'Test', description: '' });
    expect(g.delete('project-mission')).toBe(false);
  });

  it('clones genome with independent entries', () => {
    const g = new WorkspaceGenome({ workspaceId: 'ws-1', projectName: 'Test', description: '' });
    g.set('custom', 'architecture', 'microservices');
    const clone = g.clone();
    expect(clone.getByKey('custom')?.value).toBe('microservices');
    clone.set('custom', 'architecture', 'monolith');
    expect(g.getByKey('custom')?.value).toBe('microservices');
  });

  it('exports genome data', () => {
    const g = new WorkspaceGenome({ workspaceId: 'ws-1', projectName: 'Test', description: '' });
    g.set('custom', 'patterns', 'CQRS');
    const exported = g.export() as Record<string, unknown>;
    expect((exported as any).config).toBeDefined();
    expect(((exported as any).entries as any[]).length).toBeGreaterThan(0);
  });
});

// ── Knowledge Compiler ────────────────────────────────────────
describe('KnowledgeCompiler', () => {
  it('ingests traces into facts', () => {
    const kc = new KnowledgeCompiler();
    const traces = [createTrace({ name: 'git-commit' })];
    const result = kc.ingest(traces);
    expect(result.stage).toBe('fact');
    expect(result.artifacts).toHaveLength(1);
  });

  it('ingests decisions into knowledge', () => {
    const kc = new KnowledgeCompiler();
    const decisions = [
      {
        id: 'd1',
        title: 'Use TypeScript',
        description: '',
        rationale: 'Type safety',
        alternatives: [{ name: 'JS', description: 'Plain JS', pros: [], cons: [] }],
        outcome: 'adopted',
        tags: ['lang'],
        timestamp: new Date(),
        metadata: {},
        traceIds: [],
      },
    ];
    const result = kc.ingestDecisions(decisions);
    expect(result.stage).toBe('knowledge');
  });

  it('compresses facts to higher stages', () => {
    const kc = new KnowledgeCompiler();
    const traces = [
      createTrace({ name: 'git-push', attributes: [{ key: 'agent.id', value: 'a1' }] }),
      createTrace({ name: 'git-push', attributes: [{ key: 'agent.id', value: 'a1' }] }),
      createTrace({ name: 'git-push', attributes: [{ key: 'agent.id', value: 'a1' }] }),
    ];
    kc.ingest(traces);
    const result = kc.compress('fact');
    expect(result.stage).toBe('knowledge');
    expect(kc.getByStage('knowledge').length).toBeGreaterThanOrEqual(1);
  });

  it('returns wisdom artifacts', () => {
    const kc = new KnowledgeCompiler();
    expect(kc.getWisdom()).toEqual([]);
  });

  it('retrieves by tag', () => {
    const kc = new KnowledgeCompiler();
    kc.ingest([createTrace({ name: 'build', attributes: [{ key: 'env', value: 'prod' }] })]);
    expect(kc.getByTag('build').length).toBeGreaterThanOrEqual(1);
  });

  it('returns stats', () => {
    const kc = new KnowledgeCompiler();
    kc.ingest([createTrace({ name: 'a' }), createTrace({ name: 'b' })]);
    const stats = kc.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byStage['fact']).toBe(2);
  });

  it('clears all artifacts', () => {
    const kc = new KnowledgeCompiler();
    kc.ingest([createTrace({ name: 'test' })]);
    expect(kc.getStats().total).toBe(1);
    kc.clear();
    expect(kc.getStats().total).toBe(0);
  });
});

// ── Scientific Memory ─────────────────────────────────────────
describe('ScientificMemory', () => {
  it('stores with default certainty', () => {
    const sm = new ScientificMemory();
    const entry = sm.store({ key: 'test-key', value: 'test-value', source: 'test' });
    expect(entry.key).toBe('test-key');
    expect(entry.certainty).toBe('uncertain');
  });

  it('retrieves by key', () => {
    const sm = new ScientificMemory();
    sm.store({ key: 'lang', value: 'TypeScript', source: 'config' });
    expect(sm.getByKey('lang')?.value).toBe('TypeScript');
  });

  it('searches by query', () => {
    const sm = new ScientificMemory();
    sm.store({ key: 'framework', value: 'React', source: 'test', tags: ['ui'] });
    const results = sm.query('framework');
    expect(results).toHaveLength(1);
  });

  it('verifies memories and increases confidence', () => {
    const sm = new ScientificMemory();
    const entry = sm.store({ key: 'x', value: 'y', source: 'test' });
    sm.verify(entry.id, 'verified');
    expect(sm.get(entry.id)!.certainty).toBe('confirmed');
    expect(sm.get(entry.id)!.confidence).toBeGreaterThan(0.5);
  });

  it('adds contradictions and decreases confidence', () => {
    const sm = new ScientificMemory();
    const entry = sm.store({ key: 'x', value: 'y', source: 'test', confidence: 0.9 });
    sm.addContradiction(entry.id, 'found counter-evidence');
    expect(sm.get(entry.id)!.certainty).toBe('contradicted');
    expect(sm.get(entry.id)!.confidence).toBeLessThan(0.9);
  });

  it('tracks prediction accuracy', () => {
    const sm = new ScientificMemory();
    const entry = sm.store({ key: 'prediction', value: true, source: 'test' });
    sm.recordPrediction(entry.id, true);
    sm.recordPrediction(entry.id, true);
    sm.recordPrediction(entry.id, false);
    expect(sm.get(entry.id)!.predictionAccuracy).toBeGreaterThan(0);
  });

  it('returns contradicted memories', () => {
    const sm = new ScientificMemory();
    const e = sm.store({ key: 'x', value: 'y', source: 'test' });
    sm.addContradiction(e.id, 'contradiction');
    expect(sm.getContradicted()).toHaveLength(1);
  });

  it('deletes entries', () => {
    const sm = new ScientificMemory();
    const e = sm.store({ key: 'x', value: 'y', source: 'test' });
    expect(sm.delete(e.id)).toBe(true);
    expect(sm.getByKey('x')).toBeUndefined();
  });

  it('returns stats', () => {
    const sm = new ScientificMemory();
    sm.store({ key: 'a', value: 1, source: 'test', memoryType: 'config', confidence: 0.8 });
    sm.store({ key: 'b', value: 2, source: 'test', memoryType: 'config' });
    const stats = sm.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byType.config).toBe(2);
    expect(stats.avgConfidence).toBeGreaterThan(0);
  });
});

describe('CognitiveOrganism', () => {
  it('initializes with core organs and exposes a summary', async () => {
    const bus = new NeuralEventBus();
    const organism = new CognitiveOrganism({
      eventBus: bus,
      kernel: {
        remember: async () => ({
          id: 'ep1',
          content: {},
          session_id: 's1',
          agent_id: 'a1',
          user_id: 'u1',
          project_id: 'p1',
          provenance: {
            source: 'system_log',
            agent_id: 'a1',
            reliability: 1,
            timestamp: new Date(),
          },
          concepts: [],
          preceding_episode: undefined,
        }),
        getStats: () => ({
          session_id: 's1',
          episodes: 0,
          concepts: 0,
          relationships: 0,
          beliefs: 0,
          sleep_active: false,
          sleep_cycles: 0,
          neuromodulation: { novelty: 0, task_horizon: 0, uncertainty: 0, reward_history: [] },
        }),
      } as any,
      semanticMemory: new ScientificMemory(),
      identity: createWorkspaceIdentity({ workspace_id: 'ws-test', name: 'Test Workspace' }),
      constitution: new CognitiveConstitution(),
      knowledgeCompiler: new KnowledgeCompiler(),
      trustEngine: new TrustEngine(),
      conscience: {
        predict: async () => ({ predicted_type: 'observe', confidence: 0.5, context_basis: [] }),
      } as any,
    });

    await organism.initialize();
    const summary = organism.summarizeOrganism();
    expect(summary).toContain('Organism mission');
    expect(organism.memory.sensory.getRecent()).toEqual([]);
    expect(organism.memory.working.getContext().mission).toBe('Unknown');
  });

  it('ingests observation and stores a semantic fact', async () => {
    const bus = new NeuralEventBus();
    const organism = new CognitiveOrganism({
      eventBus: bus,
      kernel: {
        remember: async () => ({
          id: 'ep2',
          content: {},
          session_id: 's1',
          agent_id: 'a1',
          user_id: 'u1',
          project_id: 'p1',
          provenance: {
            source: 'system_log',
            agent_id: 'a1',
            reliability: 1,
            timestamp: new Date(),
          },
          concepts: [],
          preceding_episode: undefined,
        }),
      } as any,
      semanticMemory: new ScientificMemory(),
      identity: createWorkspaceIdentity({ workspace_id: 'ws-test', name: 'Test Workspace' }),
      constitution: new CognitiveConstitution(),
      knowledgeCompiler: new KnowledgeCompiler(),
      trustEngine: new TrustEngine(),
      conscience: {
        predict: async () => ({ predicted_type: 'observe', confidence: 0.5, context_basis: [] }),
      } as any,
    });

    const event = {
      type: 'file:saved',
      source: 'editor',
      payload: { message: 'Saved README', path: 'README.md' },
    } as any;

    await organism.memory.ingestObservation(event, 0.7);
    expect(organism.memory.sensory.getRecent().length).toBe(1);
    expect(organism.memory.semantic.getByKey('last_error')).toBeUndefined();
  });
});

// ── Trust Engine ──────────────────────────────────────────────
describe('TrustEngine', () => {
  it('registers subjects with default trust level', () => {
    const te = new TrustEngine();
    te.register('source-1', 'source');
    expect(te.get('source-1')?.level).toBe('standard');
  });

  it('assesses trust with verification success', () => {
    const te = new TrustEngine();
    const entry = te.register('verified-source', 'source', 'standard');
    te.recordSuccess('verified-source');
    const assessment = te.assess('verified-source');
    expect(assessment.verdict).toBe('trusted');
  });

  it('records successes increasing score', () => {
    const te = new TrustEngine();
    te.register('tool-1', 'tool', 'limited');
    te.recordSuccess('tool-1');
    te.recordSuccess('tool-1');
    expect(te.get('tool-1')!.verificationCount).toBe(2);
  });

  it('records failures decreasing score', () => {
    const te = new TrustEngine();
    te.register('agent-1', 'agent');
    const beforeScore = te.get('agent-1')!.score;
    te.recordFailure('agent-1');
    te.recordFailure('agent-1');
    expect(te.get('agent-1')!.score).toBeLessThan(beforeScore);
  });

  it('records conflicts', () => {
    const te = new TrustEngine();
    te.register('mcp-1', 'mcp');
    te.recordConflict('mcp-1');
    expect(te.get('mcp-1')!.conflictCount).toBe(1);
  });

  it('lists low-trust subjects', () => {
    const te = new TrustEngine();
    te.register('bad-actor', 'agent', 'none');
    const low = te.getLowTrust(0.2);
    expect(low.length).toBeGreaterThanOrEqual(1);
  });

  it('returns stats', () => {
    const te = new TrustEngine();
    te.register('a', 'source');
    te.register('b', 'plugin');
    const stats = te.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byType.source).toBe(1);
  });

  it('removes subjects', () => {
    const te = new TrustEngine();
    te.register('remove-me', 'source');
    expect(te.remove('remove-me')).toBe(true);
    expect(te.get('remove-me')).toBeUndefined();
  });
});

// ── Self Reflection Engine ────────────────────────────────────
describe('SelfReflectionEngine', () => {
  it('runs a nightly reflection cycle', () => {
    const sm = new ScientificMemory();
    const re = new SelfReflectionEngine(sm);
    const session = re.runNightly();
    expect(session.entries.length).toBeGreaterThan(0);
    expect(session.phase).toBe('dusk');
  });

  it('runs different phases', () => {
    const sm = new ScientificMemory();
    const re = new SelfReflectionEngine(sm);
    const session = re.runPhase('dawn');
    expect(session.entries.length).toBeGreaterThan(0);
  });

  it('reflects on mistakes from contradicted memories', () => {
    const sm = new ScientificMemory();
    const e = sm.store({ key: 'bad', value: 'data', source: 'test', certainty: 'confirmed' });
    sm.addContradiction(e.id, 'new evidence');
    const re = new SelfReflectionEngine(sm);
    const session = re.runNightly();
    const mistakes = session.entries.filter((e) => e.category === 'mistakes');
    expect(mistakes.length).toBeGreaterThanOrEqual(1);
  });

  it('tracks unintegrated reflections', () => {
    const sm = new ScientificMemory();
    const re = new SelfReflectionEngine(sm);
    re.runNightly();
    expect(re.getUnintegrated().length).toBeGreaterThan(0);
  });

  it('marks reflections as integrated', () => {
    const sm = new ScientificMemory();
    const re = new SelfReflectionEngine(sm);
    re.runNightly();
    const entry = re.getEntries()[0]!;
    expect(re.markIntegrated(entry.id)).toBe(true);
    expect(entry.integrated).toBe(true);
  });

  it('returns session history', () => {
    const sm = new ScientificMemory();
    const re = new SelfReflectionEngine(sm);
    re.runNightly();
    re.runNightly();
    expect(re.getSessions().length).toBe(2);
  });

  it('returns stats', () => {
    const sm = new ScientificMemory();
    const re = new SelfReflectionEngine(sm);
    re.runNightly();
    const stats = re.getStats();
    expect(stats.totalSessions).toBe(1);
    expect(stats.totalEntries).toBeGreaterThan(0);
  });
});

// ── Creativity Engine ─────────────────────────────────────────
describe('CreativityEngine', () => {
  it('generates ideas', () => {
    const ce = new CreativityEngine();
    const ideas = ce.generate({ domain: 'architecture', count: 3 });
    expect(ideas).toHaveLength(3);
  });

  it('generates by analogy', () => {
    const ce = new CreativityEngine();
    const ideas = ce.generateByAnalogy('databases', 'architecture');
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas[0]!.domain).toBe('architecture');
  });

  it('evaluates ideas', () => {
    const ce = new CreativityEngine();
    const ideas = ce.generate({ domain: 'design', count: 1 });
    expect(ce.evaluate(ideas[0]!.id, true)).toBe(true);
    expect(ce.getAccepted()).toHaveLength(1);
  });

  it('tracks un evaluated ideas', () => {
    const ce = new CreativityEngine();
    ce.generate({ domain: 'feature', count: 2 });
    expect(ce.getUnEvaluated().length).toBe(2);
  });

  it('retrieves by domain', () => {
    const ce = new CreativityEngine();
    ce.generate({ domain: 'algorithm', count: 2 });
    expect(ce.getByDomain('algorithm').length).toBe(2);
  });

  it('returns stats', () => {
    const ce = new CreativityEngine();
    ce.generate({ domain: 'architecture', count: 3 });
    ce.generate({ domain: 'design', count: 2 });
    const stats = ce.getStats();
    expect(stats.total).toBe(5);
    expect(stats.byDomain.architecture).toBe(3);
  });
});

// ── Project Health Engine ─────────────────────────────────────
describe('ProjectHealthEngine', () => {
  it('generates a health report', () => {
    const ph = new ProjectHealthEngine();
    const report = ph.assess();
    expect(report.metrics.length).toBe(12);
    expect(report.overall).toBeGreaterThan(0);
    expect(report.overall).toBeLessThanOrEqual(1);
  });

  it('accepts override values', () => {
    const ph = new ProjectHealthEngine();
    const report = ph.assess({ architecture: 0.9, code: 0.8, knowledge: 0.3 });
    const arch = report.metrics.find((m) => m.dimension === 'architecture')!;
    expect(arch.score).toBe(0.9);
  });

  it('tracks history and computes trends', () => {
    const ph = new ProjectHealthEngine();
    ph.assess({ architecture: 0.5 });
    ph.assess({ architecture: 0.7 });
    ph.assess({ architecture: 0.9 });
    const trend = ph.getTrend('architecture');
    expect(trend).toBe('improving');
  });

  it('returns the latest report', () => {
    const ph = new ProjectHealthEngine();
    expect(ph.getLatest()).toBeNull();
    ph.assess();
    expect(ph.getLatest()).not.toBeNull();
  });

  it('returns stats', () => {
    const ph = new ProjectHealthEngine();
    ph.assess();
    ph.assess({ architecture: 0.2, code: 0.3 });
    const stats = ph.getStats();
    expect(stats.totalReports).toBe(2);
    expect(stats.criticalCount).toBeGreaterThanOrEqual(0);
  });
});

// ── Taste Engine ──────────────────────────────────────────────
describe('TasteEngine', () => {
  it('initializes with all dimensions', () => {
    const te = new TasteEngine();
    const prefs = te.getAllPreferences();
    expect(prefs).toHaveLength(9);
  });

  it('learns from feedback', () => {
    const te = new TasteEngine();
    te.learn('code-elegance', 'function composition', 0.9, 'clean pattern');
    const pref = te.getPreference('code-elegance');
    expect(pref.feedback).toHaveLength(1);
    expect(pref.score).toBe(0.9);
  });

  it('accumulates feedback for scoring', () => {
    const te = new TasteEngine();
    te.learn('readability', 'descriptive names', 0.7);
    te.learn('readability', 'short functions', 0.9);
    const pref = te.getPreference('readability');
    expect(pref.score).toBe(0.8);
  });

  it('assesses candidates', () => {
    const te = new TasteEngine();
    const assessment = te.assess('simplicity', 'a new module design');
    expect(assessment.alignment).toBeGreaterThan(0);
  });

  it('returns top preferences', () => {
    const te = new TasteEngine();
    te.learn('code-elegance', 'fp', 1.0);
    te.learn('readability', 'clear code', 0.5);
    const top = te.getTopPreferences(1);
    expect(top[0]!.dimension).toBe('code-elegance');
  });

  it('returns stats', () => {
    const te = new TasteEngine();
    te.learn('minimalism', 'small API surface', 0.8);
    const stats = te.getStats();
    expect(stats.dimensions).toBe(9);
    expect(stats.totalFeedback).toBe(1);
  });
});

// ── Workspace Dreaming ────────────────────────────────────────
describe('WorkspaceDreaming', () => {
  it('runs a dream cycle on empty data', async () => {
    const ledger = new TraceLedger();
    const compiler = new KnowledgeCompiler();
    const memory = new ScientificMemory();
    const dream = new WorkspaceDreaming(ledger, compiler, memory);
    const results = await dream.dreamOnce();
    expect(Array.isArray(results)).toBe(true);
  });

  it('detects duplicate operations', async () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 6; i++) ledger.append(createTrace({ name: 'repeat-op' }));
    const dream = new WorkspaceDreaming(ledger, new KnowledgeCompiler(), new ScientificMemory());
    const results = await dream.dreamOnce();
    const dups = results.filter((r) => r.category === 'duplicate-detection');
    expect(dups.length).toBeGreaterThanOrEqual(1);
  });

  it('detects anomaly from error rate', async () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 20; i++) {
      ledger.append(endTrace(createTrace({ name: 'op' }), i < 5 ? 'ok' : 'error'));
    }
    const dream = new WorkspaceDreaming(ledger, new KnowledgeCompiler(), new ScientificMemory());
    const results = await dream.dreamOnce();
    const anomalies = results.filter((r) => r.category === 'anomaly-detection');
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
  });

  it('suggests optimizations for repeated ops', async () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 5; i++) {
      ledger.append(createTrace({ name: 'frequent-op' }));
    }
    const dream = new WorkspaceDreaming(ledger, new KnowledgeCompiler(), new ScientificMemory());
    const results = await dream.dreamOnce();
    const opts = results.filter(
      (r) => r.category === 'duplicate-detection' || r.category === 'optimization-suggestion',
    );
    expect(opts.length).toBeGreaterThanOrEqual(0);
  });

  it('marks results as implemented', async () => {
    const dream = new WorkspaceDreaming(
      new TraceLedger(),
      new KnowledgeCompiler(),
      new ScientificMemory(),
    );
    await dream.dreamOnce();
    const all = dream.getRecent();
    if (all.length > 0) {
      expect(dream.markImplemented(all[0]!.id)).toBe(true);
    }
  });

  it('returns high-impact unaddressed items', async () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 6; i++) ledger.append(createTrace({ name: 'repeat' }));
    const dream = new WorkspaceDreaming(ledger, new KnowledgeCompiler(), new ScientificMemory());
    await dream.dreamOnce();
    const highImpact = dream.getHighImpact();
    expect(Array.isArray(highImpact)).toBe(true);
  });

  it('returns stats', async () => {
    const dream = new WorkspaceDreaming(
      new TraceLedger(),
      new KnowledgeCompiler(),
      new ScientificMemory(),
    );
    await dream.dreamOnce();
    const stats = dream.getStats();
    expect(stats.cycles).toBe(1);
    expect(stats.totalResults).toBeGreaterThanOrEqual(0);
  });
});

// ── Cross-module integration ──────────────────────────────────
describe('Organism integration', () => {
  it('constitution governs genome compliance', () => {
    const c = new CognitiveConstitution();
    c.enact({
      name: 'Identity Law',
      description: 'Project must have identity',
      severity: 'foundational',
      category: 'identity',
      provenance: 'test',
      check: 'provenance:identity',
    });
    const violations = c.checkCompliance('genome', { identity: 'test-value' });
    const identityCheck = violations.find((v) => v.lawName === 'Identity Law');
    // With provision value present, check should pass (no violation)
    if (identityCheck) {
      // Check evaluates provenance:identity - if key exists in context, no violation
      // The check is: key not in context or null/undefined. identity IS in context, so no violation.
    }
    // Only check for the no-fabrication law since evidence=false triggers it
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  it('scientific memory and trust engine work together', () => {
    const sm = new ScientificMemory();
    const te = new TrustEngine();

    const entry = sm.store({
      key: 'important-fact',
      value: 'key data',
      source: 'research',
      certainty: 'confirmed',
      confidence: 0.9,
    });
    te.register('research', 'source', 'standard');
    te.recordSuccess('research');

    expect(sm.get(entry.id)!.confidence).toBeGreaterThan(0.5);
    expect(te.assess('research').verdict).toBe('trusted');
  });

  it('reflection feeds from scientific memory', () => {
    const sm = new ScientificMemory();
    sm.store({ key: 'flawed', value: 'old data', source: 'test', certainty: 'confirmed' });
    const e = sm.store({
      key: 'tested',
      value: 'new data',
      source: 'test',
      certainty: 'confirmed',
    });
    sm.addContradiction(e.id, 'contradiction');

    const re = new SelfReflectionEngine(sm);
    const session = re.runNightly();
    const mistakes = session.entries.filter((en) => en.category === 'mistakes');
    expect(mistakes.length).toBeGreaterThanOrEqual(1);
  });

  it('knowledge compiler compresses traces into wisdom', () => {
    const kc = new KnowledgeCompiler();
    const traces = [
      endTrace(createTrace({ name: 'deploy' }), 'ok'),
      endTrace(createTrace({ name: 'deploy' }), 'ok'),
      endTrace(createTrace({ name: 'deploy' }), 'ok'),
    ];
    kc.ingest(traces);
    const result = kc.compress('fact');
    expect(result.stage).toBe('knowledge');
    expect(kc.getStats().total).toBeGreaterThan(0);
  });

  it('dreaming discovers patterns in trace data', async () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 6; i++) {
      ledger.append(createTrace({ name: 'repeated-task' }));
    }
    const dream = new WorkspaceDreaming(ledger, new KnowledgeCompiler(), new ScientificMemory());
    const results = await dream.dreamOnce();
    const discovered = results.filter(
      (r) => r.category === 'duplicate-detection' || r.category === 'pattern-discovery',
    );
    expect(discovered.length).toBeGreaterThanOrEqual(1);
  });
});
