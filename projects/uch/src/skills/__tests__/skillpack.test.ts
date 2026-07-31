import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SkillPackScanner, SkillPackInstaller } from '../skillpack.js';
import { SkillRegistry } from '../../cognitive-memory/skill-registry.js';

const SAMPLE_SKILL = `---
name: sample-skill
description: A sample skill for testing
version: 1.2.0
metadata:
  tags: [test]
---

# Sample Skill

Body content.
`;

describe('SkillPackScanner', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uch-skillpack-'));
    await fs.mkdir(path.join(tmpDir, 'sample-skill'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'nested', 'deep-skill'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'sample-skill', 'SKILL.md'), SAMPLE_SKILL);
    await fs.writeFile(path.join(tmpDir, 'nested', 'deep-skill', 'SKILL.md'), '---\nname: deep-skill\ndescription: Nested skill\n---\nBody\n');
    await fs.writeFile(path.join(tmpDir, 'not-a-skill.md'), 'not a skill file');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('finds SKILL.md files recursively', async () => {
    const scanner = new SkillPackScanner();
    const summary = await scanner.scanDir(tmpDir);
    expect(summary.skillCount).toBe(2);
    expect(summary.skills).toContain('sample-skill');
    expect(summary.skills).toContain('deep-skill');
    expect(summary.packName).toBe(path.basename(tmpDir));
  });

  it('parses frontmatter metadata from extracted-format skills', async () => {
    const scanner = new SkillPackScanner();
    const summary = await scanner.scanDir(path.join(tmpDir, 'sample-skill'));
    expect(summary.skillCount).toBe(1);
    expect(summary.skills[0]).toBe('sample-skill');
  });

  it('skips directories without SKILL.md', async () => {
    await fs.mkdir(path.join(tmpDir, 'empty'));
    const scanner = new SkillPackScanner();
    const summary = await scanner.scanDir(tmpDir);
    expect(summary.skillCount).toBe(2);
    expect(summary.invalidFiles).toBe(0);
  });
});

describe('SkillPackInstaller', () => {
  let tmpDir: string;
  let registry: SkillRegistry;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uch-skillpack-install-'));
    await fs.mkdir(path.join(tmpDir, 'sample-skill'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'sample-skill', 'SKILL.md'), SAMPLE_SKILL);
    registry = new SkillRegistry();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('installs scanned skills into the registry', async () => {
    const installer = new SkillPackInstaller(registry);
    const result = await installer.installFromDir(tmpDir, { sourcePrefix: 'external-repo' });
    expect(result.installed).toContain('sample-skill');
    expect(registry.getById('sample-skill')).toBeDefined();
    expect(registry.getById('sample-skill')?.metadata.source).toBe('external-repo/sample-skill');
  });

  it('skips already-installed skills', async () => {
    const installer = new SkillPackInstaller(registry);
    await installer.installFromDir(tmpDir);
    const second = await installer.installFromDir(tmpDir);
    expect(second.installed).toHaveLength(0);
    expect(second.skipped).toContain('sample-skill');
  });
});
