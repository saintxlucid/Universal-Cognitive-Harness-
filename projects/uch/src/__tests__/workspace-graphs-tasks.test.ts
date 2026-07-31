import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceTaskGraph } from '../workspace-graphs/task-graph.js';

describe('WorkspaceTaskGraph', () => {
  let dir: string;
  let graph: WorkspaceTaskGraph;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-wsg-'));
    graph = new WorkspaceTaskGraph(dir);
  });

  afterEach(() => {
    graph.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('records task nodes with empty properties (no TaskScheduler duplication)', () => {
    graph.recordTask('t1', 'Add auth');
    const node = graph.getTask('t1');
    expect(node!.id).toBe('task:t1');
    expect(node!.type).toBe('task');
    expect(node!.name).toBe('Add auth');
    expect(Object.keys(node!.properties).length).toBe(0);
  });

  it('records dependency edges with provenance', () => {
    graph.recordTask('t1', 'A');
    graph.recordTask('t2', 'B');
    graph.recordDependency('t1', 't2');
    const deps = graph.getDependencies('t1');
    expect(deps.length).toBe(1);
    expect(deps[0]!.id).toBe('dep:t1:t2');
    expect(deps[0]!.relationship).toBe('depends_on');
    expect(deps[0]!.source).toBe('task:t1');
    expect(deps[0]!.target).toBe('task:t2');
    const provenance = deps[0]!.properties.provenance as Record<string, unknown>;
    expect(provenance.source).toBe('system_log');
    expect(typeof provenance.timestamp).toBe('number');
  });

  it('returns empty dependencies for isolated tasks', () => {
    graph.recordTask('t1', 'A');
    expect(graph.getDependencies('t1')).toEqual([]);
  });

  it('records status changes as self-edges', () => {
    graph.recordTask('t1', 'Add auth');
    graph.recordStatusChange('t1', 'pending', 'running');
    const transitions = graph.getStatusTransitions('t1');
    expect(transitions.length).toBe(1);
    expect(transitions[0]!.id).toBe('status:t1:pending:running');
    expect(transitions[0]!.relationship).toBe('status_changed');
    expect(transitions[0]!.source).toBe('task:t1');
    expect(transitions[0]!.target).toBe('task:t1');
    expect(transitions[0]!.properties.from).toBe('pending');
    expect(transitions[0]!.properties.to).toBe('running');
  });

  it('upserts duplicate status transitions', () => {
    graph.recordTask('t1', 'Add auth');
    graph.recordStatusChange('t1', 'pending', 'running');
    graph.recordStatusChange('t1', 'pending', 'running');
    expect(graph.getStatusTransitions('t1').length).toBe(1);
  });

  it('links tasks to files', () => {
    graph.recordTask('t1', 'Add auth');
    graph.recordTaskFile('t1', 'src/feature.ts');
    const edges = graph.getEdgesFrom('task:t1');
    const edge = edges.find((e) => e.id === 'touches:t1:src/feature.ts');
    expect(edge).toBeTruthy();
    expect(edge!.relationship).toBe('touches');
    expect(graph.findPaths('task:t1', 'file:src/feature.ts', 2).length).toBeGreaterThan(0);
  });

  it('links tasks to decisions without creating decision nodes', () => {
    graph.recordTask('t1', 'Add auth');
    const before = graph.nodeCount();
    graph.recordTaskDecision('t1', 'd9');
    expect(graph.nodeCount()).toBe(before);
    const edges = graph.getEdgesFrom('task:t1');
    const edge = edges.find((e) => e.id === 'informed_by:t1:d9');
    expect(edge).toBeTruthy();
    expect(edge!.relationship).toBe('informed_by');
    expect(edge!.source).toBe('task:t1');
    expect(graph.getNode('decision:d9')).toBeNull();
  });

  it('creates a sqlite graph file at the expected path', () => {
    expect(existsSync(join(dir, 'task-graph', 'graph.sqlite'))).toBe(true);
  });

  it('persists and loads manifests', async () => {
    graph.recordTask('t1', 'Add auth');
    graph.recordStatusChange('t1', 'pending', 'running');
    const file = join(dir, 'task-graph.json');
    await graph.persist(file);
    expect(existsSync(file)).toBe(true);
    const expected = graph.nodeCount();
    expect(await graph.load(file)).toBe(expected);
    expect(await graph.load(join(dir, 'missing.json'))).toBe(0);
    expect(graph.getTask('t1')!.name).toBe('Add auth');
  });
});
