import { describe, it, expect } from 'vitest';
import { EpistemicImmuneSystem } from '../kernel/epistemic/epistemic-immune.js';
import { EpistemicElevationEngine } from '../kernel/epistemic/elevation-engine.js';
import {
  createInquiryContract,
  validateInquiryContract,
  isInquiryEligible,
} from '../kernel/epistemic/inquiry-contract.js';

describe('Inquiry Contract', () => {
  const full = createInquiryContract({
    design: 'log-derived',
    design_justification: 'root-cause validation needs log-derived evidence',
    data_collection_method: 'git log + test output collection',
    analysis_method: 'five-whys descent over recorded failure timeline',
    sample_scope: 'the failing test suite, not the whole codebase',
    ethics_and_scope_limits: 'no file mutations during investigation',
    confidence: 0.82,
  });

  it('validates a fully populated contract', () => {
    const result = validateInquiryContract(full);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(isInquiryEligible(full)).toBe(true);
  });

  it('rejects a missing contract entirely', () => {
    expect(isInquiryEligible(null)).toBe(false);
    expect(validateInquiryContract(undefined).valid).toBe(false);
  });

  it('lists missing fields on partial contracts', () => {
    const partial = createInquiryContract({
      design: 'qualitative',
      design_justification: 'ok',
      data_collection_method: 'ok',
      analysis_method: '',
      sample_scope: 'ok',
      ethics_and_scope_limits: 'ok',
      confidence: 0.5,
    });
    const result = validateInquiryContract(partial);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('analysis_method');
  });

  it('rejects out-of-range confidence', () => {
    const bad = { ...full, confidence: 1.5 };
    expect(validateInquiryContract(bad).valid).toBe(false);
  });
});

