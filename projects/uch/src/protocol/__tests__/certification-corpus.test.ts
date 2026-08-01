import { describe, expect, it } from 'vitest';
import {
  CERTIFICATION_CORPUS,
  KERNEL_ABI_DOCS,
  certificationGate,
  coverageReport,
  type CoverageReport,
  type SpecCoverageEntry,
} from '../certification-corpus.js';

const withVerdict = (
  entries: SpecCoverageEntry[],
  doc: string,
  verdict: SpecCoverageEntry['verdict'],
): SpecCoverageEntry[] => entries.map((e) => (e.doc === doc ? { ...e, verdict } : e));

describe('CERTIFICATION_CORPUS integrity', () => {
  it('covers all ten normative spec documents', () => {
    expect(CERTIFICATION_CORPUS).toHaveLength(10);
    const docs = CERTIFICATION_CORPUS.map((e) => e.doc);
    expect(new Set(docs).size).toBe(docs.length);
    expect(docs).toContain('spec/CP.md');
    expect(docs).toContain('spec/CIR.md');
    expect(docs).toContain('spec/CONSTITUTION.md');
    expect(docs).toContain('spec/VERSION.md');
  });

  it('every kernel-ABI document is registered', () => {
    const docs = new Set(CERTIFICATION_CORPUS.map((e) => e.doc));
    for (const abi of KERNEL_ABI_DOCS) expect(docs.has(abi)).toBe(true);
  });

  it('every entry names at least one conformance suite', () => {
    for (const entry of CERTIFICATION_CORPUS) {
      expect(entry.suites.length).toBeGreaterThan(0);
    }
  });

  it('declares a verdict for every document', () => {
    for (const entry of CERTIFICATION_CORPUS) {
      expect(['covered', 'partial', 'gap']).toContain(entry.verdict);
    }
  });
});

describe('coverageReport', () => {
  it('computes totals and the coverage rate', () => {
    const report = coverageReport();
    expect(report.total).toBe(10);
    expect(report.covered).toBe(6);
    expect(report.partial).toBe(4);
    expect(report.gap).toBe(0);
    expect(report.coveredRate).toBe(0.6);
  });

  it('reports no blocking gaps today', () => {
    const report = coverageReport();
    expect(report.blockingGaps).toEqual([]);
  });

  it('is deterministic across calls', () => {
    expect(coverageReport()).toEqual(coverageReport());
  });
});

describe('certificationGate', () => {
  it('passes on the current corpus (gate-valid)', () => {
    const verdict = certificationGate();
    expect(verdict.certified).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it('vetoes a gap in a kernel-ABI document', () => {
    const entries = withVerdict(CERTIFICATION_CORPUS, 'spec/CP.md', 'gap');
    const report: CoverageReport = { ...coverageReport(), entries, gap: 1, covered: 5 };
    const verdict = certificationGate(report);
    expect(verdict.certified).toBe(false);
    expect(verdict.reasons.join(' ')).toContain('kernel-ABI');
  });

  it('vetoes any uncovered document', () => {
    const entries = withVerdict(CERTIFICATION_CORPUS, 'spec/COGNITIVE_ONTOLOGY.md', 'gap');
    const report: CoverageReport = { ...coverageReport(), entries, gap: 1, covered: 5 };
    const verdict = certificationGate(report);
    expect(verdict.certified).toBe(false);
    expect(verdict.reasons.join(' ')).toContain('uncovered documents');
  });

  it('vetoes a document without any conformance suite', () => {
    const entries = CERTIFICATION_CORPUS.map((e, i) =>
      i === 0 ? { ...e, suites: [] as readonly string[] } : e,
    );
    const report: CoverageReport = { ...coverageReport(), entries };
    const verdict = certificationGate(report);
    expect(verdict.certified).toBe(false);
    expect(verdict.reasons.join(' ')).toContain('without any conformance suite');
  });

  it('accepts partial coverage as long as suites are named', () => {
    const entries = withVerdict(
      CERTIFICATION_CORPUS,
      'spec/LAWS_OF_COGNITIVE_PHYSICS.md',
      'partial',
    );
    const report: CoverageReport = { ...coverageReport(), entries };
    expect(certificationGate(report).certified).toBe(true);
  });
});
