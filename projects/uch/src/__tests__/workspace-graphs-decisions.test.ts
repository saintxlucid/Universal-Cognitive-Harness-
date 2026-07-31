import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceDecisionGraph } from '../workspace-graphs/decision-graph.js';

describe('WorkspaceDecisionGraph', () => {
  let dir: string;
  let graph: WorkspaceDecisionGraph;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-wsg-'));
    graph = new WorkspaceDecisionGraph(dir);
  });

  afterEach(() => {
    graph.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('records decision nodes with empty properties (no DecisionLog duplication)', () => {
    graph.recordDecision('d1', 'Use React');
    const node = graph.getDecision('d1');
    expect(node!.id).toBe('decision:d1');
    expect(node!.type).toBe('decision');
    expect(node!.name).toBe('Use React');
    expect(Object.keys(node!.properties).length).toBe(0);
  });

  it('records relations with provenance and confidence', () => {
    graph.recordDecision('d1', 'Use React');
    graph.recordDecision('d2', 'Use Vue');
    graph.recordRelation('d1', 'd2', 'supersedes');
    const relations = graph.getRelations('d1');
    expect(relations.length).toBe(1);
    expect(relations[0]!.id).toBe('supersedes:d1:d2');
    expect(relations[0]!.relationship).toBe('supersedes');
    expect(relations[0]!.source).toBe('decision:d1');
    expect(relations[0]!.target).toBe('decision:d2');
    const provenance = relations[0]!.properties.provenance as Record<string, unknown>;
    expect(provenance.source).toBe('system_log');
    expect(typeof provenance.timestamp).toBe('number');
    const confidence = relations[0]!.properties.confidence as Record<string, unknown>;
    expect(confidence.value).toBe(1.0);
    expect(confidence.method).toBe('process_reliability');
  });

  it('upserts relations deterministically', () => {
    graph.recordDecision('d1', 'A');
    graph.recordDecision('d2', 'B');
    graph.recordRelation('d1', 'd2', 'supersedes');
    graph.recordRelation('d1', 'd2', 'supersedes');
    expect(graph.getRelations('d1').length).toBe(1);
  });

  it('records all relation variants', () => {
    graph.recordDecision('a', 'A');
    graph.recordDecision('b', 'B');
    graph.recordRelation('a', 'b', 'causes');
    graph.recordRelation('a', 'b', 'alternative_to');
    const edges = graph.getRelations('a');
    expect(edges.some((e) => e.id === 'causes:a:b')).toBe(true);
    expect(edges.some((e) => e.id === 'alternative_to:a:b')).toBe(true);
  });

  it('links decisions to files', () => {
    graph.recordDecision('d1', 'Use React');
    graph.recordDecisionFile('d1', 'src/feature.ts');
    const edges = graph.getRelations('d1');
    const edge = edges.find((e) => e.id === 'references:d1:src/feature.ts');
    expect(edge).toBeTruthy();
    expect(edge!.relationship).toBe('references');
    expect(edge!.source).toBe('decision:d1');
    const fileNode = graph.findPaths('decision:d1', 'file:src/feature.ts', 2);
    expect(fileNode.length).toBeGreaterThan(0);
  });

  it('returns empty relations for isolated decisions', () => {
    graph.recordDecision('d1', 'Alone');
    expect(graph.getRelations('d1')).toEqual([]);
  });

  it('creates a sqlite graph file at the expected path', () => {
    expect(existsSync(join(dir, 'decision-graph', 'graph.sqlite'))).toBe(true);
  });

  it('persists and loads manifests', async () => {
    graph.recordDecision('d1', 'Use React');
    graph.recordRelation('d1', 'd2', 'supersedes');
    const file = join(dir, 'decision-graph.json');
    await graph.persist(file);
    expect(existsSync(file)).toBe(true);
    const expected = graph.nodeCount();
    expect(await graph.load(file)).toBe(expected);
    expect(await graph.load(join(dir, 'missing.json'))).toBe(0);
    expect(graph.getDecision('d1')!.name).toBe('Use React');
  });
});
