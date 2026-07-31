import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CognitiveKernel } from '../../kernel/cognitive-kernel.js';
import {
  NeuralFS,
  ConceptStore,
  ExperienceStore,
  SkillStore,
  WorldModel,
  ProjectStore,
} from '../index.js';
import { BeliefStore } from '../belief-store.js';
import { GoalStore } from '../goal-store.js';
import { ReasoningTraceStore } from '../reasoning-trace-store.js';
import { VectorStore } from '../../kernel/storage/vector-store.js';
import { GraphStore } from '../../kernel/storage/graph-store.js';

function makeKernel(projectId = 'alpha') {
  return new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: projectId });
}

describe('NeuralFS', () => {
  let kernel: CognitiveKernel;
  let fs: NeuralFS;

  beforeEach(() => {
    kernel = makeKernel();
    fs = new NeuralFS(kernel);
  });

  it('lists the five root directories', () => {
    const entries = fs.ls('/');
    expect(entries.map((e) => e.name).sort()).toEqual([
      'concepts',
      'experiences',
      'projects',
      'skills',
      'world',
    ]);
    expect(entries.every((e) => e.type === 'directory')).toBe(true);
  });

  it('normalizes backslash paths', () => {
    expect(fs.ls('\\concepts').map((e) => e.name)).toEqual([]);
    expect(fs.ls('\\')).toEqual(fs.ls('/'));
  });

  it('writes and reads concepts', async () => {
    await fs.write('/concepts', { name: 'cat', type: 'entity', definition: 'a feline' });
    const entries = fs.ls('/concepts');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('cat');
    const concept = await fs.read(entries[0]!.path);
    expect(concept).toMatchObject({ name: 'cat', definition: 'a feline' });
  });

  it('writes and reads experiences with size metadata', async () => {
    const content = 'learned something new today';
    await fs.write('/experiences', { content });
    const entries = fs.ls('/experiences');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.size).toBe(JSON.stringify({ type: 'text', text: content }).length);
    const read = await fs.read(entries[0]!.path);
    expect(read).toMatchObject({ content: { text: content } });
  });

  it('writes and reads skills', async () => {
    fs.write('/skills', { name: 'test-writer', pattern: 'write tests', description: 'TDD' });
    const entries = fs.ls('/skills');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('test-writer');
    const skill = await fs.read(entries[0]!.path);
    expect(skill).toMatchObject({ name: 'test-writer', confidence: 0.5 });
  });

  it('exposes world facts and predictions as directories', async () => {
    await kernel.learnEvidence('sky is blue', 'direct observation', 0.9);
    fs.world.predict('it will rain', 0.6);
    expect(fs.ls('/world/facts')).toHaveLength(1);
    expect(fs.ls('/world/predictions')).toHaveLength(1);
    expect(fs.ls('/world').map((e) => e.name).sort()).toEqual(['facts', 'predictions']);
  });

  it('lists registered projects', () => {
    fs.projects.register('p1', 'Project One', 'first project');
    const entries = fs.ls('/projects');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('Project One');
    expect(entries[0]!.path).toBe('/projects/p1');
  });

  it('rejects writes to unknown domains and reads of unknown paths', async () => {
    await expect(fs.write('/unknown', {})).resolves.toBe(false);
    await expect(fs.read('/unknown/thing')).resolves.toBeNull();
    await expect(fs.read('/concepts/missing-id')).resolves.toBeUndefined();
  });

  it('observes a path on an interval until unsubscribed', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const unsubscribe = await fs.observe('/concepts', callback);
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledWith({ type: 'read', path: '/concepts' });
    unsubscribe();
    vi.advanceTimersByTime(15000);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('ConceptStore', () => {
  let kernel: CognitiveKernel;
  let store: ConceptStore;

  beforeEach(() => {
    kernel = makeKernel();
    store = new ConceptStore(kernel);
  });

  it('creates and reads concepts by id', async () => {
    const concept = await store.create('dog', 'entity', 'a canine');
    expect(concept.name).toBe('dog');
    expect(store.read(concept.id)).toMatchObject({ name: 'dog' });
    expect(store.read('nope')).toBeUndefined();
  });

  it('finds concepts by name', async () => {
    await store.create('dog', 'entity', 'a canine');
    expect(store.find('dog')).toMatchObject({ concept_type: 'entity' });
    expect(store.find('cat')).toBeUndefined();
  });

  it('lists all concepts as directory entries', async () => {
    await store.create('dog', 'entity', 'a canine');
    await store.create('running', 'process', 'moving fast');
    const entries = store.listAll();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.name).sort()).toEqual(['dog', 'running']);
    for (const e of entries) {
      expect(e.importance).toBeGreaterThanOrEqual(0);
      expect(e.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  it('search returns an array without throwing', async () => {
    await store.create('dog', 'entity', 'a canine');
    const results = await store.search('dog');
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('ExperienceStore', () => {
  let kernel: CognitiveKernel;
  let store: ExperienceStore;

  beforeEach(() => {
    kernel = makeKernel();
    store = new ExperienceStore(kernel);
  });

  it('records experiences into the kernel', async () => {
    const episode = await store.record({ type: 'text', text: 'first day notes' }, { concepts: ['work'] });
    expect(episode.content).toEqual({ type: 'text', text: 'first day notes' });
    expect(episode.concepts).toEqual(['work']);
  });

  it('lists recent experiences as entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await store.record({ type: 'text', text: 'alpha notes' });
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    await store.record({ type: 'text', text: 'beta notes' });
    const recent = store.recent(10);
    expect(recent).toHaveLength(2);
    expect(recent[0]!.summary).toContain('beta notes');
    expect(recent[1]!.summary).toContain('alpha notes');
    expect(recent[0]!.timestamp).toBeTruthy();
    vi.useRealTimers();
  });

  it('queries experiences within a time range', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await store.record({ type: 'text', text: 'old note' });
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    const start = new Date();
    await store.record({ type: 'text', text: 'new note' });
    const end = new Date(Date.now() + 1000);
    const inRange = await store.query({ start, end }, 10);
    expect(inRange.map((e) => e.summary)).toEqual([expect.stringContaining('new note')]);
    vi.useRealTimers();
  });
});

describe('SkillStore', () => {
  let store: SkillStore;

  beforeEach(() => {
    store = new SkillStore(makeKernel());
  });

  it('learns a skill with defaults', () => {
    const skill = store.learn('refactor', 'extract function', 'improve code');
    expect(skill.confidence).toBe(0.5);
    expect(skill.invocation_count).toBe(0);
    expect(skill.id).toBeTruthy();
    expect(store.count).toBe(1);
  });

  it('finds skills by name', () => {
    const skill = store.learn('refactor', 'extract function', 'improve code');
    expect(store.find('refactor')?.id).toBe(skill.id);
    expect(store.find('missing')).toBeUndefined();
  });

  it('searches by name, description, or pattern substring', () => {
    store.learn('refactor', 'extract function', 'improve code');
    store.learn('testing', 'write tests', 'verify behavior');
    expect(store.search('refactor')).toHaveLength(1);
    expect(store.search('extract')).toHaveLength(1);
    expect(store.search('verify')).toHaveLength(1);
    expect(store.search('nothing')).toHaveLength(0);
  });

  it('increments invocation count and confidence on invoke', () => {
    const skill = store.learn('refactor', 'extract function', 'improve code');
    const invoked = store.invoke(skill.id)!;
    expect(invoked.invocation_count).toBe(1);
    expect(invoked.confidence).toBeCloseTo(0.55, 5);
    expect(store.invoke('missing')).toBeUndefined();
  });

  it('lists all registered skills', () => {
    store.learn('a', 'p1', 'd1');
    store.learn('b', 'p2', 'd2');
    expect(store.listAll()).toHaveLength(2);
  });
});

describe('ProjectStore', () => {
  let kernel: CognitiveKernel;
  let store: ProjectStore;

  beforeEach(() => {
    kernel = makeKernel('alpha');
    store = new ProjectStore(kernel);
  });

  it('registers and retrieves project memory', () => {
    const entry = store.register('alpha', 'Alpha', 'the alpha project');
    expect(entry.episodeCount).toBe(0);
    expect(store.get('alpha')).toEqual(entry);
    expect(store.get('missing')).toBeUndefined();
  });

  it('lists projects sorted by most recent activity', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    store.register('old', 'Old', 'older project');
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    store.register('new', 'New', 'newer project');
    const list = store.listProjects();
    expect(list.map((p) => p.projectId)).toEqual(['new', 'old']);
    vi.useRealTimers();
  });

  it('records activity counts from the kernel', async () => {
    store.register('alpha', 'Alpha', 'the alpha project');
    await kernel.remember({ content: { type: 'text', text: 'alpha work' } });
    await store.recordActivity('alpha');
    const entry = store.get('alpha')!;
    expect(entry.episodeCount).toBeGreaterThanOrEqual(1);
    expect(entry.conceptCount).toBe(kernel.getStats().concepts);
  });

  it('recallProjectContext returns formatted recall', async () => {
    store.register('alpha', 'Alpha', 'the alpha project');
    await kernel.remember({ content: { type: 'text', text: 'alpha work' } });
    const context = await store.recallProjectContext('alpha', 'alpha');
    expect(typeof context).toBe('string');
  });
});

describe('WorldModel', () => {
  let kernel: CognitiveKernel;
  let world: WorldModel;

  beforeEach(() => {
    kernel = makeKernel();
    world = new WorldModel(kernel);
  });

  it('learns propositions and lists them as facts with epistemic status', async () => {
    await world.learn('the sky is blue', 'direct observation', 0.95);
    const facts = world.listFacts();
    expect(facts).toHaveLength(1);
    expect(facts[0]!.statement).toBe('the sky is blue');
    expect(facts[0]!.confidence).toBeGreaterThan(0);
    expect(facts[0]!.epistemicStatus).toBeTruthy();
  });

  it('sorts facts by confidence descending', async () => {
    await world.learn('confident fact', 'observation a', 0.95);
    await world.learn('shaky fact', 'rumor', 0.5);
    const facts = world.listFacts();
    expect(facts[0]!.statement).toBe('confident fact');
  });

  it('tracks pending, confirmed, and refuted predictions', () => {
    world.predict('it will rain', 0.6);
    world.predict('the sun will rise', 0.9);
    world.confirmPrediction('the sun will rise', 'it did');
    world.refutePrediction('it will rain', 'it did not');
    const predictions = world.listPredictions();
    expect(predictions.find((p) => p.hypothesis === 'it will rain')?.outcome).toBe('refuted');
    expect(predictions.find((p) => p.hypothesis === 'the sun will rise')?.outcome).toBe('confirmed');
    expect(predictions.find((p) => p.hypothesis === 'the sun will rise')?.evidence).toContain('it did');
    world.confirmPrediction('never made', 'x');
  });

  it('computes a truth score as a weighted blend', async () => {
    expect(world.truthScore('claim', 1.0, 1.0, 0.0)).toBeCloseTo(0.7, 5);
    await world.learn('claim', 'evidence', 0.9);
    expect(world.truthScore('claim', 1.0, 1.0, 0.0)).toBeCloseTo(0.8, 5);
  });

  it('exposes the kernel belief set', async () => {
    await world.learn('a fact', 'evidence', 0.9);
    const beliefs = world.getBeliefs();
    expect(beliefs.propositions.has('a fact')).toBe(true);
  });
});

describe('BeliefStore (sqlite-backed)', () => {
  let dir: string;
  let vectors: VectorStore;
  let graph: GraphStore;
  let store: BeliefStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-belief-'));
    vectors = new VectorStore(dir, 8);
    graph = new GraphStore(dir);
    store = new BeliefStore(vectors, graph);
  });

  afterEach(() => {
    graph.close();
    vectors.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts beliefs with confidence >= 0.7 and hypothesizes below', () => {
    const accepted = store.addBelief('the earth is round', 0.9, ['src-1']);
    const hypothesis = store.addBelief('aliens exist', 0.5, ['src-2']);
    expect(accepted.status).toBe('accepted');
    expect(hypothesis.status).toBe('hypothesis');
    expect(store.count()).toBe(2);
  });

  it('registers belief nodes and source-reference edges in the graph', () => {
    const belief = store.addBelief('a claim', 0.8, ['src-1']);
    const node = graph.getNode(belief.id);
    expect(node?.type).toBe('belief');
    expect(graph.getEdgesFrom(belief.id)).toHaveLength(1);
  });

  it('flags contradictory beliefs as contested', () => {
    store.addBelief('the sky is blue', 0.8, ['src-1'], ['sky']);
    store.addBelief('the sky is not blue', 0.8, ['src-2'], ['sky']);
    expect(store.getContestedBeliefs()).toHaveLength(2);
    for (const belief of store.getContestedBeliefs()) {
      expect(belief.contradictingEvidence).toHaveLength(1);
    }
  });

  it('does not contest beliefs without negation conflict', () => {
    store.addBelief('the sky is blue', 0.8, [], ['sky']);
    store.addBelief('the ocean is blue', 0.8, [], ['blue']);
    expect(store.getContestedBeliefs()).toHaveLength(0);
  });

  it('supersedes lower-confidence conflicting accepted beliefs', () => {
    const weak = store.addBelief('the sky is not blue', 0.7, [], ['sky']);
    store.acceptBelief(weak.id);
    const strong = store.addBelief('the sky is blue', 0.95, [], ['sky']);
    store.acceptBelief(strong.id);
    const weakNow = store.getBelief(weak.id)!;
    expect(weakNow.status).toBe('superseded');
    expect(weakNow.supersededBy).toBe(strong.id);
    expect(store.getBelief(strong.id)!.status).toBe('accepted');
  });

  it('rejects beliefs', () => {
    const belief = store.addBelief('a claim', 0.9, []);
    store.rejectBelief(belief.id);
    expect(store.getBelief(belief.id)!.status).toBe('rejected');
  });

  it('queries by tags and status, sorted by confidence', () => {
    store.addBelief('high confidence claim', 0.9, [], ['math']);
    store.addBelief('low confidence claim', 0.6, [], ['math']);
    store.addBelief('unrelated claim', 0.8, [], ['other']);
    const tagged = store.queryBeliefs(['math']);
    expect(tagged).toHaveLength(2);
    expect(tagged[0]!.confidence).toBeGreaterThan(tagged[1]!.confidence);
    expect(store.queryBeliefs(undefined, 'hypothesis')).toHaveLength(1);
    expect(store.getAcceptedBeliefs()).toHaveLength(2);
  });
});

describe('GoalStore (sqlite-backed)', () => {
  let dir: string;
  let vectors: VectorStore;
  let graph: GraphStore;
  let store: GoalStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-goal-'));
    vectors = new VectorStore(dir, 8);
    graph = new GraphStore(dir);
    store = new GoalStore(vectors, graph);
  });

  afterEach(() => {
    graph.close();
    vectors.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates active goals with defaults', () => {
    const goal = store.createGoal('Ship v1', 'release the product');
    expect(goal.status).toBe('active');
    expect(goal.priority).toBe('medium');
    expect(goal.progress).toBe(0);
    expect(goal.createdBy).toBe('system');
    expect(goal.tags).toEqual([]);
  });

  it('builds parent-child hierarchies with graph edges', () => {
    const parent = store.createGoal('Parent', 'top goal');
    const child = store.createGoal('Child', 'sub goal', 'high', { parentGoalId: parent.id });
    const hierarchy = store.getGoalHierarchy(parent.id)!;
    expect(hierarchy.children).toHaveLength(1);
    expect(hierarchy.children[0]!.id).toBe(child.id);
    expect(graph.getEdgesFrom(parent.id).some((e) => e.relationship === 'contains')).toBe(true);
    expect(store.getGoalHierarchy('missing')).toBeNull();
  });

  it('blocks goals whose dependencies are incomplete', () => {
    const dependency = store.createGoal('Prep work', 'do prep');
    const dependent = store.createGoal('Build', 'build it', 'high', { dependencies: [dependency.id] });
    expect(dependent.status).toBe('blocked');
    store.updateProgress(dependency.id, 100);
    store.updateProgress(dependent.id, 0);
    const unblocked = store.getGoal(dependent.id)!;
    expect(unblocked.status).toBe('active');
    expect(unblocked.blockedBy).toEqual([]);
  });

  it('completes goals at 100% progress with clamping', () => {
    const goal = store.createGoal('Finish', 'do the thing');
    store.updateProgress(goal.id, 150);
    expect(store.getGoal(goal.id)!.progress).toBe(100);
    expect(store.getGoal(goal.id)!.status).toBe('completed');
    store.updateProgress(goal.id, -10);
    expect(store.getGoal(goal.id)!.progress).toBe(0);
  });

  it('propagates progress from children to parents', () => {
    const parent = store.createGoal('Parent', 'top goal');
    const c1 = store.createGoal('C1', 'child one', 'high', { parentGoalId: parent.id });
    const c2 = store.createGoal('C2', 'child two', 'high', { parentGoalId: parent.id });
    store.updateProgress(c1.id, 100);
    store.updateProgress(c2.id, 50);
    expect(store.getGoal(parent.id)!.progress).toBe(75);
  });

  it('sets status, adds notes, and counts goals', () => {
    const a = store.createGoal('Active', 'active goal', 'critical');
    const b = store.createGoal('Later', 'paused goal', 'low');
    store.setStatus(b.id, 'paused');
    store.addNote(a.id, 'first note');
    expect(store.getGoal(a.id)!.notes).toEqual(['first note']);
    expect(store.count()).toEqual({ total: 2, active: 1, completed: 0, blocked: 0 });
    expect(store.getActiveGoals()).toHaveLength(1);
    expect(store.getActiveGoals('critical')).toHaveLength(1);
    expect(store.getActiveGoals('high')).toHaveLength(0);
    expect(store.getGoal('missing')).toBeUndefined();
  });

  it('orders active goals by priority', () => {
    store.createGoal('Low', 'low priority', 'low');
    store.createGoal('Critical', 'critical priority', 'critical');
    store.createGoal('Medium', 'medium priority', 'medium');
    const active = store.getActiveGoals();
    expect(active.map((g) => g.priority)).toEqual(['critical', 'medium', 'low']);
  });
});

describe('ReasoningTraceStore (sqlite-backed)', () => {
  let dir: string;
  let vectors: VectorStore;
  let graph: GraphStore;
  let store: ReasoningTraceStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-trace-'));
    vectors = new VectorStore(dir, 8);
    graph = new GraphStore(dir);
    store = new ReasoningTraceStore(vectors, graph);
  });

  afterEach(() => {
    graph.close();
    vectors.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts traces with a goal and empty steps', () => {
    const trace = store.startTrace('fix the bug', 'session-1', ['debug']);
    expect(trace.steps).toEqual([]);
    expect(trace.conclusion).toBeNull();
    expect(trace.completedAt).toBeNull();
    expect(graph.getNode(trace.id)?.type).toBe('reasoning-trace');
  });

  it('adds steps with sequence edges', () => {
    const trace = store.startTrace('fix the bug', 'session-1');
    const step1 = store.addStep(trace.id, 'observation', 'bug appears', 'reproduced', 0.9);
    const step2 = store.addStep(trace.id, 'hypothesis', 'why', 'likely cause', 0.7, ['premise-a']);
    expect(step1).not.toBeNull();
    expect(step2).not.toBeNull();
    const sequenceEdges = graph.getEdgesFrom(`step-${trace.id}-0`).filter((e) => e.relationship === 'leads-to');
    expect(sequenceEdges).toHaveLength(1);
    expect(store.addStep('missing-trace', 'observation', 'i', 'o', 0.5)).toBeNull();
  });

  it('links steps to premise nodes when they exist', () => {
    const trace = store.startTrace('fix the bug', 'session-1');
    graph.addNode('premise-a', 'fact', 'premise-a');
    store.addStep(trace.id, 'deduction', 'if a then b', 'b holds', 0.8, ['premise-a']);
    const premiseEdges = graph.getEdgesFrom(`step-${trace.id}-0`).filter((e) => e.relationship === 'uses-premise');
    expect(premiseEdges).toHaveLength(1);
  });

  it('concludes traces and updates stats', () => {
    const trace = store.startTrace('fix the bug', 'session-1');
    store.addStep(trace.id, 'observation', 'in', 'out', 0.8);
    const ok = store.concludeTrace(trace.id, 'root cause found', 0.95);
    expect(ok).toBe(true);
    const finished = store.getTrace(trace.id)!;
    expect(finished.conclusion).toBe('root cause found');
    expect(finished.completedAt).not.toBeNull();
    expect(store.concludeTrace('missing', 'x', 0.5)).toBe(false);
    expect(store.getTraceStats()).toEqual({ total: 1, completed: 1, steps: 1 });
  });

  it('finds traces by session and lists most recent first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    store.startTrace('old trace', 'session-1');
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    store.startTrace('new trace', 'session-1');
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    store.startTrace('other session trace', 'session-2');
    expect(store.getTracesBySession('session-1')).toHaveLength(2);
    expect(store.getTracesBySession('session-2')).toHaveLength(1);
    const recent = store.getRecentTraces(2);
    expect(recent.map((t) => t.goal)).toEqual(['other session trace', 'new trace']);
    vi.useRealTimers();
  });
});
