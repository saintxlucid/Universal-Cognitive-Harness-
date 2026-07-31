import { describe, it, expect } from 'vitest';
import { ContextCompressor } from '../kernel/retrieval/context-compressor.js';
import { FastPathRouter } from '../agentic/fastpath/fast-path-router.js';
import type { ScoredResult } from '../kernel/retrieval/fusion.js';

function result(id: string, score: number, content: unknown, source: ScoredResult['source'] = 'semantic'): ScoredResult {
  return {
    id,
    score,
    rawScore: score,
    provenanceFactor: 1,
    source,
    content: content as ScoredResult['content'],
  };
}

const concept = (name: string, definition: string) => ({
  id: `c-${name}`,
  name,
  definition,
  confidence: { value: 0.9 },
  provenance: { reliability: 0.9 },
});

describe('ContextCompressor', () => {
  it('compresses retrieved context and reports stats', () => {
    const compressor = new ContextCompressor({ maxEntries: 2 });
    const results = [
      result('1', 0.9, concept('alpha', 'the alpha module handles ingestion')),
      result('2', 0.8, concept('beta', 'the beta module handles retrieval')),
      result('3', 0.7, concept('gamma', 'the gamma module handles routing')),
      result('4', 0.6, concept('delta', 'the delta module handles persistence')),
    ];
    const out = compressor.compress(results);
    expect(out.stats.inputEntries).toBe(4);
    expect(out.stats.outputEntries).toBe(2);
    expect(out.stats.droppedByScore).toBe(2);
    expect(out.text).toContain('alpha');
    expect(out.text).not.toContain('gamma');
    expect(out.stats.compressionPct).toBeGreaterThan(0);
  });

  it('deduplicates near-identical content', () => {
    const compressor = new ContextCompressor();
    const results = [
      result('1', 0.9, concept('same', 'the pipeline ingests raw data and normalizes it')),
      result('2', 0.85, concept('same-copy', 'the pipeline ingests raw data and normalizes it completely')),
      result('3', 0.5, concept('other', 'unrelated concept about orchestration')),
    ];
    const out = compressor.compress(results);
    expect(out.stats.droppedByDedupe).toBe(1);
    expect(out.stats.outputEntries).toBe(2);
  });

  it('truncates oversized entries', () => {
    const compressor = new ContextCompressor({ maxEntryChars: 60 });
    const long = 'a'.repeat(200);
    const out = compressor.compress([result('1', 0.9, concept('long', long))]);
    expect(out.stats.truncated).toBe(1);
    expect(out.text.length).toBeLessThan(120);
    expect(out.text.endsWith('...')).toBe(true);
  });

  it('returns empty output for empty input', () => {
    const compressor = new ContextCompressor();
    const out = compressor.compress([]);
    expect(out.text).toBe('');
    expect(out.stats.inputEntries).toBe(0);
    expect(out.stats.outputEntries).toBe(0);
  });

  it('ranks by score before compressing', () => {
    const compressor = new ContextCompressor({ maxEntries: 1 });
    const results = [
      result('low', 0.1, concept('low', 'low scoring concept first in list')),
      result('high', 0.99, concept('high', 'high scoring concept second in list')),
    ];
    const out = compressor.compress(results);
    expect(out.text).toContain('high');
    expect(out.text).not.toContain('low');
  });
});

describe('Exoskeleton fast path routing', () => {
  it('routes status requests deterministically', () => {
    const router = new FastPathRouter();
    router.register({
      name: 'status-routine',
      description: 'status',
      keywords: ['status', 'state'],
      execute: () => 'ok',
    });
    const result = router.resolve('what is the current status?');
    expect(result?.routine).toBe('status-routine');
  });

  it('reports cortex-offload ratio', () => {
    const router = new FastPathRouter();
    router.register({
      name: 'health-routine',
      description: 'health',
      keywords: ['health'],
      execute: () => 'healthy',
    });
    router.resolve('health please');
    router.resolve('health please');
    router.resolve('write me a poem about retrieval');
    const stats = router.getStats();
    expect(stats.resolved).toBe(2);
    expect(stats.totalCalls).toBe(3);
    expect(stats.missRate).toBeCloseTo(1 / 3, 5);
  });
});
