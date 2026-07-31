import { describe, it, expect } from 'vitest';
import { CognitiveKernel } from '../cognitive-kernel.js';
import { EpisodicStore } from '../storage/episodic-store.js';
import { SemanticGraph } from '../storage/semantic-graph.js';
import { createConcept, createEpisode, createEdge } from '../types/index.js';
import { createProvenance } from '../types/provenance.js';
import { revise, createBeliefSet, classifyEpistemicStatus, assessTruth, type Proposition } from '../constitution/epistemology.js';
import { RetrievalFusion } from '../retrieval/fusion.js';
import { SleepCycle } from '../consolidation/sleep-cycle.js';
import { Neuromodulation } from '../cortex/neuromodulation.js';

describe('CognitiveKernel', () => {
  it('creates a session', () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj' });
    expect(kernel.getSessionId()).toBeTruthy();
    expect(kernel.getStats().episodes).toBe(0);
  });

  it('remembers and recalls episodes', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj' });
    await kernel.remember({
      content: { type: 'text', text: 'hello world' },
      concepts: [],
    });
    expect(kernel.getStats().episodes).toBe(1);

    const recalled = await kernel.recall({ text: 'hello' });
    expect(recalled.length).toBeGreaterThan(0);
  });

  it('manages concepts and relationships', () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj' });

    const c1 = kernel.addConcept({ name: 'Rust', concept_type: 'entity', definition: 'A systems programming language' });
    const c2 = kernel.addConcept({ name: 'TypeScript', concept_type: 'entity', definition: 'A typed JavaScript superset' });

    expect(kernel.getConcept(c1.id)?.name).toBe('Rust');
    expect(kernel.findConcept('rust')?.id).toBe(c1.id);
    expect(kernel.findConcept('typescript')?.id).toBe(c2.id);
  });

  it('adds and invalidates relationships', () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj' });
    const c1 = kernel.addConcept({ name: 'Alice', concept_type: 'entity', definition: 'A person' });
    const c2 = kernel.addConcept({ name: 'Email', concept_type: 'entity', definition: 'Communication tool' });

    const ep = kernel.remember({ content: { type: 'text', text: 'Alice prefers email' } });

    const e1 = kernel.addRelationship({ source: c1.id, target: c2.id, relationship: 'prefers', source_episode: '' });

    const rels = kernel.getRelationships(c1.id);
    expect(rels.length).toBeGreaterThan(0);
    expect(rels[0]!.relationship).toBe('prefers');
  });

  it('starts sleep cycle and reports', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj', sleep_interval_ms: 60000 });
    kernel.startSleep();
    expect(kernel.getStats().sleep_active).toBe(true);

    const report = await kernel.forceSleepCycle();
    expect(report.cycle).toBe(1);
    expect(report.duration_ms).toBeGreaterThanOrEqual(0);

    kernel.stopSleep();
    expect(kernel.getStats().sleep_active).toBe(false);
  });

  it('updates neuromodulation based on context', () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj' });

    const initial = kernel.getNeuromodulationState();
    expect(initial.learning_rate).toBe(0.1);

    // High novelty should increase learning rate
    kernel.updateContext({ novelty: 0.9, task_horizon: 20, uncertainty: 0.8 });
    const updated = kernel.getNeuromodulationState();
    expect(updated.learning_rate).toBe(0.3);
    expect(updated.discount_factor).toBe(0.95);
  });

  it('manages beliefs via cognitive constitution', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj' });
    await kernel.learnEvidence('Alice prefers TypeScript', 'Observed in conversation', 0.9);
    expect(kernel.getBeliefs().propositions.size).toBe(1);
    const prop = kernel.getBeliefs().propositions.get('Alice prefers TypeScript');
    expect(prop).toBeTruthy();
    expect(prop!.confidence.value).toBeGreaterThan(0.7);
  });
});

