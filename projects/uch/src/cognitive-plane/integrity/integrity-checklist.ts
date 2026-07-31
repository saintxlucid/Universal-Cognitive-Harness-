import type { ComplianceViolation } from '../constitution/constitution.js';

export type IntegrityFlag =
  | 'subjectivity'
  | 'unqualified_source'
  | 'prejudice'
  | 'propaganda'
  | 'omission';

export interface IntegrityIssue {
  flag: IntegrityFlag;
  question: string;
  detail: string;
}

export interface IntegrityResult {
  passed: boolean;
  issues: IntegrityIssue[];
  violations: ComplianceViolation[];
}

export interface IntegrityContext {
  claim: string;
  objective?: boolean;
  qualifiedSource?: boolean;
  prejudice?: boolean;
  propaganda?: boolean;
  wholeTruth?: boolean;
}

export const INTEGRITY_QUESTIONS: Array<{ flag: IntegrityFlag; question: string }> = [
  { flag: 'subjectivity', question: 'Is it objective?' },
  { flag: 'unqualified_source', question: 'Is the source qualified?' },
  { flag: 'prejudice', question: 'Is there evidence of prejudice?' },
  { flag: 'propaganda', question: 'Is it propaganda?' },
  { flag: 'omission', question: 'Is it the whole truth?' },
];

export class IntegrityChecklist {
  evaluate(context: IntegrityContext): IntegrityResult {
    const issues: IntegrityIssue[] = [];

    if (context.objective !== true) {
      issues.push({
        flag: 'subjectivity',
        question: 'Is it objective?',
        detail: `Claim "${context.claim}" is not objective — it must be verifiable against workspace state or external evidence.`,
      });
    }
    if (context.qualifiedSource !== true) {
      issues.push({
        flag: 'unqualified_source',
        question: 'Is the source qualified?',
        detail: `Claim "${context.claim}" lacks a qualified source — identified, relevant, and competent for the claim.`,
      });
    }
    if (context.prejudice === true) {
      issues.push({
        flag: 'prejudice',
        question: 'Is there evidence of prejudice?',
        detail: `Source for "${context.claim}" shows evidence of prejudice and cannot be treated as neutral evidence.`,
      });
    }
    if (context.propaganda === true) {
      issues.push({
        flag: 'propaganda',
        question: 'Is it propaganda?',
        detail: `Material for "${context.claim}" is propagandistic — intent to persuade rather than inform — and is inadmissible as planning evidence.`,
      });
    }
    if (context.wholeTruth !== true) {
      issues.push({
        flag: 'omission',
        question: 'Is it the whole truth?',
        detail: `Claim "${context.claim}" may omit material facts — omission that reverses meaning is a violation.`,
      });
    }

    return {
      passed: issues.length === 0,
      issues,
      violations: [],
    };
  }

  toComplianceContext(result: IntegrityResult): Record<string, boolean> {
    const context: Record<string, boolean> = {};
    for (const issue of result.issues) {
      context[issue.flag] = true;
    }
    return context;
  }

  attachViolations(result: IntegrityResult, violations: ComplianceViolation[]): IntegrityResult {
    return { ...result, violations };
  }
}
