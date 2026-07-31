import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assembleMiddleware, applyExcludedMiddleware, mergeMiddlewareStacks, collectMiddlewareTools, PROTECTED_MIDDLEWARE } from '../middleware/pipeline.js';
import { TodoListMiddleware } from '../middleware/todo-list.js';
import { FilesystemMiddleware } from '../middleware/filesystem.js';
import { SummarizationMiddleware } from '../middleware/summarization.js';
import { MemoryMiddleware, loadMemoryFile } from '../middleware/memory.js';
import { SkillsMiddleware, parseSkillFrontmatter, loadSkillFile } from '../middleware/skills.js';
import { StateBackend, createPermission } from '../backends/index.js';
import type { AgentMiddleware } from '../middleware/types.js';

function named(name: string): AgentMiddleware {
  return { name };
}

describe('middleware pipeline', () => {
  it('assembles base + user + tail in order', () => {
    const stack = assembleMiddleware({
      base: [named('Base')],
      user: [named('User')],
      tail: [named('Tail')],
    });
    expect(stack.map((m) => m.name)).toEqual(['Base', 'User', 'Tail']);
  });

  it('excludes by name with validation', () => {
    const stack = assembleMiddleware({
      base: [named('A'), named('B')],
      excluded: ['B'],
    });
    expect(stack.map((m) => m.name)).toEqual(['A']);
  });

  it('raises on unknown exclusion', () => {
    expect(() =>
      applyExcludedMiddleware([named('A')], ['Missing']),
    ).toThrow('not present in stack');
  });

  it('raises on protected middleware exclusion', () => {
    expect(() =>
      applyExcludedMiddleware([new FilesystemMiddleware(new StateBackend())], ['FilesystemMiddleware']),
    ).toThrow('protected');
  });

  it('raises on private (underscore) exclusion', () => {
    expect(() => applyExcludedMiddleware([named('A')], ['_internal'])).toThrow('private');
  });

  it('merges stacks deduplicating by name (extra wins)', () => {
    const merged = mergeMiddlewareStacks([named('A'), named('B')], [named('B'), named('C')]);
    expect(merged.map((m) => m.name)).toEqual(['A', 'B', 'C']);
  });

  it('collects tools from all middleware', () => {
    const stack = [
      new TodoListMiddleware(),
      new FilesystemMiddleware(new StateBackend()),
    ];
    const tools = collectMiddlewareTools(stack);
    const names = tools.map((t) => t.name);
    expect(names).toContain('write_todos');
    expect(names).toContain('read_file');
    expect(names).toContain('edit_file');
    expect(PROTECTED_MIDDLEWARE.has('FilesystemMiddleware')).toBe(true);
  });
});

describe('TodoListMiddleware', () => {
  it('adds and updates todos via tool', async () => {
    const middleware = new TodoListMiddleware();
    const tools = middleware.tools();
    const writeTodos = tools.find((t) => t.name === 'write_todos');
    expect(writeTodos).toBeDefined();
    await writeTodos!.call({ todos: [{ content: 'first task', status: 'pending', priority: 'high' }] }, {} as never);
    await writeTodos!.call({ todos: [{ content: 'first task', status: 'in_progress', priority: 'high' }] }, {} as never);
    const items = middleware.list();
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe('in_progress');
  });

  it('renders todos into the system prompt', async () => {
    const middleware = new TodoListMiddleware();
    const tools = middleware.tools();
    const writeTodos = tools.find((t) => t.name === 'write_todos');
    await writeTodos!.call({ todos: [{ content: 'ship it', status: 'pending', priority: 'high' }] }, {} as never);
    const prompt = await middleware.systemPrompt?.('base prompt', {} as never);
    expect(prompt).toContain('Current todo list');
    expect(prompt).toContain('ship it');
    expect(prompt).toContain('base prompt');
  });
});

