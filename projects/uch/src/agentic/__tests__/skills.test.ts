import { describe, it, expect } from 'vitest';
import { parseFrontmatter, skillFromFile, loadSkillsDir, renderSkillPrompt, validateSkillArgs, createSkillRegistry, renderSkillCatalog, BUNDLED_SKILLS } from '../skills/skills.js';

describe('frontmatter parsing', () => {
  it('parses name/description/args', () => {
    const { frontmatter, body } = parseFrontmatter(
      `---\nname: test-skill\ndescription: A test skill\narguments: {"query":{"description":"Search query","required":true}}\n---\n\nDo the thing with {{query}}.`,
    );
    expect(frontmatter.name).toBe('test-skill');
    expect(frontmatter.description).toBe('A test skill');
    expect((frontmatter.arguments as { query: { required: boolean } }).query.required).toBe(true);
    expect(body).toContain('Do the thing');
  });

  it('handles files without frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('just body text');
    expect(frontmatter).toEqual({});
    expect(body).toBe('just body text');
  });

  it('converts to skill definitions', () => {
    const skill = skillFromFile('/skills/foo/SKILL.md', `---\nname: foo\ndescription: Does foo\n---\nDo foo.`);
    expect(skill).not.toBeNull();
    expect(skill?.name).toBe('foo');
    expect(skill?.filePath).toBe('/skills/foo/SKILL.md');
    expect(skill?.source).toBe('disk');
  });

  it('rejects skills missing metadata', () => {
    expect(skillFromFile('/x/SKILL.md', 'no frontmatter')).toBeNull();
    expect(skillFromFile('/x/SKILL.md', '---\nname: only-name\n---\nbody')).toBeNull();
  });
});

describe('skill execution', () => {
  it('substitutes arguments', () => {
    const skill = skillFromFile('/x/SKILL.md', '---\nname: s\ndescription: d\n---\nSearch for {{query}} in {{scope}}.')!;
    const prompt = renderSkillPrompt(skill, { query: 'foo', scope: 'src' });
    expect(prompt).toContain('Search for foo in src.');
  });

  it('validates required arguments', () => {
    const skill = skillFromFile(
      '/x/SKILL.md',
      '---\nname: s\ndescription: d\narguments: {"query":{"description":"q","required":true}}\n---\n{{query}}',
    )!;
    expect(validateSkillArgs(skill, {})).toContain('query');
    expect(validateSkillArgs(skill, { query: 'x' })).toBeNull();
  });
});

describe('disk loading', () => {
  it('loads skills from a directory', async () => {
    const skills = await loadSkillsDir('__nonexistent__');
    expect(skills).toEqual([]);
  });
});

describe('skill registry', () => {
  it('registers and finds skills', () => {
    const registry = createSkillRegistry(BUNDLED_SKILLS);
    const remember = registry.get('remember');
    expect(remember).toBeDefined();
    expect(registry.find('memory').length).toBeGreaterThan(0);
    expect(registry.find('nonexistent-skill-xyz')).toEqual([]);
  });

  it('sorts the catalog', () => {
    const names = registryNames();
    expect(names).toEqual([...names].sort());
  });

  it('skips disabled skills', () => {
    const registry = createSkillRegistry([
      { name: 'on', description: 'enabled', prompt: 'x' },
      { name: 'off', description: 'disabled', prompt: 'x', disabled: true },
    ]);
    expect(registry.list()).toHaveLength(1);
  });

  function registryNames(): string[] {
    return createSkillRegistry(BUNDLED_SKILLS).list().map((s) => s.name);
  }
});

describe('catalog rendering', () => {
  it('renders skill catalog with args', () => {
    const catalog = renderSkillCatalog([{ name: 'plan', description: 'Plan things', arguments: { task: { description: 'Task' } }, prompt: '' }]);
    expect(catalog).toContain('plan');
    expect(catalog).toContain('task');
  });
});
