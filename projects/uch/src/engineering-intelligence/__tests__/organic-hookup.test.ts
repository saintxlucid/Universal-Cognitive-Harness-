import { describe, it, expect } from 'vitest';
import { OrganicScoreEngine } from '../../kernel/constitution/organic-score.js';
import {
  autoTarget,
  coerceFindings,
  engineeringFindingsFor,
} from '../organic-hookup.js';
import type { EngineeringFinding } from '../types.js';

describe('autoTarget', () => {
  it('detects diff/code text as a code target', () => {
    const target = autoTarget('+const x = fetch("https://api.example.com");\n+return x.json();');
    expect(target.kind).toBe('code');
    if (target.kind === 'code') expect(target.diff).toContain('fetch');
  });

  it('detects plain prose as a design target', () => {
    const target = autoTarget('The system depends on a single database server for all writes.');
    expect(target.kind).toBe('design');
    if (target.kind !== 'code') expect(target.text).toContain('database');
  });

  it('honors an explicit kind override', () => {
    const target = autoTarget('The queue has no failover and no standby.', 'architecture');
    expect(target.kind).toBe('architecture');
  });

  it('classifies code-like prose conservatively', () => {
    expect(autoTarget('import x from "y"; const z = 1;').kind).toBe('code');
  });
});

describe('coerceFindings', () => {
  it('passes valid findings through and drops junk entries', () => {
    const raw = [
      {
        tier: 'tier-08-failure',
        severity: 'blocking',
        conceptId: 'failure.network-loss',
        message: 'Network I/O with no recovery path.',
        evidence: ['I/O sites: 1'],
        suggestion: ['Add timeout + retry.'],
        gate: 'veto',
      },
      { conceptId: 'no-gate' },
      'not an object',
      {
        tier: 'tier-99-bogus',
        severity: 'blocking',
        conceptId: 'x',
        message: 'y',
        evidence: [],
        suggestion: [],
        gate: 'veto',
      },
    ];
    const out = coerceFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.conceptId).toBe('failure.network-loss');
    expect(out[0]!.gate).toBe('veto');
  });

  it('returns [] for non-array input', () => {
    expect(coerceFindings(null)).toEqual([]);
    expect(coerceFindings('nope')).toEqual([]);
    expect(coerceFindings({})).toEqual([]);
    expect(coerceFindings(undefined)).toEqual([]);
  });
});

describe('engineeringFindingsFor', () => {
  it('surfaces the SPOF veto for a single-dependency design', () => {
    const findings = engineeringFindingsFor(
      'The system depends on a single database server for all writes.',
    );
    expect(findings.some((f) => f.conceptId === 'sys.spof' && f.gate === 'veto')).toBe(true);
  });

  it('surfaces the network-loss veto for unmitigated fetch code', () => {
    const findings = engineeringFindingsFor(
      '+const r = await fetch("https://api.example.com/v1/users");\n+return await r.json();',
      'code',
    );
    expect(findings.some((f) => f.conceptId === 'failure.network-loss' && f.gate === 'veto')).toBe(true);
  });

  it('returns [] for a clean target', () => {
    const findings = engineeringFindingsFor('The service runs in three replicas with automatic failover to a standby database.');
    expect(findings.filter((f) => f.gate === 'veto')).toEqual([]);
  });

  it('returns [] for empty input', () => {
    expect(engineeringFindingsFor('')).toEqual([]);
    expect(engineeringFindingsFor('   ')).toEqual([]);
  });
});

describe('full pipeline: evaluator findings feed the organic-score gate', () => {
  const engine = new OrganicScoreEngine();

  it('rejects a pathological-complexity diff via engineering veto', () => {
    const findings: EngineeringFinding[] = engineeringFindingsFor(
      [
        '+for (const a of xs) {',
        '+  for (const b of ys) a.includes(b);',
        '+    for (const c of zs) b.includes(c);',
        '+      for (const d of ws) c.includes(d);',
        '+}',
      ].join('\n'),
      'code',
    );
    const result = engine.evaluate({
      change: 'Add the transformation loop.',
      engineeringFindings: findings,
    });
    expect(result.vetoedBy).toContain('cs.complexity.time');
    expect(result.verdict).toBe('reject');
  });

  it('does not veto a mitigated network call', () => {
    const findings = engineeringFindingsFor(
      [
        '+const r = await fetch("https://api.example.com/v1/users", { timeout: 3000 });',
        '+retry(r, { backoff: true, fallback: cache });',
      ].join('\n'),
      'code',
    );
    const result = engine.evaluate({
      change: 'Add the fetch with timeout, retry, and cache fallback.',
      engineeringFindings: findings,
    });
    expect(result.verdict).not.toBe('reject');
    expect(result.vetoedBy).toBeUndefined();
  });
});
