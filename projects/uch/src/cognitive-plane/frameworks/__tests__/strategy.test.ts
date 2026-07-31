import { describe, it, expect } from 'vitest';
import { strategyWheel, strategyVsPlan } from '../strategy/strategy-wheel.js';

describe('Strategy Wheel', () => {
  it('presents all 20 questions in 4 quadrants', () => {
    const r = strategyWheel();
    expect(r.quadrants.length).toBe(4);
    expect(r.quadrants.reduce((acc, q) => acc + q.questions.length, 0)).toBe(20);
    expect(r.completenessPct).toBe(0);
  });

  it('measures completeness from answers', () => {
    const r = strategyWheel({
      answers: {
        purpose: [
          { question: 'Why do we exist?', answer: 'To accelerate teams' },
          { question: 'What is our mission in one clear sentence?', answer: 'Ship faster' },
        ],
      },
    });
    expect(r.completenessPct).toBeGreaterThan(0);
    expect(r.quadrants[0].gaps.length).toBe(3);
  });

  it('encodes the hidden flow', () => {
    const r = strategyWheel();
    expect(r.hiddenFlow.some((f) => f.includes('Purpose → Market'))).toBe(true);
  });
});

describe('Strategy vs Plan', () => {
  it('detects missing strategy when only a plan exists', () => {
    const r = strategyVsPlan({
      plan: { goals: 'Ship v2', timeline: 'Q3', ownership: 'Team A' },
    });
    expect(r.strategyGaps).toContain('Purpose');
    expect(r.strategyGaps).toContain('Advantage');
    expect(r.diagnosis).toContain('organized activity without direction');
  });

  it('detects missing plan when only strategy exists', () => {
    const r = strategyVsPlan({
      strategy: { purpose: 'Own the mid-market', arena: 'EU', advantage: 'Speed', capabilities: 'AI infra', revenueLogic: 'SaaS' },
    });
    expect(r.planGaps.length).toBeGreaterThan(0);
    expect(r.diagnosis).toContain('plan gaps');
  });

  it('confirms alignment when both layers are defined', () => {
    const r = strategyVsPlan({
      strategy: { purpose: 'p', arena: 'a', advantage: 'adv', capabilities: 'cap', revenueLogic: 'rl' },
      plan: { goals: 'g', ownership: 'o', resources: 'r', timeline: 't', tracking: 'tr' },
    });
    expect(r.diagnosis).toContain('aligned');
  });

  it('states the time horizons correctly', () => {
    const r = strategyVsPlan({});
    expect(r.timeHorizons.strategy).toContain('3-5 years');
    expect(r.timeHorizons.plan).toContain('days to months');
  });
});