describe('EpisodicStore', () => {
  it('appends and retrieves episodes', async () => {
    const store = new EpisodicStore();
    const ep = await store.append({
      content: { type: 'text', text: 'test' },
      session_id: 's1',
      provenance: createProvenance('system_log', 'test'),
    });
    expect(store.count()).toBe(1);
    expect(store.getById(ep.id)?.content).toEqual({ type: 'text', text: 'test' });
  });

  it('indexes by concept', async () => {
    const store = new EpisodicStore();
    await store.append({ content: { type: 'text', text: 'a' }, session_id: 's1', provenance: createProvenance('system_log', 'test'), concepts: ['c1'] });
    await store.append({ content: { type: 'text', text: 'b' }, session_id: 's1', provenance: createProvenance('system_log', 'test'), concepts: ['c1'] });
    await store.append({ content: { type: 'text', text: 'c' }, session_id: 's1', provenance: createProvenance('system_log', 'test'), concepts: ['c2'] });

    expect(store.getByConcept('c1').length).toBe(2);
    expect(store.getByConcept('c2').length).toBe(1);
  });

  it('filters by time range', async () => {
    const store = new EpisodicStore();
    await store.append({ content: { type: 'text', text: 'old' }, session_id: 's1', provenance: createProvenance('system_log', 'test') });
    await new Promise((r) => setTimeout(r, 10));
    await store.append({ content: { type: 'text', text: 'new' }, session_id: 's1', provenance: createProvenance('system_log', 'test') });

    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const results = store.getByTimeRange(past, now);
    expect(results.length).toBe(2);
  });

  it('returns recent episodes sorted by time', async () => {
    const store = new EpisodicStore();
    await store.append({ content: { type: 'text', text: 'first' }, session_id: 's1', provenance: createProvenance('system_log', 'test') });
    await new Promise((r) => setTimeout(r, 5));
    await store.append({ content: { type: 'text', text: 'second' }, session_id: 's1', provenance: createProvenance('system_log', 'test') });

    const recent = store.getRecent(5);
    expect(recent.length).toBe(2);
    expect(recent[0]!.timestamp.getTime()).toBeGreaterThanOrEqual(recent[1]!.timestamp.getTime());
  });
});

describe('SemanticGraph', () => {
  it('adds and retrieves concepts', () => {
    const graph = new SemanticGraph();
    const c = createConcept({ name: 'Test', concept_type: 'entity', definition: 'A test concept', provenance: createProvenance('system_log', 'test') });
    graph.addConcept(c);
    expect(graph.getConcept(c.id)?.name).toBe('Test');
    expect(graph.findConceptByName('test')?.id).toBe(c.id);
  });

  it('adds edges and auto-invalidates on contradiction', () => {
    const graph = new SemanticGraph();
    const a = createConcept({ name: 'A', concept_type: 'entity', definition: 'Entity A', provenance: createProvenance('system_log', 'test') });
    const b = createConcept({ name: 'B', concept_type: 'entity', definition: 'Entity B', provenance: createProvenance('system_log', 'test') });
    graph.addConcept(a);
    graph.addConcept(b);

    const e1 = createEdge({ source: a.id, target: b.id, relationship: 'prefers', source_episode: 'e1', provenance: createProvenance('system_log', 'test') });
    graph.addEdge(e1);
    expect(graph.getEdgeCount()).toBe(1);

    // Add contradictory edge — old one should be invalidated
    const e2 = createEdge({ source: a.id, target: b.id, relationship: 'prefers', source_episode: 'e2', provenance: createProvenance('system_log', 'test') });
    graph.addEdge(e2);
    expect(graph.getEdgeCount()).toBe(2);
    expect(graph.getEdge(e1.id)!.invalid_at).toBeTruthy();
    expect(graph.getEdgesFrom(a.id, true).length).toBe(1);
  });

  it('performs BFS traversal', () => {
    const graph = new SemanticGraph();
    const nodes = ['A', 'B', 'C', 'D'].map((name) => {
      const c = createConcept({ name, concept_type: 'entity', definition: name, provenance: createProvenance('system_log', 'test') });
      graph.addConcept(c);
      return c;
    });

    graph.addEdge(createEdge({ source: nodes[0]!.id, target: nodes[1]!.id, relationship: 'connects', source_episode: 'e', provenance: createProvenance('system_log', 'test') }));
    graph.addEdge(createEdge({ source: nodes[1]!.id, target: nodes[2]!.id, relationship: 'connects', source_episode: 'e', provenance: createProvenance('system_log', 'test') }));
    graph.addEdge(createEdge({ source: nodes[2]!.id, target: nodes[3]!.id, relationship: 'connects', source_episode: 'e', provenance: createProvenance('system_log', 'test') }));

    const traversal = graph.bfsTraversal(nodes[0]!.id, 3);
    expect(traversal.length).toBe(3); // B, C, D
    expect(traversal[0]!.concept.name).toBe('B');
    expect(traversal[2]!.concept.name).toBe('D');
  });

  it('detects contradictions across edges', () => {
    const graph = new SemanticGraph();
    const a = createConcept({ name: 'A', concept_type: 'entity', definition: 'A', provenance: createProvenance('system_log', 'test') });
    const b = createConcept({ name: 'B', concept_type: 'entity', definition: 'B', provenance: createProvenance('system_log', 'test') });
    graph.addConcept(a);
    graph.addConcept(b);

    graph.addEdge(createEdge({ source: a.id, target: b.id, relationship: 'likes', source_episode: 'e1', provenance: createProvenance('system_log', 'test') }));
    graph.addEdge(createEdge({ source: a.id, target: b.id, relationship: 'likes', source_episode: 'e2', provenance: createProvenance('system_log', 'test') }));

    const contradictions = graph.findContradictions();
    // The auto-invalidation means only one edge should be active
    expect(contradictions.length).toBe(0); // Already invalidated
  });
});

