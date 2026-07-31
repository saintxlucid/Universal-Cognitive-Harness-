/**
 * Engineering Intelligence — organic-score hookup helpers.
 *
 * Bridges the deterministic EngineeringEvaluator into the organic-score
 * gate at the call sites (MCP tool, CLI). The kernel stays pure: this
 * module owns target auto-detection, finding coercion from untrusted
 * JSON, and the one-liner that computes veto-capable findings for a
 * change text (diff or prose).
 */

import { createDomainRegistry } from './domains/index.js';
import { createLawRegistry } from './laws/engineering-laws.js';
import { EngineeringEvaluator } from './evaluator.js';
import type {
  EngineeringFinding,
  EvaluationTarget,
} from './types.js';

/** Heuristic: does this text look like a code diff / code snippet? */
function looksLikeCode(text: string): boolean {
  return (
    /^diff --git/m.test(text) ||
    /(^|\n)\s*[+-]/m.test(text) ||
    /=>|const |function |import |\bif\s*\(/.test(text)
  );
}

/**
 * Build an EvaluationTarget from a change text. Explicit `kind` wins;
 * otherwise diff/code markers select `code`, everything else is prose.
 */
export function autoTarget(
  change: string,
  kind?: EvaluationTarget['kind'],
): EvaluationTarget {
  if (kind) {
    return kind === 'code' ? { kind: 'code', diff: change, paths: [] } : { kind, text: change };
  }
  return looksLikeCode(change)
    ? { kind: 'code', diff: change, paths: [] }
    : { kind: 'design', text: change };
}

/**
 * Coerce untrusted JSON (MCP args, CLI flags) into EngineeringFinding[].
 * Entries missing required fields or carrying invalid enums are dropped;
 * unknown extra fields are ignored.
 */
export function coerceFindings(raw: unknown): EngineeringFinding[] {
  if (!Array.isArray(raw)) return [];
  const validTiers = new Set([
    'tier-01-cs', 'tier-02-se', 'tier-03-systems', 'tier-04-product',
    'tier-05-economics', 'tier-06-laws', 'tier-07-patterns',
    'tier-08-failure', 'tier-09-taste', 'tier-10-unknown',
  ]);
  const validSeverity = new Set(['info', 'warning', 'blocking']);
  const validGate = new Set(['veto', 'advisory']);

  const out: EngineeringFinding[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.conceptId !== 'string' || !e.conceptId) continue;
    if (typeof e.message !== 'string' || !e.message) continue;
    if (typeof e.tier !== 'string' || !validTiers.has(e.tier)) continue;
    if (typeof e.severity !== 'string' || !validSeverity.has(e.severity)) continue;
    if (typeof e.gate !== 'string' || !validGate.has(e.gate)) continue;
    out.push({
      tier: e.tier as EngineeringFinding['tier'],
      severity: e.severity as EngineeringFinding['severity'],
      conceptId: e.conceptId,
      message: e.message,
      evidence: Array.isArray(e.evidence) ? e.evidence.filter((x) => typeof x === 'string') : [],
      suggestion: Array.isArray(e.suggestion) ? e.suggestion.filter((x) => typeof x === 'string') : [],
      gate: e.gate as EngineeringFinding['gate'],
    });
  }
  return out;
}

/**
 * Compute engineering findings for a change text. Returns an empty array
 * when the change is clean; veto-capable findings (SPOF, unrecovered
 * failure surfaces, pathological complexity) appear with `gate: 'veto'`.
 */
export function engineeringFindingsFor(
  change: string,
  kind?: EvaluationTarget['kind'],
): EngineeringFinding[] {
  if (!change || !change.trim()) return [];
  const domains = createDomainRegistry();
  const laws = createLawRegistry();
  const evaluator = new EngineeringEvaluator(domains, laws);
  return evaluator.evaluate(autoTarget(change, kind)).findings;
}
