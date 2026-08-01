/**
 * Belief Propagation Engine — prototype tests (IDEA-0086).
 *
 * Coverage: the pure algebra (evidence anchor, RFC-0005 instability
 * reuse), support/attack propagation with per-hop decay, direct
 * evidence outranking inference (Law 4 — a direct node is informed,
 * never overwritten, never pushed below its evidence floor), trust
 * flow with Law-5 decay (no self-assertion), the contradiction
 * ripple (reverse-support affected set, one belief:changed record
 * per member, instability flags), and the ripple's bounds (hop
 * limit, per-ripple energy cap).
 */

import { describe, expect, it } from 'vitest';
import {
  BeliefEngine,
  beliefReport,
  evidenceAnchorOf,
  instabilityOf,
  isUnstable,
} from '../belief-engine.js';

const closeTo = (actual: number, expected: number): void => {
  expect(actual).toBeCloseTo(expected, 6);
};

describe('pure algebra', () => {
  it('evidenceAnchorOf normalizes raw mass monotonically to [0,1)', () => {
    expect(evidenceAnchorOf(0)).toBe(0);
    expect(evidenceAnchorOf(1)).toBe(0.5);
    closeTo(evidenceAnchorOf(2), 2 / 3);
    closeTo(evidenceAnchorOf(100), 100 / 101);
  });

  it('negative mass clamps to zero', () => {
    expect(evidenceAnchorOf(-5)).toBe(0);
  });

  it('instability reuses RFC-0005: I(b) = confidence − evidenceAnchor', () => {
    closeTo(instabilityOf(0.9, 0.1), 0.9 - 1 / 11);
    expect(instabilityOf(0.5, 1)).toBe(0);
  });

  it('unstable flag fires above the threshold (RFC-0005 veto semantics)', () => {
    expect(isUnstable(0.9, 0.1)).toBe(true);
    expect(isUnstable(0.5, 1)).toBe(false);
    expect(isUnstable(0.6, 0.5, 0.4)).toBe(false);
    expect(isUnstable(0.8, 0.5, 0.4)).toBe(true);
  });
});

describe('graph construction', () => {
  it('confidence defaults to the evidence anchor; direct defaults false', () => {
    const engine = new BeliefEngine();
    engine.addNode('n', { evidenceMass: 1 });
    const state = engine.stateOf('n');
    expect(state?.confidence).toBe(0.5);
    expect(state?.direct).toBe(false);
    expect(engine.nodeCount()).toBe(1);
  });

  it('duplicate ids are rejected', () => {
    const engine = new BeliefEngine();
    engine.addNode('n', {});
    expect(() => engine.addNode('n', {})).toThrow(/duplicate node/);
  });

  it('edges validate their endpoints and self-trust is rejected', () => {
    const engine = new BeliefEngine();
    engine.addNode('a', {});
    expect(() => engine.addEdge({ from: 'a', to: 'ghost', kind: 'support' })).toThrow(/unknown edge target/);
    expect(() => engine.addEdge({ from: 'ghost', to: 'a', kind: 'support' })).toThrow(/unknown edge source/);
    expect(() => engine.addEdge({ from: 'a', to: 'a', kind: 'trust' })).toThrow(/cannot trust itself/);
  });
});

describe('support propagation', () => {
  it('raises confidence along a support chain with per-hop decay', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addNode('C', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'support' });
    engine.addEdge({ from: 'B', to: 'C', kind: 'support' });
    engine.propagate(1);
    closeTo(engine.confidenceOf('B') ?? 0, 0.9 * 0.9);
    closeTo(engine.confidenceOf('C') ?? 0, 0.9 * 0.9 * 0.9);
  });

  it('edge weight scales the influence', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { confidence: 0.8, evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'support', weight: 0.5 });
    engine.propagate(1);
    closeTo(engine.confidenceOf('B') ?? 0, 0.8 * 0.5 * 0.9);
  });

  it('propagation maintains belief: a declared confidence is re-anchored by evidence', () => {
    const engine = new BeliefEngine();
    engine.addNode('B', { confidence: 0.9, evidenceMass: 1 });
    const records = engine.propagate(1);
    closeTo(engine.confidenceOf('B') ?? 0, 0.5);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: 'B', from: 0.9, cause: 'propagation', tick: 1 });
  });

  it('is idempotent at the fixpoint: a second pass emits no records', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'support' });
    engine.propagate(1);
    expect(engine.propagate(2)).toHaveLength(0);
  });
});

