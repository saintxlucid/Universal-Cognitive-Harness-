import { describe, it, expect } from 'vitest';
import { CodeScorer, type FileProfile } from '../suit/litmus/code-scorer.js';

function makeProfile(overrides: Partial<FileProfile> = {}): FileProfile {
  return {
    path: overrides.path ?? '/test/file.ts',
    language: overrides.language ?? 'typescript',
    lines: overrides.lines ?? 50,
    imports: overrides.imports ?? ['fs', 'path'],
    exports: overrides.exports ?? ['main'],
    functions: overrides.functions ?? [{ name: 'main', lines: 20, params: 2, complexity: 3 }],
    classes: overrides.classes ?? [],
    comments: overrides.comments ?? 5,
    todoCount: overrides.todoCount ?? 0,
    hasTests: overrides.hasTests ?? true,
    hasTypes: overrides.hasTypes ?? true,
    maxNesting: overrides.maxNesting ?? 2,
    duplicateScore: overrides.duplicateScore ?? 0,
    dependencyCount: overrides.dependencyCount ?? 2,
    securityPatterns: overrides.securityPatterns ?? [],
  };
}

describe('CodeScorer', () => {
  it('scores a clean file highly', () => {
    const scorer = new CodeScorer(100);
    const result = scorer.score(makeProfile());
    expect(result.composite).toBeGreaterThan(0.8);
    expect(result.rejected).toBe(false);
    expect(result.dimensions.length).toBe(16);
  });

  it('rejects files below threshold', () => {
    const scorer = new CodeScorer(100, { threshold: 0.9 });
    const result = scorer.score(makeProfile({ lines: 600, maxNesting: 8, functions: [{ name: 'do', lines: 150, params: 10, complexity: 25 }], todoCount: 10, dependencyCount: 20, hasTests: false }));
    expect(result.rejected).toBe(true);
  });

  it('penalizes missing tests', () => {
    const scorer = new CodeScorer(100);
    const without = scorer.score(makeProfile({ hasTests: false }));
    const withTests = scorer.score(makeProfile({ hasTests: true }));
    expect(without.composite).toBeLessThan(withTests.composite);
  });

  it('penalizes high nesting', () => {
    const scorer = new CodeScorer(100);
    const deep = scorer.score(makeProfile({ maxNesting: 7 }));
    const shallow = scorer.score(makeProfile({ maxNesting: 2 }));
    expect(deep.composite).toBeLessThan(shallow.composite);
  });

  it('penalizes security patterns', () => {
    const scorer = new CodeScorer(100);
    const safe = scorer.score(makeProfile({ securityPatterns: [] }));
    const unsafe = scorer.score(makeProfile({ securityPatterns: ['eval'] }));
    expect(unsafe.composite).toBeLessThan(safe.composite);
  });

  it('penalizes large files', () => {
    const scorer = new CodeScorer(100);
    const small = scorer.score(makeProfile({ lines: 50 }));
    const large = scorer.score(makeProfile({ lines: 600 }));
    expect(large.composite).toBeLessThan(small.composite);
  });

  it('penalizes high duplicate score', () => {
    const scorer = new CodeScorer(100);
    const unique = scorer.score(makeProfile({ duplicateScore: 0 }));
    const duped = scorer.score(makeProfile({ duplicateScore: 0.6 }));
    expect(duped.composite).toBeLessThan(unique.composite);
  });

  it('penalizes TODOs', () => {
    const scorer = new CodeScorer(100);
    const clean = scorer.score(makeProfile({ todoCount: 0 }));
    const messy = scorer.score(makeProfile({ todoCount: 8 }));
    expect(messy.composite).toBeLessThan(clean.composite);
  });

  it('tracks history', () => {
    const scorer = new CodeScorer(100);
    scorer.score(makeProfile({ path: '/a.ts' }));
    scorer.score(makeProfile({ path: '/b.ts' }));
    expect(scorer.getHistory()).toHaveLength(2);
    expect(scorer.getHistory(1)).toHaveLength(1);
  });

  it('returns stats', () => {
    const scorer = new CodeScorer(100);
    scorer.score(makeProfile({ path: '/a.ts' }));
    const stats = scorer.getStats();
    expect(stats.totalScored).toBe(1);
    expect(typeof stats.avgComposite).toBe('number');
  });

  it('handles empty files', () => {
    const scorer = new CodeScorer(100);
    const result = scorer.score(makeProfile({ lines: 1, functions: [], comments: 0, exports: [] }));
    expect(result.composite).toBeGreaterThan(0);
  });

  it('detects complex functions', () => {
    const scorer = new CodeScorer(100);
    const simple = scorer.score(makeProfile({ functions: [{ name: 'f', lines: 5, params: 1, complexity: 2 }] }));
    const complex = scorer.score(makeProfile({ functions: [{ name: 'f', lines: 5, params: 1, complexity: 15 }] }));
    expect(complex.composite).toBeLessThan(simple.composite);
  });
});
