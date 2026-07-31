import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { WorkspaceBrain } from '../workspace-brain.js';
import { createGenome, genomeSummary } from '../genome.js';
import { createWorkspaceIdentity } from '../identity.js';
import { createWorldModel, addDecision, addSubsystem, worldModelSummary } from '../world-model.js';
import { ArchitectureGraph } from '../architecture-graph.js';
import { WorkspaceTimeline } from '../timeline.js';
import { WorkspaceHealth } from '../health.js';

// ── Genome edge cases ──

describe('Genome — edge cases', () => {
  it('creates genome with minimal config', () => {
    const g = createGenome({ workspace_id: 'min', name: 'M', root_path: '/' });
    expect(g.workspace_id).toBe('min');
    expect(g.dna.primary_language).toBe('unknown');
  });

  it('handles empty name', () => {
    const g = createGenome({ workspace_id: 'id', name: '', root_path: '/p' });
    expect(g.name).toBe('');
  });

  it('genomeSummary is not empty', () => {
    const g = createGenome({ workspace_id: 'ws', name: 'Test', root_path: '/p' });
    const s = genomeSummary(g);
    expect(s.length).toBeGreaterThan(0);
    expect(typeof s).toBe('string');
  });
});

// ── Identity edge cases ──

describe('Identity — edge cases', () => {
  it('creates with minimal options', () => {
    const id = createWorkspaceIdentity({ workspace_id: 'min', name: 'M' });
    expect(id.name).toBe('M');
    expect(id.personality.naming_convention).toBe('mixed');
  });

  it('handles empty name', () => {
    const id = createWorkspaceIdentity({ workspace_id: 'id', name: '' });
    expect(id.name).toBe('');
  });
});

// ── WorldModel edge cases ──

describe('WorldModel — edge cases', () => {
  it('starts with null sprint', () => {
    const m = createWorldModel();
    expect(m.current_sprint).toBeNull();
    expect(m.decisions).toEqual([]);
  });

  it('addDecision returns record with id and date', () => {
    const m = createWorldModel();
    const d = addDecision(m, {
      title: '', context: '', decision: '', alternatives: [], rationale: '', consequences: [], status: 'active',
    });
    expect(d.id).toBeTruthy();
    expect(d.date).toBeInstanceOf(Date);
  });

  it('addSubsystem assigns default values', () => {
    const m = createWorldModel();
    const s = addSubsystem(m, {
      name: 'Test', path: '/test', type: 'service', dependencies: [], consumers: [], ownership: 'team', health: 'healthy', description: '',
    });
    expect(s.id).toBeTruthy();
    expect(m.subsystems.size).toBe(1);
  });

  it('worldModelSummary handles null sprint', () => {
    const m = createWorldModel();
    const s = worldModelSummary(m);
    expect(s).toContain('Subsystems: 0');
  });
});

// ── ArchitectureGraph edge cases ──

describe('ArchitectureGraph — edge cases', () => {
  let graph: ArchitectureGraph;

  beforeEach(() => {
    graph = new ArchitectureGraph();
  });

  it('getNode returns undefined for missing node', () => {
    expect(graph.getNode('nope')).toBeUndefined();
  });

  it('getDependencies returns empty for missing node', () => {
    expect(graph.getDependencies('nope')).toEqual([]);
  });

  it('getDependents returns empty for missing node', () => {
    expect(graph.getDependents('nope')).toEqual([]);
  });

  it('addEdge does not crash for missing nodes', () => {
    graph.addEdge({
      source: 'nonexistent_a', target: 'nonexistent_b',
      relationship: 'depends_on', weight: 1,
    });
    expect(graph.getNodeCount()).toBe(0);
  });
});

// ── WorkspaceTimeline edge cases ──

