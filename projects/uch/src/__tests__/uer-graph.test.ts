/**
 * Universal Engineering Replay — causal graph tests (IDEA-0047).
 *
 * Multi-host synthetic scenario: two hosts, two sessions, a commit DAG,
 * artifact touches, a decision informed by a trace chain, and
 * traceparent-driven ingestion across the host boundary.
 */

import { describe, expect, it } from 'vitest';
import { UerGraph } from '../cognitive-plane/replay/uer-graph.js';

function buildScenario(): UerGraph {
  const g = new UerGraph();
  const t = (ms: number) => new Date(ms).getTime();

  g.addNode('h1', 'host', 'vscode', t(1000));
  g.addNode('h2', 'host', 'codex', t(2000));
  g.addNode('s1', 'session', 'vscode-session-7', t(1500));
  g.addNode('s2', 'session', 'codex-session-42', t(2500));

  g.ingestTrace({ traceparent: '', traceId: 't1', ts: t(1600) });
  g.registerSpan('00f067aa0ba902b7', 't1');
  g.ingestTrace({
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    traceId: 't2',
    ts: t(1700),
  });
  g.ingestTrace({ traceparent: '', traceId: 't3', ts: t(2600) });
  g.addEdge('s1', 't1', 'informed_by', t(1610));
  g.addEdge('s2', 't3', 'informed_by', t(2610));

  g.addNode('c3', 'commit', '9f1c2d4', t(3000));
  g.addNode('c2', 'commit', '7bb8246', t(2900));
  g.addNode('c1', 'commit', '352715d', t(2800));
  g.addEdge('c1', 'c2', 'ancestor_of', t(3000));
  g.addEdge('c2', 'c3', 'ancestor_of', t(3100));
  g.addEdge('c1', 's1', 'informed_by', t(2810));

  g.addNode('a.ts', 'artifact', 'src/engine/scheduler.ts', t(2700));
  g.addEdge('c3', 'a.ts', 'touches', t(3050));
  g.addEdge('c2', 'a.ts', 'touches', t(2950));
  g.addEdge('c1', 'a.ts', 'touches', t(2850));

  g.addNode('d1', 'decision', 'ADR-003: EI layer', t(3200));
  g.addEdge('d1', 't2', 'informed_by', t(3210));
  g.addEdge('d1', 'a.ts', 'references', t(3220));

  g.addNode('unrelated', 'artifact', 'docs/other.md', t(4000));
  return g;
}

describe('ingestion', () => {
  it('traceparent links traces across the host boundary', () => {
    const g = buildScenario();
    const path = g.influencePath('t1', 't2');
    expect(path).not.toBeNull();
    expect(path!.length).toBeLessThanOrEqual(2);
  });

  it('ingestTrace with an empty traceparent creates a root trace', () => {
    const g = new UerGraph();
    g.ingestTrace({ traceparent: '', traceId: 'root' });
    expect(g.stats().nodes.trace).toBe(1);
    expect(g.stats().edges.parent_of).toBe(0);
  });

  it('duplicate nodes and edges are idempotent', () => {
    const g = new UerGraph();
    g.addNode('x', 'artifact');
    g.addNode('x', 'artifact');
    g.addEdge('x', 'x', 'touches');
    g.addEdge('x', 'x', 'touches');
    expect(g.stats().nodes.artifact).toBe(1);
    expect(g.stats().edges.touches).toBe(0);
  });
});

describe('influencePath', () => {
  it('finds the causal chain from a decision to its originating commit', () => {
    const g = buildScenario();
    const path = g.influencePath('d1', 'c2');
    expect(path).not.toBeNull();
    expect(path![0]).toBe('d1');
    expect(path![path!.length - 1]).toBe('c2');
    expect(path!.length).toBeGreaterThan(1);
  });

  it('returns null for disconnected entities', () => {
    const g = buildScenario();
    expect(g.influencePath('d1', 'unrelated')).toBeNull();
  });

  it('a node is on its own influence path', () => {
    const g = buildScenario();
    expect(g.influencePath('d1', 'd1')).toEqual(['d1']);
  });
});

describe('ancestry', () => {
  it('walks the commit DAG from descendant to root', () => {
    const g = buildScenario();
    expect(g.ancestry('c1')).toEqual(['c2', 'c3']);
    expect(g.ancestry('c2')).toEqual(['c3']);
  });

  it('a root commit has no ancestors', () => {
    const g = buildScenario();
    expect(g.ancestry('c3')).toEqual([]);
  });
});

describe('changePoints', () => {
  it('flags regime shifts via the gap heuristic', () => {
    const g = new UerGraph();
    const t = (ms: number) => new Date(ms).getTime();
    g.addNode('a.ts', 'artifact');
    for (const [i, ms] of [t(100), t(110), t(120), t(400)].entries()) {
      g.addNode(`c${i}`, 'commit', '', ms);
      g.addEdge(`c${i}`, 'a.ts', 'touches', ms);
    }
    const points = g.changePoints('a.ts');
    expect(points.map((p) => p.changePoint)).toEqual([false, false, false, true]);
    expect(points.filter((p) => p.changePoint).map((p) => p.ts)).toEqual([t(400)]);
  });

  it('steady cadence produces no change points', () => {
    const g = new UerGraph();
    const t = (ms: number) => new Date(ms).getTime();
    g.addNode('a.ts', 'artifact');
    for (const [i, ms] of [t(100), t(200), t(300)].entries()) {
      g.addNode(`c${i}`, 'commit', '', ms);
      g.addEdge(`c${i}`, 'a.ts', 'touches', ms);
    }
    const points = g.changePoints('a.ts');
    expect(points.every((p) => !p.changePoint)).toBe(true);
  });

  it('fewer than two touches never flags', () => {
    const g = new UerGraph();
    g.addNode('a.ts', 'artifact');
    g.addNode('c1', 'commit');
    g.addEdge('c1', 'a.ts', 'touches', 100);
    expect(g.changePoints('a.ts')).toEqual([{ nodeId: 'c1', ts: 100, changePoint: false }]);
  });
});

describe('scenario stats', () => {
  it('counts the full multi-host scenario', () => {
    const g = buildScenario();
    const s = g.stats();
    expect(s.nodes.host).toBe(2);
    expect(s.nodes.session).toBe(2);
    expect(s.nodes.trace).toBe(3);
    expect(s.nodes.commit).toBe(3);
    expect(s.nodes.artifact).toBe(2);
    expect(s.nodes.decision).toBe(1);
    expect(s.edges.ancestor_of).toBe(2);
    expect(s.edges.touches).toBe(3);
    expect(s.edges.informed_by).toBe(4);
    expect(s.edges.references).toBe(1);
  });
});
