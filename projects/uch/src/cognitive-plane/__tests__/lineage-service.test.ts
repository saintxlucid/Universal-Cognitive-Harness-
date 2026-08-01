import { describe, expect, it } from 'vitest';
import { LineageService } from '../lineage/lineage-service.js';

describe('LineageService', () => {
  it('answers the origin question', () => {
    const service = new LineageService();
    service.recordOrigin('belief-1', 'belief', 'session-a', 'evt-1', 10);
    expect(service.lineage('belief-1')?.origin).toEqual({
      creator: 'session-a',
      eventId: 'evt-1',
      atTick: 10,
    });
  });

  it('records the changelog with who/what/why', () => {
    const service = new LineageService();
    service.recordOrigin('b', 'belief', 'me', 'evt-1', 1);
    service.addChange('b', 'verifier', 'strengthened', 'new evidence', 2);
    service.addChange('b', 'system', 'decayed', 'law-5 trust decay', 3);
    expect(service.lineage('b')?.changelog).toHaveLength(2);
    expect(service.lineage('b')?.changelog[0]).toMatchObject({ who: 'verifier', what: 'strengthened' });
  });

  it('tracks verification verdicts', () => {
    const service = new LineageService();
    service.recordOrigin('c', 'belief', 'me', 'evt-1', 1);
    service.addVerification('c', 'pass', 'benchmark-run-7', 5);
    service.addVerification('c', 'fail', 'organic-score-9', 6);
    expect(service.verifiedBy('c')).toHaveLength(2);
    expect(service.verifiedBy('c')[0]).toMatchObject({ verdict: 'pass', run: 'benchmark-run-7' });
  });

  it('answers what depends on me via reverse causal edges', () => {
    const service = new LineageService();
    service.recordOrigin('api', 'decision', 'a', 'evt-1', 1);
    service.recordOrigin('client', 'decision', 'b', 'evt-2', 2);
    service.declareDependency('client', 'api');
    expect(service.dependsOnMe('api')).toEqual(['client']);
  });

  it('retains a lineage stub after extinction', () => {
    const service = new LineageService();
    service.recordOrigin('gone', 'skill', 'me', 'evt-1', 1);
    service.addVerification('gone', 'pass', 'run-1', 2);
    expect(service.markExtinct('gone')).toBe(true);
    const lineage = service.lineage('gone');
    expect(lineage).toBeDefined();
    expect(lineage?.extinct).toBe(true);
    expect(lineage?.origin.creator).toBe('me');
  });

  it('refuses changes to extinct objects', () => {
    const service = new LineageService();
    service.recordOrigin('gone', 'skill', 'me', 'evt-1', 1);
    service.markExtinct('gone');
    expect(service.addChange('gone', 'x', 'y', 'z', 2)).toBe(false);
  });

  it('refuses unknown object queries', () => {
    const service = new LineageService();
    expect(service.lineage('nope')).toBeUndefined();
    expect(service.verifiedBy('nope')).toEqual([]);
  });

  it('prevents self-dependencies', () => {
    const service = new LineageService();
    service.recordOrigin('self', 'x', 'me', 'evt-1', 1);
    expect(service.declareDependency('self', 'self')).toBe(false);
  });
});
