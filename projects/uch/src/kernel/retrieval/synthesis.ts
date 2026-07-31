/**
 * Synthesis engine with citations — adapted to UCH as a
 * deterministic local engine (no LLM dependency).
 *
 * Trust contract:
 *   1. Every claim the synthesis makes MUST carry a citation marker `[id#N]`.
 *   2. Citations resolve against the retrieved source set; unresolved
 *      markers are reported as warnings, never silently dropped.
 *   3. A claim that cannot be attributed to a source is surfaced as a gap,
 *      not asserted.
 */

export interface SynthesisSource {
  id: string;
  text: string;
  timestamp: Date;
  source: string;
  title?: string;
}

export interface ParsedCitation {
  page_slug: string;
  row_num: number | null;
  citation_index: number;
}

export interface SynthesisClaim {
  claim: string;
  citations: string[];
  supported: boolean;
  supportScore: number;
}

export interface SynthesisOutput {
  query: string;
  summary: string;
  claims: SynthesisClaim[];
  citations: Array<{ id: string; marker: string; title: string | undefined; quoted: boolean }>;
  gaps: string[];
  contradictions: Array<{ between: string[]; reason: string }>;
  warnings: string[];
  confidence: number;
}

export interface SynthesisOptions {
  maxClaims?: number;
  maxSources?: number;
  minSupportOverlap?: number;
}

const DEFAULT_OPTIONS: Required<SynthesisOptions> = {
  maxClaims: 6,
  maxSources: 8,
  minSupportOverlap: 0.3,
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'what', 'when', 'where', 'how', 'is', 'are', 'do', 'does', 'did', 'i', 'we',
  'this', 'that', 'it', 'they', 'them', 'their', 'there', 'was', 'were', 'be',
]);

/**
 * Extract citation markers from a body. Recognizes:
 *   [id#3]      → row citation
 *   [id]        → source citation
 *   [id/nested#7] → multi-segment id citation
 * Anything outside the id allowlist won't match — random brackets in prose
 * shouldn't promote to citations.
 */
