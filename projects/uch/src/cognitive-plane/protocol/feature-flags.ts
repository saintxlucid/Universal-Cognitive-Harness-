/**
 * IDEA-0069 — Feature Flags, Versioned Cognition & Deprecation (prototype).
 *
 * A deterministic feature-flag registry (sticky percentage rollouts via
 * hashing), versioned cognitive capabilities (semver), and an enforced
 * deprecation lifecycle (active → deprecated → sunset → removed) with
 * warning windows and migration hints. No randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export interface DeprecationInfo {
  readonly status: 'deprecated' | 'sunset' | 'removed';
  readonly since: string;
  readonly migrationHint?: string;
}

export interface FlagRule {
  readonly name: string;
  /** Default state when no override applies. */
  readonly defaultEnabled: boolean;
  /** Parent flag namespace to inherit from (e.g. "feature.memory"). */
  readonly parent?: string;
  /** Percentage rollout 0-100; sticky per agent key. */
  readonly rolloutPct?: number;
  readonly deprecation?: DeprecationInfo;
}

export interface FlagEvaluation {
  readonly name: string;
  readonly enabled: boolean;
  /** Present when the flag is deprecated/sunset — the warning window. */
  readonly warning?: string;
  /** Present when removed: why it is disabled and what to do instead. */
  readonly removalReason?: string;
}

export class FeatureFlagRegistry {
  private rules = new Map<string, FlagRule>();

  set(rule: FlagRule): void {
    this.rules.set(rule.name, rule);
  }

  get(name: string): FlagRule | undefined {
    return this.rules.get(name);
  }

  list(): FlagRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluates a flag for an agent. Percentage rollouts are sticky via a
   * deterministic hash of name + agent key. Removed flags are always
   * disabled with the migration hint as the reason.
   */
  evaluate(name: string, agentKey: string): FlagEvaluation {
    const rule = this.rules.get(name);
    if (!rule) return { name, enabled: false, removalReason: `unknown flag "${name}"` };
    if (rule.deprecation?.status === 'removed') {
      return {
        name,
        enabled: false,
        removalReason: `flag removed (${rule.deprecation.since}): ${rule.deprecation.migrationHint ?? 'no migration hint'}`,
      };
    }
    const warning = rule.deprecation
      ? `flag ${rule.deprecation.status} since ${rule.deprecation.since}: ${rule.deprecation.migrationHint ?? 'migrate before removal'}`
      : undefined;

    const effectivePct = rule.rolloutPct ?? (rule.defaultEnabled ? 100 : 0);
    if (effectivePct >= 100) return { name, enabled: rule.defaultEnabled, warning };
    if (effectivePct <= 0) return { name, enabled: rule.defaultEnabled, warning };

    const base = this.effectiveName(name);
    const bucket = stickyBucket(base, agentKey);
    const enabled = bucket < effectivePct;
    return { name, enabled: rule.defaultEnabled ? enabled : !enabled, warning };
  }

  /** Resolves inherited state for a flag (its own rule wins over parent). */
  private effectiveName(name: string): string {
    const rule = this.rules.get(name);
    if (!rule?.parent) return name;
    return `${rule.parent}.${name}`;
  }
}

/** FNV-1a 32-bit hash → 0..99. Deterministic, no randomness. */
export function stickyBucket(flagName: string, agentKey: string): number {
  const input = `${flagName}#${agentKey}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}

// ── Versioned cognition ────────────────────────────────────

export interface VersionedCapability {
  readonly id: string;
  readonly version: string;
  /** Semver classification of the change relative to the previous version. */
  readonly changeKind: 'major' | 'minor' | 'patch' | 'initial';
}

export interface VersionBump {
  readonly id: string;
  readonly from: string | undefined;
  readonly to: string;
  readonly changeKind: 'major' | 'minor' | 'patch' | 'initial';
}

/** Validates a version bump per SemVer: breaking → major, additive → minor, fix → patch. */
export function classifyBump(from: string | undefined, to: string): VersionBump['changeKind'] {
  if (from === undefined) return 'initial';
  const parse = (v: string) => v.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const [fMajor, fMinor, fPatch] = parse(from);
  const [tMajor, tMinor, tPatch] = parse(to);
  if (tMajor !== fMajor) return 'major';
  if (tMinor !== fMinor) return 'minor';
  if (tPatch !== fPatch) return 'patch';
  return 'patch';
}

// ── Deprecation engine ─────────────────────────────────────

export const DEPRECATION_ORDER: readonly DeprecationInfo['status'][] = ['deprecated', 'sunset', 'removed'];

export function transitionDeprecation(
  from: DeprecationInfo | undefined,
  to: DeprecationInfo['status'],
  since: string,
): DeprecationInfo {
  if (from && DEPRECATION_ORDER.indexOf(to) < DEPRECATION_ORDER.indexOf(from.status)) {
    throw new Error(`invalid deprecation transition: ${from.status} → ${to}`);
  }
  return { status: to, since };
}
