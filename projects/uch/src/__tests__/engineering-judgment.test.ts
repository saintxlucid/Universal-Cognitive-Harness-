import { describe, it, expect } from 'vitest';
import { EngineeringJudgmentEngine } from '../kernel/constitution/engineering-judgment.js';

describe('EngineeringJudgmentEngine', () => {
  it('rejects proposals that bypass the existing abstraction and skip verification', () => {
    const engine = new EngineeringJudgmentEngine();

    const result = engine.evaluate({
      intent: 'add a new user profile API',
      proposedChange:
        'Create a new UserManager2 service, add a dependency, and ship the endpoint without tests or docs.',
      context: {
        existingArchitecture:
          'UserService already owns profile operations and the project uses one service layer per domain.',
        dependencies: ['express', 'zod'],
        modules: ['UserService', 'ProfileController'],
      },
    });

    expect(result.verdict).toBe('review');
    expect(result.flags).toContain('duplicate-abstraction');
    expect(result.flags).toContain('missing-verification');
    expect(result.score).toBeLessThan(0.8);
  });

  it('approves proposals that extend existing abstractions and include tests', () => {
    const engine = new EngineeringJudgmentEngine();

    const result = engine.evaluate({
      intent: 'extend an existing profile endpoint',
      proposedChange:
        'Extend the existing UserService with a profile summary method and add unit tests plus docs for the public API.',
      context: {
        existingArchitecture:
          'UserService already owns profile operations and the project uses one service layer per domain.',
        dependencies: ['zod'],
        modules: ['UserService', 'ProfileController'],
      },
    });

    expect(result.verdict).toBe('pass');
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('preserve')]),
    );
  });

  it('produces richer risk signals and next-step guidance', () => {
    const engine = new EngineeringJudgmentEngine();

    const result = engine.evaluate({
      intent: 'introduce a new caching layer',
      proposedChange: 'Add a new Redis-backed cache service without tests or docs.',
      context: {
        existingArchitecture: 'The app already uses a shared in-process cache.',
        dependencies: ['redis'],
        modules: ['CacheService', 'APIController'],
      },
    });

    expect(result.riskLevel).toBe('high');
    expect(result.nextSteps.length).toBeGreaterThan(0);
    expect(result.recommendations.some((item) => item.includes('tests'))).toBe(true);
  });
});
