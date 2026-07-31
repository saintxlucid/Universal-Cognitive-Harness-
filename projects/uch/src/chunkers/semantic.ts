import { chunkText, type ChunkOptions } from './recursive.js';

export interface SemanticChunkOptions extends ChunkOptions {
  embedSentence?: (sentence: string) => Promise<number[]>;
  similarityThresholdPercentile?: number;
}

interface SentenceSpan {
  text: string;
  embedding: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?。！？])\s+|\n+/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function savitzkyGolayDerivative(values: number[]): number[] {
  const coeffs = [1, -8, 0, 8, -1];
  const halfWindow = 2;
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let hasNeighbor = false;
    for (let j = 0; j < coeffs.length; j++) {
      const idx = i + (j - halfWindow);
      const value = values[idx];
      if (value === undefined) continue;
      hasNeighbor = true;
      sum += coeffs[j]! * value;
    }
    result.push(hasNeighbor ? sum / 12 : 0);
  }
  return result;
}

function boundaryCandidates(derivative: number[]): number[] {
  const candidates: number[] = [];
  for (let i = 1; i < derivative.length; i++) {
    const prev = derivative[i - 1] ?? 0;
    const curr = derivative[i] ?? 0;
    if (prev < 0 && curr >= 0) {
      candidates.push(i);
    }
  }
  return candidates;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[index] ?? 0;
}

export async function chunkSemantic(
  text: string,
  options: SemanticChunkOptions = {},
): Promise<string[]> {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) {
    return chunkText(text, options);
  }

  let spans: SentenceSpan[];
  try {
    const embed = options.embedSentence;
    if (!embed) {
      return chunkText(text, options);
    }
    const embeddings = await Promise.all(sentences.map((s) => embed(s)));
    spans = sentences.map((sentence, i) => ({
      text: sentence,
      embedding: embeddings[i] ?? [],
    }));
  } catch {
    return chunkText(text, options);
  }

  const similarities: number[] = [];
  for (let i = 1; i < spans.length; i++) {
    similarities.push(cosineSimilarity(spans[i - 1]!.embedding, spans[i]!.embedding));
  }
  if (similarities.length === 0) {
    return chunkText(text, options);
  }

  const derivative = savitzkyGolayDerivative(similarities);
  const candidates = boundaryCandidates(derivative);
  if (candidates.length === 0) {
    return chunkText(text, options);
  }

  const candidateSimilarities = candidates.map((idx) => similarities[idx] ?? 0);
  const threshold = percentile(
    candidateSimilarities,
    options.similarityThresholdPercentile ?? 20,
  );
  const boundaries = candidates
    .filter((idx) => (similarities[idx] ?? 0) <= threshold)
    .filter((idx, i, arr) => i === 0 || idx - arr[i - 1]! >= 2);

  if (boundaries.length === 0) {
    return chunkText(text, options);
  }

  const groups: string[] = [];
  let start = 0;
  for (const boundary of boundaries) {
    groups.push(spans.slice(start, boundary).map((s) => s.text).join(' '));
    start = boundary;
  }
  groups.push(spans.slice(start).map((s) => s.text).join(' '));

  const maxChars = options.maxChars ?? 6000;
  const targetWords = options.targetWords ?? 300;
  const finalChunks: string[] = [];
  for (const group of groups) {
    if (group.length > maxChars) {
      finalChunks.push(...chunkText(group, options));
    } else if (group.length > maxChars * 1.5) {
      finalChunks.push(...chunkText(group, options));
    } else {
      finalChunks.push(group);
    }
  }

  void targetWords;
  return finalChunks;
}
