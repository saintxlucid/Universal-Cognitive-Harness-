/**
 * Certification corpus — the machine layer of the conformance-as-moat
 * program (IDEA-0127, "impossible to reimplement").
 *
 * The corpus binds the normative specification stack (spec/*.md) to the
 * conformance suites that exercise it. A compatibility claim is only
 * valid through the suite; this module computes the coverage verdict
 * and runs the certification gate that guards the claim.
 *
 * Data source: design/CONFORMANCE-CORPUS.md (the inventory). This
 * module is deterministic and import-free beyond the SpecRepository
 * family types — it performs no I/O and consumes no clocks.
 */

import type { SpecFamily } from './spec-repository/spec-repository.js';

export type CoverageVerdict = 'covered' | 'partial' | 'gap';

export interface SpecCoverageEntry {
  /** Spec document path, e.g. 'spec/CP.md'. */
  doc: string;
  /** Human-readable title. */
  title: string;
  /** SpecRepository primitive families the document governs. */
  families: readonly SpecFamily[];
  /** Conformance suites (test-file basenames) that exercise the document. */
  suites: readonly string[];
  /** Coverage verdict. */
  verdict: CoverageVerdict;
  /** Why this verdict; what the migration path is for partial/gap. */
  note?: string;
}

export interface CoverageReport {
  total: number;
  covered: number;
  partial: number;
  gap: number;
  /** covered / total, 0..1 */
  coveredRate: number;
  /** Documents whose gap blocks certification outright (kernel ABI). */
  blockingGaps: string[];
  entries: readonly SpecCoverageEntry[];
}

export interface CertificationVerdict {
  certified: boolean;
  reasons: string[];
  report: CoverageReport;
}

/** Kernel-ABI documents: a gap here is a hard veto on certification. */
export const KERNEL_ABI_DOCS: readonly string[] = [
  'spec/CONSTITUTION.md',
  'spec/CP.md',
  'spec/CIR.md',
  'spec/VERSION.md',
];

export const CERTIFICATION_CORPUS: readonly SpecCoverageEntry[] = [
  {
    doc: 'spec/CP.md',
    title: 'Cognitive Protocol — Instruction Set (ISA)',
    families: ['isa'],
    suites: [
      'protocol/__tests__/cp.test.ts',
      '__tests__/instruction-catalog.test.ts',
      '__tests__/mcp-cp.test.ts',
      '__tests__/mcp-sse.test.ts',
      'protocol/__tests__/spec-repository.test.ts',
    ],
    verdict: 'covered',
    note: '17-op ABI exercised against CPServer, catalog metadata, and MCP bindings.',
  },
  {
    doc: 'spec/CIR.md',
    title: 'Cognitive Intermediate Representation',
    families: ['runtime'],
    suites: [
      'cognitive-compiler/cir.test.ts',
      'cognitive-compiler/frontend.test.ts',
      'cognitive-compiler/passes.test.ts',
      'cognitive-compiler/executor.test.ts',
      'cognitive-compiler/benchmark/runner.test.ts',
    ],
    verdict: 'covered',
    note: 'Reference implementation certified on a 71-case benchmark corpus (RFC-0004).',
  },
  {
    doc: 'spec/CONSTITUTION.md',
    title: 'Constitution — laws, rights, immutability',
    families: ['policies', 'permissions'],
    suites: [
      'kernel/__tests__/organic-score.test.ts',
      'kernel/__tests__/coding-principles.test.ts',
      'kernel/__tests__/core.test.ts',
      '__tests__/code-governance-gate.test.ts',
      '__tests__/litmus.test.ts',
      '__tests__/executive-framework-integration.test.ts',
      '__tests__/implementation-blueprint.test.ts',
      'cognitive-plane/__tests__/health-registry.test.ts',
    ],
    verdict: 'covered',
    note: 'Law enforcement exercised via OrganicScoreEngine vetoes, integrity checklist, and safe-mode boot; Articles IX-XI kernel-ABI immutability is enforced by the spec-version CI gate, not a direct suite.',
  },
  {
    doc: 'spec/LAWS_OF_COGNITIVE_PHYSICS.md',
    title: '32 Laws of Cognitive Physics, five families',
    families: ['laws', 'policies'],
    suites: [
      'engineering-intelligence/__tests__/laws.test.ts',
      'engineering-intelligence/__tests__/decision-law.test.ts',
    ],
    verdict: 'partial',
    note: 'Law machinery tested; no per-law suite maps each of the 32 laws to its enforcement test (IDEA-0048 requirement).',
  },
  {
    doc: 'spec/FORMAL_FOUNDATIONS.md',
    title: 'Formal foundations — mathematics, failure physics',
    families: ['errors', 'metrics'],
    suites: [
      'engineering-intelligence/__tests__/failure-physics.test.ts',
      'engineering-intelligence/__tests__/heldout.test.ts',
      'engineering-intelligence/__tests__/decision-law.test.ts',
      '__tests__/engineering-judgment.test.ts',
    ],
    verdict: 'partial',
    note: 'Part VIII (failure physics, theta calibration) certified on a held-out corpus; Parts I-VII (set theory, functions, graphs, temporal logic) have no direct suites.',
  },
  {
    doc: 'spec/COGNITIVE_ONTOLOGY.md',
    title: 'Cognitive Ontology — signal/entity taxonomy',
    families: ['signals', 'events'],
    suites: [
      '__tests__/signal-store.test.ts',
      '__tests__/nervous-system.test.ts',
      'nervous-system/__tests__/signal-lifecycle.test.ts',
      'nervous-system/__tests__/flow-control.test.ts',
      '__tests__/epistemic-foundation.test.ts',
    ],
    verdict: 'partial',
    note: 'Signal taxonomy well covered; Entity/Component/Evidence taxonomy (Thought, Memory, Capability) lacks direct suites.',
  },
  {
    doc: 'spec/GENOME.md',
    title: 'Cognitive Genome — provenance, versioning',
    families: ['capabilities', 'lifecycles'],
    suites: [
      '__tests__/phase4b-provenance-genome.test.ts',
      '__tests__/organism-versioning.test.ts',
      'cognitive-plane/genome/__tests__/expression-engine.test.ts',
    ],
    verdict: 'covered',
    note: 'Provenance weights, versioned store restore, and expression derivation exercised.',
  },
  {
    doc: 'spec/EXPRESSION.md',
    title: 'Expression System — genes, proteins, epigenetics',
    families: ['capabilities', 'lifecycles'],
    suites: [
      'cognitive-plane/genome/__tests__/expression-engine.test.ts',
      'cognitive-plane/genome/__tests__/expression-benchmark.test.ts',
    ],
    verdict: 'covered',
    note: 'Gene catalog, tick-ordered mark ledger, and benchmark contract exercised.',
  },
  {
    doc: 'spec/COGNITIVE_BIOLOGY.md',
    title: 'Cognitive Biology — organ physiology',
    families: ['lifecycles', 'runtime'],
    suites: [
      '__tests__/organism-features.test.ts',
      '__tests__/organism-persistence.test.ts',
      '__tests__/evolution-system.test.ts',
    ],
    verdict: 'partial',
    note: 'Organism lifecycle and persistence covered; no suite maps the biology specification sections themselves.',
  },
  {
    doc: 'spec/VERSION.md',
    title: 'Specification versioning and stability policy',
    families: ['runtime'],
    suites: ['scripts/spec-version-check.mjs (CI gate)'],
    verdict: 'covered',
    note: 'Enforced by the check:spec-version gate on every commit wave.',
  },
];

