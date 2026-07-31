import { describe, it, expect } from 'vitest';
import {
  SynthesisEngine,
  parseInlineCitations,
  normalizeStructuredCitations,
  resolveCitations,
  type SynthesisSource,
} from '../retrieval/synthesis.js';

function source(id: string, text: string, daysAgo = 0): SynthesisSource {
  return {
    id,
    text,
    timestamp: new Date(Date.now() - daysAgo * 86_400_000),
    source: 'test',
    title: `title-${id}`,
  };
}

describe('parseInlineCitations', () => {
  it('extracts [id] and [id#row] markers in order', () => {
    const citations = parseInlineCitations('First claim [abc123]. Second [abc123#2] and [nested/slug#7].');
    expect(citations).toEqual([
      { page_slug: 'abc123', row_num: null, citation_index: 1 },
      { page_slug: 'abc123', row_num: 2, citation_index: 2 },
      { page_slug: 'nested/slug', row_num: 7, citation_index: 3 },
    ]);
  });

  it('ignores invalid markers', () => {
    expect(parseInlineCitations('no brackets here').length).toBe(0);
    expect(parseInlineCitations('[#3]')).toEqual([]);
  });
});

describe('normalizeStructuredCitations', () => {
  it('validates and dedupes structured citations', () => {
    const { citations, warnings } = normalizeStructuredCitations([
      { page_slug: 'abc', row_num: 1 },
      { page_slug: 'abc', row_num: 1 },
      { page_slug: '', row_num: null },
      'garbage',
    ]);
    expect(citations).toHaveLength(1);
    expect(warnings).toEqual(['CITATION_MISSING_SLUG', 'CITATION_NOT_OBJECT']);
  });

  it('warns when input is not an array', () => {
    const { citations, warnings } = normalizeStructuredCitations(null);
    expect(citations).toEqual([]);
    expect(warnings).toEqual(['CITATIONS_NOT_ARRAY']);
  });
});

describe('resolveCitations', () => {
  it('prefers structured citations over regex fallback', () => {
    const { citations, usedFallback } = resolveCitations([{ page_slug: 'abc', row_num: null }], '[def] body');
    expect(citations[0]?.page_slug).toBe('abc');
    expect(usedFallback).toBe(false);
  });

  it('falls back to inline markers with a warning', () => {
    const { citations, usedFallback, warnings } = resolveCitations(null, 'Grounded claim [def#4] here.');
    expect(citations[0]?.page_slug).toBe('def');
    expect(usedFallback).toBe(true);
    expect(warnings).toContain('CITATIONS_REGEX_FALLBACK');
  });
});

describe('SynthesisEngine', () => {
  it('produces grounded claims with citations and a summary', () => {
    const engine = new SynthesisEngine();
    const output = engine.synthesize('deployment pipeline status', [
      source('r1', 'The deployment pipeline is working and supports rollbacks.'),
      source('r2', 'The pipeline went down during the last release window.'),
      source('r3', 'Deployment rollbacks take about five minutes.'),
    ]);
    expect(output.claims.length).toBeGreaterThan(0);
    expect(output.summary.length).toBeGreaterThan(0);
    expect(output.citations.length).toBeGreaterThan(0);
    for (const claim of output.claims) {
      expect(claim.citations.length).toBeGreaterThan(0);
    }
  });

  it('reports empty corpora as ungrounded with zero confidence', () => {
    const engine = new SynthesisEngine();
    const output = engine.synthesize('anything', []);
    expect(output.confidence).toBe(0);
    expect(output.warnings).toContain('NO_SOURCES');
    expect(output.gaps.some((g) => g.includes('cannot be grounded'))).toBe(true);
  });

  it('detects contradictions between sources', () => {
    const engine = new SynthesisEngine();
    const output = engine.synthesize('service status', [
      source('r1', 'The service is working fine right now.'),
      source('r2', 'The service is down and failing requests.'),
    ]);
    expect(output.contradictions.length).toBeGreaterThan(0);
  });

  it('flags thin coverage as a gap', () => {
    const engine = new SynthesisEngine();
    const output = engine.synthesize('migration planning', [
      source('r1', 'Migration planning session happened.'),
      source('r2', 'migration planning next steps'),
    ]);
    expect(output.gaps.some((g) => g.includes('Only 2 source'))).toBe(true);
  });

  it('scales confidence with grounded claims', () => {
    const engine = new SynthesisEngine();
    const strong = engine.synthesize('alice pricing meeting', [
      source('r1', 'alice pricing meeting notes discussed tiers'),
      source('r2', 'alice pricing discussed for next quarter'),
      source('r3', 'meeting with alice covered pricing'),
      source('r4', 'pricing tiers for alice approved'),
      source('r5', 'alice pricing follow-up scheduled'),
    ]);
    const weak = engine.synthesize('alice pricing meeting', [source('r1', 'unrelated content about weather')]);
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });
});
