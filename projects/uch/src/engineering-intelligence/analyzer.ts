/**
 * Engineering Intelligence Layer — analyzer.
 *
 * Deterministic text analysis of an evaluation target into a
 * JudgmentContext: diff statistics and code facts (loops, nesting,
 * I/O surfaces, parallelism, retries). No LLM, no heuristics that
 * depend on model behavior — pure regex/line scanning.
 */

import type {
  CodeFacts,
  DiffStats,
  EvaluationTarget,
  JudgmentContext,
} from './types.js';

const LOOP_RE = /\b(for|while)\s*\(|\.forEach\s*\(|\.map\s*\(/g;
const SHIFT_RE = /\.(shift|unshift)\s*\(/g;
const IO_RE = /\b(fs\.|readFile|writeFile|appendFile|fetch\s*\(|http\.(get|post)|https\.(get|post)|axios|\.post\s*\(|\.get\s*\(|redis|\.query\s*\(|knex|prisma|sequelize|mongoose|pg\s*\.)/g;
const RETRY_RE = /\b(retry|backoff|retries|retryCount)\b/g;
const PARALLEL_RE = /Promise\.(all|allSettled|race|any)\s*\(/g;
const CLOCK_RE = /\b(Date\.now|new Date|performance\.now|setTimeout|setInterval)\b/g;
const IMPORT_RE = /^\s*(import .* from|import\s+["']|const .* = require\s*\()/gm;

export function analyzeTarget(target: EvaluationTarget): JudgmentContext {
  const text = textOf(target);
  const lines = text.split('\n');
  const lowerLines = lines.map((l) => l.toLowerCase());

  const diffStats = diffStatsOf(target);
  const codeFacts = codeFactsOf(text, lines, lowerLines);

  const tokens = new Set<string>();
  for (const line of lowerLines) {
    for (const word of line.split(/[^a-z0-9_.#'"]+/)) {
      if (word.length > 1) tokens.add(word);
    }
  }

  return {
    kind: target.kind,
    text,
    tokens: [...tokens],
    diffStats,
    codeFacts,
  };
}

function textOf(target: EvaluationTarget): string {
  switch (target.kind) {
    case 'code':
      return target.diff;
    default:
      return target.text;
  }
}

function diffStatsOf(target: EvaluationTarget): DiffStats {
  if (target.kind !== 'code') {
    return { filesTouched: 0, linesAdded: 0, linesRemoved: 0, newFiles: 0 };
  }
  const lines = target.diff.split('\n');
  let filesTouched = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  let newFiles = 0;
  for (const line of lines) {
    if (line.startsWith('diff --git ')) filesTouched++;
    if (line.startsWith('new file mode')) newFiles++;
    else if (/^\+\+\+ b\//.test(line)) {
      // heuristics: "new file" can also be signaled by +++ on a b/ path
    } else if (/^\+[^+]/.test(line)) linesAdded++;
    else if (/^-[^-]/.test(line)) linesRemoved++;
  }
  if (filesTouched === 0 && target.paths.length > 0) filesTouched = target.paths.length;
  return { filesTouched, linesAdded, linesRemoved, newFiles };
}

function codeFactsOf(text: string, lines: string[], lowerLines: string[]): CodeFacts {
  const loopMatches = text.match(LOOP_RE) ?? [];
  const shiftMatches = text.match(SHIFT_RE) ?? [];
  const ioMatches = text.match(IO_RE) ?? [];
  const retryMatches = text.match(RETRY_RE) ?? [];
  const parallelMatches = text.match(PARALLEL_RE) ?? [];
  const clockMatches = text.match(CLOCK_RE) ?? [];
  // Strip diff markers so anchored patterns (imports) match in diffs too.
  const importText = text.replace(/^[+-]\s?/gm, '');
  const importMatches = importText.match(IMPORT_RE) ?? [];

  const importLines = lowerLines
    .map((l) => l.replace(/^[+-]\s?/, ''))
    .filter((l) => /^\s*(import .* from|import\s+["'])/.test(l));
  const externalImports = importLines.filter(
    (l) => !/from\s+['"](\.\/|\.\.\/)/.test(l),
  ).length;

  const { maxNestingDepth, nestedLoopPairs, arrayScansInLoop, stringConcatInLoop } =
    loopStructure(lines);

  return {
    maxNestingDepth,
    loopCount: loopMatches.length,
    nestedLoopPairs,
    arrayScansInLoop,
    shiftUnshiftCount: shiftMatches.length,
    stringConcatInLoop,
    rawIoCount: ioMatches.length,
    parallelCalls: parallelMatches.length,
    retryCount: retryMatches.length,
    fileSystemAccess: ioMatches.some((m) => /fs\.|readFile|writeFile|appendFile/.test(m)),
    networkAccess: ioMatches.some((m) => /fetch|http\.|https\.|axios|\.post\s*\(|\.get\s*\(/.test(m)),
    databaseAccess: ioMatches.some((m) => /redis|\.query\s*\(|knex|prisma|sequelize|mongoose|pg\s*\./.test(m)),
    clockAccess: clockMatches.length > 0,
    importCount: importMatches.length,
    externalImports,
  };
}

function loopStructure(lines: string[]): {
  maxNestingDepth: number;
  nestedLoopPairs: number;
  arrayScansInLoop: number;
  stringConcatInLoop: number;
} {
  const loopLineRe = /\b(for|while)\s*\(|\.forEach\s*\(|\.map\s*\(/;
  const scanLineRe = /\.(includes|indexOf|lastIndexOf|find|filter|some|every)\s*\(/;
  const concatLineRe = /(\+=?\s*["'`]|["'`]\s*\+)/;

  const loopLines: { indent: number; line: string }[] = [];
  for (const line of lines) {
    if (loopLineRe.test(line)) {
      // Strip diff markers (+/-) before measuring indentation.
      const content = line.replace(/^[+-]\s?/, '');
      const indent = content.match(/^\s*/)?.[0].length ?? 0;
      loopLines.push({ indent, line: content.toLowerCase() });
    }
  }

  let maxNestingDepth = 0;
  let nestedLoopPairs = 0;
  let arrayScansInLoop = 0;
  let stringConcatInLoop = 0;

  for (let i = 0; i < loopLines.length; i++) {
    const cur = loopLines[i]!;
    let depth = 1;
    for (let j = i - 1; j >= 0; j--) {
      // Every preceding loop line at a strictly smaller indent is an
      // enclosing loop (line-based approximation of block structure).
      if (loopLines[j]!.indent < cur.indent) depth++;
    }
    maxNestingDepth = Math.max(maxNestingDepth, depth);

    if (i + 1 < loopLines.length) {
      const next = loopLines[i + 1]!;
      if (next.indent > cur.indent && next.indent - cur.indent <= 4) {
        nestedLoopPairs++;
      }
    }

    if (scanLineRe.test(cur.line)) arrayScansInLoop++;
    if (concatLineRe.test(cur.line)) stringConcatInLoop++;
  }

  return { maxNestingDepth, nestedLoopPairs, arrayScansInLoop, stringConcatInLoop };
}
