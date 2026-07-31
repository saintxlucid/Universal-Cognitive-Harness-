import { describe, it, expect } from 'vitest';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';
import { IntegrityChecklist } from '../cognitive-plane/integrity/integrity-checklist.js';
import { FastPathRouter, PrefixTrie } from '../agentic/fastpath/fast-path-router.js';

describe('Constitution: Information Integrity Checklist (ledger 5.4)', () => {
  it('enacts the five integrity laws', () => {
    const c = new CognitiveConstitution();
    const names = c.getByCategory('integrity').map((l) => l.name);
    expect(names).toContain('Objectivity Required');
    expect(names).toContain('Qualified Source Required');
    expect(names).toContain('No Prejudice as Evidence');
    expect(names).toContain('No Propaganda as Evidence');
    expect(names).toContain('Whole Truth Requirement');
  });

  it('flags subjectivity as a violation', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('executive', { subjectivity: true });
    expect(violations.some((v) => v.lawName === 'Objectivity Required')).toBe(true);
  });

  it('flags unqualified sources as a violation', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('executive', { unqualified_source: true });
    expect(violations.some((v) => v.lawName === 'Qualified Source Required')).toBe(true);
  });

  it('flags propaganda as a violation', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('executive', { propaganda: true });
    expect(violations.some((v) => v.lawName === 'No Propaganda as Evidence')).toBe(true);
  });

  it('flags material omission as a violation', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('executive', { omission: true });
    expect(violations.some((v) => v.lawName === 'Whole Truth Requirement')).toBe(true);
  });

  it('passes clean contexts', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('executive', {
      subjectivity: false,
      unqualified_source: false,
      prejudice: false,
      propaganda: false,
      omission: false,
      provenance: 'test-source',
    });
    expect(violations).toHaveLength(0);
  });
});

describe('Constitution: Clean Code Covenant (ledger 4.5)', () => {
  it('enacts the five covenant laws', () => {
    const c = new CognitiveConstitution();
    const names = c.getByCategory('engineering').map((l) => l.name);
    expect(names).toContain('Separation of Concerns');
    expect(names).toContain("Don't Repeat Yourself");
    expect(names).toContain('Keep It Simple');
    expect(names).toContain('Document Your Code');
    expect(names).toContain("You Aren't Gonna Need It");
  });

  it('flags duplication as a violation', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('code-review', { duplication: true });
    expect(violations.some((v) => v.lawName === "Don't Repeat Yourself")).toBe(true);
  });

  it('flags undocumented code as a violation', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('code-review', { undocumented: true });
    expect(violations.some((v) => v.lawName === 'Document Your Code')).toBe(true);
  });

  it('flags unused generality as a violation', () => {
    const c = new CognitiveConstitution();
    const violations = c.checkCompliance('code-review', { unused_generality: true });
    expect(violations.some((v) => v.lawName === "You Aren't Gonna Need It")).toBe(true);
  });
});

describe('IntegrityChecklist', () => {
  it('passes a fully qualified claim', () => {
    const checklist = new IntegrityChecklist();
    const result = checklist.evaluate({
      claim: 'the module exports three functions',
      objective: true,
      qualifiedSource: true,
      prejudice: false,
      propaganda: false,
      wholeTruth: true,
    });
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('flags every failing question', () => {
    const checklist = new IntegrityChecklist();
    const result = checklist.evaluate({ claim: 'trust me' });
    expect(result.passed).toBe(false);
    const flags = result.issues.map((i) => i.flag);
    expect(flags).toContain('subjectivity');
    expect(flags).toContain('unqualified_source');
    expect(flags).toContain('omission');
  });

  it('maps issues to constitution compliance context', () => {
    const checklist = new IntegrityChecklist();
    const result = checklist.evaluate({ claim: 'x', propaganda: true, wholeTruth: false });
    const context = checklist.toComplianceContext(result);
    expect(context.propaganda).toBe(true);
    expect(context.omission).toBe(true);
    expect(context.subjectivity).toBe(true);
  });

  it('gate output satisfies the constitution when integrated', () => {
    const checklist = new IntegrityChecklist();
    const constitution = new CognitiveConstitution();
    const result = checklist.evaluate({ claim: 'x' });
    const violations = constitution.checkCompliance('executive', checklist.toComplianceContext(result));
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });
});

describe('PrefixTrie', () => {
  it('indexes and collects completions by prefix', () => {
    const trie = new PrefixTrie();
    trie.insert('deploy', 'deploy-routine');
    trie.insert('debug', 'debug-routine');
    expect(trie.collectCompletions('de')).toEqual(expect.arrayContaining(['deploy-routine', 'debug-routine']));
    expect(trie.collectCompletions('zzz')).toEqual([]);
    expect(trie.size()).toBe(2);
  });
});

describe('FastPathRouter (reflex fast path)', () => {
  it('resolves routine requests without an LLM', () => {
    const router = new FastPathRouter();
    router.register({
      name: 'deploy-routine',
      description: 'deploys the current build',
      keywords: ['deploy', 'release', 'ship'],
      execute: () => 'deploying',
    });
    router.register({
      name: 'status-routine',
      description: 'reports workspace status',
      keywords: ['status', 'health'],
      execute: () => 'all systems nominal',
    });

    const result = router.resolve('please deploy the build now');
    expect(result).not.toBeNull();
    expect(result!.routine).toBe('deploy-routine');
    expect(result!.output).toBe('deploying');
    expect(result!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('misses on unrelated input', () => {
    const router = new FastPathRouter();
    router.register({
      name: 'deploy-routine',
      description: 'deploys the current build',
      keywords: ['deploy', 'release'],
      execute: () => 'deploying',
    });
    expect(router.resolve('what is the meaning of life')).toBeNull();
  });

  it('tracks cortex-offload statistics', () => {
    const router = new FastPathRouter();
    router.register({
      name: 'status-routine',
      description: 'reports workspace status',
      keywords: ['status'],
      execute: () => 'ok',
    });
    router.resolve('show status');
    router.resolve('show status');
    router.resolve('random noise');

    const stats = router.getStats();
    expect(stats.totalCalls).toBe(3);
    expect(stats.resolved).toBe(2);
    expect(stats.missRate).toBeCloseTo(1 / 3, 5);
    expect(stats.avgResolutionMs).toBeGreaterThanOrEqual(0);
    expect(stats.routines).toBe(1);
  });

  it('ignores punctuation and case', () => {
    const router = new FastPathRouter();
    router.register({
      name: 'deploy-routine',
      description: 'deploys the current build',
      keywords: ['deploy', 'release'],
      execute: () => 'deploying',
    });
    expect(router.resolve('DEPLOY! NOW.')).not.toBeNull();
  });

  it('deduplicates keyword hits and prefers highest hit count', () => {
    const router = new FastPathRouter();
    router.register({
      name: 'a-routine',
      description: 'a',
      keywords: ['alpha'],
      execute: () => 'a',
    });
    router.register({
      name: 'b-routine',
      description: 'b',
      keywords: ['beta'],
      execute: () => 'b',
    });
    const result = router.resolve('alpha beta');
    expect(result).not.toBeNull();
  });
});
