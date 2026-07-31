import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SkillCreator } from '../skill-creator.js';
import { SkillOptimizer } from '../skill-optimizer.js';
import { SkillRegistry } from '../../cognitive-memory/skill-registry.js';

describe('SkillCreator', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uch-skill-creator-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('builds a SKILL.md with frontmatter and default sections', () => {
    const creator = new SkillCreator();
    const content = creator.build({
      name: 'my-skill',
      description: 'Does my thing',
      version: '1.0.0',
      tags: ['a', 'b'],
    });
    expect(content).toContain('name: my-skill');
    expect(content).toContain('description: "Does my thing"');
    expect(content).toContain('version: 1.0.0');
    expect(content).toContain('tags: [a, b]');
    expect(content).toContain('## Overview');
    expect(content).toContain('## Checklist');
  });

  it('writes the skill to disk and it is parseable', async () => {
    const creator = new SkillCreator();
    const result = await creator.writeToDir(tmpDir, {
      name: 'my-skill',
      description: 'Does my thing',
    });
    expect(result.filePath).toContain('my-skill');
    const content = await fs.readFile(result.filePath, 'utf8');
    expect(content).toContain('name: my-skill');
  });
});

describe('SkillOptimizer', () => {
  it('flags low success rates with enough invocations', () => {
    const registry = new SkillRegistry();
    registry.register({
      id: 'broken-skill', name: 'broken-skill', description: 'd',
      trigger_patterns: ['broken'], location: '/x', enabled: true, version: '1.0.0', metadata: {},
    });
    const invocations = Array.from({ length: 5 }, (_, i) => ({
      skill_id: 'broken-skill',
      timestamp: new Date(),
      input: `input ${i}`,
      output: 'out',
      duration_ms: 500,
      success: i % 2 !== 0,
    }));
    const optimizer = new SkillOptimizer();
    const report = optimizer.analyze('broken-skill', invocations);
    expect(report.invocationsAnalyzed).toBe(5);
    expect(report.successRate).toBeCloseTo(0.4);
    expect(report.suggestions.some((s) => s.issue === 'low-success-rate')).toBe(true);
  });

  it('reports empty analysis for unknown skills', () => {
    const optimizer = new SkillOptimizer();
    const report = optimizer.analyze('never-used', []);
    expect(report.invocationsAnalyzed).toBe(0);
    expect(report.suggestions[0]?.issue).toBe('no-invocations');
  });

  it('analyzes across all skills', () => {
    const optimizer = new SkillOptimizer();
    const invocations = [
      { skill_id: 'a', timestamp: new Date(), input: 'x', output: 'y', duration_ms: 10, success: true },
      { skill_id: 'a', timestamp: new Date(), input: 'x', output: 'y', duration_ms: 10, success: true },
      { skill_id: 'b', timestamp: new Date(), input: 'x', output: 'y', duration_ms: 10, success: false },
    ];
    const reports = optimizer.analyzeAll(invocations);
    expect(reports.map((r) => r.skillId).sort()).toEqual(['a', 'b']);
  });
});