describe('WorkspaceTimeline — edge cases', () => {
  let tl: WorkspaceTimeline;

  beforeEach(() => {
    tl = new WorkspaceTimeline();
  });

  it('getEventCount starts at 0', () => {
    expect(tl.getEventCount()).toBe(0);
  });

  it('addEvent assigns an id', () => {
    const e = tl.addEvent({
      type: 'commit', timestamp: new Date(), title: 't', description: '', tags: [], metadata: {},
    });
    expect(e.id).toBeTruthy();
    expect(tl.getEventCount()).toBe(1);
  });

  it('getByType returns empty for unknown type', () => {
    expect(tl.getByType('nonexistent' as any)).toEqual([]);
  });

  it('getRecent returns events sorted newest first', () => {
    tl.addEvent({
      type: 'commit', timestamp: new Date(2020, 1, 1), title: 'Old', description: '', tags: [], metadata: {},
    });
    tl.addEvent({
      type: 'commit', timestamp: new Date(2024, 1, 1), title: 'New', description: '', tags: [], metadata: {},
    });
    const recent = tl.getRecent(10);
    expect(recent[0]!.title).toBe('New');
    expect(recent[1]!.title).toBe('Old');
  });

  it('getByTimeRange returns empty for no overlap', () => {
    tl.addEvent({
      type: 'commit', timestamp: new Date(2023, 6, 1), title: 'Mid', description: '', tags: [], metadata: {},
    });
    expect(tl.getByTimeRange(new Date(2020, 1, 1), new Date(2020, 12, 31))).toHaveLength(0);
  });
});

// ── WorkspaceHealth edge cases ──

describe('WorkspaceHealth — edge cases', () => {
  let h: WorkspaceHealth;

  beforeEach(() => {
    h = new WorkspaceHealth();
  });

  it('getMetric returns undefined for unknown', () => {
    expect(h.getMetric('nope')).toBeUndefined();
  });

  it('classifies metrics correctly (higher is better)', () => {
    h.setMetric('coverage', 0.95, 0.8, '%');
    expect(h.getMetric('coverage')?.status).toBe('good');
    h.setMetric('coverage', 0.75, 0.8, '%');
    expect(h.getMetric('coverage')?.status).toBe('warning');
    h.setMetric('coverage', 0.3, 0.8, '%');
    expect(h.getMetric('coverage')?.status).toBe('critical');
  });

  it('classifies metrics correctly (lower is better)', () => {
    h.setMetric('errors', 10, 50, 'count', false);
    expect(h.getMetric('errors')?.status).toBe('good');
    h.setMetric('errors', 60, 50, 'count', false);
    expect(h.getMetric('errors')?.status).toBe('warning');
    h.setMetric('errors', 100, 50, 'count', false);
    expect(h.getMetric('errors')?.status).toBe('critical');
  });

  it('logIncident tracks multiple incidents', () => {
    h.logIncident('Error 1');
    h.logIncident('Error 2');
    h.logIncident('Error 3');
    expect(h.getIncidents()).toHaveLength(3);
    expect(h.getIncidents(2)).toHaveLength(2);
  });

  it('getOverallStatus starts as healthy', () => {
    expect(h.getOverallStatus()).toBe('healthy');
  });

  it('getOverallStatus reflects critical metrics', () => {
    h.setMetric('critical_metric', 0.1, 1.0, 'count');
    expect(h.getOverallStatus()).toBe('critical');
  });

  it('summary includes all metric statuses', () => {
    h.setMetric('pass', 0.95, 0.8, '%');
    const s = h.summary();
    expect(s).toContain('healthy');
  });
});

// ── WorkspaceBrain integration edge cases ──

