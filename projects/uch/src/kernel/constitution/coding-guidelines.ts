export const CODING_GUIDELINES_VERSION = '1.0.0';

export const CODING_GUIDELINES: string = `# Coding Guidelines (Agent Constitution)

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes
Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution
Define success criteria. Loop until verified.
- Transform tasks into verifiable goals:
  - "Add validation" → "Write tests for invalid inputs, then make them pass"
  - "Fix the bug" → "Write a test that reproduces it, then make it pass"
  - "Refactor X" → "Ensure tests pass before and after"
- For multi-step tasks, state a brief plan:
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]`;

export function buildCodingGuidelinesPrompt(section?: 'all' | 1 | 2 | 3 | 4): string {
  if (!section || section === 'all') return CODING_GUIDELINES;
  const header = '## ' + (section === 1 ? '1. Think Before Coding' : section === 2 ? '2. Simplicity First' : section === 3 ? '3. Surgical Changes' : '4. Goal-Driven Execution');
  const idx = CODING_GUIDELINES.indexOf(header);
  if (idx < 0) return CODING_GUIDELINES;
  const nextHeader = CODING_GUIDELINES.indexOf('\n## ', idx + 1);
  const sectionText = nextHeader < 0 ? CODING_GUIDELINES.slice(idx) : CODING_GUIDELINES.slice(idx, nextHeader);
  return `Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.\n\n${sectionText.trim()}`;
}

export const CODING_ANTI_PATTERN_TABLE: string = `| Principle | Anti-Pattern | Fix |
|-----------|-------------|-----|
| Think Before Coding | Silently assumes file format, fields, scope | List assumptions explicitly, ask for clarification |
| Simplicity First | Strategy pattern for single discount calculation | One function until complexity is actually needed |
| Surgical Changes | Reformats quotes, adds type hints while fixing bug | Only change lines that fix the reported issue |
| Goal-Driven | "I'll review and improve the code" | "Write test for bug X → make it pass → verify no regressions" |`;

export interface PlanStep {
  step: string;
  verify?: string;
  raw: string;
}

export interface VerificationPlanResult {
  valid: boolean;
  steps: PlanStep[];
  issues: string[];
}

const STEP_RE = /^\s*(?:\d+[.)]|[-*])\s+(.+)$/;

export function parseVerificationPlan(plan: string): PlanStep[] {
  const steps: PlanStep[] = [];
  for (const line of plan.split('\n')) {
    const match = STEP_RE.exec(line);
    if (!match) continue;
    const raw = match[1]!.trim();
    if (!raw) continue;
    const verifyIdx = raw.indexOf('->');
    if (verifyIdx < 0) {
      const arrow = raw.indexOf('→');
      if (arrow >= 0) {
        steps.push({
          step: raw.slice(0, arrow).trim(),
          verify: raw.slice(arrow + 1).replace(/^verify:?\s*/i, '').trim(),
          raw,
        });
        continue;
      }
      steps.push({ step: raw, raw });
      continue;
    }
    steps.push({
      step: raw.slice(0, verifyIdx).trim(),
      verify: raw.slice(verifyIdx + 2).replace(/^verify:?\s*/i, '').trim(),
      raw,
    });
  }
  return steps;
}

export function validateVerificationPlan(plan: string): VerificationPlanResult {
  const steps = parseVerificationPlan(plan);
  if (steps.length === 0) {
    return {
      valid: false,
      steps,
      issues: ['Plan must contain numbered or bulleted steps'],
    };
  }
  const issues: string[] = [];
  for (const step of steps) {
    if (!step.verify) {
      issues.push(`Step "${step.step.slice(0, 60)}" has no verify clause (use "Step → verify: check")`);
    } else if (isWeakVerify(step.verify)) {
      issues.push(`Step "${step.step.slice(0, 60)}" has a weak verify clause: "${step.verify}"`);
    }
  }
  return { valid: issues.length === 0, steps, issues };
}

const WEAK_VERIFY_PATTERNS = [
  /^make it work$/i,
  /^review and (improve|check)$/i,
  /^ensure (it )?works$/i,
  /^look(s)? good$/i,
  /^done$/i,
  /^finish/i,
];

export function isWeakVerify(verify: string): boolean {
  const value = verify.trim().toLowerCase();
  if (value.length < 8) return true;
  return WEAK_VERIFY_PATTERNS.some((pattern) => pattern.test(value));
}

export function renderVerificationPlan(plan: string): string {
  const { valid, issues } = validateVerificationPlan(plan);
  if (valid) {
    return plan
      .split('\n')
      .filter((line) => STEP_RE.test(line))
      .map((line) => `- ${line.replace(STEP_RE, '$1').trim()}`)
      .join('\n');
  }
  return `Plan needs verification clauses:\n${issues.map((issue) => `- ${issue}`).join('\n')}\n\nSuggested format:\n1. [Step] → verify: [check]`;
}
