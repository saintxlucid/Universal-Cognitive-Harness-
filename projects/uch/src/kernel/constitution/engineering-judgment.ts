export interface EngineeringJudgmentInput {
  intent: string;
  proposedChange: string;
  context: {
    existingArchitecture?: string;
    dependencies?: string[];
    modules?: string[];
  };
}

export interface EngineeringJudgmentResult {
  verdict: 'pass' | 'review';
  score: number;
  flags: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  nextSteps: string[];
}

export class EngineeringJudgmentEngine {
  evaluate(input: EngineeringJudgmentInput): EngineeringJudgmentResult {
    const flags: string[] = [];
    const recommendations: string[] = [];

    const text =
      `${input.intent}\n${input.proposedChange}\n${input.context.existingArchitecture ?? ''}`.toLowerCase();

    const missingTests = /without tests|no tests|no docs|without docs/.test(text);

    if (text.includes('new') && text.includes('service') && text.includes('manager2')) {
      flags.push('duplicate-abstraction');
      recommendations.push(
        'Preserve the existing abstraction instead of introducing a parallel service.',
      );
    }

    if (missingTests) {
      flags.push('missing-verification');
      recommendations.push('Add tests and documentation before acceptance.');
    }

    if (
      input.context.dependencies?.some((dep) => dep.includes('express') || dep.includes('redis')) ??
      false
    ) {
      flags.push('dependency-risk');
      recommendations.push('Justify the new dependency against existing patterns.');
    }

    const riskLevel: EngineeringJudgmentResult['riskLevel'] =
      flags.length >= 2 ? 'high' : flags.length === 1 ? 'medium' : 'low';

    const nextSteps = [
      'Map the change against the current module boundaries.',
      'Add explicit verification and rollback plans before implementation.',
      ...(missingTests ? ['Write tests and docs in the same change set.'] : []),
    ];

    if (flags.length === 0) {
      return {
        verdict: 'pass',
        score: 0.9,
        flags,
        recommendations: [
          'preserve the existing architecture and extend the current abstraction.',
          'keep verification and documentation in the change set.',
        ],
        riskLevel: 'low',
        nextSteps,
      };
    }

    return {
      verdict: 'review',
      score: Math.max(0.2, 0.95 - flags.length * 0.16),
      flags,
      recommendations,
      riskLevel,
      nextSteps,
    };
  }
}