describe('WorkspaceBrain — integration edge cases', () => {
  let brain: WorkspaceBrain;
  let bus: NeuralEventBus;

  beforeEach(() => {
    bus = new NeuralEventBus();
    brain = new WorkspaceBrain({
      workspace_id: 'edge-test',
      name: 'Edge Test',
      root_path: '/workspace/edge',
      eventBus: bus,
    });
  });

  it('initializes with default metrics', () => {
    expect(brain.genome.name).toBe('Edge Test');
    expect(brain.genome.workspace_id).toBe('edge-test');
    expect(brain.genome.architecture.module_count).toBe(0);
    expect(brain.health.getMetric('test_pass_rate')?.value).toBe(1.0);
  });

  it('addDecision integrates with timeline', () => {
    const d = brain.addDecision({
      title: 'Use React',
      context: 'UI framework',
      decision: 'React 18',
      alternatives: ['Vue'],
      rationale: 'Best ecosystem',
      consequences: ['Size'],
      status: 'active',
    });
    expect(d.title).toBe('Use React');
    expect(brain.timeline.getEventCount()).toBe(1);
    expect(brain.timeline.getByType('decision').length).toBe(1);
  });

  it('recordArchitectureNode updates genome module count', () => {
    brain.recordArchitectureNode({
      id: 'mod1', name: 'Module 1', type: 'module', path: 'src/mod1', metadata: {},
    });
    expect(brain.genome.architecture.module_count).toBe(1);
  });

  it('recordArchitectureEdge does not crash', () => {
    brain.recordArchitectureNode({ id: 'a', name: 'A', type: 'module', path: '/a', metadata: {} });
    brain.recordArchitectureNode({ id: 'b', name: 'B', type: 'module', path: '/b', metadata: {} });
    brain.recordArchitectureEdge({ source: 'a', target: 'b', relationship: 'depends_on', weight: 1 });
    expect(brain.architecture.getEdgeCount()).toBe(1);
  });

  it('logTimelineEvent adds event and returns it', () => {
    const e = brain.logTimelineEvent({
      type: 'milestone', timestamp: new Date(), title: 'v1.0', description: 'Released', tags: ['release'], metadata: {},
    });
    expect(e.type).toBe('milestone');
    expect(brain.timeline.getEventCount()).toBe(1);
  });

  it('updateHealthMetric updates existing metrics', () => {
    brain.updateHealthMetric('test_pass_rate', 0.5, 0.8, '%');
    expect(brain.health.getMetric('test_pass_rate')?.value).toBe(0.5);
    expect(brain.health.getMetric('test_pass_rate')?.status).toBe('critical');
  });

  it('records failure signals from handoff protocol', async () => {
    await bus.publishProtocol('module:handoff', 'uch', {
      intent: 'error-report', message: 'Something failed',
    });
    expect(brain.worldModel.known_failures).toContain('Something failed');
    expect(brain.worldModel.open_issues_count).toBe(1);
    expect(brain.timeline.getByType('incident').length).toBe(1);
  });

  it('ignores empty failure messages', async () => {
    await bus.publishProtocol('module:handoff', 'uch', {
      intent: 'error-report', message: '',
    });
    expect(brain.timeline.getByType('incident').length).toBe(0);
  });

  it('ignores non-failure handoff signals', async () => {
    await bus.publishProtocol('module:handoff', 'uch', {
      intent: 'info-update', message: 'progress update',
    });
    expect(brain.timeline.getByType('incident').length).toBe(0);
  });

  it('deduplicates repeated failure signals', async () => {
    const msg = 'Repeated error';
    await bus.publishProtocol('module:handoff', 'uch', { intent: 'error-report', message: msg });
    await bus.publishProtocol('module:handoff', 'uch', { intent: 'error-report', message: msg });
    expect(brain.worldModel.known_failures).toEqual([msg]);
    expect(brain.timeline.getByType('incident').length).toBe(1);
  });

  it('handles memory ingest from protocol', async () => {
    await bus.publishProtocol('memory:ingest', 'uch', { observation: 'Test memory' });
    expect(brain.timeline.getEventCount()).toBe(1);
    expect(brain.timeline.getByType('milestone').length).toBe(1);
  });

  it('generates summary with all sections', () => {
    const s = brain.summary();
    expect(s).toContain('Workspace Brain');
    expect(s).toContain('Identity');
    expect(s).toContain('Timeline events');
    expect(s).toContain('Architecture nodes');
  });
});