function computeReport(entries: readonly SpecCoverageEntry[]): CoverageReport {
  const covered = entries.filter((e) => e.verdict === 'covered').length;
  const partial = entries.filter((e) => e.verdict === 'partial').length;
  const gap = entries.filter((e) => e.verdict === 'gap').length;
  const blockingGaps = entries
    .filter((e) => e.verdict === 'gap' && KERNEL_ABI_DOCS.includes(e.doc))
    .map((e) => e.doc);
  return {
    total: entries.length,
    covered,
    partial,
    gap,
    coveredRate: entries.length === 0 ? 0 : covered / entries.length,
    blockingGaps,
    entries,
  };
}

export function coverageReport(): CoverageReport {
  return computeReport(CERTIFICATION_CORPUS);
}

/**
 * The certification gate (suite-as-moat): the corpus is gate-valid only
 * when every normative document names at least one conformance suite,
 * no document is an uncovered gap, and the kernel-ABI documents are
 * fully covered. A green gate is the precondition for issuing any
 * "UCH Compatible" brand claim (IDEA-0098).
 */
export function certificationGate(report: CoverageReport = coverageReport()): CertificationVerdict {
  const reasons: string[] = [];
  const unnamed = report.entries.filter((e) => e.suites.length === 0).map((e) => e.doc);
  if (unnamed.length > 0)
    reasons.push(`documents without any conformance suite: ${unnamed.join(', ')}`);
  const gaps = report.entries.filter((e) => e.verdict === 'gap').map((e) => e.doc);
  if (gaps.length > 0) reasons.push(`uncovered documents: ${gaps.join(', ')}`);
  const abiPartial = report.entries
    .filter((e) => KERNEL_ABI_DOCS.includes(e.doc) && e.verdict !== 'covered')
    .map((e) => e.doc);
  if (abiPartial.length > 0)
    reasons.push(`kernel-ABI documents not fully covered: ${abiPartial.join(', ')}`);
  const certified = reasons.length === 0;
  return { certified, reasons, report };
}
