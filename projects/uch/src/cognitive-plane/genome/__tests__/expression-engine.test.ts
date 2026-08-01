/**
 * Cognitive Expression System — prototype tests (IDEA-0090).
 *
 * Unit coverage of the core claims: same genome, different expression
 * per environment (the honeybee test); conservative fallback for
 * undeclared environments with reported ambiguity; ledgered,
 * tick-ordered, idempotent epigenetic marks; determinism; and the
 * derived report (params consumable by RFC-0005 / decision law).
 */

import { describe, expect, it } from 'vitest';
import {
  BUILTIN_ENVIRONMENTS,
  DEFAULT_GENE_EXPRESSION_RULES,
  ExpressionEngine,
  deriveExpressionReport,
} from '../expression/expression-engine.js';

describe('same genome, different expression (epigenetics)', () => {
  it('expresses different proteins in production vs development', () => {
    const engine = new ExpressionEngine();
    const prod = engine.express('production', 1);
    const dev = engine.express('development', 2);
    expect(prod.proteins.map((p) => p.id).sort()).not.toEqual(dev.proteins.map((p) => p.id).sort());
    expect(engine.proteinFor('verification-strictness', 'production')?.id).toBe(
      'strict-verification',
    );
    expect(engine.proteinFor('verification-strictness', 'development')?.id).toBe(
      'lenient-verification',
    );
    expect(engine.proteinFor('risk-profile', 'development')?.id).toBe('experimental-risk');
    expect(engine.proteinFor('sleep-cadence', 'development')?.id).toBe('frequent-consolidation');
  });

  it('production expresses the conservative protein set', () => {
    const engine = new ExpressionEngine();
    const prod = engine.express('production', 1);
    const byGene = new Map(prod.proteins.map((p) => [p.gene, p]));
    expect(byGene.get('verification-strictness')?.params.vetoThreshold).toBe(0.5);
    expect(byGene.get('risk-profile')?.params.explorationBias).toBe(0.1);
    expect(byGene.get('sleep-cadence')?.params.sleepEveryTicks).toBe(1000);
  });

  it('development expresses the experimental protein set', () => {
    const engine = new ExpressionEngine();
    const dev = engine.express('development', 1);
    const byGene = new Map(dev.proteins.map((p) => [p.gene, p]));
    expect(byGene.get('verification-strictness')?.params.vetoThreshold).toBe(0.7);
    expect(byGene.get('risk-profile')?.params.explorationBias).toBe(0.6);
    expect(byGene.get('sleep-cadence')?.params.sleepEveryTicks).toBe(200);
  });

  it('genes are constant: the genome object never changes across environments', () => {
    const engine = new ExpressionEngine();
    const genesBefore = engine.genes();
    engine.express('production', 1);
    engine.express('development', 2);
    expect(engine.genes()).toEqual(genesBefore);
    expect(genesBefore.sort()).toEqual([
      'risk-profile',
      'sleep-cadence',
      'verification-strictness',
    ]);
  });
});

describe('undeclared environment → conservative fallback', () => {
  it('expresses every gene as its default (conservative) protein', () => {
    const engine = new ExpressionEngine();
    const result = engine.express('staging-2026', 5);
    expect(result.proteins.map((p) => p.id).sort()).toEqual([
      'conservative-risk',
      'daily-consolidation',
      'strict-verification',
    ]);
  });

  it('reports the ambiguity instead of hiding it', () => {
    const engine = new ExpressionEngine();
    const result = engine.express('staging-2026', 5);
    expect(result.fallbacks.sort()).toEqual([
      'risk-profile',
      'sleep-cadence',
      'verification-strictness',
    ]);
  });

  it('does not fall back when the environment is declared', () => {
    const engine = new ExpressionEngine();
    expect(engine.express('production', 1).fallbacks).toEqual([]);
    expect(engine.express('development', 1).fallbacks).toEqual([]);
  });
});

