import { describe, it, expect } from 'vitest';
import { validateMethodology, detectGaps, GAP_TYPES } from '../research/methodology.js';

describe('Methodology validation', () => {
  it('passes a complete methodology', () => {
    const r = validateMethodology({
      researchQuestion: 'Does X improve Y?',
      design: { approach: 'quantitative', justification: 'Because causal inference requires measurable outcomes and controlled comparison across conditions.' },
      collection: { methods: ['survey'], detail: 'Online survey distributed to targeted respondents' },
      analysis: { methods: ['regression', 'descriptive statistics'], description: 'Run OLS regression controlling for confounders' },
      sampling: { population: 'working adults', method: 'random', size: '300', justification: 'Detects effect size 0.1 at 80% power' },
      ethics: { informedConsent: true, confidentiality: true, voluntary: true, dataProtection: true },
    });
    expect(r.ready).toBe(true);
    expect(r.mistakes.length).toBe(0);
    expect(r.stages.length).toBe(5);
  });

  it('flags missing stages with the fundamental questions', () => {
    const r = validateMethodology({ researchQuestion: 'Anything' });
    expect(r.ready).toBe(false);
    expect(r.mistakes).toContain('No clear research design');
    expect(r.mistakes).toContain('Ignoring ethics');
    expect(r.stages[0].fundamentalQuestion).toContain('How will I investigate');
    expect(r.stages[4].fundamentalQuestion).toContain('trusted ethically');
  });

  it('flags overly complicated methods', () => {
    const r = validateMethodology({
      researchQuestion: 'q',
      design: { approach: 'mixed', justification: 'justified because of the mixed nature of the evidence in this domain.' },
      collection: { methods: ['a', 'b', 'c', 'd', 'e'], detail: 'x' },
      analysis: { methods: ['regression'], description: 'y' },
      sampling: { population: 'p', method: 'm', size: '10', justification: 'j' },
      ethics: { informedConsent: true, confidentiality: true, voluntary: true, dataProtection: true },
    });
    expect(r.mistakes).toContain('Overly complicated methods');
  });
});

describe('Research gap analysis', () => {
  it('detects a knowledge gap when no literature exists', () => {
    const r = detectGaps({ topic: 'LLM agents in surgery', notes: [] });
    expect(r.detected.some((g) => g.type === 'knowledge')).toBe(true);
    expect(r.ranked[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects contradictions between studies', () => {
    const r = detectGaps({
      topic: 'Exercise and memory',
      notes: [
        { title: 'A', finding: 'exercise improves memory' },
        { title: 'B', finding: 'no effect of exercise on memory', year: 2024 },
      ],
    });
    expect(r.detected.some((g) => g.type === 'contradiction')).toBe(true);
  });

  it('detects time gaps from stale evidence', () => {
    const r = detectGaps({
      topic: 'AI coding agents',
      notes: [
        { title: 'Old', finding: 'agents are toys', year: 2018 },
        { title: 'Older', finding: 'agents struggle', year: 2015 },
      ],
    });
    expect(r.detected.some((g) => g.type === 'time')).toBe(true);
  });

  it('mines future-research recommendations', () => {
    const r = detectGaps({
      topic: 'Remote work',
      notes: [
        { title: 'A', finding: 'productivity up', futureRecommendation: 'study small businesses in Africa' },
      ],
    });
    expect(r.detected.some((g) => g.evidence.includes('Africa'))).toBe(true);
  });

  it('produces a research question from the top gap', () => {
    const r = detectGaps({ topic: 'Quantum UX', notes: [] });
    expect(r.researchQuestion).toContain('Quantum UX');
  });

  it('covers all eight gap types in the catalog', () => {
    expect(GAP_TYPES.length).toBe(8);
    expect(GAP_TYPES.map((g) => g.type)).toEqual(
      expect.arrayContaining(['knowledge', 'evidence', 'methodological', 'population', 'context', 'time', 'contradiction', 'theory']),
    );
  });
});