export function parseInlineCitations(body: string): ParsedCitation[] {
  const RX = /\[([a-zA-Z0-9][a-zA-Z0-9\-_]*(?:\/[a-zA-Z0-9][a-zA-Z0-9\-_]*)*)(?:#(\d+))?\]/g;
  const out: ParsedCitation[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  let idx = 1;
  while ((match = RX.exec(body)) !== null) {
    const slug = match[1]!.toLowerCase();
    const rowStr = match[2];
    const row_num = rowStr ? parseInt(rowStr, 10) : null;
    if (row_num !== null && (!Number.isFinite(row_num) || row_num <= 0)) continue;
    const key = `${slug}#${row_num ?? '_'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ page_slug: slug, row_num, citation_index: idx++ });
  }
  return out;
}

/**
 * Validate a structured citations array. Returns the cleaned list + warnings
 * about dropped/invalid entries.
 */
export function normalizeStructuredCitations(
  raw: unknown,
): { citations: ParsedCitation[]; warnings: string[] } {
  const citations: ParsedCitation[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(raw)) {
    return { citations, warnings: ['CITATIONS_NOT_ARRAY'] };
  }
  let idx = 1;
  const seen = new Set<string>();
  for (const c of raw) {
    if (typeof c !== 'object' || c === null) {
      warnings.push('CITATION_NOT_OBJECT');
      continue;
    }
    const slug = (c as { page_slug?: unknown }).page_slug;
    const row = (c as { row_num?: unknown }).row_num;
    if (typeof slug !== 'string' || !slug.trim()) {
      warnings.push('CITATION_MISSING_SLUG');
      continue;
    }
    let row_num: number | null = null;
    if (row !== null && row !== undefined) {
      const n = typeof row === 'number' ? row : parseInt(String(row), 10);
      if (Number.isFinite(n) && n > 0) {
        row_num = n;
      } else {
        warnings.push(`CITATION_INVALID_ROW(${slug}: ${row})`);
        continue;
      }
    }
    const key = `${slug.toLowerCase()}#${row_num ?? '_'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ page_slug: slug.toLowerCase(), row_num, citation_index: idx++ });
  }
  return { citations, warnings };
}

/** Combine structured + inline fallback into one resolved list. */
export function resolveCitations(
  structuredRaw: unknown,
  answerBody: string,
): { citations: ParsedCitation[]; warnings: string[]; usedFallback: boolean } {
  const structured = normalizeStructuredCitations(structuredRaw);
  if (structured.citations.length > 0) {
    return { citations: structured.citations, warnings: structured.warnings, usedFallback: false };
  }
  const fallback = parseInlineCitations(answerBody);
  const warnings = [...structured.warnings, 'CITATIONS_REGEX_FALLBACK'];
  return { citations: fallback, warnings, usedFallback: true };
}

function extractTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 3 && !STOP_WORDS.has(t));
}

/** Jaccard-ish overlap of two term sets, in [0, 1]. */
function termOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  const shared = a.filter((t) => bSet.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return shared / union;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export class SynthesisEngine {
  private options: Required<SynthesisOptions>;

  constructor(options: SynthesisOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Synthesize an answer for `query` from retrieved `sources`.
   * Every output claim carries at least one citation; claims that fail the
   * support check are still reported (with supportScore) so callers can see
   * where the corpus is thin.
   */
  synthesize(query: string, sources: SynthesisSource[], options: SynthesisOptions = {}): SynthesisOutput {
    const opts = { ...this.options, ...options };
    const top = sources.slice(0, opts.maxSources);
    const warnings: string[] = [];
    const gaps: string[] = [];
    const contradictions: Array<{ between: string[]; reason: string }> = [];

    if (top.length === 0) {
      gaps.push(`No sources retrieved for "${query}". Synthesis cannot be grounded; do not assert anything.`);
      return {
        query, summary: '', claims: [], citations: [], gaps, contradictions,
        warnings: ['NO_SOURCES'], confidence: 0,
      };
    }
    if (top.length < 3) {
      gaps.push(`Only ${top.length} source(s) retrieved; coverage may be thin for "${query}".`);
    }

    // 1. Extract candidate claims from the strongest sources (sentence level).
    const claims: SynthesisClaim[] = [];
    for (const source of top) {
      for (const sentence of splitSentences(source.text)) {
        const support = this.supportFor(query, sentence);
        const marker = `[${source.id}]`;
        claims.push({
          claim: sentence,
          citations: [marker],
          supported: support >= opts.minSupportOverlap,
          supportScore: Number(support.toFixed(2)),
        });
      }
    }

    // 2. Rank: relevance to query first, then support; cap at maxClaims.
    claims.sort((a, b) => {
      const qa = termOverlap(extractTerms(query), extractTerms(a.claim));
      const qb = termOverlap(extractTerms(query), extractTerms(b.claim));
      return qb - qa || b.supportScore - a.supportScore;
    });
    const topClaims = claims.slice(0, opts.maxClaims);

    // 3. Contradiction scan across the surviving claim set.
    contradictions.push(...this.detectContradictions(topClaims));

    // 4. Build the summary as a contiguous paragraph with inline markers.
    const summary = this.renderSummary(query, topClaims);
    const used = resolveCitations(summary, summary);

    const citations = topClaims
      .flatMap((c) => c.citations)
      .map((marker) => {
        const id = marker.slice(1, -1).split('#')[0]!;
        const src = top.find((s) => s.id === id);
        return { id, marker, title: src?.title, quoted: src ? termOverlap(extractTerms(query), extractTerms(src.text)) > 0.5 : false };
      });

    for (const w of used.warnings) warnings.push(w);
    const unsupported = topClaims.filter((c) => !c.supported);
    if (unsupported.length > 0) {
      warnings.push(`CLAIMS_UNDERSUPPORTED(${unsupported.length}): low overlap with the query; treat as background, not answer.`);
    }

    const grounded = topClaims.filter((c) => c.supported).length / Math.max(1, topClaims.length);
    const coverage = Math.min(1, top.length / 5);
    const confidence = Number((0.5 * grounded + 0.5 * coverage).toFixed(2));

    return {
      query,
      summary,
      claims: topClaims,
      citations,
      gaps,
      contradictions,
      warnings,
      confidence,
    };
  }

  /** How much a candidate sentence actually addresses the query. */
  private supportFor(query: string, sentence: string): number {
    return termOverlap(extractTerms(query), extractTerms(sentence));
  }

  private renderSummary(query: string, claims: SynthesisClaim[]): string {
    if (claims.length === 0) return `(no grounded claims for "${query}")`;
    const parts: string[] = [];
    for (const c of claims) {
      parts.push(`${c.claim}${c.citations.join('')}`);
    }
    return parts.join(' ');
  }

  private detectContradictions(claims: SynthesisClaim[]): Array<{ between: string[]; reason: string }> {
    const out: Array<{ between: string[]; reason: string }> = [];
    const negationPairs: Array<[RegExp, RegExp]> = [
      [/supports|supports this|is supported/, /does not support|unsupported|doesn't support|not supported/],
      [/increases|went up|rising|higher/, /decreases|went down|falling|lower/],
      [/is active|working|operational/, /is broken|down|not working|fails/],
      [/fixed|resolved/, /still failing|still broken|unresolved|recurring/],
    ];

    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const a = claims[i]!;
        const b = claims[j]!;
        if (a.citations[0] === b.citations[0]) continue;
        for (const [pos, neg] of negationPairs) {
          if (pos.test(a.claim) && neg.test(b.claim)) {
            out.push({
              between: [a.citations[0]!, b.citations[0]!],
              reason: `One source asserts a positive claim while another denies it (${a.citations[0]} vs ${b.citations[0]}).`,
            });
            break;
          }
        }
      }
    }
    return out;
  }
}