describe('epigenetic mark ledger', () => {
  it('records a mark per gene on first expression', () => {
    const engine = new ExpressionEngine();
    const result = engine.express('production', 10);
    expect(result.marks.map((m) => m.gene).sort()).toEqual([
      'risk-profile',
      'sleep-cadence',
      'verification-strictness',
    ]);
    expect(result.marks.every((m) => m.reason === 'switch')).toBe(true);
  });

  it('is idempotent: re-expressing the same environment records nothing', () => {
    const engine = new ExpressionEngine();
    engine.express('production', 10);
    const again = engine.express('production', 11);
    expect(again.marks).toEqual([]);
    expect(engine.marks()).toHaveLength(3);
  });

  it('records a switch when the environment changes (same genome)', () => {
    const engine = new ExpressionEngine();
    engine.express('production', 10);
    const switched = engine.express('development', 20);
    expect(switched.marks).toHaveLength(3);
    expect(switched.marks.every((m) => m.reason === 'switch')).toBe(true);
    expect(switched.marks.every((m) => m.atTick === 20)).toBe(true);
  });

  it('is append-only and tick-ordered', () => {
    const engine = new ExpressionEngine();
    engine.express('production', 10);
    engine.express('development', 20);
    engine.express('production', 30);
    const marks = engine.marks();
    expect(marks).toHaveLength(9);
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i].atTick).toBeGreaterThanOrEqual(marks[i - 1].atTick);
    }
  });

  it('records fallback marks with reason fallback for undeclared environments', () => {
    const engine = new ExpressionEngine();
    const result = engine.express('staging-2026', 5);
    expect(result.marks.every((m) => m.reason === 'fallback')).toBe(true);
    expect(result.marks.find((m) => m.gene === 'verification-strictness')?.proteinId).toBe(
      'strict-verification',
    );
  });

  it('switching back to a previously expressed protein is a new mark', () => {
    const engine = new ExpressionEngine();
    engine.express('production', 10);
    engine.express('development', 20);
    const back = engine.express('production', 30);
    expect(back.marks).toHaveLength(3);
    expect(back.marks.find((m) => m.gene === 'verification-strictness')?.proteinId).toBe(
      'strict-verification',
    );
  });
});

describe('derived report (params consumable by the corpus)', () => {
  it('derives the effective veto threshold per environment', () => {
    const engine = new ExpressionEngine();
    expect(deriveExpressionReport(engine, 'production', 1).effectiveVetoThreshold).toBe(0.5);
    expect(deriveExpressionReport(engine, 'development', 2).effectiveVetoThreshold).toBe(0.7);
  });

  it('derives the exploration bias per environment', () => {
    const engine = new ExpressionEngine();
    expect(deriveExpressionReport(engine, 'production', 1).explorationBias).toBe(0.1);
    expect(deriveExpressionReport(engine, 'development', 2).explorationBias).toBe(0.6);
  });

  it('reports behaviors, not just values — the protein does work', () => {
    const engine = new ExpressionEngine();
    const report = deriveExpressionReport(engine, 'production', 1);
    const verification = report.entries.find((e) => e.gene === 'verification-strictness');
    expect(verification?.behavior).toContain('Verify');
  });

  it('falls back conservatively in the report too', () => {
    const engine = new ExpressionEngine();
    const report = deriveExpressionReport(engine, 'staging-2026', 1);
    expect(report.effectiveVetoThreshold).toBe(0.5);
    expect(report.fallbacks).toHaveLength(3);
  });
});

describe('engine properties', () => {
  it('is deterministic: same input, same output', () => {
    const a = new ExpressionEngine().express('production', 7);
    const b = new ExpressionEngine().express('production', 7);
    expect(a.proteins).toEqual(b.proteins);
    expect(a.marks).toEqual(b.marks);
  });

  it('declares the built-in environments', () => {
    expect(new ExpressionEngine().declaredEnvironments().sort()).toEqual(
      [...BUILTIN_ENVIRONMENTS].sort(),
    );
  });

  it('every gene carries a conservative default rule', () => {
    const engine = new ExpressionEngine();
    for (const gene of engine.genes()) {
      const fallback = engine.proteinFor(gene, 'production');
      expect(fallback).toBeDefined();
    }
  });

  it('proteinFor is pure: no ledger side effects', () => {
    const engine = new ExpressionEngine();
    engine.proteinFor('risk-profile', 'development');
    engine.proteinFor('verification-strictness', 'staging-2026');
    expect(engine.marks()).toEqual([]);
  });

  it('unknown gene lookups return undefined', () => {
    const engine = new ExpressionEngine();
    expect(engine.proteinFor('no-such-gene', 'production')).toBeUndefined();
  });

  it('custom rules override the default catalog', () => {
    const engine = new ExpressionEngine([
      {
        gene: 'verification-strictness',
        environment: 'production',
        protein: {
          id: 'extra-strict',
          name: 'Extra Strict',
          behavior: 'Veto at a raised threshold for a regulated domain.',
          params: { vetoThreshold: 0.4, verifyBeforeCommit: true, evidenceSources: 4 },
        },
      },
      ...DEFAULT_GENE_EXPRESSION_RULES.filter(
        (r) => !(r.gene === 'verification-strictness' && r.environment === 'production'),
      ),
    ]);
    expect(engine.proteinFor('verification-strictness', 'production')?.params.vetoThreshold).toBe(
      0.4,
    );
    expect(deriveExpressionReport(engine, 'production', 1).effectiveVetoThreshold).toBe(0.4);
  });
});
