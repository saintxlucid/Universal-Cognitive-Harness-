import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainStore } from '../domains/base.js';
import { tier01CSConcepts } from '../domains/tier-01-cs.js';
import { tier03SystemsConcepts } from '../domains/tier-03-systems.js';
import { tier05EconomicsConcepts } from '../domains/tier-05-economics.js';
import { createDomainRegistry } from '../domains/index.js';
import { analyzeTarget } from '../analyzer.js';
import type { EngineeringConcept } from '../types.js';

const ALL_TIER_1 = tier01CSConcepts();

describe('Tier I — CS domain store', () => {
  const store = new DomainStore('tier-01-cs', 'Computer Science Intelligence', ALL_TIER_1);

  it('ships the full catalog: 69 concepts across 5 families', () => {
    expect(store.size).toBe(69);
    expect(store.families()).toEqual([
      'algorithms',
      'data-structures',
      'distributed-systems',
      'networking',
      'os',
    ]);
  });

  it("covers the vision's concept list", () => {
    const ids = ALL_TIER_1.map((c) => c.id);
    const expected = [
      'cs.complexity.amortized', 'cs.complexity.branch-prediction', 'cs.complexity.cache',
      'cs.complexity.communication', 'cs.complexity.external-memory', 'cs.complexity.locality',
      'cs.complexity.parallel', 'cs.complexity.space', 'cs.complexity.streaming', 'cs.complexity.time',
      'cs.data-structures.b-tree', 'cs.data-structures.bloom-filter', 'cs.data-structures.cuckoo-filter',
      'cs.data-structures.deque', 'cs.data-structures.fenwick-tree', 'cs.data-structures.immutable',
      'cs.data-structures.lsm-tree', 'cs.data-structures.persistent', 'cs.data-structures.radix-tree',
      'cs.data-structures.ring-buffer', 'cs.data-structures.rope', 'cs.data-structures.segment-tree',
      'cs.data-structures.skip-list', 'cs.data-structures.trie',
      'cs.os.cache-hierarchy', 'cs.os.file-systems', 'cs.os.ipc', 'cs.os.lock-contention',
      'cs.os.memory-layout', 'cs.os.numa', 'cs.os.paging', 'cs.os.processes', 'cs.os.scheduling',
      'cs.os.signals', 'cs.os.synchronization', 'cs.os.syscalls', 'cs.os.threads',
      'cs.os.virtual-memory',
      'cs.net.certificates', 'cs.net.congestion-control', 'cs.net.connection-pooling', 'cs.net.dns',
      'cs.net.http2', 'cs.net.http3', 'cs.net.load-balancing', 'cs.net.quic', 'cs.net.retry-storms',
      'cs.net.reverse-proxy', 'cs.net.service-discovery', 'cs.net.tcp-internals', 'cs.net.tls',
      'cs.net.udp',
      'cs.dist.at-least-once', 'cs.dist.cap', 'cs.dist.consensus', 'cs.dist.cqrs', 'cs.dist.crdt',
      'cs.dist.event-sourcing', 'cs.dist.eventual-consistency', 'cs.dist.exactly-once',
      'cs.dist.gossip', 'cs.dist.idempotency', 'cs.dist.lamport-clocks', 'cs.dist.pacelc',
      'cs.dist.paxos', 'cs.dist.raft', 'cs.dist.sagas', 'cs.dist.split-brain',
      'cs.dist.vector-clocks',
    ];
    for (const id of expected) expect(ids).toContain(id);
  });

  it('enforces tier membership and unique ids', () => {
    const wrong: EngineeringConcept = {
      ...ALL_TIER_1[0],
      id: 'se.x',
      tier: 'tier-02-se',
    };
    expect(() => store.register(wrong)).toThrow(/rejected concept/);
    expect(() => store.register({ ...ALL_TIER_1[0] })).toThrow(/Duplicate concept id/);
  });

  it('every concept carries provenance, signals, triggers, guidance, and antiPatterns', () => {
    for (const c of ALL_TIER_1) {
      expect(c.id).toMatch(/^cs\./);
      expect(c.provenance.length).toBeGreaterThan(0);
      expect(c.signals.length).toBeGreaterThan(0);
      expect(c.triggers.length).toBeGreaterThan(0);
      expect(c.guidance.length).toBeGreaterThan(0);
      expect(c.antiPatterns.length).toBeGreaterThan(0);
      expect(c.weight).toBeGreaterThanOrEqual(0);
    }
  });

  it('activation surfaces retry-storm and ring-buffer concepts for the right context', () => {
    const ctx = analyzeTarget({
      kind: 'design',
      text: 'Retry the request with backoff when the queue buffer fills, bounded by a cap.',
    });
    const activated = store.activate(ctx, 10).map((r) => r.concept.id);
    expect(activated).toContain('cs.net.retry-storms');
    expect(activated).toContain('cs.data-structures.ring-buffer');
  });

  it('persists and reloads without loss (mkdtemp)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'uch-tier01-'));
    const file = path.join(dir, 'tier-01.json');
    await store.persist(file);
    const reloaded = new DomainStore('tier-01-cs', 'reloaded');
    const count = await reloaded.load(file);
    expect(count).toBe(69);
    expect(reloaded.get('cs.dist.raft')?.name).toBe('Raft');
    expect(reloaded.get('cs.dist.raft')?.tier).toBe('tier-01-cs');
  });
});

describe('Tier III + V stores', () => {
  it('systems store: 12 concepts across 4 families', () => {
    const store = new DomainStore('tier-03-systems', 'Systems', tier03SystemsConcepts());
    expect(store.size).toBe(12);
    expect(store.families()).toEqual(['capacity', 'failure-modeling', 'flow-control', 'operations']);
    for (const c of store.list()) expect(c.provenance.length).toBeGreaterThan(0);
  });

  it('economics store: 10 concepts across 3 families', () => {
    const store = new DomainStore('tier-05-economics', 'Economics', tier05EconomicsConcepts());
    expect(store.size).toBe(10);
    expect(store.families()).toEqual(['cost', 'decision', 'risk']);
    for (const c of store.list()) expect(c.provenance.length).toBeGreaterThan(0);
  });

  it('registry aggregates 150 concepts across all ten tiers', () => {
    const registry = createDomainRegistry();
    expect(registry.totalConcepts).toBe(150);
    expect(registry.get('tier-01-cs')).not.toBeNull();
    expect(registry.get('tier-02-se')).not.toBeNull();
    expect(registry.concept('sys.spof')?.store.tier).toBe('tier-03-systems');
    expect(registry.concept('econ.build-vs-buy')?.concept.name).toBe('Build vs Buy');
    expect(registry.concept('nope')).toBeNull();
  });
});