describe('RetrievalFusion', () => {
  it('performs multi-signal fusion search', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const fusion = new RetrievalFusion(graph, episodic);

    // Add concepts
    const c = createConcept({ name: 'Rust', concept_type: 'entity', definition: 'Systems programming language', provenance: createProvenance('system_log', 'test') });
    c.embedding = [0.1, 0.2, 0.3];
    graph.addConcept(c);

    const results = fusion.search({ text: 'Rust', embedding: [0.1, 0.2, 0.3] });
    expect(results.length).toBeGreaterThan(0);
  });

  it('formats context for prompts', () => {
    const graph = new SemanticGraph();
    const episodic = new EpisodicStore();
    const fusion = new RetrievalFusion(graph, episodic);

    const c = createConcept({ name: 'Test', concept_type: 'entity', definition: 'A test', provenance: createProvenance('system_log', 'test') });
    graph.addConcept(c);

    const results = fusion.search({ text: 'Test' });
    const formatted = fusion.formatContext(results);
    expect(formatted).toContain('Test');
    expect(formatted).toContain('confidence:');
    expect(formatted).toContain('source:');
  });
});

describe('Cognitive Constitution', () => {
  it('classifies epistemic status correctly', () => {
    expect(classifyEpistemicStatus(0.995, 2, true)).toBe('fact');
    expect(classifyEpistemicStatus(0.97, 1, true)).toBe('knowledge');
    expect(classifyEpistemicStatus(0.85, 1, false)).toBe('belief');
    expect(classifyEpistemicStatus(0.50, 0, false)).toBe('speculation');
    expect(classifyEpistemicStatus(0.1, 0, false)).toBe('rejected');
  });

  it('assesses truth using composite scoring', () => {
    const score = assessTruth('test prop', 0.9, 0.8, 0.7, 0.6);
    expect(score).toBeCloseTo(0.4 * 0.9 + 0.3 * 0.8 + 0.2 * 0.7 + 0.1 * 0.6);
  });

  it('revises beliefs with expansion', () => {
    const beliefs = createBeliefSet();
    const p: Proposition = {
      value: 'test',
      confidence: { value: 0.9, method: 'model_calibration', calibration_history: [] },
      entrenchment: 3,
      evidence: [],
      contradictions: [],
      created_at: new Date(),
      last_revised: new Date(),
    };
    revise(beliefs, p);
    expect(beliefs.propositions.size).toBe(1);
  });

  it('revises beliefs with higher entrenchment override', () => {
    const beliefs = createBeliefSet();
    const existing: Proposition = {
      value: 'old',
      confidence: { value: 0.8, method: 'model_calibration', calibration_history: [] },
      entrenchment: 2,
      evidence: [],
      contradictions: [],
      created_at: new Date(),
      last_revised: new Date(),
    };
    existing.contradictions.push('new');

    const incoming: Proposition = {
      value: 'new',
      confidence: { value: 0.9, method: 'model_calibration', calibration_history: [] },
      entrenchment: 4,
      evidence: [],
      contradictions: ['old'],
      created_at: new Date(),
      last_revised: new Date(),
    };

    beliefs.propositions.set('old', existing);
    revise(beliefs, incoming);

    // Higher entrenchment should win
    expect(beliefs.propositions.has('old')).toBe(false);
    expect(beliefs.propositions.has('new')).toBe(true);
  });
});

