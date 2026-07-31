import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { createGenome, genomeSummary } from '../workspace-brain/genome.js';
import { createWorkspaceIdentity } from '../workspace-brain/identity.js';
import {
  createWorldModel,
  addDecision,
  addSubsystem,
  worldModelSummary,
} from '../workspace-brain/world-model.js';
import { ArchitectureGraph } from '../workspace-brain/architecture-graph.js';
import { WorkspaceTimeline } from '../workspace-brain/timeline.js';
import { WorkspaceHealth } from '../workspace-brain/health.js';

describe('Genome', () => {
  it('creates a genome with default values', () => {
    const g = createGenome({ workspace_id: 'ws1', name: 'Test', root_path: '/path' });
    expect(g.workspace_id).toBe('ws1');
    expect(g.dna.primary_language).toBe('unknown');
    expect(g.dna.project_type).toBe('single_package');
    expect(g.architecture.module_count).toBe(0);
    expect(g.evolution.commit_count).toBe(0);
  });

  it('accepts optional params', () => {
    const g = createGenome({
      workspace_id: 'ws2',
      name: 'Full',
      root_path: '/p',
      primary_language: 'TypeScript',
      project_type: 'monorepo',
    });
    expect(g.dna.primary_language).toBe('TypeScript');
    expect(g.dna.project_type).toBe('monorepo');
  });

  it('generates a summary', () => {
    const g = createGenome({ workspace_id: 'ws1', name: 'MyApp', root_path: '/app' });
    const summary = genomeSummary(g);
    expect(summary).toContain('MyApp');
    expect(summary).toContain('single_package');
    expect(summary).toContain('clean');
  });
});

describe('Identity', () => {
  it('creates with defaults', () => {
    const id = createWorkspaceIdentity({ workspace_id: 'ws1', name: 'Test' });
    expect(id.name).toBe('Test');
    expect(id.personality.naming_convention).toBe('mixed');
    expect(id.goals).toEqual([]);
    expect(id.dependencies).toEqual([]);
  });

  it('accepts optional mission and purpose', () => {
    const id = createWorkspaceIdentity({
      workspace_id: 'ws1',
      name: 'App',
      purpose: 'Build great software',
      mission: 'Ship fast',
    });
    expect(id.purpose).toBe('Build great software');
    expect(id.mission).toBe('Ship fast');
  });
});

describe('WorldModel', () => {
  it('creates an empty model', () => {
    const m = createWorldModel();
    expect(m.subsystems.size).toBe(0);
    expect(m.decisions.length).toBe(0);
    expect(m.current_sprint).toBeNull();
  });

  it('adds decisions', () => {
    const m = createWorldModel();
    const d = addDecision(m, {
      title: 'Use React',
      context: 'Need a UI framework',
      decision: 'Use React 18',
      alternatives: ['Vue', 'Svelte'],
      rationale: 'Best ecosystem',
      consequences: ['Larger bundle'],
      status: 'active',
    });
    expect(m.decisions.length).toBe(1);
    expect(d.title).toBe('Use React');
    expect(d.id).toBeTruthy();
    expect(d.date).toBeInstanceOf(Date);
  });

  it('adds subsystems', () => {
    const m = createWorldModel();
    const s = addSubsystem(m, {
      name: 'Auth Service',
      path: 'services/auth',
      type: 'service',
      dependencies: [],
      consumers: [],
      ownership: 'team-a',
      health: 'healthy',
      description: 'Handles authentication',
    });
    expect(m.subsystems.size).toBe(1);
    expect(s.name).toBe('Auth Service');
    expect(s.id).toBeTruthy();
  });

  it('generates summary', () => {
    const m = createWorldModel();
    m.current_sprint = 'Sprint 12';
    const summary = worldModelSummary(m);
    expect(summary).toContain('Sprint 12');
    expect(summary).toContain('Subsystems: 0');
  });
});

