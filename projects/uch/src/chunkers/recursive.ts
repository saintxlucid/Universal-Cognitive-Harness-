export interface Chunk {
  text: string;
  start: number;
  end: number;
}

export interface ChunkOptions {
  targetWords?: number;
  overlapWords?: number;
  maxChars?: number;
}

export const MARKDOWN_CHUNKER_VERSION = 3;

export const DEFAULT_CHUNK_OPTIONS: Required<Omit<ChunkOptions, never>> = {
  targetWords: 300,
  overlapWords: 50,
  maxChars: 6000,
};

const DELIMITER_LEVELS: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: 'paragraph',
    patterns: [/\n\n+/g],
  },
  {
    name: 'line',
    patterns: [/\n/g],
  },
  {
    name: 'sentence',
    patterns: [/[.!?。！？]+(?=\s|$)/g],
  },
  {
    name: 'clause',
    patterns: [/[;,：；，、]+(?=\s|$)/g],
  },
  {
    name: 'word',
    patterns: [/\s+/g],
  },
];

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  const cjkChars = (text.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g) ?? []).length;
  const totalChars = text.length;
  if (totalChars > 0 && cjkChars / totalChars >= 0.3) {
    return totalChars;
  }
  return (text.trim().match(/\S+/g) ?? []).length;
}

export function countCJKAwareWords(text: string): number {
  return countWords(text);
}

function splitAtDelimiters(text: string, level: number): string[] {
  const delimiters = DELIMITER_LEVELS[level]?.patterns ?? [];
  const parts: string[] = [];
  let lastIndex = 0;
  for (const pattern of delimiters) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const end = match.index + match[0].length;
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, end));
      }
      lastIndex = end;
    }
    if (lastIndex > 0) break;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function recursiveSplit(text: string, targetWords: number, level = 0): string[] {
  if (countWords(text) <= targetWords || level >= DELIMITER_LEVELS.length) {
    return [text];
  }
  const parts = splitAtDelimiters(text, level);
  if (parts.length <= 1) {
    return [text];
  }
  const result: string[] = [];
  for (const part of parts) {
    if (!part.trim()) continue;
    result.push(...recursiveSplit(part, targetWords, level + 1));
  }
  return result;
}

function greedyMerge(parts: string[], targetWords: number): string[] {
  const merged: string[] = [];
  let current = '';
  for (const part of parts) {
    const candidate = current ? `${current}\n\n${part}` : part;
    if (current && countWords(candidate) > targetWords * 1.5) {
      merged.push(current.trim());
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) merged.push(current.trim());
  return merged;
}

function applyOverlap(chunks: string[], overlapWords: number): string[] {
  if (overlapWords <= 0 || chunks.length <= 1) return chunks;
  const result: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    if (i > 0) {
      const previous = chunks[i - 1]!;
      const prevWords = previous.split(/\s+/);
      const overlap = prevWords.slice(-overlapWords).join(' ');
      if (overlap) {
        result.push(`${overlap}\n\n${chunk}`);
        continue;
      }
    }
    result.push(chunk);
  }
  return result;
}

function enforceMaxChars(chunks: string[], maxChars: number): string[] {
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      result.push(chunk);
      continue;
    }
    const overlap = Math.min(500, Math.floor(maxChars / 10));
    const step = maxChars - overlap;
    let start = 0;
    while (start < chunk.length) {
      result.push(chunk.slice(start, start + maxChars));
      start += step;
    }
  }
  return result;
}

export function chunkMarkdown(text: string, options: ChunkOptions = {}): Chunk[] {
  const opts = { ...DEFAULT_CHUNK_OPTIONS, ...options };
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const parts = recursiveSplit(normalized, opts.targetWords);
  const merged = greedyMerge(parts, opts.targetWords);
  const withOverlap = applyOverlap(merged, opts.overlapWords);
  const capped = enforceMaxChars(withOverlap, opts.maxChars);

  let offset = 0;
  return capped.map((text) => {
    const start = offset;
    offset = start + text.length + 2;
    return { text, start, end: start + text.length };
  });
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  return chunkMarkdown(text, options).map((c) => c.text);
}
