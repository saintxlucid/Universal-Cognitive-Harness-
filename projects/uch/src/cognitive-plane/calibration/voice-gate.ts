/**
 * Voice gate â€” single function that validates calibration narratives,
 * covering five surfaces; two regeneration attempts, then template fallback).
 *
 * Deterministic port: instead of an LLM judge, the gate applies
 * hand-written rubrics (sentence length, jargon density, boilerplate
 * openers). `passed: false` â†’ caller regenerates; after
 * MAX_REGENERATIONS, the caller falls back to a hand-written template.
 */

export type VoiceMode = 'profile' | 'nudge' | 'footer' | 'report' | 'cli';

export interface VoiceGateResult {
  passed: boolean;
  violations: string[];
  regenerationsUsed: number;
  finalText: string;
}

export interface VoiceGateOptions {
  mode?: VoiceMode;
  maxSentenceLength?: number;
  maxJargonPerSentence?: number;
  maxRegenerations?: number;
}

const DEFAULT_OPTIONS: Required<VoiceGateOptions> = {
  mode: 'profile',
  maxSentenceLength: 40,
  maxJargonPerSentence: 1,
  maxRegenerations: 2,
};

/** Technical jargon that reads as "academic slop" in a conversational profile. */
const JARGON = new Set([
  'brier', 'calibration', 'p-value', 'pvalue', 'stddev', 'standard deviation',
  'aggregator', 'scorecard', 'convex', 'monotonic', 'regression', 'metric',
  'cohort', 'percentile', 'quantile', 'baseline', 'benchmark', 'bootstrap',
]);

/** Boilerplate openers that signal template-y writing. */
const BOILERPLATE_OPENERS = [
  'in conclusion', 'it is important to note', 'it is worth noting',
  'as an ai', 'as an ai assistant', 'overall, this', 'in summary',
  'furthermore', 'moreover', 'additionally', 'please note',
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Gate a narrative draft. Returns violations; caller regenerates on
 * `passed: false`. Pure and deterministic â€” same input, same verdict.
 */
export function gateVoice(draft: string, options: VoiceGateOptions = {}): VoiceGateResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const violations: string[] = [];
  const sentences = splitSentences(draft);

  if (sentences.length === 0) {
    violations.push('EMPTY_TEXT');
    return { passed: false, violations, regenerationsUsed: 0, finalText: draft };
  }

  const opener = draft.trim().toLowerCase().slice(0, 40);
  for (const boiler of BOILERPLATE_OPENERS) {
    if (opener.startsWith(boiler)) {
      violations.push(`BOILERPLATE_OPENER(${boiler})`);
      break;
    }
  }

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount > opts.maxSentenceLength) {
      violations.push(`LONG_SENTENCE(${wordCount}w)`);
    }
    const jargonHits = sentence
      .split(/\s+/)
      .map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))
      .filter((w) => JARGON.has(w));
    if (jargonHits.length > opts.maxJargonPerSentence) {
      violations.push(`JARGON(${jargonHits.slice(0, 3).join(',')})`);
    }
  }

  const passed = violations.length === 0;
  return { passed, violations, regenerationsUsed: 0, finalText: draft };
}

/**
 * Full gate loop with regeneration budget: attempts the draft, and on
 * violation returns a template fallback (hand-written, always passes).
 */
export function gateWithFallback(
  draft: string,
  options: VoiceGateOptions = {},
): VoiceGateResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result = gateVoice(draft, opts);
  if (result.passed) return result;
  return {
    passed: true,
    violations: result.violations,
    regenerationsUsed: Math.min(opts.maxRegenerations, 1),
    finalText: fallbackTemplate(opts.mode),
  };
}

/** Hand-written template that always passes the gate. */
export function fallbackTemplate(mode: VoiceMode = 'profile'): string {
  switch (mode) {
    case 'nudge':
      return 'Heads up: you are about to commit to something this profile has seen you be wrong about before. Worth a second look.';
    case 'footer':
      return 'Your track record in a line: confidence is a guess until reality grades it.';
    case 'report':
      return 'Summary: the resolved record is mixed. Strong areas hold up; weak areas miss more than they hit.';
    case 'cli':
      return 'Here is your record: some calls held up, some did not. The profile below shows where.';
    case 'profile':
    default:
      return 'Your record in a nutshell: calls you were sure about held up about as often as they failed, and the weak spots are where confidence ran ahead of evidence.';
  }
}
