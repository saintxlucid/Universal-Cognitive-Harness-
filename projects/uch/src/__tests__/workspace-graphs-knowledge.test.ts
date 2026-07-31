import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceKnowledgeGraph } from '../workspace-graphs/knowledge-graph.js';

describe('WorkspaceKnowledgeGraph', () => {
  let dir: string;
  let graph: WorkspaceKnowledgeGraph;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-wsg-'));
    graph = new WorkspaceKnowledgeGraph(dir);
  });

  afterEach(() => {
    graph.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('records artifacts with deterministic file ids and basename names', () => {
    graph.recordArtifact('src/app.ts');
    const artifacts = graph.findArtifacts();
    expect(artifacts.length).toBe(1);
    expect(artifacts[0]!.id).toBe('file:src/app.ts');
    expect(artifacts[0]!.type).toBe('artifact');
    expect(artifacts[0]!.name).toBe('app.ts');
    expect(artifacts[0]!.properties.path).toBe('src/app.ts');

    graph.recordArtifact('src/app.ts');
    expect(graph.nodeCount()).toBe(1);
  });

  it('records commits with artifact linkage and provenance-bearing touches edges', () => {
    graph.recordCommit('abc123', 'feat: add login\n\nbody', ['src/a.ts', 'src/b.ts']);
    const commits = graph.findCommits();
    expect(commits.length).toBe(1);
    expect(commits[0]!.id).toBe('commit:abc123');
    expect(commits[0]!.name).toBe('feat: add login');
    expect(commits[0]!.properties.hash).toBe('abc123');

    const artifacts = graph.findArtifacts();
    expect(artifacts.length).toBe(2);

    const edges = graph.getEdgesFrom('commit:abc123');
    expect(edges.length).toBe(2);
    const edgeIds = edges.map((e) => e.id).sort();
    expect(edgeIds).toEqual(['commit:abc123:touches:src/a.ts', 'commit:abc123:touches:src/b.ts']);
    for (const edge of edges) {
      expect(edge.relationship).toBe('touches');
      expect(edge.source).toBe('commit:abc123');
      const provenance = edge.properties.provenance as Record<string, unknown>;
      expect(typeof provenance.source).toBe('string');
      expect(provenance.source_id).toBe('abc123');
      expect(typeof provenance.timestamp).toBe('number');
      expect(typeof provenance.reliability).toBe('number');
      const confidence = edge.properties.confidence as Record<string, unknown>;
      expect(confidence.value).toBe(1.0);
      expect(confidence.method).toBe('process_reliability');
    }
  });

  it('upserts deterministically on duplicate commits', () => {
    graph.recordCommit('abc123', 'feat: x', ['src/a.ts', 'src/b.ts']);
    graph.recordCommit('abc123', 'feat: x', ['src/a.ts', 'src/b.ts']);
    expect(graph.findCommits().length).toBe(1);
    expect(graph.edgeCount()).toBe(2);
  });

  it('records builds discoverable via search', () => {
    graph.recordBuild('b1');
    const results = graph.search('b1');
    const node = results.find((n) => n.id === 'build:b1');
    expect(node).toBeTruthy();
    expect(node!.properties.id).toBe('b1');
  });

  it('records failures discoverable via search', () => {
    graph.recordFailure('f1', 'boom', 'test');
    const results = graph.search('boom');
    const node = results.find((n) => n.id === 'failure:f1');
    expect(node).toBeTruthy();
    expect(node!.properties.message).toBe('boom');
    expect(node!.properties.kind).toBe('test');
  });

  it('records prs and reviews discoverable via search', () => {
    graph.recordPr('42', 'Add auth', 'https://x/pr/42');
    graph.recordReview('r1', '42');
    const results = graph.search('42');
    const pr = results.find((n) => n.id === 'pr:42');
    expect(pr).toBeTruthy();
    expect(pr!.name).toBe('Add auth');
    expect(pr!.properties.title).toBe('Add auth');
    expect(pr!.properties.url).toBe('https://x/pr/42');
    const review = results.find((n) => n.id === 'review:r1');
    expect(review).toBeTruthy();
    expect(review!.properties.prId).toBe('42');
  });

  it('traverses bfs levels and finds paths', () => {
    graph.recordCommit('c1', 'm1', ['src/a.ts', 'src/b.ts']);
    graph.recordCommit('c2', 'm2', ['src/a.ts']);

    const levels = graph.bfs('commit:c1');
    expect(levels[0]!.some((n) => n.id === 'commit:c1')).toBe(true);
    const depth1 = levels[1]!;
    expect(depth1.length).toBe(2);
    expect(depth1.some((n) => n.id === 'file:src/a.ts')).toBe(true);
    expect(depth1.some((n) => n.id === 'file:src/b.ts')).toBe(true);

    const paths = graph.findPaths('commit:c1', 'file:src/b.ts', 5);
    expect(paths.length).toBeGreaterThan(0);
  });

  it('caps node growth at maxNodes', () => {
    const capped = new WorkspaceKnowledgeGraph(dir, 3);
    capped.recordArtifact('src/a.ts');
    capped.recordArtifact('src/b.ts');
    capped.recordArtifact('src/c.ts');
    capped.recordArtifact('src/d.ts');
    expect(capped.nodeCount()).toBe(3);
    capped.close();
  });

  it('creates a sqlite graph file at the expected path', () => {
    expect(existsSync(join(dir, 'knowledge-graph', 'graph.sqlite'))).toBe(true);
  });

  it('persists and loads manifests', async () => {
    graph.recordArtifact('src/app.ts');
    graph.recordCommit('abc123', 'feat: x', ['src/a.ts']);
    const file = join(dir, 'knowledge-graph.json');
    await graph.persist(file);
    expect(existsSync(file)).toBe(true);
    const expected = graph.nodeCount();
    expect(await graph.load(file)).toBe(expected);
    expect(await graph.load(join(dir, 'missing.json'))).toBe(0);
  });
});