describe('ArchitectureGraph', () => {
  let graph: ArchitectureGraph;

  beforeEach(() => {
    graph = new ArchitectureGraph();
  });

  it('starts empty', () => {
    expect(graph.getNodeCount()).toBe(0);
    expect(graph.getEdgeCount()).toBe(0);
  });

  it('adds and retrieves nodes', () => {
    graph.addNode({ id: 'a', name: 'Module A', type: 'module', path: 'src/a', metadata: {} });
    expect(graph.getNode('a')?.name).toBe('Module A');
    expect(graph.getNodeCount()).toBe(1);
  });

  it('adds edges and finds dependencies', () => {
    graph.addNode({ id: 'a', name: 'A', type: 'module', path: '/a', metadata: {} });
    graph.addNode({ id: 'b', name: 'B', type: 'module', path: '/b', metadata: {} });
    graph.addEdge({ source: 'a', target: 'b', relationship: 'depends_on', weight: 1 });

    const deps = graph.getDependencies('a');
    expect(deps.length).toBe(1);
    expect(deps[0]!.name).toBe('B');
  });

  it('finds dependents', () => {
    graph.addNode({ id: 'a', name: 'A', type: 'module', path: '/a', metadata: {} });
    graph.addNode({ id: 'b', name: 'B', type: 'module', path: '/b', metadata: {} });
    graph.addEdge({ source: 'a', target: 'b', relationship: 'depends_on', weight: 1 });

    const dependents = graph.getDependents('b');
    expect(dependents.length).toBe(1);
    expect(dependents[0]!.name).toBe('A');
  });
});

describe('WorkspaceTimeline', () => {
  it('adds events and retrieves by type', () => {
    const tl = new WorkspaceTimeline();
    const e = tl.addEvent({
      type: 'commit',
      timestamp: new Date(),
      title: 'Fix bug',
      description: 'Fixed the thing',
      tags: ['fix'],
      metadata: { hash: 'abc123' },
    });
    expect(e.id).toBeTruthy();
    expect(tl.getEventCount()).toBe(1);
    expect(tl.getByType('commit').length).toBe(1);
  });

  it('retrieves recent events sorted by time', () => {
    const tl = new WorkspaceTimeline();
    tl.addEvent({
      type: 'commit',
      timestamp: new Date(2020, 1, 1),
      title: 'Old',
      description: '',
      tags: [],
      metadata: {},
    });
    tl.addEvent({
      type: 'decision',
      timestamp: new Date(2024, 1, 1),
      title: 'New',
      description: '',
      tags: [],
      metadata: {},
    });

    const recent = tl.getRecent(10);
    expect(recent[0]!.title).toBe('New');
    expect(recent[1]!.title).toBe('Old');
  });

  it('filters by time range', () => {
    const tl = new WorkspaceTimeline();
    const start = new Date(2023, 1, 1);
    const end = new Date(2023, 12, 31);
    tl.addEvent({
      type: 'commit',
      timestamp: new Date(2023, 6, 15),
      title: 'Mid',
      description: '',
      tags: [],
      metadata: {},
    });
    tl.addEvent({
      type: 'commit',
      timestamp: new Date(2024, 1, 1),
      title: 'Outside',
      description: '',
      tags: [],
      metadata: {},
    });

    expect(tl.getByTimeRange(start, end).length).toBe(1);
  });
});

describe('WorkspaceHealth', () => {
  it('sets and retrieves metrics', () => {
    const h = new WorkspaceHealth();
    h.setMetric('test_pass_rate', 0.95, 0.8, '%');
    const m = h.getMetric('test_pass_rate');
    expect(m?.value).toBe(0.95);
    expect(m?.status).toBe('good');
  });

  it('classifies warning status (higher is better)', () => {
    const h = new WorkspaceHealth();
    h.setMetric('coverage', 0.75, 1.0, '%');
    expect(h.getMetric('coverage')?.status).toBe('warning');
  });

  it('classifies critical status (higher is better)', () => {
    const h = new WorkspaceHealth();
    h.setMetric('coverage', 0.5, 1.0, '%');
    expect(h.getMetric('coverage')?.status).toBe('critical');
  });

  it('classifies metrics where lower is better', () => {
    const h = new WorkspaceHealth();
    h.setMetric('errors', 100, 50, 'count', false);
    expect(h.getMetric('errors')?.status).toBe('critical');
    h.setMetric('errors', 60, 50, 'count', false);
    expect(h.getMetric('errors')?.status).toBe('warning');
    h.setMetric('errors', 10, 50, 'count', false);
    expect(h.getMetric('errors')?.status).toBe('good');
  });

  it('tracks incidents', () => {
    const h = new WorkspaceHealth();
    h.logIncident('Out of memory');
    h.logIncident('Timeout');
    expect(h.getIncidents().length).toBe(2);
    expect(h.getIncidents(1).length).toBe(1);
  });

  it('computes overall status', () => {
    const h = new WorkspaceHealth();
    expect(h.getOverallStatus()).toBe('healthy');
    h.setMetric('critical_metric', 0.1, 1.0, 'count');
    expect(h.getOverallStatus()).toBe('critical');
  });

  it('generates summary', () => {
    const h = new WorkspaceHealth();
    h.setMetric('pass', 0.95, 0.8, '%');
    h.setMetric('warn', 0.75, 1.0, '%', true);
    const s = h.summary();
    expect(s).toContain('healthy');
    expect(s).toContain('warning');
  });
});

