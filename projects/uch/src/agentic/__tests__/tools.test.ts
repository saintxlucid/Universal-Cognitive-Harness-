import { describe, it, expect } from 'vitest';
import { buildTool, validateInputAgainstSchema, toolResultToBlock, findToolByName, toolMatchesName } from '../tools/types.js';
import { getAllBaseTools, getTools, assembleToolPool, filterToolsByDenyRules, registerTool, buildSimpleModePool } from '../tools/registry.js';
import { BashTool, FileReadTool, FileEditTool, isReadOnlyCommand, isDestructiveCommand } from '../tools/implementations.js';

describe('buildTool', () => {
  it('fills fail-closed defaults', () => {
    const tool = buildTool({
      name: 'Test',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: {} },
      call: async () => ({ data: 'ok' }),
    });
    expect(tool.isEnabled?.()).toBe(true);
    expect(tool.isConcurrencySafe?.({} as never)).toBe(false);
    expect(tool.isReadOnly?.({} as never)).toBe(false);
    expect(tool.isDestructive?.({} as never)).toBe(false);
    expect(tool.requiresUserInteraction?.()).toBe(false);
    expect(tool.maxResultSizeChars).toBe(50000);
    expect(tool.aliases).toEqual([]);
  });

  it('keeps explicit overrides', () => {
    const tool = buildTool({
      name: 'Read2',
      description: 'read-only',
      inputSchema: { type: 'object', properties: {} },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      maxResultSizeChars: Infinity,
      call: async () => ({ data: 'x' }),
    });
    expect(tool.isReadOnly?.({} as never)).toBe(true);
    expect(tool.isConcurrencySafe?.({} as never)).toBe(true);
    expect(tool.maxResultSizeChars).toBe(Infinity);
  });
});

describe('schema validation', () => {
  const schema = {
    type: 'object' as const,
    properties: {
      command: { type: 'string' as const },
      timeout: { type: 'number' as const },
      dry_run: { type: 'boolean' as const },
      tags: { type: 'array' as const },
      level: { type: 'string' as const, enum: ['low', 'high'] },
    },
    required: ['command'],
  };

  it('rejects missing required fields', () => {
    expect(validateInputAgainstSchema({}, schema)).toContain('command');
  });

  it('rejects wrong types', () => {
    expect(validateInputAgainstSchema({ command: 42 }, schema)).toContain('command');
    expect(validateInputAgainstSchema({ command: 'ls', timeout: 'fast' }, schema)).toContain('timeout');
  });

  it('rejects invalid enum values', () => {
    expect(validateInputAgainstSchema({ command: 'ls', level: 'extreme' }, schema)).toContain('level');
  });

  it('accepts valid input', () => {
    expect(validateInputAgainstSchema({ command: 'ls', timeout: 10, dry_run: true, tags: ['a'], level: 'low' }, schema)).toBeNull();
  });
});

describe('tool result blocks', () => {
  it('maps string data', () => {
    const block = toolResultToBlock('id1', 'Bash', { data: 'hello' });
    expect(block).toEqual({ type: 'tool_result', toolUseId: 'id1', content: 'hello', isError: false });
  });

  it('maps empty data to no-output marker', () => {
    const block = toolResultToBlock('id2', 'Glob', { data: undefined });
    expect(block.content).toContain('Glob completed with no output');
  });

  it('serializes objects', () => {
    const block = toolResultToBlock('id3', 'Memory', { data: { facts: 3 } });
    expect(block.content).toBe('{"facts":3}');
  });

  it('marks errors', () => {
    const block = toolResultToBlock('id4', 'Bash', { data: 'boom', isError: true });
    expect(block.isError).toBe(true);
  });
});

