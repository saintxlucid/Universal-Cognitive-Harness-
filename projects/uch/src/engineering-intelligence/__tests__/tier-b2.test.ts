import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainStore } from '../domains/base.js';
import { tier02SEConcepts } from '../domains/tier-02-se.js';
import { tier04ProductConcepts } from '../domains/tier-04-product.js';
import { tier07PatternsConcepts } from '../domains/tier-07-patterns.js';
import { tier08FailureConcepts } from '../domains/tier-08-failure.js';
import { tier10UnknownConcepts } from '../domains/tier-10-unknown.js';
import { createDomainRegistry } from '../domains/index.js';
import { createEngineeringJudgment } from '../index.js';
import { analyzeTarget } from '../analyzer.js';
import type { EvaluationTarget } from '../types.js';

const evalTarget = (diff: string): EvaluationTarget => ({ kind: 'code', diff, paths: [] });

describe('Tier II — SE quality store', () => {
  const store = new DomainStore('tier-02-se', 'SE Quality', tier02SEConcepts());

  it('ships 20 concepts across modularity/quality/evolution', () => {
    expect(store.size).toBe(20);
    expect(store.families()).toEqual(['evolution', 'modularity', 'quality']);
  });

  it('covers coupling → evolvability', () => {
    const ids = store.list().map((c) => c.id);
    expect(ids[0]).toBe('se.coupling');
    expect(ids).toContain('se.cohesion');
    expect(ids).toContain('se.connascence');
    expect(ids).toContain('se.architecture-drift');
    expect(ids).toContain('se.change-amplification');
    expect(ids).toContain('se.evolvability');
    for (const c of store.list()) expect(c.id).toMatch(/^se\./);
  });

  it('every concept carries signals, triggers, guidance, antiPatterns, provenance', () => {
    for (const c of store.list()) {
      expect(c.provenance.length).toBeGreaterThan(0);
      expect(c.signals.length).toBeGreaterThan(0);
      expect(c.triggers.length).toBeGreaterThan(0);
      expect(c.guidance.length).toBeGreaterThan(0);
      expect(c.antiPatterns.length).toBeGreaterThan(0);
    }
  });

  it('activates coupling/refactoring concepts on a refactor target', () => {
    const ctx = analyzeTarget({
      kind: 'design',
      text: 'Refactor the module to reduce coupling and remove duplication.',
    });
    const activated = store.activate(ctx, 10).map((r) => r.concept.id);
    expect(activated).toContain('se.coupling');
    expect(activated).toContain('se.refactoring-opportunities');
    expect(activated).toContain('se.code-smells');
  });

  it('persists and reloads without loss (mkdtemp)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'uch-tier02-'));
    const file = path.join(dir, 'tier-02.json');
    await store.persist(file);
    const reloaded = new DomainStore('tier-02-se', 'reloaded');
    const count = await reloaded.load(file);
    expect(count).toBe(20);
    expect(reloaded.get('se.change-amplification')?.name).toBe('Change Amplification');
  });
});

describe('Tier VII — architecture patterns', () => {
  const store = new DomainStore('tier-07-patterns', 'Patterns', tier07PatternsConcepts());

  it('ships 13 patterns with when-NOT-to-use guidance', () => {
    expect(store.size).toBe(13);
    expect(store.families()).toEqual(['architecture']);
    for (const c of store.list()) {
      expect(c.id).toMatch(/^arch\./);
      expect(c.antiPatterns.length).toBeGreaterThan(0);
      expect(c.guidance.length).toBeGreaterThan(0);
    }
  });

  it('covers layered through plugin', () => {
    const ids = store.list().map((c) => c.id);
    const expected = [
      'arch.layered', 'arch.hexagonal', 'arch.onion', 'arch.clean', 'arch.ddd',
      'arch.event-driven', 'arch.microservices', 'arch.modular-monolith', 'arch.cqrs',
      'arch.actor-model', 'arch.pipes-filters', 'arch.blackboard', 'arch.plugin',
    ];
    for (const id of expected) expect(ids).toContain(id);
  });

  it('microservices entry explicitly warns against distributed monoliths', () => {
    const ms = store.get('arch.microservices')!;
    expect(ms.antiPatterns.join(' ')).toMatch(/distributed monolith/i);
  });

  it('activates event-driven + microservices on a migration target', () => {
    const ctx = analyzeTarget({
      kind: 'architecture',
      text: 'Migrate to microservices with an event bus for async teams.',
    });
    const activated = store.activate(ctx, 10).map((r) => r.concept.id);
    expect(activated).toContain('arch.microservices');
    expect(activated).toContain('arch.event-driven');
  });
});

