import { describe, it, expect } from 'vitest';
import { CodeGovernanceGate } from '../kernel/constitution/code-governance-gate.js';

describe('Code Governance Gate', () => {
  it('allows a clean change with a full score', () => {
    const gate = new CodeGovernanceGate();
    const record = gate.review({
      change: 'extract the shared email helper used by both callers',
      intent: 'reuse validation',
      target: 'src/auth/validation.ts',
    });
    expect(record.verdict).toBe('allow');
    expect(record.score).toBeGreaterThanOrEqual(7);
    expect(record.evidence).toEqual([]);
    expect(record.scope).toBe('workspace');
  });

  it('blocks a change with a hard principle violation', () => {
    const gate = new CodeGovernanceGate();
    const record = gate.review({
      change:
        'rewrites the same logic in three places with duplicated code and reimplements the validation',
      target: 'src/pricing/discount.ts',
    });
    expect(record.verdict).toBe('block');
    expect(record.evidence.some((e) => e.startsWith('dry'))).toBe(true);
  });

  it('defers moderate violations to review', () => {
    const gate = new CodeGovernanceGate();
    const record = gate.review({
      change: 'duplicate validation logic in a microservices setup with speculative features',
      target: 'src/queue/consumer.ts',
    });
    expect(record.verdict).toBe('review');
    expect(record.evidence.length).toBeGreaterThan(0);
  });

  it('records evidence as principle ids and scores only — never change content', () => {
    const gate = new CodeGovernanceGate();
    const record = gate.review({
      change: 'rewrites the same logic in three places with duplicated code',
      target: 'src/legacy/parser.ts',
    });
    for (const e of record.evidence) {
      expect(e).not.toContain('rewrites the same logic');
      expect(e).toMatch(/^(soc|dry|kiss|dyc|yagni)/);
    }
  });

  it('emits governance:code_reviewed events when a sink is configured', () => {
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const gate = new CodeGovernanceGate({
      eventSink: (event) => {
        events.push(event);
      },
    });
    gate.review({ change: 'clean minimal change', target: 'src/a.ts' });
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('governance:code_reviewed');
    expect(events[0]!.payload.target).toBe('src/a.ts');
    expect(events[0]!.payload.verdict).toBe('allow');
  });

  it('computes block and review rate benchmarks', () => {
    const gate = new CodeGovernanceGate();
    gate.review({ change: 'clean minimal change', target: 'a.ts' });
    gate.review({ change: 'another clean minimal change', target: 'b.ts' });
    gate.review({
      change: 'rewrites the same logic in three places with duplicated code',
      target: 'c.ts',
    });
    expect(gate.getBlockRate()).toBeCloseTo(1 / 3);
  });

  it('detects revision loops on the same target', () => {
    const gate = new CodeGovernanceGate();
    for (let i = 0; i < 3; i++) {
      gate.review({
        change: 'duplicated code with over-engineered abstractions and speculative extension points',
        target: 'src/pricing/discount.ts',
      });
    }
    expect(gate.getRevisionLoopRate()).toBeGreaterThan(0);
  });

  it('computes the average governance score', () => {
    const gate = new CodeGovernanceGate();
    gate.review({ change: 'clean minimal change', target: 'a.ts' });
    gate.review({ change: 'another clean minimal change', target: 'b.ts' });
    expect(gate.getAverageScore()).toBeGreaterThanOrEqual(7);
  });

  it('returns records by id and full status snapshot', () => {
    const gate = new CodeGovernanceGate({ scope: 'project-x' });
    const record = gate.review({ change: 'clean minimal change', target: 'a.ts' });
    expect(gate.getRecord(record.id)!.target).toBe('a.ts');
    const status = gate.getStatus();
    expect(status.reviewed).toBe(1);
  });
});
