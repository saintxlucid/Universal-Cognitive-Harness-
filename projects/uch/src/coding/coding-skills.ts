export type CodingSkillCategory =
  | 'debugging' | 'refactoring' | 'code-review' | 'testing' | 'optimization'
  | 'documentation' | 'security' | 'architecture' | 'git-workflow' | 'general';

export interface CodingSkillStep {
  title: string;
  detail: string;
}

export interface CodingSkill {
  id: string;
  name: string;
  category: CodingSkillCategory;
  description: string;
  triggers: string[];
  steps: CodingSkillStep[];
  outputs: string[];
  whenNotToUse: string[];
}

export interface SkillMatch {
  skill: CodingSkill;
  score: number;
  matchedTriggers: string[];
}

const SKILLS: CodingSkill[] = [
  {
    id: 'skill:debug',
    name: 'Debugging',
    category: 'debugging',
    description: 'Systematic root-cause investigation for failing code, errors, and unexpected behavior.',
    triggers: ['debug', 'bug', 'error', 'crash', 'exception', 'failing', 'broken', 'stack trace', 'root cause', 'why is'],
    steps: [
      { title: 'Reproduce', detail: 'Get a minimal, deterministic reproduction of the failure.' },
      { title: 'Read the error', detail: 'Parse the stack trace top-down; identify the exact failing frame.' },
      { title: 'Inspect state', detail: 'Check inputs, environment, and intermediate values at the failure point.' },
      { title: 'Form hypothesis', detail: 'State one hypothesis with a prediction, then verify with a targeted check.' },
      { title: 'Fix and verify', detail: 'Apply the narrowest fix and re-run the reproduction plus related tests.' },
    ],
    outputs: ['Root cause statement', 'Reproduction steps', 'Fix + regression test'],
    whenNotToUse: ['Vague "make it better" requests', 'New feature work'],
  },
  {
    id: 'skill:refactor',
    name: 'Refactoring',
    category: 'refactoring',
    description: 'Restructure code without changing behavior to improve readability, maintainability, and design.',
    triggers: ['refactor', 'clean up', 'restructure', 'simplify', 'duplicated', 'dead code', 'improve structure'],
    steps: [
      { title: 'Map behavior', detail: 'Identify public contract (inputs, outputs, side effects) before touching anything.' },
      { title: 'Find duplication', detail: 'Locate repeated patterns and extraction candidates.' },
      { title: 'Small steps', detail: 'One transformation at a time; keep the code compiling after each step.' },
      { title: 'Preserve tests', detail: 'Run the suite after each step — behavior must not change.' },
    ],
    outputs: ['Refactored code with unchanged behavior', 'List of behavior-preserving transformations'],
    whenNotToUse: ['When behavior must change', 'During hotfixes'],
  },
  {
    id: 'skill:code-review',
    name: 'Code Review',
    category: 'code-review',
    description: 'Systematic review of diffs and PRs for correctness, security, performance, and maintainability.',
    triggers: ['review', 'pr', 'pull request', 'code review', 'check my changes', 'audit'],
    steps: [
      { title: 'Read the diff', detail: 'Understand intent: what behavior is being added or changed?' },
      { title: 'Check correctness', detail: 'Edge cases, null handling, off-by-one, concurrency, error paths.' },
      { title: 'Check security', detail: 'Secrets, injection, unsafe deserialization, authz gaps, unsafe eval.' },
      { title: 'Check performance', detail: 'N+1 queries, unbounded loops, sync IO in hot paths.' },
      { title: 'Check style', detail: 'Naming, conventions, dead code, leftover debug statements.' },
    ],
    outputs: ['Findings with severity', 'Specific line references', 'Actionable suggestions'],
    whenNotToUse: ['When asked to implement, not review'],
  },
  {
    id: 'skill:testing',
    name: 'Test Writing',
    category: 'testing',
    description: 'Write and run unit, integration, and E2E tests that verify behavior and prevent regressions.',
    triggers: ['test', 'unit test', 'integration test', 'coverage', 'spec', 'mock', 'assert'],
    steps: [
      { title: 'Identify contract', detail: 'What is the function/component supposed to do? List input→output pairs.' },
      { title: 'Cover edges', detail: 'Empty input, boundaries, error cases, invalid data.' },
      { title: 'Write test first', detail: 'Red-green-refactor where possible; assert behavior, not implementation.' },
      { title: 'Run suite', detail: 'Run the test command and confirm green plus no flakiness.' },
    ],
    outputs: ['Test cases covering normal + edge paths', 'Test command run results'],
    whenNotToUse: ['When testing would cost more than the risk it covers (rare)'],
  },
  {
    id: 'skill:optimize',
    name: 'Performance Optimization',
    category: 'optimization',
    description: 'Identify and fix performance bottlenecks with evidence, not guesses.',
    triggers: ['slow', 'performance', 'optimize', 'bottleneck', 'latency', 'profiling', 'n+1'],
    steps: [
      { title: 'Measure first', detail: 'Profile or benchmark to find the real bottleneck.' },
      { title: 'Set a target', detail: 'Define the improvement goal numerically.' },
      { title: 'Optimize hot path', detail: 'Attack the single biggest cost, then re-measure.' },
      { title: 'Verify', detail: 'Confirm the improvement with the same measurement method.' },
    ],
    outputs: ['Evidence-based bottleneck analysis', 'Optimized code + before/after numbers'],
    whenNotToUse: ['Premature optimization without measurements'],
  },
  {
    id: 'skill:document',
    name: 'Documentation',
    category: 'documentation',
    description: 'Create READMEs, API docs, guides, comments, and changelogs that explain what and why.',
    triggers: ['document', 'readme', 'docs', 'comment', 'changelog', 'guide', 'explain the code'],
    steps: [
      { title: 'Audience first', detail: 'Who reads this — maintainers, users, or API consumers?' },
      { title: 'Document why', detail: 'Explain intent and constraints, not just what the code does.' },
      { title: 'Keep examples live', detail: 'Every snippet should be runnable and verified.' },
      { title: 'Link, don\'t duplicate', detail: 'Reference canonical sources instead of copying.' },
    ],
    outputs: ['Structured docs with examples', 'Updated README/changelog'],
    whenNotToUse: ['Docs that restate code verbatim'],
  },
  {
    id: 'skill:security-audit',
    name: 'Security Audit',
    category: 'security',
    description: 'Review code and dependencies for OWASP-class vulnerabilities and hardening gaps.',
    triggers: ['security', 'vulnerability', 'cve', 'owasp', 'xss', 'injection', 'hardening', 'auth', 'secret'],
    steps: [
      { title: 'Map attack surface', detail: 'Inputs, auth boundaries, and trust zones.' },
      { title: 'Check input handling', detail: 'Injection, XSS, path traversal, unsafe parsing.' },
      { title: 'Check authz', detail: 'Missing checks, IDOR, privilege escalation.' },
      { title: 'Check secrets', detail: 'Hardcoded credentials, leaked keys, over-scoped tokens.' },
      { title: 'Check dependencies', detail: 'Known CVEs in the dependency tree.' },
    ],
    outputs: ['Vulnerability report with severity', 'Mitigation steps'],
    whenNotToUse: ['When no security impact exists (isolated local scripts)'],
  },
  {
    id: 'skill:architect',
    name: 'Architecture & Design',
    category: 'architecture',
    description: 'Design or evaluate system structure, module boundaries, and technical decisions.',
    triggers: ['architecture', 'design', 'structure', 'module', 'monolith', 'microservice', 'tech stack', 'schema'],
    steps: [
      { title: 'Clarify constraints', detail: 'Scale, team size, deployment targets, regulatory requirements.' },
      { title: 'Identify boundaries', detail: 'Decomposition along change rates and ownership lines.' },
      { title: 'Document decisions', detail: 'ADR-style: context, options considered, chosen, consequences.' },
      { title: 'Validate against reality', detail: 'Prototype the riskiest assumption first.' },
    ],
    outputs: ['Architecture plan with trade-offs', 'ADR entry'],
    whenNotToUse: ['For isolated one-file changes'],
  },
  {
    id: 'skill:git-workflow',
    name: 'Git Workflow',
    category: 'git-workflow',
    description: 'Branching, committing, rebasing, and PR hygiene for clean history.',
    triggers: ['git', 'commit', 'branch', 'merge', 'rebase', 'squash', 'pr', 'history'],
    steps: [
      { title: 'Review status', detail: 'Check what changed and what is staged.' },
      { title: 'Write conventional message', detail: 'type(scope): description with body for why.' },
      { title: 'Small commits', detail: 'One logical change per commit; keep history reviewable.' },
      { title: 'Verify before push', detail: 'Run tests/lint, check the diff one last time.' },
    ],
    outputs: ['Clean commit history', 'PR with focused changes'],
    whenNotToUse: ['When destructive git ops are requested (force-push, rewrite history)'],
  },
  {
    id: 'skill:general',
    name: 'General Engineering',
    category: 'general',
    description: 'Fallback workflow for routine coding tasks: understand, plan, implement, verify.',
    triggers: ['implement', 'add', 'create', 'fix', 'change', 'update', 'build', 'feature', 'code'],
    steps: [
      { title: 'Understand', detail: 'Read the relevant files; trace data flow before writing code.' },
      { title: 'Plan', detail: 'State the change surface: files, functions, tests affected.' },
      { title: 'Implement', detail: 'Minimal, idiomatic changes following project conventions.' },
      { title: 'Verify', detail: 'Typecheck, lint, and run the relevant tests.' },
    ],
    outputs: ['Implemented feature', 'Verification results'],
    whenNotToUse: ['Tasks already matched to a specialized skill'],
  },
];