describe('Tier IV — product thinking', () => {
  const store = new DomainStore('tier-04-product', 'Product', tier04ProductConcepts());

  it('ships 8 concepts across product-judgment', () => {
    expect(store.size).toBe(8);
    expect(store.families()).toEqual(['product-judgment']);
    const ids = store.list().map((c) => c.id);
    for (const id of [
      'product.user-problem', 'product.simpler-approach', 'product.discoverability',
      'product.business-alignment', 'product.maintenance-burden', 'product.opportunity-cost',
      'product.usage-evidence', 'product.minimum-viable',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('activates opportunity-cost + business-alignment on a roadmap target', () => {
    const ctx = analyzeTarget({
      kind: 'plan',
      text: 'Roadmap decision: the feature is a business goal, but it means skipping the priority fix.',
    });
    const activated = store.activate(ctx, 10).map((r) => r.concept.id);
    expect(activated).toContain('product.opportunity-cost');
    expect(activated).toContain('product.business-alignment');
  });
});

describe('Tier VIII — failure engineering', () => {
  const store = new DomainStore('tier-08-failure', 'Failure', tier08FailureConcepts());

  it('ships 9 concepts across imagination/surfaces', () => {
    expect(store.size).toBe(9);
    expect(store.families()).toEqual(['imagination', 'surfaces']);
    for (const c of store.list()) expect(c.id).toMatch(/^failure\./);
  });

  it('activates network-loss + rollback on a deploy target', () => {
    const ctx = analyzeTarget({
      kind: 'plan',
      text: 'Deployment failed when the network connection dropped; we retry with backoff.',
    });
    const activated = store.activate(ctx, 10).map((r) => r.concept.id);
    expect(activated).toContain('failure.network-loss');
    expect(activated).toContain('failure.rollback');
    expect(activated).toContain('failure.pre-mortem');
  });
});

describe('Tier X — unknown-unknown discovery', () => {
  const store = new DomainStore('tier-10-unknown', 'Unknowns', tier10UnknownConcepts());

  it('ships 9 concepts across discovery', () => {
    expect(store.size).toBe(9);
    expect(store.families()).toEqual(['discovery']);
    for (const c of store.list()) expect(c.id).toMatch(/^unknown\./);
  });

  it('activates silent-debt + dead-code on a hack target', () => {
    const ctx = analyzeTarget({
      kind: 'design',
      text: 'Temporary hack, we will fix it later; unused legacy code stays.',
    });
    const activated = store.activate(ctx, 10).map((r) => r.concept.id);
    expect(activated).toContain('unknown.silent-debt');
    expect(activated).toContain('unknown.dead-code');
  });
});

describe('Domain registry — Wave 2 aggregation', () => {
  const registry = createDomainRegistry();

  it('registers all ten tiers: 150 concepts', () => {
    expect(registry.totalConcepts).toBe(150);
    for (const tier of ['tier-01-cs', 'tier-02-se', 'tier-03-systems', 'tier-04-product',
      'tier-05-economics', 'tier-07-patterns', 'tier-08-failure', 'tier-10-unknown']) {
      expect(registry.get(tier)).not.toBeNull();
    }
  });

  it('resolves concepts across the new tiers', () => {
    expect(registry.concept('se.evolvability')?.store.tier).toBe('tier-02-se');
    expect(registry.concept('arch.modular-monolith')?.concept.name).toBe('Modular Monolith');
    expect(registry.concept('product.user-problem')?.concept.name).toBe('Problem-First Fit');
    expect(registry.concept('failure.disk-full')?.concept.name).toBe('Disk Full');
    expect(registry.concept('unknown.hidden-assumptions')?.store.tier).toBe('tier-10-unknown');
  });

  it('still rejects duplicate store registration', () => {
    const reg = createDomainRegistry();
    expect(() => reg.register(new DomainStore('tier-02-se', 'dup', []))).toThrow(
      /already registered/,
    );
  });
});

describe('Analyzer — import detection in diffs', () => {
  it('counts diff-prefixed import lines', () => {
    const ctx = analyzeTarget(
      evalTarget([
        '+import { a } from "react";',
        '+import { b } from "./local";',
        '+import { c } from "lodash";',
        '+import { d } from "../relative";',
      ].join('\n')),
    );
    expect(ctx.codeFacts.importCount).toBe(4);
    expect(ctx.codeFacts.externalImports).toBe(2);
  });

  it('still counts plain-text imports', () => {
    const ctx = analyzeTarget({
      kind: 'design',
      text: 'import x from "pkg";\nimport y from "./local";',
    });
    expect(ctx.codeFacts.importCount).toBe(2);
    expect(ctx.codeFacts.externalImports).toBe(1);
  });

  it('activation matches derived forms: microservices vs microservice, deploy vs deployment', () => {
    const patterns = createDomainRegistry();
    const ctx = analyzeTarget({
      kind: 'architecture',
      text: 'Microservices deployment failed when the network dropped.',
    });
    const tier7 = patterns.get('tier-07-patterns')!;
    const tier8 = patterns.get('tier-08-failure')!;
    const t7 = tier7.activate(ctx, 10).map((r) => r.concept.id);
    const t8 = tier8.activate(ctx, 10).map((r) => r.concept.id);
    expect(t7).toContain('arch.microservices');
    expect(t8).toContain('failure.rollback');
    expect(t8).toContain('failure.pre-mortem');
  });
});

describe('EngineeringEvaluator — Tier II coupling gate', () => {
  const judgment = createEngineeringJudgment();

  it('warns on change amplification: 8+ files touched', () => {
    const lines = ['+export const x = 1;'];
    for (let i = 0; i < 8; i++) {
      lines.push(`diff --git a/f${i}.ts b/f${i}.ts`, '+export const y = 1;');
    }
    const review = judgment.evaluator.evaluate(evalTarget(lines.join('\n')));
    const t2 = review.findings.filter((f) => f.tier === 'tier-02-se');
    const amp = t2.find((f) => f.conceptId === 'se.change-amplification');
    expect(amp).toBeDefined();
    expect(amp!.severity).toBe('warning');
  });

  it('warns on high external coupling: 8+ external imports', () => {
    const lines = ['diff --git a/a.ts b/a.ts'];
    for (let i = 0; i < 8; i++) lines.push(`+import { x${i} } from "dep${i}";`);
    const review = judgment.evaluator.evaluate(evalTarget(lines.join('\n')));
    const t2 = review.findings.filter((f) => f.tier === 'tier-02-se');
    const coup = t2.find((f) => f.conceptId === 'se.coupling');
    expect(coup).toBeDefined();
    expect(coup!.severity).toBe('warning');
  });

  it('flags moderate signals as info: 5 files or 5 external imports', () => {
    const lines = ['diff --git a/a.ts b/a.ts'];
    for (let i = 0; i < 5; i++) lines.push(`+import { x${i} } from "dep${i}";`);
    for (let i = 0; i < 5; i++) {
      lines.push(`diff --git a/g${i}.ts b/g${i}.ts`, '+export const y = 1;');
    }
    const review = judgment.evaluator.evaluate(evalTarget(lines.join('\n')));
    const t2 = review.findings.filter((f) => f.tier === 'tier-02-se');
    expect(t2.every((f) => f.severity === 'info')).toBe(true);
    expect(t2.map((f) => f.conceptId).sort()).toEqual(['se.change-amplification', 'se.coupling']);
  });

  it('stays silent on clean small diffs', () => {
    const review = judgment.evaluator.evaluate(evalTarget('+const x = 1;'));
    expect(review.findings.filter((f) => f.tier === 'tier-02-se')).toEqual([]);
  });

  it('coupling findings are advisory, never veto', () => {
    const lines = ['diff --git a/a.ts b/a.ts'];
    for (let i = 0; i < 9; i++) lines.push(`+import { x${i} } from "dep${i}";`);
    for (let i = 0; i < 9; i++) {
      lines.push(`diff --git a/g${i}.ts b/g${i}.ts`, '+export const y = 1;');
    }
    const review = judgment.evaluator.evaluate(evalTarget(lines.join('\n')));
    expect(review.findings.filter((f) => f.tier === 'tier-02-se').length).toBeGreaterThan(0);
    expect(review.findings.every((f) => f.gate === 'advisory')).toBe(true);
  });
});
