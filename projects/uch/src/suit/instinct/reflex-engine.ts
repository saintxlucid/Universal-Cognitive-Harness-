export type ReflexSeverity = 'block' | 'warn' | 'info';

export interface ReflexResult {
  reflex: string;
  passed: boolean;
  severity: ReflexSeverity;
  message: string;
  context: Record<string, unknown>;
  durationMs: number;
}

export interface Reflex {
  name: string;
  description: string;
  severity: ReflexSeverity;
  check(context: ReflexContext): Promise<ReflexResult> | ReflexResult;
}

export interface ReflexContext {
  action: 'create' | 'modify' | 'delete' | 'rename' | 'import' | 'depend';
  targetType: 'file' | 'function' | 'class' | 'abstraction' | 'dependency' | 'api';
  name: string;
  existingAbstractions: string[];
  existingDependencies: string[];
  fileSize: number;
  complexity: number;
  nestingDepth: number;
  architecturePatterns: string[];
  allowedDependencies: string[];
  forbiddenDependencies: string[];
  maxFileSize: number;
  maxFunctionLines: number;
  maxNesting: number;
  maxComplexity: number;
}

export class ReflexEngine {
  private reflexes: Map<string, Reflex> = new Map();
  private results: ReflexResult[] = [];
  private maxResults: number;

