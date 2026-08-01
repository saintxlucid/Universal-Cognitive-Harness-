/**
 * IDEA-0073 — Cognitive Contracts Registry (prototype).
 *
 * Behavioral contracts as first-class records: the nine fields verbatim
 * (inputs, outputs, side effects, guarantees, failure modes, timing,
 * resources, security — plus declaring subsystem and version), a
 * registry, and conformance probes that check observed behavior against
 * a declaration. Deterministic: no randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export interface ContractRecord {
  /** Declaring subsystem, e.g. "memory", "fast-path". */
  readonly subsystem: string;
  /** Semver of the contract declaration itself (IDEA-0069 versioning). */
  readonly version: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly sideEffects: readonly string[];
  readonly guarantees: readonly string[];
  readonly failureModes: readonly string[];
  /** Timing envelope, e.g. "p95 < 200ms". */
  readonly timing: string;
  /** Resource envelope, e.g. "energy <= 5 per call". */
  readonly resources: string;
  readonly security: readonly string[];
}

export interface ObservedBehavior {
  readonly outputs: readonly string[];
  readonly sideEffects: readonly string[];
  /** Failure classes actually observed (faculty tags per IDEA-0074). */
  readonly failures: readonly string[];
  readonly timingMs: number;
  /** Declared resource unit consumed (energy, tokens, ...). */
  readonly resources: number;
}

export type ProbeVerdict = 'conformant' | 'violated' | 'untested';

export interface ProbeResult {
  readonly subsystem: string;
  readonly verdict: ProbeVerdict;
  /** Human-readable violation descriptions; empty when conformant/untested. */
  readonly violations: readonly string[];
}

export interface TimingEnvelope {
  readonly p95Ms: number;
}

export interface ResourceEnvelope {
  readonly maxUnits: number;
}

/** Parses "p95 < 200ms" → { p95Ms: 200 }. Deterministic; undefined on mismatch. */
export function parseTimingEnvelope(envelope: string): TimingEnvelope | undefined {
  const m = /p95\s*<\s*(\d+(?:\.\d+)?)\s*ms/i.exec(envelope);
  const p95 = m?.[1];
  if (p95 === undefined) return undefined;
  return { p95Ms: Number.parseFloat(p95) };
}

/** Parses "energy <= 5 per call" → { maxUnits: 5 }. */
export function parseResourceEnvelope(envelope: string): ResourceEnvelope | undefined {
  const m = /(?:energy|tokens|units)\s*(?:<=|=|max)\s*(\d+(?:\.\d+)?)/i.exec(envelope);
  const maxUnits = m?.[1];
  if (maxUnits === undefined) return undefined;
  return { maxUnits: Number.parseFloat(maxUnits) };
}

/**
 * Checks a declaration against observed behavior. A violation is any
 * observed output/side-effect/failure not declared, or any envelope
 * exceeded. Untested when no observations exist.
 */
export function probeContract(contract: ContractRecord, observed: ObservedBehavior | undefined): ProbeResult {
  const violations: string[] = [];
  if (!observed) return { subsystem: contract.subsystem, verdict: 'untested', violations: [] };

  const declaredOutputs = new Set(contract.outputs);
  for (const out of observed.outputs) {
    if (!declaredOutputs.has(out)) violations.push(`undeclared output: ${out}`);
  }
  const declaredSideEffects = new Set(contract.sideEffects);
  for (const se of observed.sideEffects) {
    if (!declaredSideEffects.has(se)) violations.push(`undeclared side effect: ${se}`);
  }
  const declaredFailures = new Set(contract.failureModes);
  for (const f of observed.failures) {
    if (!declaredFailures.has(f)) violations.push(`undeclared failure mode: ${f}`);
  }
  const timing = parseTimingEnvelope(contract.timing);
  if (timing && observed.timingMs > timing.p95Ms) {
    violations.push(`timing: observed ${observed.timingMs}ms > declared ${timing.p95Ms}ms p95`);
  }
  const resources = parseResourceEnvelope(contract.resources);
  if (resources && observed.resources > resources.maxUnits) {
    violations.push(`resources: observed ${observed.resources} > declared ${resources.maxUnits}`);
  }
  return {
    subsystem: contract.subsystem,
    verdict: violations.length === 0 ? 'conformant' : 'violated',
    violations,
  };
}

export class ContractRegistry {
  private contracts = new Map<string, ContractRecord>();

  register(contract: ContractRecord): void {
    this.contracts.set(contract.subsystem, contract);
  }

  get(subsystem: string): ContractRecord | undefined {
    return this.contracts.get(subsystem);
  }

  list(): ContractRecord[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Verifies a declaration against behavior. A contract change is
   * *breaking* (IDEA-0069 major bump) when a previously declared
   * output/side-effect/failure-mode disappears or an envelope tightens.
   */
  isBreakingChange(from: ContractRecord, to: ContractRecord): boolean {
    const missingOutput = from.outputs.some((o) => !to.outputs.includes(o));
    const missingSideEffect = from.sideEffects.some((s) => !to.sideEffects.includes(s));
    const missingFailure = from.failureModes.some((f) => !to.failureModes.includes(f));
    if (missingOutput || missingSideEffect || missingFailure) return true;
    const fromTiming = parseTimingEnvelope(from.timing);
    const toTiming = parseTimingEnvelope(to.timing);
    if (fromTiming && toTiming && toTiming.p95Ms < fromTiming.p95Ms) return true;
    const fromRes = parseResourceEnvelope(from.resources);
    const toRes = parseResourceEnvelope(to.resources);
    if (fromRes && toRes && toRes.maxUnits < fromRes.maxUnits) return true;
    return false;
  }
}
