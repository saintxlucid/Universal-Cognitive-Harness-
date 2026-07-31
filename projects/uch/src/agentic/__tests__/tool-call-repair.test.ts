import { describe, it, expect } from 'vitest';
import {
  repairToolCallArguments,
  parseJsonArgs,
  coerceValue,
  resolveEnumValue,
  deterministicToolCallId,
  deduplicateToolCalls,
  detectPathOverlap,
} from '../query/tool-call-repair.js';
import type { ToolCall } from '../types.js';
import type { Tool } from '../tools/types.js';

const numberSchema = {
  type: 'object' as const,
  properties: {
    maxResults: { type: 'number' as const },
    path: { type: 'string' as const },
    recursive: { type: 'boolean' as const },
    tags: { type: 'array' as const },
    filter: { type: 'object' as const },
    status: { type: 'string' as const, enum: ['pending', 'in_progress', 'completed'] },
    limit: { type: 'number' as const, default: 10 },
  },
};

describe('parseJsonArgs', () => {
  it('parses a JSON string into an object', () => {
    const { input, error } = parseJsonArgs('{"a": 1}');
    expect(error).toBeNull();
    expect(input).toEqual({ a: 1 });
  });

  it('passes objects through untouched', () => {
    const { input, error } = parseJsonArgs({ b: 2 });
    expect(error).toBeNull();
    expect(input).toEqual({ b: 2 });
  });

  it('reports malformed JSON', () => {
    const { error } = parseJsonArgs('{not json');
    expect(error).toContain('JSON');
  });

  it('rejects non-object JSON', () => {
    const { input, error } = parseJsonArgs('[1,2]');
    expect(error).toContain('object');
    expect(input).toEqual({});
  });

  it('treats empty string as empty object', () => {
    const { input, error } = parseJsonArgs('  ');
    expect(error).toBeNull();
    expect(input).toEqual({});
  });
});

describe('coerceValue', () => {
  it('coerces numeric strings to numbers', () => {
    const { value, coerced } = coerceValue('42', { type: 'number' });
    expect(coerced).toBe(true);
    expect(value).toBe(42);
  });

  it('coerces boolean strings', () => {
    expect(coerceValue('true', { type: 'boolean' }).value).toBe(true);
    expect(coerceValue('0', { type: 'boolean' }).value).toBe(false);
  });

  it('coerces numbers to strings', () => {
    const { value, coerced } = coerceValue(7, { type: 'string' });
    expect(coerced).toBe(true);
    expect(value).toBe('7');
  });

  it('parses JSON array strings', () => {
    const { value, coerced } = coerceValue('["a","b"]', { type: 'array' });
    expect(coerced).toBe(true);
    expect(value).toEqual(['a', 'b']);
  });

  it('parses JSON object strings', () => {
    const { value, coerced } = coerceValue('{"k": 1}', { type: 'object' });
    expect(coerced).toBe(true);
    expect(value).toEqual({ k: 1 });
  });

  it('leaves already-correct values untouched', () => {
    const { value, coerced } = coerceValue(5, { type: 'number' });
    expect(coerced).toBe(false);
    expect(value).toBe(5);
  });

  it('leaves non-coercible values untouched', () => {
    const { value, coerced } = coerceValue('abc', { type: 'number' });
    expect(coerced).toBe(false);
    expect(value).toBe('abc');
  });
});

describe('resolveEnumValue', () => {
  it('matches case-insensitively', () => {
    const { value, coerced } = resolveEnumValue('IN_PROGRESS', ['pending', 'in_progress', 'completed']);
    expect(coerced).toBe(true);
    expect(value).toBe('in_progress');
  });

  it('returns unchanged on exact match', () => {
    const { value, coerced } = resolveEnumValue('pending', ['pending', 'completed']);
    expect(coerced).toBe(false);
    expect(value).toBe('pending');
  });

  it('returns unchanged on no match', () => {
    const { value, coerced } = resolveEnumValue('nope', ['pending']);
    expect(coerced).toBe(false);
    expect(value).toBe('nope');
  });
});

