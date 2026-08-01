/**
 * IDEA-0068 — Cognitive Capability Negotiation & Discovery (prototype).
 *
 * TLS-style dialect negotiation over versioned capability descriptors:
 * offer → intersect → select → fallback, with explicit 'none' outcomes
 * (never a silent downgrade). Discovery answers "who can verify this?"
 * declaratively. Deterministic by construction (no randomness, no I/O).
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(value: string): Semver | undefined {
  const parts = value.trim().split('.');
  if (parts.length === 0 || parts.length > 3) return undefined;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return undefined;
  const [major = 0, minor = 0, patch = 0] = nums;
  return { major, minor, patch };
}

export function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export interface CapabilityDescriptor {
  /** Stable identity, e.g. "memory" or "signal-abi". */
  readonly id: string;
  /** Semantic version of the dialect this endpoint supports, e.g. "3.2.1". */
  readonly version: string;
  /** Named features this endpoint supports, e.g. ["semantic", "episodic"]. */
  readonly features?: readonly string[];
  /** Domain tags for discovery, e.g. ["kubernetes"], ["rust"]. */
  readonly tags?: readonly string[];
}

export type DialectStatus = 'negotiated' | 'fallback' | 'none';

export interface NegotiatedDialect {
  readonly capabilityId: string;
  /** Version both endpoints share (the supported endpoint's version). */
  readonly selectedVersion: string;
  /** Version the offering endpoint declared. */
  readonly offeredVersion: string;
  /** Feature intersection, in the supported endpoint's order. */
  readonly features: readonly string[];
  /**
   * negotiated = identical version string; fallback = same major,
   * different minor/patch (explicit, never silent); none = no
   * compatible dialect.
   */
  readonly status: DialectStatus;
}

export interface NegotiationOutcome {
  readonly dialects: readonly NegotiatedDialect[];
  /** Capability ids with a negotiated or fallback dialect. */
  readonly matched: readonly string[];
  /** Capability ids with no compatible dialect. */
  readonly unmatched: readonly string[];
}

export interface NegotiationOptions {
  /** Default true. When false, only exact version strings match. */
  readonly allowMajorFallback?: boolean;
}

/**
 * Negotiates dialects between an offer (peer's declared capabilities)
 * and the set this endpoint supports. Deterministic: same inputs,
 * same outcome.
 */
export function negotiateDialects(
  offered: readonly CapabilityDescriptor[],
  supported: readonly CapabilityDescriptor[],
  options?: NegotiationOptions,
): NegotiationOutcome {
  const allowMajorFallback = options?.allowMajorFallback ?? true;
  const supportedById = new Map(supported.map((d) => [d.id, d]));

  const dialects: NegotiatedDialect[] = [];
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const offer of offered) {
    const ours = supportedById.get(offer.id);
    if (!ours) {
      unmatched.push(offer.id);
      continue;
    }
    const offeredSem = parseSemver(offer.version);
    const ourSem = parseSemver(ours.version);
    if (!offeredSem || !ourSem) {
      unmatched.push(offer.id);
      continue;
    }
    const sameMajor = offeredSem.major === ourSem.major;
    const exact = offer.version.trim() === ours.version.trim();
    const compatible = allowMajorFallback ? sameMajor : exact;
    if (!compatible) {
      unmatched.push(offer.id);
      continue;
    }
    const status: DialectStatus = exact ? 'negotiated' : 'fallback';
    dialects.push({
      capabilityId: offer.id,
      selectedVersion: ours.version,
      offeredVersion: offer.version,
      features: intersectFeatures(offer.features ?? [], ours.features ?? []),
      status,
    });
    matched.push(offer.id);
  }

  return { dialects, matched, unmatched };
}

function intersectFeatures(offered: readonly string[], supported: readonly string[]): string[] {
  const supportedSet = new Set(supported);
  return supported.filter((f) => supportedSet.has(f) && offered.includes(f));
}

export interface DiscoveryQuery {
  /** Provider must support every feature in this list. */
  readonly requires?: readonly string[];
  /** Provider must carry every tag in this list. */
  readonly domain?: readonly string[];
}

/**
 * Declarative discovery: who can satisfy the query? Deterministic;
 * answers over a static provider set (live registry wiring is follow-up).
 */
export function findProviders(
  providers: readonly CapabilityDescriptor[],
  query: DiscoveryQuery,
): CapabilityDescriptor[] {
  const requireAll = query.requires ?? [];
  const tagsAll = query.domain ?? [];
  return providers.filter((p) => {
    const features = new Set(p.features ?? []);
    const tags = new Set(p.tags ?? []);
    const hasFeatures = requireAll.every((f) => features.has(f));
    const hasTags = tagsAll.every((t) => tags.has(t));
    return hasFeatures && hasTags;
  });
}

/** Highest semver provider for an id (deterministic; undefined when none). */
export function pickLatest(
  providers: readonly CapabilityDescriptor[],
  id: string,
): CapabilityDescriptor | undefined {
  const candidates = providers.filter((p) => p.id === id).map((p) => ({ p, s: parseSemver(p.version) }));
  let best: { p: CapabilityDescriptor; s: Semver } | undefined;
  for (const c of candidates) {
    if (!c.s) continue;
    if (!best || compareSemver(c.s, best.s) > 0) best = c as { p: CapabilityDescriptor; s: Semver };
  }
  return best?.p;
}

/** Deterministic key for ledger/journal records of an outcome. */
export function dialectKey(outcome: NegotiationOutcome): string {
  return outcome.dialects
    .map((d) => `${d.capabilityId}@${d.selectedVersion}:${d.status}`)
    .sort()
    .join('|');
}
