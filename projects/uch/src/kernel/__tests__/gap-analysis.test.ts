import { describe, it, expect } from 'vitest';
import { GapAnalysisEngine, type GapAnalysisResultItem } from '../retrieval/gap-analysis.js';

function result(id: string, text: string, daysAgo = 0): GapAnalysisResultItem {
  return {
    id,
    text,
    timestamp: new Date(Date.now() - daysAgo * 86_400_000),
    source: 'test',
  };
}

describe('GapAnalysisEngine', () => {
  it('cites retrieved results and reports thin coverage', () => {
    const engine = new GapAnalysisEngine();
    const output = engine.analyze('alice pricing', [result('r1', 'Alice handles pricing tiers')]);
    expect(output.citations).toEqual(['r1']);
    expect(output.gaps.some((g) => g.includes('Only 1 source'))).toBe(true);
  });

  it('reports missing terms not covered by any page', () => {
    const engine = new GapAnalysisEngine();
    const output = engine.analyze('security review deadline', [result('r1', 'security review is due')]);
    expect(output.missingTerms).toContain('deadline');
    expect(output.gaps.some((g) => g.includes('deadline'))).toBe(true);
  });

  it('flags stale pages beyond the threshold', () => {
    const engine = new GapAnalysisEngine({ stalenessThresholdDays: 30 });
    const output = engine.analyze('roadmap', [result('r1', 'roadmap for next quarter', 45)]);
    expect(output.stale).toHaveLength(1);
    expect(output.stale[0]?.ageDays).toBeGreaterThan(30);
    expect(output.gaps.some((g) => g.includes('older than 30 days'))).toBe(true);
  });

  it('detects contradictions between pages', () => {
    const engine = new GapAnalysisEngine();
    const output = engine.analyze('deploy status', [
      result('r1', 'The service is working fine'),
      result('r2', 'The service is down right now'),
    ]);
    expect(output.contradictions.length).toBeGreaterThan(0);
    expect(output.contradictions[0]?.between.sort()).toEqual(['r1', 'r2']);
  });

  it('reports empty brains as a gap', () => {
    const engine = new GapAnalysisEngine();
    const output = engine.analyze('anything', []);
    expect(output.gaps.some((g) => g.includes('no pages'))).toBe(true);
    expect(output.confidence).toBe(0);
  });

  it('scales confidence with coverage', () => {
    const engine = new GapAnalysisEngine();
    const full = engine.analyze('alice pricing meeting', [
      result('r1', 'alice pricing meeting notes'),
      result('r2', 'alice pricing discussed'),
      result('r3', 'meeting with alice'),
      result('r4', 'pricing tiers for alice'),
      result('r5', 'alice pricing follow-up'),
    ]);
    const thin = engine.analyze('alice pricing meeting', [result('r1', 'alice pricing meeting notes')]);
    expect(full.confidence).toBeGreaterThan(thin.confidence);
  });
});