describe('repairToolCallArguments', () => {
  it('coerces types and fills defaults, reporting repairs', () => {
    const result = repairToolCallArguments(
      '{"maxResults": "5", "path": 3, "recursive": "true"}',
      numberSchema,
      'search',
    );
    expect(result.jsonParseError).toBeNull();
    expect(result.input.maxResults).toBe(5);
    expect(result.input.path).toBe('3');
    expect(result.input.recursive).toBe(true);
    expect(result.input.limit).toBe(10);
    expect(result.repairs.length).toBeGreaterThanOrEqual(3);
    const filled = result.repairs.find((r) => r.field === 'limit');
    expect(filled?.reason).toContain('default');
  });

  it('matches enums case-insensitively during repair', () => {
    const result = repairToolCallArguments({ status: 'Completed' }, numberSchema, 'update');
    expect(result.input.status).toBe('completed');
    expect(result.repairs.some((r) => r.field === 'status')).toBe(true);
  });

  it('parses object input directly', () => {
    const result = repairToolCallArguments({ maxResults: 2 }, numberSchema, 'search');
    expect(result.jsonParseError).toBeNull();
    expect(result.input.maxResults).toBe(2);
  });
});

describe('deterministicToolCallId', () => {
  it('is stable across calls', () => {
    expect(deterministicToolCallId('read_file', 0)).toBe(deterministicToolCallId('read_file', 0));
  });

  it('differs by name and index', () => {
    expect(deterministicToolCallId('read_file', 0)).not.toBe(deterministicToolCallId('read_file', 1));
    expect(deterministicToolCallId('read_file', 0)).not.toBe(deterministicToolCallId('write_file', 0));
  });

  it('has a stable prefix', () => {
    expect(deterministicToolCallId('a', 1)).toMatch(/^toolu_[0-9a-f]{32}$/);
  });
});

describe('deduplicateToolCalls', () => {
  it('collapses identical name+input calls', () => {
    const calls: ToolCall[] = [
      { id: '1', name: 'read_file', input: { path: '/a' } },
      { id: '2', name: 'read_file', input: { path: '/a' } },
      { id: '3', name: 'read_file', input: { path: '/b' } },
    ];
    const { calls: kept, removed } = deduplicateToolCalls(calls);
    expect(kept).toHaveLength(2);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.call.id).toBe('2');
    expect(removed[0]?.duplicateOf.id).toBe('1');
  });

  it('ignores key order when comparing inputs', () => {
    const calls: ToolCall[] = [
      { id: '1', name: 't', input: { a: 1, b: 2 } },
      { id: '2', name: 't', input: { b: 2, a: 1 } },
    ];
    const { calls: kept } = deduplicateToolCalls(calls);
    expect(kept).toHaveLength(1);
  });

  it('keeps distinct calls', () => {
    const calls: ToolCall[] = [
      { id: '1', name: 'a', input: { x: 1 } },
      { id: '2', name: 'b', input: { x: 1 } },
    ];
    const { calls: kept, removed } = deduplicateToolCalls(calls);
    expect(kept).toHaveLength(2);
    expect(removed).toHaveLength(0);
  });
});

describe('detectPathOverlap', () => {
  const tools: Tool[] = [
    {
      name: 'edit_file',
      description: 'edit',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      call: async () => ({ data: '' }),
    },
    {
      name: 'read_file',
      description: 'read',
      isConcurrencySafe: () => true,
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      call: async () => ({ data: '' }),
    },
  ];

  it('flags parallel-unsafe same-path calls', () => {
    const calls: ToolCall[] = [
      { id: '1', name: 'edit_file', input: { path: '/src/a.ts' } },
      { id: '2', name: 'edit_file', input: { path: '/src/a.ts' } },
    ];
    const overlaps = detectPathOverlap(calls, tools);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]?.paths).toEqual(['/src/a.ts']);
  });

  it('ignores concurrency-safe tools', () => {
    const calls: ToolCall[] = [
      { id: '1', name: 'edit_file', input: { path: '/a.ts' } },
      { id: '2', name: 'read_file', input: { path: '/a.ts' } },
    ];
    const overlaps = detectPathOverlap(calls, tools);
    expect(overlaps).toHaveLength(0);
  });

  it('reports no overlap for different paths', () => {
    const calls: ToolCall[] = [
      { id: '1', name: 'edit_file', input: { path: '/a.ts' } },
      { id: '2', name: 'edit_file', input: { path: '/b.ts' } },
    ];
    const overlaps = detectPathOverlap(calls, tools);
    expect(overlaps).toHaveLength(0);
  });
});
