import { describe, it, expect, vi } from 'vitest';
import {
  chunkMarkdown,
  chunkText,
  countWords,
  countCJKAwareWords,
  DEFAULT_CHUNK_OPTIONS,
  MARKDOWN_CHUNKER_VERSION,
} from '../recursive.js';
import { chunkSemantic } from '../semantic.js';

function paragraph(wordCount: number, offset = 0): string {
  return Array.from({ length: wordCount }, (_, i) => `w${offset + i}`).join(' ');
}

describe('countWords', () => {
  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
  });

  it('counts whitespace-separated tokens for latin text', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  spaced   out  ')).toBe(2);
  });

  it('counts characters for CJK-dominant text', () => {
    expect(countWords('你好世界')).toBe(4);
    expect(countWords('日本語のテストです')).toBe(9);
  });

  it('counts tokens for mixed CJK/latin text below the CJK threshold', () => {
    expect(countWords('hello 世界')).toBe(2);
  });

  it('aliases countCJKAwareWords to countWords', () => {
    expect(countCJKAwareWords('a b c')).toBe(countWords('a b c'));
    expect(countCJKAwareWords('你好')).toBe(2);
  });
});

describe('chunkText', () => {
  it('returns [] for empty text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const chunks = chunkText('Just a short sentence.', { targetWords: 300 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('short sentence');
  });

  it('splits long text into multiple chunks', () => {
    const text = Array.from({ length: 30 }, (_, i) => paragraph(15, i * 100)).join('\n\n');
    const chunks = chunkText(text, { targetWords: 20 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('normalizes CRLF to LF', () => {
    const chunks = chunkText('one\r\ntwo\r\n\r\nthree');
    expect(chunks[0]).toBe('one\ntwo\n\nthree');
  });
});

describe('chunkMarkdown', () => {
  it('reports monotonically increasing, self-consistent offsets', () => {
    const text = Array.from({ length: 10 }, (_, i) => paragraph(15, i * 100)).join('\n\n');
    const chunks = chunkMarkdown(text, { targetWords: 20, overlapWords: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]!;
      expect(c.end - c.start).toBe(c.text.length);
      expect(c.start).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(c.start).toBeGreaterThan(chunks[i - 1]!.start);
    }
  });

  it('applies overlap words from the previous chunk', () => {
    const text = Array.from({ length: 4 }, (_, i) => paragraph(15, i * 100)).join('\n\n');
    const chunks = chunkMarkdown(text, { targetWords: 20, overlapWords: 5 });
    expect(chunks.length).toBeGreaterThan(1);
    const prevLast5 = chunks[0]!.text.split(/\s+/).slice(-5).join(' ');
    expect(chunks[1]!.text.startsWith(prevLast5 + '\n\n')).toBe(true);
  });

  it('enforces maxChars on oversized chunks', () => {
    const text = paragraph(500);
    const chunks = chunkMarkdown(text, { maxChars: 100 });
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(100);
    }
  });

  it('exposes stable defaults and version', () => {
    expect(DEFAULT_CHUNK_OPTIONS).toEqual({ targetWords: 300, overlapWords: 50, maxChars: 6000 });
    expect(MARKDOWN_CHUNKER_VERSION).toBe(3);
  });
});

describe('chunkSemantic', () => {
  const alpha = [1, 0];
  const beta = [0, 1];

  it('falls back to chunkText when no embedder is provided', async () => {
    const text = 'Alpha first. Beta first. Beta second. Alpha second.';
    await expect(chunkSemantic(text)).resolves.toEqual(chunkText(text));
  });

  it('falls back to chunkText for a single sentence', async () => {
    const embed = vi.fn(async () => alpha);
    const chunks = await chunkSemantic('Only one sentence here.', { embedSentence: embed });
    expect(chunks).toEqual(chunkText('Only one sentence here.'));
    expect(embed).not.toHaveBeenCalled();
  });

  it('falls back to chunkText when the embedder throws', async () => {
    const embed = vi.fn(async () => {
      throw new Error('embed failure');
    });
    const text = 'Alpha first. Beta first. Beta second. Alpha second.';
    const chunks = await chunkSemantic(text, { embedSentence: embed });
    expect(chunks).toEqual(chunkText(text));
  });

  it('falls back to chunkText when no topic boundaries are detected', async () => {
    const embed = vi.fn(async () => alpha);
    const chunks = await chunkSemantic('One topic. Same topic. Still same. Always same.', {
      embedSentence: embed,
    });
    expect(chunks).toEqual(chunkText('One topic. Same topic. Still same. Always same.'));
  });

  it('splits at semantic topic transitions', async () => {
    const embed = vi.fn(async (sentence: string) => (sentence.startsWith('Alpha') ? alpha : beta));
    const chunks = await chunkSemantic('Alpha first. Alpha second. Beta first. Alpha third.', {
      embedSentence: embed,
    });
    expect(chunks).toEqual(['Alpha first. Alpha second.', 'Beta first. Alpha third.']);
  });

  it('preserves all sentences in order across chunks', async () => {
    const embed = vi.fn(async (sentence: string) => (sentence.startsWith('Alpha') ? alpha : beta));
    const chunks = await chunkSemantic('Alpha first. Alpha second. Beta first. Alpha third.', {
      embedSentence: embed,
    });
    const joined = chunks.join(' ');
    for (const s of ['Alpha first.', 'Alpha second.', 'Beta first.', 'Alpha third.']) {
      expect(joined).toContain(s);
    }
  });

  it('caps oversized groups with maxChars', async () => {
    const embed = vi.fn(async (sentence: string) => (sentence.startsWith('Alpha') ? alpha : beta));
    const chunks = await chunkSemantic('Alpha first. Beta first. Beta second. Alpha second.', {
      embedSentence: embed,
      maxChars: 10,
    });
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(10);
    }
  });
});