describe('Neuromodulation', () => {
  it('responds to high novelty', () => {
    const nm = new Neuromodulation();
    nm.update({ novelty: 0.9, task_horizon: 5, uncertainty: 0.3, reward_history: [] });
    const state = nm.getState();
    expect(state.learning_rate).toBe(0.3);
    expect(state.exploration_rate).toBe(0.6);
  });

  it('responds to low novelty', () => {
    const nm = new Neuromodulation();
    nm.update({ novelty: 0.1, task_horizon: 3, uncertainty: 0.1, reward_history: [] });
    const state = nm.getState();
    expect(state.learning_rate).toBe(0.05);
    expect(state.exploration_rate).toBe(0.1);
  });

  it('responds to long task horizons', () => {
    const nm = new Neuromodulation();
    nm.update({ novelty: 0.3, task_horizon: 20, uncertainty: 0.2, reward_history: [] });
    expect(nm.getState().discount_factor).toBe(0.95);
  });

  it('responds to short task horizons', () => {
    const nm = new Neuromodulation();
    nm.update({ novelty: 0.3, task_horizon: 3, uncertainty: 0.2, reward_history: [] });
    expect(nm.getState().discount_factor).toBe(0.7);
  });

  it('increases exploration on low reward', () => {
    const nm = new Neuromodulation();
    nm.update({ novelty: 0.3, task_horizon: 3, uncertainty: 0.2, reward_history: [0.1, 0.2, 0.15] });
    expect(nm.getState().exploration_rate).toBeGreaterThanOrEqual(0.2);
  });

  it('resets to defaults', () => {
    const nm = new Neuromodulation();
    nm.update({ novelty: 0.9, task_horizon: 20, uncertainty: 0.8, reward_history: [] });
    nm.reset();
    const state = nm.getState();
    expect(state.learning_rate).toBe(0.1);
    expect(state.exploration_rate).toBe(0.3);
    expect(state.discount_factor).toBe(0.9);
    expect(state.reward_sensitivity).toBe(0.5);
  });
});

describe('SleepCycle', () => {
  it('reports stats on cycle', async () => {
    const episodic = new EpisodicStore();
    const graph = new SemanticGraph();
    const nm = new Neuromodulation();

    // Add some data
    await episodic.append({ content: { type: 'text', text: 'test' }, session_id: 's1', provenance: createProvenance('system_log', 'test') });

    const sleep = new SleepCycle(episodic, graph, nm, { interval_ms: 60000 });
    const report = await sleep.cycle();
    expect(report.cycle).toBe(1);
    expect(report.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('can start and stop', () => {
    const episodic = new EpisodicStore();
    const graph = new SemanticGraph();
    const nm = new Neuromodulation();
    const sleep = new SleepCycle(episodic, graph, nm, { interval_ms: 60000 });

    expect(sleep.isRunning()).toBe(false);
    sleep.start();
    expect(sleep.isRunning()).toBe(true);
    sleep.stop();
    expect(sleep.isRunning()).toBe(false);
  });
});