export class CodingSkills {
  private skills: Map<string, CodingSkill> = new Map();

  constructor() {
    for (const skill of SKILLS) {
      this.skills.set(skill.id, skill);
    }
  }

  getAll(): CodingSkill[] {
    return [...this.skills.values()];
  }

  get(id: string): CodingSkill | undefined {
    return this.skills.get(id);
  }

  getByCategory(category: CodingSkillCategory): CodingSkill[] {
    return [...this.skills.values()].filter((s) => s.category === category);
  }

  suggest(task: string): SkillMatch {
    const q = task.toLowerCase();
    let best: SkillMatch | null = null;

    for (const skill of this.skills.values()) {
      const matchedTriggers: string[] = [];
      for (const trigger of skill.triggers) {
        if (q.includes(trigger.toLowerCase())) {
          matchedTriggers.push(trigger);
        }
      }
      if (matchedTriggers.length === 0) continue;

      const score = matchedTriggers.length * 2 + Math.min(matchedTriggers[0]!.length / 10, 1);
      if (!best || score > best.score) {
        best = { skill, score, matchedTriggers };
      }
    }

    if (best) return best;

    const general = this.skills.get('skill:general')!;
    return { skill: general, score: 0.5, matchedTriggers: [] };
  }

  suggestAll(task: string, limit = 3): SkillMatch[] {
    const q = task.toLowerCase();
    const matches: SkillMatch[] = [];

    for (const skill of this.skills.values()) {
      const matchedTriggers: string[] = [];
      for (const trigger of skill.triggers) {
        if (q.includes(trigger.toLowerCase())) {
          matchedTriggers.push(trigger);
        }
      }
      if (matchedTriggers.length > 0) {
        const score = matchedTriggers.length * 2 + Math.min(matchedTriggers[0]!.length / 10, 1);
        matches.push({ skill, score, matchedTriggers });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  render(skill: CodingSkill): string {
    const lines = [
      `## ${skill.name} (${skill.category})`,
      '',
      skill.description,
      '',
      '### Steps',
      ...skill.steps.map((s, i) => `${i + 1}. **${s.title}** — ${s.detail}`),
      '',
      '### Outputs',
      ...skill.outputs.map((o) => `- ${o}`),
    ];
    if (skill.whenNotToUse.length > 0) {
      lines.push('', '### Do not use when', ...skill.whenNotToUse.map((w) => `- ${w}`));
    }
    return lines.join('\n');
  }

  get count(): number {
    return this.skills.size;
  }
}
