import { describe, it, expect } from 'vitest';
import { dikwTransform, checkRepresentationInvariance } from '../knowledge/dikw.js';

describe('DIKW Transform', () => {
  it('moves data to wisdom when context is added', () => {
    const r = dikwTransform({
      dataPoints: [
        { attribute: 'temperature', value: '38.6C' },
        { attribute: 'duration', value: '3 days' },
        { attribute: 'white blood cells', value: 'elevated' },
      ],
      relationships: [
        { subject: 'patient', relationships: ['fever for 3 days', 'elevated WBC'] },
      ],
      knowledgeRules: [
        { pattern: 'persistent fever + elevated WBC', mechanism: 'often indicates infection', applicability: 'diagnostic heuristic' },
      ],
      judgment: {
        priorities: ['find the underlying infection', 'treat the cause not symptoms'],
        tradeoffs: ['speed of diagnosis vs cost of tests'],
        ethicalConsiderations: ['patient consent'],
      },
    });
    expect(r.data.primaryQuestions).toEqual(expect.arrayContaining(['Who?', 'What?']));
    expect(r.information.entities.length).toBe(1);
    expect(r.knowledge.primaryQuestion).toBe('How?');
    expect(r.wisdom.primaryQuestion).toBe('Why?');
    expect(r.wisdom.judgment?.priorities[0]).toContain('underlying infection');
    expect(r.loop[0]).toContain('Reality → Observe');
  });

  it('reports missing layers honestly', () => {
    const r = dikwTransform({ dataPoints: [{ attribute: 'x', value: '1' }] });
    expect(r.wisdom.judgment).toBeNull();
    expect(r.wisdom.added[0]).toContain('missing');
  });
});

describe('Representation invariance (Truth axiom)', () => {
  it('confirms a claim that converges across representations', () => {
    const r = checkRepresentationInvariance('The service is down', [
      { label: 'metrics', content: 'service unreachable in monitoring' },
      { label: 'logs', content: 'service returned errors in logs' },
      { label: 'users', content: 'users report service unavailable' },
    ]);
    expect(r.consistent).toBe(true);
    expect(r.agreementPct).toBeGreaterThanOrEqual(50);
  });

  it('flags conflicting representations as unverified', () => {
    const r = checkRepresentationInvariance('The service is down', [
      { label: 'health check', content: 'health check passes and returns 200' },
    ]);
    expect(r.consistent).toBe(false);
    expect(r.insight).toContain('conflict');
  });
});