describe('attack edges and contradiction ripple', () => {
  it('a new attack edge lowers confidence immediately (ripple by definition)', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('X', { confidence: 0.8, evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'support' });
    engine.propagate(1);
    const ripple = engine.addEdge({ from: 'X', to: 'B', kind: 'attack' });
    expect(ripple).toBeDefined();
    closeTo(engine.confidenceOf('B') ?? 0, 0.9 * 0.9 - 0.8 * 0.9);
    expect(ripple?.changes).toHaveLength(1);
    expect(ripple?.changes[0]).toMatchObject({ id: 'B', cause: 'contradiction' });
  });

  it('contradict() ripples through the reverse support set in one pass', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addNode('C', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'support' });
    engine.addEdge({ from: 'B', to: 'C', kind: 'support' });
    engine.propagate(1);
    closeTo(engine.confidenceOf('C') ?? 0, 0.9 * 0.9 * 0.9);
    const ripple = engine.contradict('B', 2);
    expect(ripple.affectedCount).toBe(2);
    expect(ripple.processed).toBe(2);
    expect(ripple.truncated).toBe(false);
    expect(ripple.changes.map((c) => c.id)).toEqual(['B', 'C']);
    expect(ripple.changes.every((c) => c.cause === 'contradiction')).toBe(true);
    expect(ripple.changes.every((c) => c.tick === 2)).toBe(true);
    expect(engine.confidenceOf('B')).toBe(0);
    expect(engine.confidenceOf('C')).toBe(0);
  });

  it('emits one belief:changed record per affected member, even when unchanged', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('B', { evidenceMass: 2, direct: false });
    engine.addEdge({ from: 'A', to: 'B', kind: 'support' });
    engine.propagate(1);
    const ripple = engine.contradict('B', 2);
    expect(ripple.affectedCount).toBe(1);
    expect(ripple.changes).toHaveLength(1);
  });

  it('repeat contradictions are distinct observations (no duplicate-node crash)', () => {
    const engine = new BeliefEngine();
    engine.addNode('B', {});
    engine.contradict('B', 1);
    engine.contradict('B', 1);
    expect(engine.edgeCount()).toBe(2);
    expect(engine.nodeCount()).toBe(3);
  });
});

describe('direct evidence outranks inference (Law 4)', () => {
  it('a contradiction can never push a direct node below its evidence floor', () => {
    const engine = new BeliefEngine();
    engine.addNode('D', { confidence: 0.9, evidenceMass: 2, direct: true });
    engine.addNode('E', {});
    engine.addEdge({ from: 'D', to: 'E', kind: 'support' });
    engine.propagate(1);
    const ripple = engine.contradict('D', 3);
    expect(ripple.affectedCount).toBe(2);
    const floor = evidenceAnchorOf(2);
    expect(engine.confidenceOf('D')).toBeGreaterThanOrEqual(floor);
    expect(engine.confidenceOf('D')).toBe(floor);
  });

  it('a direct node is informed (small move) but never overwritten by support', () => {
    const engine = new BeliefEngine();
    engine.addNode('S', { confidence: 1, evidenceMass: 5, direct: true });
    engine.addNode('D', { confidence: 0.5, evidenceMass: 5, direct: true });
    engine.addEdge({ from: 'S', to: 'D', kind: 'support', weight: 1 });
    engine.propagate(1);
    const state = engine.stateOf('D');
    expect(state?.confidence).toBeGreaterThan(0.5);
    expect(state?.confidence).toBeLessThan(1);
  });

  it('a thin-evidence direct node that is contradicted remains flagged unstable', () => {
    const engine = new BeliefEngine();
    engine.addNode('D', { confidence: 0.9, evidenceMass: 0.1, direct: true });
    expect(engine.stateOf('D')?.unstable).toBe(true);
    const ripple = engine.contradict('D', 1);
    expect(ripple.unstable).toContain('D');
    expect(engine.stateOf('D')?.unstable).toBe(true);
    expect(engine.confidenceOf('D')).toBeGreaterThan(evidenceAnchorOf(0.1));
  });
});