  constructor(maxResults = 1000) {
    this.maxResults = maxResults;
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    this.register({
      name: 'duplicate-abstraction',
      description: 'Detects when a new abstraction duplicates an existing one',
      severity: 'block',
      check: (ctx: ReflexContext): ReflexResult => {
        const start = Date.now();
        const similar = ctx.existingAbstractions.filter(
          (a) =>
            a.toLowerCase().includes(ctx.name.toLowerCase()) ||
            ctx.name.toLowerCase().includes(a.toLowerCase()),
        );
        return {
          reflex: 'duplicate-abstraction',
          passed: similar.length === 0,
          severity: 'block',
          message:
            similar.length > 0
              ? `Duplicate abstraction detected. "${ctx.name}" overlaps with existing: ${similar.join(', ')}`
              : 'No duplicate abstraction found',
          context: { existing: similar, proposed: ctx.name },
          durationMs: Date.now() - start,
        };
      },
    });

    this.register({
      name: 'architecture-violation',
      description: 'Detects structural violations against allowed architecture patterns',
      severity: 'block',
      check: (ctx: ReflexContext): ReflexResult => {
        const start = Date.now();
        const violations =
          ctx.allowedDependencies.length > 0
            ? ctx.existingDependencies.filter((d) => !ctx.allowedDependencies.includes(d))
            : [];
        return {
          reflex: 'architecture-violation',
          passed: violations.length === 0,
          severity: 'block',
          message:
            violations.length > 0
              ? `Architecture violation: unauthorized dependencies: ${violations.join(', ')}`
              : 'Architecture rules satisfied',
          context: { violations, allowed: ctx.allowedDependencies },
          durationMs: Date.now() - start,
        };
      },
    });

    this.register({
      name: 'complexity-gate',
      description: 'Enforces maximum complexity thresholds',
      severity: 'block',
      check: (ctx: ReflexContext): ReflexResult => {
        const start = Date.now();
        const issues: string[] = [];
        if (ctx.fileSize > ctx.maxFileSize)
          issues.push(`File size ${ctx.fileSize} exceeds max ${ctx.maxFileSize}`);
        if (ctx.complexity > ctx.maxComplexity)
          issues.push(`Complexity ${ctx.complexity} exceeds max ${ctx.maxComplexity}`);
        if (ctx.nestingDepth > ctx.maxNesting)
          issues.push(`Nesting depth ${ctx.nestingDepth} exceeds max ${ctx.maxNesting}`);
        return {
          reflex: 'complexity-gate',
          passed: issues.length === 0,
          severity: 'block',
          message: issues.length > 0 ? issues.join('; ') : 'Complexity within limits',
          context: {
            fileSize: ctx.fileSize,
            complexity: ctx.complexity,
            nesting: ctx.nestingDepth,
          },
          durationMs: Date.now() - start,
        };
      },
    });

    this.register({
      name: 'security-reflex',
      description: 'Detects unsafe code patterns',
      severity: 'block',
      check: (ctx: ReflexContext): ReflexResult => {
        const start = Date.now();
        const unsafe = ['eval', 'exec', 'innerHTML', 'dangerouslySetInnerHTML', 'raw_sql', 'shell'];
        const triggered = unsafe.filter((p) => ctx.name.toLowerCase().includes(p));
        return {
          reflex: 'security-reflex',
          passed: triggered.length === 0,
          severity: 'block',
          message:
            triggered.length > 0
              ? `Unsafe pattern detected: ${triggered.join(', ')}`
              : 'No security concerns',
          context: { patterns: triggered },
          durationMs: Date.now() - start,
        };
      },
    });

    this.register({
      name: 'dependency-reflex',
      description: 'Prevents adding dependencies when an existing one suffices',
      severity: 'warn',
      check: (ctx: ReflexContext): ReflexResult => {
        const start = Date.now();
        const hasExisting = ctx.existingDependencies.length > 0 && ctx.action === 'depend';
        return {
          reflex: 'dependency-reflex',
          passed: !hasExisting || ctx.allowedDependencies.length === 0,
          severity: 'warn',
          message:
            hasExisting && ctx.allowedDependencies.length > 0
              ? `Prefer existing dependency over adding new: ${ctx.allowedDependencies}`
              : 'Dependency check passed',
          context: { existingDeps: ctx.existingDependencies },
          durationMs: Date.now() - start,
        };
      },
    });

    this.register({
      name: 'naming-reflex',
      description: 'Flags generic or non-domain names',
      severity: 'warn',
      check: (ctx: ReflexContext): ReflexResult => {
        const start = Date.now();
        const generic = [
          'data',
          'info',
          'temp',
          'tmp',
          'utils',
          'helper',
          'manager',
          'handler',
          'processor',
        ];
        const tokens = ctx.name
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/[_\W]+/g, ' ')
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);

        const matched = tokens.filter((token) => generic.includes(token));
        const hasDomainWord = tokens.some((token) => !generic.includes(token));
        const passed = matched.length === 0 || hasDomainWord;

        return {
          reflex: 'naming-reflex',
          passed,
          severity: 'warn',
          message:
            matched.length > 0 && !hasDomainWord
              ? `Generic naming detected: "${ctx.name}" contains ${matched.join(', ')}. Consider a more domain-specific name.`
              : 'Naming looks domain-specific',
          context: { genericTerms: matched, tokens },
          durationMs: Date.now() - start,
        };
      },
    });
  }

  register(reflex: Reflex): void {
    this.reflexes.set(reflex.name, reflex);
  }

  async evaluate(ctx: ReflexContext): Promise<ReflexResult[]> {
    const results: ReflexResult[] = [];
    for (const [, reflex] of this.reflexes) {
      try {
        const result = await Promise.resolve(reflex.check(ctx));
        results.push(result);
        this.results.push(result);
        if (this.results.length > this.maxResults) this.results.shift();
      } catch (err) {
        const result: ReflexResult = {
          reflex: reflex.name,
          passed: false,
          severity: 'block',
          message: `Reflex error: ${err}`,
          context: {},
          durationMs: 0,
        };
        results.push(result);
      }
    }
    return results;
  }

  async evaluateWithBlock(
    ctx: ReflexContext,
  ): Promise<{ passed: boolean; results: ReflexResult[]; blockedBy: ReflexResult[] }> {
    const results = await this.evaluate(ctx);
    const blocked = results.filter((r) => !r.passed && r.severity === 'block');
    return { passed: blocked.length === 0, results, blockedBy: blocked };
  }

  getResults(limit = 100): ReflexResult[] {
    return this.results.slice(-limit);
  }

  getReflexes(): Reflex[] {
    return [...this.reflexes.values()];
  }

  getStats(): Record<string, unknown> {
    const total = this.results.length;
    const failed = this.results.filter((r) => !r.passed);
    const blocked = failed.filter((r) => r.severity === 'block');
    return {
      totalChecks: total,
      passed: total - failed.length,
      failed: failed.length,
      blocked: blocked.length,
      reflexes: this.reflexes.size,
      byReflex: Object.fromEntries(
        [...this.reflexes.keys()].map((name) => [
          name,
          this.results.filter((r) => r.reflex === name).length,
        ]),
      ),
    };
  }
}