describe('registry', () => {
  it('exposes the base tool set', () => {
    const tools = getAllBaseTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('Bash');
    expect(names).toContain('Read');
    expect(names).toContain('Edit');
    expect(names).toContain('Write');
    expect(names).toContain('Glob');
    expect(names).toContain('Grep');
    expect(names).toContain('WebFetch');
    expect(names).toContain('Memory');
    expect(names).toContain('TodoWrite');
    expect(names).toContain('AskUserQuestion');
    expect(names).toContain('Sleep');
    expect(names).toContain('Subagent');
  });

  it('filters by visibility', () => {
    const core = getTools('core');
    expect(core.map((t) => t.name)).toEqual(expect.arrayContaining(['Bash', 'Read']));
    expect(core.length).toBeLessThan(getTools('all').length);
  });

  it('reasoning visibility excludes execution tools', () => {
    const reasoning = getTools('reasoning');
    const names = reasoning.map((t) => t.name);
    expect(names).not.toContain('Bash');
    expect(names).not.toContain('Edit');
    expect(names).not.toContain('Write');
    expect(names).toContain('Read');
    expect(names).toContain('Grep');
    expect(names).toContain('Memory');
  });

  it('assembles a deduplicated sorted pool', () => {
    const pool = assembleToolPool(getAllBaseTools(), [BashTool]);
    const names = pool.map((t) => t.name);
    expect(names.filter((n) => n === 'Bash').length).toBe(1);
    expect(names).toEqual([...names].sort());
  });

  it('filters deny rules before the model sees tools', () => {
    const filtered = filterToolsByDenyRules(getAllBaseTools(), ['Bash', 'Grep']);
    expect(filtered.find((t) => t.name === 'Bash')).toBeUndefined();
    expect(filtered.find((t) => t.name === 'Grep')).toBeUndefined();
    expect(filtered.find((t) => t.name === 'Read')).toBeDefined();
  });

  it('registers and replaces tools', () => {
    const base = getTools('all');
    const updated = registerTool(base, BashTool);
    expect(updated.filter((t) => t.name === 'Bash').length).toBe(1);
  });

  it('builds simple mode pool', () => {
    const simple = buildSimpleModePool();
    const names = simple.map((t) => t.name);
    expect(names).toContain('Bash');
    expect(names).toContain('Write');
    expect(names).not.toContain('WebFetch');
  });

  it('finds tools by name and alias', () => {
    const tools = getAllBaseTools();
    expect(findToolByName(tools, 'Bash')).toBeDefined();
    expect(findToolByName(tools, 'Shell')).toBe(BashTool);
    expect(findToolByName(tools, 'Nope')).toBeUndefined();
    expect(toolMatchesName(FileReadTool, 'FileRead')).toBe(true);
    expect(toolMatchesName(FileEditTool, 'Edit')).toBe(true);
  });
});

describe('command classification', () => {
  it('classifies read-only commands', () => {
    expect(isReadOnlyCommand('ls -la')).toBe(true);
    expect(isReadOnlyCommand('git status')).toBe(true);
    expect(isReadOnlyCommand('cat file.txt')).toBe(true);
    expect(isReadOnlyCommand('grep foo *.ts')).toBe(true);
    expect(isReadOnlyCommand('Get-Content x.txt')).toBe(true);
    expect(isReadOnlyCommand('npm install lodash')).toBe(false);
    expect(isReadOnlyCommand('git push')).toBe(false);
  });

  it('classifies destructive commands', () => {
    expect(isDestructiveCommand('rm -rf build')).toBe(true);
    expect(isDestructiveCommand('Remove-Item -Recurse out')).toBe(true);
    expect(isDestructiveCommand('git reset --hard')).toBe(true);
    expect(isDestructiveCommand('git commit -m "x"')).toBe(false);
    expect(isDestructiveCommand('ls')).toBe(false);
  });

  it('derives concurrency safety from command classification', () => {
    expect(BashTool.isConcurrencySafe?.({ command: 'grep x .' } as never)).toBe(true);
    expect(BashTool.isConcurrencySafe?.({ command: 'npm install' } as never)).toBe(false);
    expect(BashTool.isReadOnly?.({ command: 'cat a' } as never)).toBe(true);
    expect(BashTool.isDestructive?.({ command: 'rm -rf x' } as never)).toBe(true);
  });
});

describe('file tools', () => {
  it('Read rejects missing files', async () => {
    const result = await FileReadTool.call(
      { file_path: '/nonexistent/definitely-missing.txt' },
      { cwd: process.cwd(), abortController: new AbortController(), getSessionId: () => 't' },
    );
    expect(result.isError).toBe(true);
  });

  it('Edit rejects absent old_string', async () => {
    const result = await FileEditTool.call(
      { file_path: 'package.json', old_string: 'zzz-this-does-not-exist-zzz', new_string: 'x' },
      { cwd: process.cwd(), abortController: new AbortController(), getSessionId: () => 't' },
    );
    expect(result.isError).toBe(true);
    expect(String(result.data)).toContain('old_string not found');
  });
});