describe('FilesystemMiddleware', () => {
  it('writes and reads through the backend', async () => {
    const backend = new StateBackend();
    const middleware = new FilesystemMiddleware(backend);
    const tools = Object.fromEntries(middleware.tools().map((t) => [t.name, t]));
    const write = await tools.write_file!.call({ path: '/note.txt', content: 'hello' }, {} as never);
    expect(write.data).toContain('Wrote');
    const read = await tools.read_file!.call({ path: '/note.txt' }, {} as never);
    expect(String(read.data)).toContain('hello');
  });

  it('enforces permission rules at the tool level', async () => {
    const backend = new StateBackend();
    const middleware = new FilesystemMiddleware(backend, [createPermission('/**/*.env', false)]);
    const tools = Object.fromEntries(middleware.tools().map((t) => [t.name, t]));
    const denied = await tools.write_file!.call({ path: '/secret.env', content: 'x' }, {} as never);
    expect(String(denied.data)).toContain('Permission denied');
    const allowed = await tools.write_file!.call({ path: '/src.ts', content: 'x' }, {} as never);
    expect(String(allowed.data)).toContain('Wrote');
  });
});

describe('SummarizationMiddleware', () => {
  it('compresses when over threshold', async () => {
    let summaries = 0;
    const middleware = new SummarizationMiddleware({
      maxContextTokens: 1000,
      thresholdRatio: 0.5,
      summarize: async (text) => {
        summaries++;
        return `SUM ${text.slice(0, 30)}`;
      },
    });
    const messages = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: [{ type: 'text' as const, text: 'x'.repeat(2000) }],
      timestamp: '',
    }));
    const context = { messages, systemPrompt: 'p', cwd: '/', toolContext: {} as never };
    const result = await middleware.beforeModelCall(context as never);
    expect(result).not.toBeNull();
    expect(summaries).toBeGreaterThan(0);
    expect(result!.messages.length).toBeLessThan(messages.length);
    expect(middleware.compressionTriggered).toBe(1);
  });

  it('no-ops under threshold', async () => {
    const middleware = new SummarizationMiddleware({
      maxContextTokens: 100000,
      summarize: async (t) => t,
    });
    const messages = [{ id: 'a', role: 'user', content: [{ type: 'text' as const, text: 'hi' }], timestamp: '' }];
    const result = await middleware.beforeModelCall({ messages, systemPrompt: 'p', cwd: '/', toolContext: {} as never } as never);
    expect(result).toBeNull();
  });
});

describe('MemoryMiddleware', () => {
  it('loads memory files and renders into prompt', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'uch-mem-'));
    try {
      await writeFile(path.join(dir, 'AGENTS.md'), '# Conventions\n- use vitest');
      const middleware = new MemoryMiddleware(['/AGENTS.md'], dir);
      const entries = await middleware.load();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.displayName).toBe('AGENTS.md');
      const prompt = await middleware.systemPrompt?.('base', {} as never);
      expect(prompt).toContain('Project Memory');
      expect(prompt).toContain('vitest');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects traversal paths', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'uch-mem-'));
    try {
      const entry = await loadMemoryFile('../../etc/hosts', dir);
      expect(entry).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('SkillsMiddleware', () => {
  it('parses SKILL.md frontmatter', () => {
    const parsed = parseSkillFrontmatter('---\nname: my-skill\ndescription: Does things\n---\n# Body\ncontent');
    expect(parsed?.name).toBe('my-skill');
    expect(parsed?.description).toBe('Does things');
    expect(parsed?.body).toContain('# Body');
  });

  it('parses files without frontmatter gracefully', () => {
    const parsed = parseSkillFrontmatter('just text');
    expect(parsed?.name).toBe('unnamed');
    expect(parsed?.body).toBe('just text');
  });

  it('loads skills with last-one-wins dedup', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'uch-skill-'));
    try {
      await writeFile(path.join(dir, 'a.md'), '---\nname: same\n---\nversion A');
      await writeFile(path.join(dir, 'b.md'), '---\nname: same\n---\nversion B');
      const middleware = new SkillsMiddleware(['/a.md', '/b.md'], dir);
      const loaded = await middleware.load();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.body).toContain('version B');
      const entry = await loadSkillFile('/a.md', dir);
      expect(entry?.name).toBe('same');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