describe('trust flow (Law 5)', () => {
  it('direct nodes seed trust from their own evidence; trust flows with decay', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addNode('C', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'trust' });
    engine.addEdge({ from: 'B', to: 'C', kind: 'trust' });
    engine.propagate(1);
    closeTo(engine.trustOf('A') ?? 0, 0.5);
    closeTo(engine.trustOf('B') ?? 0, 0.5 * 0.9);
    closeTo(engine.trustOf('C') ?? 0, 0.5 * 0.9 * 0.9);
  });

  it('no component asserts its own trust: an unsupported node holds zero trust', () => {
    const engine = new BeliefEngine();
    engine.addNode('B', { confidence: 0.9, evidenceMass: 2 });
    engine.propagate(1);
    expect(engine.trustOf('B')).toBe(0);
  });

  it('trust edge weight scales the granted trust', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'trust', weight: 0.5 });
    engine.propagate(1);
    closeTo(engine.trustOf('B') ?? 0, 0.5 * 0.5 * 0.9);
  });
});

describe('ripple bounds', () => {
  it('the hop limit caps the affected set', () => {
    const engine = new BeliefEngine({ hopLimit: 1 });
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addNode('C', {});
    engine.addNode('D', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'support' });
    engine.addEdge({ from: 'B', to: 'C', kind: 'support' });
    engine.addEdge({ from: 'C', to: 'D', kind: 'support' });
    engine.propagate(1);
    const ripple = engine.contradict('B', 2);
    expect(ripple.affectedCount).toBe(2);
    expect(ripple.changes.map((c) => c.id)).toEqual(['B', 'C']);
  });

  it('the per-ripple energy cap truncates and reports the full count', () => {
    const engine = new BeliefEngine({ maxAffectedPerRipple: 2 });
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addNode('C', {});
    engine.addNode('D', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'support' });
    engine.addEdge({ from: 'B', to: 'C', kind: 'support' });
    engine.addEdge({ from: 'C', to: 'D', kind: 'support' });
    engine.propagate(1);
    const ripple = engine.contradict('B', 2);
    expect(ripple.affectedCount).toBe(3);
    expect(ripple.processed).toBe(2);
    expect(ripple.truncated).toBe(true);
    expect(ripple.changes).toHaveLength(2);
    expect(ripple.changes[0]?.affectedCount).toBe(3);
  });
});

describe('ledger and observability', () => {
  it('ledgers every change with tick, cause, and RFC-0005 instability', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('B', {});
    engine.addEdge({ from: 'A', to: 'B', kind: 'support' });
    engine.propagate(1);
    engine.contradict('B', 2);
    const tick1 = engine.changesFor(1);
    const tick2 = engine.changesFor(2);
    expect(tick1).toHaveLength(1);
    expect(tick1[0]?.cause).toBe('propagation');
    expect(tick2.length).toBeGreaterThanOrEqual(1);
    expect(tick2.every((c) => c.cause === 'contradiction')).toBe(true);
    expect(engine.fullLedger().length).toBe(tick1.length + tick2.length);
  });

  it('stateOf exposes confidence, anchor, trust, and instability together', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { evidenceMass: 1, direct: true });
    const state = engine.stateOf('A');
    expect(state).toMatchObject({ confidence: 0.5, evidenceAnchor: 0.5, direct: true, trust: 0.5 });
  });

  it('clear() resets the graph, ledger, and contradiction sequence', () => {
    const engine = new BeliefEngine();
    engine.addNode('B', {});
    engine.contradict('B', 1);
    expect(engine.nodeCount()).toBe(2);
    engine.clear();
    expect(engine.nodeCount()).toBe(0);
    expect(engine.edgeCount()).toBe(0);
    expect(engine.fullLedger()).toHaveLength(0);
    engine.addNode('B2', {});
    expect(() => engine.contradict('B2', 1)).not.toThrow();
  });
});

describe('beliefReport', () => {
  it('aggregates nodes, changes, and instability count', () => {
    const engine = new BeliefEngine();
    engine.addNode('A', { confidence: 0.9, evidenceMass: 1, direct: true });
    engine.addNode('B', { confidence: 0.9, evidenceMass: 0.1, direct: true });
    engine.addNode('C', {});
    engine.addEdge({ from: 'A', to: 'C', kind: 'support' });
    engine.propagate(1);
    const report = beliefReport(engine, 1);
    expect(report.nodes).toBe(3);
    expect(report.edges).toBe(1);
    expect(report.changes).toBe(1);
    expect(report.unstableCount).toBe(2);
    expect(report.maxInstability).toBeGreaterThan(0.5);
    closeTo(report.meanConfidence, (0.9 + 0.9 + 0.81) / 3);
  });

  it('empty engine reports zeros, not NaN', () => {
    const report = beliefReport(new BeliefEngine());
    expect(report).toMatchObject({ nodes: 0, edges: 0, changes: 0, unstableCount: 0, meanConfidence: 0, maxInstability: 0 });
  });
});
