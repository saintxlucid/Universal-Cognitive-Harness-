import { describe, it, expect } from 'vitest';
import { ReflexEngine, type ReflexContext } from '../suit/instinct/reflex-engine.js';

function makeContext(overrides: Partial<ReflexContext> = {}): ReflexContext {
  return {
    action: overrides.action ?? 'create',
    targetType: overrides.targetType ?? 'file',
    name: overrides.name ?? 'user-service',
    existingAbstractions: overrides.existingAbstractions ?? ['UserService', 'UserRepository', 'AuthService'],
    existingDependencies: overrides.existingDependencies ?? ['express', 'lodash'],
    fileSize: overrides.fileSize ?? 100,
    complexity: overrides.complexity ?? 5,
    nestingDepth: overrides.nestingDepth ?? 2,
    architecturePatterns: overrides.architecturePatterns ?? ['hexagonal'],
    allowedDependencies: overrides.allowedDependencies ?? ['express', 'zod', 'prisma'],
    forbiddenDependencies: overrides.forbiddenDependencies ?? [],
    maxFileSize: overrides.maxFileSize ?? 400,
    maxFunctionLines: overrides.maxFunctionLines ?? 80,
    maxNesting: overrides.maxNesting ?? 4,
    maxComplexity: overrides.maxComplexity ?? 10,
  };
}

describe('ReflexEngine', () => {
  it('has 6 built-in reflexes', () => {
    const engine = new ReflexEngine();
    expect(engine.getReflexes()).toHaveLength(6);
  });

  it('duplicate-abstraction blocks overlapping names', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ name: 'UserManager2', existingAbstractions: ['UserService', 'UserManager'] });
    const results = await engine.evaluate(ctx);
    const dup = results.find((r) => r.reflex === 'duplicate-abstraction')!;
    expect(dup.passed).toBe(false);
    expect(dup.severity).toBe('block');
    expect(dup.message).toContain('Duplicate abstraction');
  });

  it('duplicate-abstraction passes for unique names', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ name: 'PaymentGateway', existingAbstractions: ['UserService'] });
    const results = await engine.evaluate(ctx);
    const dup = results.find((r) => r.reflex === 'duplicate-abstraction')!;
    expect(dup.passed).toBe(true);
  });

  it('architecture-violation blocks unauthorized dependencies', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({
      existingDependencies: ['mongoose'],
      allowedDependencies: ['express', 'zod'],
    });
    const results = await engine.evaluate(ctx);
    const arch = results.find((r) => r.reflex === 'architecture-violation')!;
    expect(arch.passed).toBe(false);
    expect(arch.message).toContain('unauthorized dependencies');
  });

  it('complexity-gate blocks oversized files', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ fileSize: 900, maxFileSize: 400 });
    const results = await engine.evaluate(ctx);
    const cg = results.find((r) => r.reflex === 'complexity-gate')!;
    expect(cg.passed).toBe(false);
    expect(cg.message).toContain('exceeds max');
  });

  it('complexity-gate blocks excessive nesting', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ nestingDepth: 7, maxNesting: 4 });
    const results = await engine.evaluate(ctx);
    const cg = results.find((r) => r.reflex === 'complexity-gate')!;
    expect(cg.passed).toBe(false);
  });

  it('complexity-gate passes for clean files', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ fileSize: 50, complexity: 2, nestingDepth: 2 });
    const results = await engine.evaluate(ctx);
    const cg = results.find((r) => r.reflex === 'complexity-gate')!;
    expect(cg.passed).toBe(true);
  });

  it('security-reflex blocks unsafe patterns', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ name: 'executeShellCommand' });
    const results = await engine.evaluate(ctx);
    const sec = results.find((r) => r.reflex === 'security-reflex')!;
    expect(sec.passed).toBe(false);
    expect(sec.message).toContain('shell');
  });

  it('naming-reflex flags generic names', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ name: 'dataHelper' });
    const results = await engine.evaluate(ctx);
    const naming = results.find((r) => r.reflex === 'naming-reflex')!;
    expect(naming.passed).toBe(false);
    expect(naming.message).toContain('Generic naming');
  });

  it('naming-reflex passes for domain names', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ name: 'InvoiceProcessor' });
    const results = await engine.evaluate(ctx);
    const naming = results.find((r) => r.reflex === 'naming-reflex')!;
    expect(naming.passed).toBe(true);
  });

  it('evaluateWithBlock returns blocked items', async () => {
    const engine = new ReflexEngine();
    const ctx = makeContext({ name: 'dataHelper', fileSize: 900, maxFileSize: 400 });
    const { passed, blockedBy } = await engine.evaluateWithBlock(ctx);
    expect(passed).toBe(false);
    expect(blockedBy.length).toBeGreaterThanOrEqual(2);
  });

  it('registers custom reflexes', async () => {
    const engine = new ReflexEngine();
    engine.register({
      name: 'custom-check', description: 'Custom', severity: 'block',
      check: () => ({ reflex: 'custom-check', passed: false, severity: 'block' as const, message: 'Custom block', context: {}, durationMs: 0 }),
    });
    const results = await engine.evaluate(makeContext());
    const custom = results.find((r) => r.reflex === 'custom-check')!;
    expect(custom.passed).toBe(false);
  });

  it('returns stats', () => {
    const engine = new ReflexEngine();
    const stats = engine.getStats();
    expect(stats.reflexes).toBe(6);
    expect(stats.totalChecks).toBe(0);
  });

  it('handles reflex errors gracefully', async () => {
    const engine = new ReflexEngine();
    engine.register({
      name: 'broken', description: 'Broken', severity: 'block',
      check: () => { throw new Error('oops'); },
    });
    const results = await engine.evaluate(makeContext());
    const broken = results.find((r) => r.reflex === 'broken')!;
    expect(broken.passed).toBe(false);
    expect(broken.message).toContain('Reflex error');
  });
});