describe('WorkspaceBrain (integration)', () => {
  let brain: WorkspaceBrain;

  beforeEach(() => {
    const bus = new NeuralEventBus();
    brain = new WorkspaceBrain({
      workspace_id: 'ws1',
      name: 'Test WS',
      root_path: '/workspace/test',
      eventBus: bus,
    });
  });

  it('initializes with default metrics', () => {
    expect(brain.genome.name).toBe('Test WS');
    expect(brain.health.getMetric('test_pass_rate')?.value).toBe(1.0);
  });

  it('adds decisions with timeline integration', () => {
    const d = brain.addDecision({
      title: 'Refactor auth',
      context: 'Need better auth',
      decision: 'Switch to OAuth2',
      alternatives: ['JWT'],
      rationale: 'More secure',
      consequences: ['More complex'],
      status: 'active',
    });
    expect(d.id).toBeTruthy();
    expect(brain.timeline.getEventCount()).toBe(1);
    expect(brain.timeline.getByType('decision').length).toBe(1);
  });

  it('records architecture nodes and updates genome', () => {
    brain.recordArchitectureNode({
      id: 'mod1',
      name: 'Core',
      type: 'module',
      path: 'src/core',
      metadata: {},
    });
    expect(brain.genome.architecture.module_count).toBe(1);
  });

  it('creates timeline events', () => {
    const e = brain.logTimelineEvent({
      type: 'release',
      timestamp: new Date(),
      title: 'v1.0',
      description: 'First release',
      tags: ['release'],
      metadata: {},
    });
    expect(e.type).toBe('release');
    expect(brain.timeline.getEventCount()).toBe(1);
  });

  it('updates health metrics', () => {
    brain.updateHealthMetric('custom_metric', 50, 100, 'ms');
    expect(brain.health.getMetric('custom_metric')?.value).toBe(50);
  });

  it('generates a summary', () => {
    const s = brain.summary();
    expect(s).toContain('Workspace Brain');
    expect(s).toContain('Test WS');
  });

  it('records failures from handoff protocols', async () => {
    const bus = new NeuralEventBus();
    const workspace = new WorkspaceBrain({
      workspace_id: 'ws2',
      name: 'Failure WS',
      root_path: '/workspace/failure',
      eventBus: bus,
    });

    await bus.publishProtocol(
      'module:handoff',
      'uch',
      {
        intent: 'error-report',
        message: 'Database connection failed',
      },
      ['workspace'],
    );

    expect(workspace.worldModel.known_failures).toContain('Database connection failed');
    expect(workspace.worldModel.open_issues_count).toBe(1);
    expect(workspace.timeline.getByType('incident').length).toBe(1);
  });

  it('does not create duplicate incidents for repeated mistakes', async () => {
    const bus = new NeuralEventBus();
    const workspace = new WorkspaceBrain({
      workspace_id: 'ws3',
      name: 'Duplicate WS',
      root_path: '/workspace/duplicate',
      eventBus: bus,
    });

    await bus.publishProtocol(
      'module:handoff',
      'uch',
      {
        intent: 'error-report',
        message: 'Database connection failed',
      },
      ['workspace'],
    );
    await bus.publishProtocol(
      'module:handoff',
      'uch',
      {
        intent: 'error-report',
        message: 'Database connection failed',
      },
      ['workspace'],
    );

    expect(workspace.worldModel.known_failures).toEqual(['Database connection failed']);
    expect(workspace.timeline.getByType('incident').length).toBe(1);
  });
});