describe('Epistemic Immune System', () => {
  function goodSignal(overrides: Record<string, unknown> = {}) {
    return {
      target: 'dependency X is vulnerable',
      content: 'verified advisory confirms vulnerability',
      source_type: 'tool',
      source_id: 'npm-audit',
      answers: {
        needs: 'yes, relevant to the current task',
        qualified_source: 'yes, official advisory',
        currency: 'yes, updated today',
        prejudice: 'no bias',
        fact_vs_opinion: 'no, factual',
        propaganda: 'no propaganda',
        motivation: 'educational',
        whole_story: 'yes, complete advisory',
        better_sources: 'yes, corroborated by two sources',
      },
      corroborations: ['source-b'],
      ...overrides,
    } as never;
  }

  it('accepts a well-corroborated, fully-answered signal', () => {
    const immune = new EpistemicImmuneSystem();
    const result = immune.gateSignal(goodSignal());
    expect(result.verdict).toBe('accept');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('quarantines uncorroborated signals below threshold', () => {
    const immune = new EpistemicImmuneSystem();
    const result = immune.gateSignal(goodSignal({ corroborations: [] }));
    expect(result.verdict).toBe('quarantine');
    expect(immune.getQuarantine()).toHaveLength(1);
    expect(immune.getQuarantine()[0]!.resolution).toBe('pending');
  });

  it('quarantine resolves to corroborated once enough sources arrive', () => {
    const immune = new EpistemicImmuneSystem({ minCorroborations: 2 });
    const result = immune.gateSignal(goodSignal({ corroborations: [] }));
    expect(result.verdict).toBe('quarantine');

    const first = immune.corroborate(result.signalId, 'source-b');
    expect(first.resolution).toBe('still-pending');
    const second = immune.corroborate(result.signalId, 'source-c');
    expect(second.resolution).toBe('corroborated');
    expect(immune.getQuarantine()[0]!.resolvedAt).not.toBeNull();
  });

  it('rejects signals with hard failures', () => {
    const immune = new EpistemicImmuneSystem();
    const result = immune.gateSignal(
      goodSignal({
        answers: {
          needs: 'no, irrelevant',
          qualified_source: 'no, anonymous blog',
          currency: 'no, outdated',
          prejudice: 'yes biased',
          fact_vs_opinion: 'yes opinion',
          propaganda: 'yes propaganda',
          motivation: 'sell',
          whole_story: 'no, partial',
          better_sources: 'no, single source',
        },
      }),
    );
    expect(result.verdict).toBe('reject');
  });

  it('tracks false-acceptance rate benchmark', () => {
    const immune = new EpistemicImmuneSystem();
    immune.gateSignal(goodSignal());
    immune.recordContradiction('x');
    expect(immune.getFalseAcceptanceRate()).toBeCloseTo(1);
    immune.gateSignal(goodSignal({ id: 'y' }));
    expect(immune.getFalseAcceptanceRate()).toBeCloseTo(0.5);
  });

  it('computes quarantine resolution latency', () => {
    const immune = new EpistemicImmuneSystem({ minCorroborations: 1 });
    const result = immune.gateSignal(goodSignal({ corroborations: [] }));
    immune.corroborate(result.signalId, 'src');
    expect(immune.getQuarantineResolutionLatencyMs()).toBeGreaterThanOrEqual(0);
  });

  it('requires 2+ sources for wisdom eligibility', () => {
    const immune = new EpistemicImmuneSystem();
    expect(immune.wisdomCorroborationThreshold).toBe(2);
    expect(immune.isWisdomEligible('nope')).toBe(false);
  });
});

describe('Epistemic Elevation Engine', () => {
  function engine() {
    const immune = new EpistemicImmuneSystem();
    return { immune, elevation: new EpistemicElevationEngine(immune) };
  }

  const inquiry = createInquiryContract({
    design: 'log-derived',
    design_justification: 'log-derived evidence fits the claim',
    data_collection_method: 'observations',
    analysis_method: 'correlation analysis',
    sample_scope: 'workspace slice',
    ethics_and_scope_limits: 'none touched',
    confidence: 0.9,
  });

  it('ingests objects at the data tier', () => {
    const { elevation } = engine();
    const obj = elevation.ingest('raw observation', 0.1);
    expect(obj.tier).toBe('data');
    expect(elevation.getObject(obj.id)).toBeDefined();
  });

  it('promotes data → information with context + inquiry', () => {
    const { elevation } = engine();
    const obj = elevation.ingest('organized fact', 0.4, inquiry);
    const attempt = elevation.attemptPromotion(obj.id);
    expect(attempt.allowed).toBe(true);
    expect(elevation.getObject(obj.id)!.tier).toBe('information');
  });

  it('blocks premature promotion without context score', () => {
    const { elevation } = engine();
    const obj = elevation.ingest('early fact', 0.1, inquiry);
    const attempt = elevation.attemptPromotion(obj.id);
    expect(attempt.allowed).toBe(false);
    expect(attempt.reasons.join(' ')).toContain('context_score');
  });

  it('blocks promotion to information without inquiry contract', () => {
    const { elevation } = engine();
    const obj = elevation.ingest('no inquiry', 0.9);
    const attempt = elevation.attemptPromotion(obj.id);
    expect(attempt.allowed).toBe(false);
    expect(attempt.reasons.join(' ')).toContain('InquiryContract');
  });

  it('requires immune gate pass for knowledge tier', () => {
    const { elevation } = engine();
    const obj = elevation.ingest('claim', 0.6, inquiry);
    elevation.attemptPromotion(obj.id); // data → information

    // Now to knowledge: no gate pass yet → blocked.
    const attempt = elevation.attemptPromotion(obj.id);
    expect(attempt.allowed).toBe(false);
    expect(attempt.reasons.join(' ')).toContain('Immune System');

    // Attach a passing gate via a fully-answered signal.
    const signal = {
      target: 'claim',
      content: 'verified claim',
      source_type: 'tool',
      source_id: 'src',
      answers: {
        needs: 'yes relevant',
        qualified_source: 'yes qualified expert',
        currency: 'yes current',
        prejudice: 'no bias',
        fact_vs_opinion: 'no factual',
        propaganda: 'no propaganda',
        motivation: 'educational',
        whole_story: 'yes complete',
        better_sources: 'yes converges',
      },
      corroborations: ['src2'],
    };
    const gate = elevation['immune'].gateSignal(signal);
    const obj2 = elevation.getObject(obj.id)!;
    obj2.lastGate = gate;
    const attempt2 = elevation.attemptPromotion(obj.id);
    expect(attempt2.allowed).toBe(true);
    expect(obj2.tier).toBe('knowledge');
  });

  it('requires 2 corroborations for wisdom', () => {
    const { elevation, immune } = engine();
    const obj = elevation.ingest('deep claim', 0.9, inquiry);
    elevation.attemptPromotion(obj.id); // → information
    // gate pass for knowledge
    const gate = immune.gateSignal({
      target: 'deep claim',
      content: 'verified',
      source_type: 'tool',
      source_id: 'a',
      answers: {
        needs: 'yes relevant',
        qualified_source: 'yes qualified',
        currency: 'yes current',
        prejudice: 'no bias',
        fact_vs_opinion: 'no factual',
        propaganda: 'no propaganda',
        motivation: 'educational',
        whole_story: 'yes complete',
        better_sources: 'yes converges',
      },
      corroborations: ['b'],
    });
    obj.lastGate = gate;
    elevation.attemptPromotion(obj.id); // → knowledge

    // 0 corroborations → wisdom blocked
    let attempt = elevation.attemptPromotion(obj.id);
    expect(attempt.allowed).toBe(false);
    expect(attempt.reasons.join(' ')).toContain('corroboration');

    elevation.addCorroboration(obj.id, 2);
    attempt = elevation.attemptPromotion(obj.id);
    expect(attempt.allowed).toBe(true);
    expect(obj.tier).toBe('wisdom');
  });

  it('demotes and tracks false-promotion rate', () => {
    const { elevation } = engine();
    const obj = elevation.ingest('x', 0.5, inquiry);
    elevation.attemptPromotion(obj.id);
    expect(elevation.demote(obj.id, 'data')).toBe(true);
    expect(elevation.getDemotionCount()).toBe(1);
    expect(elevation.getFalsePromotionRate()).toBeCloseTo(1);
    expect(elevation.demote(obj.id, 'knowledge')).toBe(false);
  });

  it('reports status with tier distribution', () => {
    const { elevation } = engine();
    elevation.ingest('a', 0.9, inquiry);
    elevation.ingest('b', 0.9, inquiry);
    const status = elevation.getStatus();
    expect(status.objects).toBe(2);
    expect((status.tiers as Record<string, number>).data).toBe(2);
  });

  it('runs the DIKW transform through the framework engine', () => {
    const { elevation } = engine();
    const obj = elevation.ingest('observation', 0.1);
    const result = elevation.analyzeDikw(obj.id, {
      dataPoints: [{ value: '42', attribute: 'latency_ms' }],
    });
    expect(result).not.toBeNull();
    expect(result!.data.points).toHaveLength(1);
    expect(elevation.analyzeDikw('missing', { dataPoints: [] })).toBeNull();
  });
});
